/**
 * Search relevance scoring system
 *
 * Calculates relevance scores for search results based on:
 * - Field weights (title > keywords > description > excerpt)
 * - Match quality (exact > startsWith > contains)
 * - Position bonus (matches at start of field)
 * - Path depth penalty (prefer top-level pages)
 * - Multi-field match bonus
 */

// Field weight constants
export const FIELD_WEIGHTS = {
  title: 10,
  keywords: 7,
  description: 3,
  excerpt: 1,
} as const

// Match quality multipliers
export const MATCH_QUALITY = {
  exact: 3,
  startsWith: 2,
  contains: 1,
} as const

// Scoring bonuses/penalties
const POSITION_BONUS = 2  // Bonus for match at start of field
const MULTI_FIELD_BONUS = 3  // Bonus when query matches multiple fields
const DEPTH_PENALTIES = {
  root: 0,      // /page
  shallow: -1,  // /church/history (1-2 levels)
  deep: -2,     // /church/history/subsection (3+ levels)
} as const

export interface SearchableFields {
  title?: string
  description?: string
  excerpt?: string
  keywords?: string[]
  path?: string
}

export interface FieldMatchResult {
  field: keyof typeof FIELD_WEIGHTS
  score: number
  matchType: keyof typeof MATCH_QUALITY
}

/**
 * Determine match quality for a field value
 */
function getMatchQuality(fieldValue: string, query: string): keyof typeof MATCH_QUALITY | null {
  const fieldLower = fieldValue.toLowerCase()
  const queryLower = query.toLowerCase()

  if (fieldLower === queryLower) {
    return 'exact'
  }
  if (fieldLower.startsWith(queryLower)) {
    return 'startsWith'
  }
  if (fieldLower.includes(queryLower)) {
    return 'contains'
  }

  return null
}

/**
 * Calculate score for a single field match
 */
function calculateFieldScore(
  fieldValue: string,
  query: string,
  fieldName: keyof typeof FIELD_WEIGHTS
): number {
  const matchType = getMatchQuality(fieldValue, query)
  if (!matchType) return 0

  const baseWeight = FIELD_WEIGHTS[fieldName]
  const qualityMultiplier = MATCH_QUALITY[matchType]

  // Calculate base score with quality multiplier
  let score = baseWeight * qualityMultiplier

  // Add position bonus if match is at start
  const fieldLower = fieldValue.toLowerCase()
  const queryLower = query.toLowerCase()
  if (fieldLower.startsWith(queryLower)) {
    score += POSITION_BONUS
  }

  return score
}

/**
 * Calculate depth penalty based on path structure
 */
function calculateDepthPenalty(path: string): number {
  const segments = path.split('/').filter(Boolean)
  const depth = segments.length

  if (depth <= 1) return DEPTH_PENALTIES.root
  if (depth <= 2) return DEPTH_PENALTIES.shallow
  return DEPTH_PENALTIES.deep
}

/**
 * Calculate relevance score for a page
 */
export function calculateRelevanceScore(page: SearchableFields, query: string): number {
  const queryLower = query.toLowerCase()
  const matches: FieldMatchResult[] = []
  let totalScore = 0

  // Score title match
  if (page.title) {
    const score = calculateFieldScore(page.title, query, 'title')
    if (score > 0) {
      matches.push({ field: 'title', score, matchType: getMatchQuality(page.title, query)! })
      totalScore += score
    }
  }

  // Score description match
  if (page.description) {
    const score = calculateFieldScore(page.description, query, 'description')
    if (score > 0) {
      matches.push({ field: 'description', score, matchType: getMatchQuality(page.description, query)! })
      totalScore += score
    }
  }

  // Score excerpt match
  if (page.excerpt) {
    const score = calculateFieldScore(page.excerpt, query, 'excerpt')
    if (score > 0) {
      matches.push({ field: 'excerpt', score, matchType: getMatchQuality(page.excerpt, query)! })
      totalScore += score
    }
  }

  // Score keywords match (take highest scoring keyword)
  if (page.keywords && page.keywords.length > 0) {
    let maxKeywordScore = 0
    for (const keyword of page.keywords) {
      const score = calculateFieldScore(keyword, query, 'keywords')
      if (score > maxKeywordScore) {
        maxKeywordScore = score
      }
    }
    if (maxKeywordScore > 0) {
      matches.push({ field: 'keywords', score: maxKeywordScore, matchType: 'contains' })
      totalScore += maxKeywordScore
    }
  }

  // Add multi-field bonus if query matches in 2+ fields
  if (matches.length >= 2) {
    totalScore += MULTI_FIELD_BONUS
  }

  // Apply depth penalty
  if (page.path) {
    totalScore += calculateDepthPenalty(page.path)
  }

  return Math.max(0, totalScore)  // Ensure non-negative
}

/**
 * Sort search results by relevance score
 */
export function sortByRelevance<T extends SearchableFields>(
  results: T[],
  query: string,
  getTitleFn: (item: T) => string = (item) => item.title || ''
): T[] {
  // Calculate scores for all results
  const scored = results.map(item => ({
    item,
    score: calculateRelevanceScore(item, query),
  }))

  // Sort by score (descending), then alphabetically by title
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }
    return getTitleFn(a.item).localeCompare(getTitleFn(b.item))
  })

  return scored.map(s => s.item)
}

/**
 * Composable for search relevance scoring
 */
export function useSearchRelevance() {
  return {
    calculateRelevanceScore,
    sortByRelevance,
    FIELD_WEIGHTS,
    MATCH_QUALITY,
  }
}
