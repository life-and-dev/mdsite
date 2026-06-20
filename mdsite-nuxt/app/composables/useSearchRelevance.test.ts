/**
 * Unit tests for search relevance scoring
 */

import { describe, it, expect } from 'vitest'
import { calculateRelevanceScore, sortByRelevance, FIELD_WEIGHTS, MATCH_QUALITY } from './useSearchRelevance'
import type { SearchableFields } from './useSearchRelevance'

describe('useSearchRelevance', () => {
  describe('calculateRelevanceScore', () => {
    it('should score title matches higher than description matches', () => {
      const titleMatch: SearchableFields = {
        title: 'Church',
        description: 'About the kingdom',
        path: '/church',
      }

      const descriptionMatch: SearchableFields = {
        title: 'Kingdom',
        description: 'About the church',
        path: '/kingdom',
      }

      const titleScore = calculateRelevanceScore(titleMatch, 'church')
      const descScore = calculateRelevanceScore(descriptionMatch, 'church')

      expect(titleScore).toBeGreaterThan(descScore)
    })

    it('should score exact matches higher than partial matches', () => {
      const exactMatch: SearchableFields = {
        title: 'Church',
        path: '/church',
      }

      const partialMatch: SearchableFields = {
        title: 'Church History',
        path: '/church-history',
      }

      const exactScore = calculateRelevanceScore(exactMatch, 'church')
      const partialScore = calculateRelevanceScore(partialMatch, 'church')

      expect(exactScore).toBeGreaterThan(partialScore)
    })

    it('should score startsWith matches higher than contains matches', () => {
      const startsWithMatch: SearchableFields = {
        title: 'Dark Ages',
        path: '/dark-ages',
      }

      const containsMatch: SearchableFields = {
        title: 'The Dark Period',
        path: '/dark-period',
      }

      const startsScore = calculateRelevanceScore(startsWithMatch, 'dark')
      const containsScore = calculateRelevanceScore(containsMatch, 'dark')

      expect(startsScore).toBeGreaterThan(containsScore)
    })

    it('should score keyword matches appropriately', () => {
      const keywordMatch: SearchableFields = {
        title: 'History',
        keywords: ['Constantine', 'Rome', 'Empire'],
        path: '/history',
      }

      const score = calculateRelevanceScore(keywordMatch, 'constantine')
      expect(score).toBeGreaterThan(0)
      expect(score).toBeLessThan(FIELD_WEIGHTS.title * MATCH_QUALITY.exact)
    })

    it('should add bonus for multi-field matches', () => {
      const singleFieldMatch: SearchableFields = {
        title: 'Church',
        description: 'About the kingdom',
        path: '/church',
      }

      const multiFieldMatch: SearchableFields = {
        title: 'Church',
        description: 'About the church',
        path: '/church',
      }

      const singleScore = calculateRelevanceScore(singleFieldMatch, 'church')
      const multiScore = calculateRelevanceScore(multiFieldMatch, 'church')

      expect(multiScore).toBeGreaterThan(singleScore)
    })

    it('should penalize deep paths', () => {
      const shallowPage: SearchableFields = {
        title: 'Church',
        path: '/church',
      }

      const deepPage: SearchableFields = {
        title: 'Church',
        path: '/kingdom/church/history/constantine',
      }

      const shallowScore = calculateRelevanceScore(shallowPage, 'church')
      const deepScore = calculateRelevanceScore(deepPage, 'church')

      expect(shallowScore).toBeGreaterThan(deepScore)
    })

    it('should handle case-insensitive matching', () => {
      const page: SearchableFields = {
        title: 'CHURCH',
        path: '/church',
      }

      const lowerScore = calculateRelevanceScore(page, 'church')
      const upperScore = calculateRelevanceScore(page, 'CHURCH')
      const mixedScore = calculateRelevanceScore(page, 'ChUrCh')

      expect(lowerScore).toEqual(upperScore)
      expect(upperScore).toEqual(mixedScore)
    })

    it('should return 0 for non-matching pages', () => {
      const page: SearchableFields = {
        title: 'Kingdom',
        description: 'About the kingdom',
        path: '/kingdom',
      }

      const score = calculateRelevanceScore(page, 'church')
      expect(score).toEqual(0)
    })

    it('should handle pages with missing fields', () => {
      const minimalPage: SearchableFields = {
        title: 'Church',
      }

      const score = calculateRelevanceScore(minimalPage, 'church')
      expect(score).toBeGreaterThan(0)
    })

    it('should score excerpt matches lowest', () => {
      const excerptMatch: SearchableFields = {
        title: 'Kingdom',
        excerpt: 'church',
        path: '/kingdom',
      }

      const titleMatch: SearchableFields = {
        title: 'Church',
        path: '/church',
      }

      const excerptScore = calculateRelevanceScore(excerptMatch, 'church')
      const titleScore = calculateRelevanceScore(titleMatch, 'church')

      expect(titleScore).toBeGreaterThan(excerptScore)
    })
  })

  describe('sortByRelevance', () => {
    it('should sort results by score descending', () => {
      const pages: SearchableFields[] = [
        { title: 'History of the Church', path: '/history' },
        { title: 'Church', path: '/church' },
        { title: 'Kingdom', description: 'About the church', path: '/kingdom' },
      ]

      const sorted = sortByRelevance(pages, 'church')

      expect(sorted.length).toBe(3)
      // Exact title match should be first
      expect(sorted[0]?.title).toBe('Church')
      // Title startsWith match should be second
      expect(sorted[1]?.title).toBe('History of the Church')
      // Description match should be last
      expect(sorted[2]?.title).toBe('Kingdom')
    })

    it('should use alphabetical tie-breaking', () => {
      const pages: SearchableFields[] = [
        { title: 'Zebra Church', path: '/zebra' },
        { title: 'Alpha Church', path: '/alpha' },
        { title: 'Beta Church', path: '/beta' },
      ]

      const sorted = sortByRelevance(pages, 'church')

      expect(sorted.length).toBe(3)
      // All have same score, should be alphabetical
      expect(sorted[0]?.title).toBe('Alpha Church')
      expect(sorted[1]?.title).toBe('Beta Church')
      expect(sorted[2]?.title).toBe('Zebra Church')
    })

    it('should handle empty results', () => {
      const pages: SearchableFields[] = []
      const sorted = sortByRelevance(pages, 'church')
      expect(sorted).toEqual([])
    })

    it('should handle custom title getter', () => {
      interface CustomPage extends SearchableFields {
        customTitle: string
      }

      const pages: CustomPage[] = [
        { customTitle: 'Zebra', title: 'A', path: '/zebra' },
        { customTitle: 'Alpha', title: 'Z', path: '/alpha' },
      ]

      const sorted = sortByRelevance(
        pages,
        'page',
        (page) => (page as CustomPage).customTitle
      )

      expect(sorted.length).toBe(2)
      // Should use customTitle for alphabetical sorting
      expect(sorted[0]?.customTitle).toBe('Alpha')
      expect(sorted[1]?.customTitle).toBe('Zebra')
    })

    it('should prioritize relevance over alphabetical order', () => {
      const pages: SearchableFields[] = [
        { title: 'Zebra Church Article', path: '/zebra' },
        { title: 'Church', path: '/church' },
      ]

      const sorted = sortByRelevance(pages, 'church')

      expect(sorted.length).toBe(2)
      // Exact match should win despite being alphabetically later
      expect(sorted[0]?.title).toBe('Church')
      expect(sorted[1]?.title).toBe('Zebra Church Article')
    })
  })

  describe('field weight constants', () => {
    it('should have correct field weight hierarchy', () => {
      expect(FIELD_WEIGHTS.title).toBeGreaterThan(FIELD_WEIGHTS.keywords)
      expect(FIELD_WEIGHTS.keywords).toBeGreaterThan(FIELD_WEIGHTS.description)
      expect(FIELD_WEIGHTS.description).toBeGreaterThan(FIELD_WEIGHTS.excerpt)
    })

    it('should have correct match quality multipliers', () => {
      expect(MATCH_QUALITY.exact).toBeGreaterThan(MATCH_QUALITY.startsWith)
      expect(MATCH_QUALITY.startsWith).toBeGreaterThan(MATCH_QUALITY.contains)
    })
  })
})
