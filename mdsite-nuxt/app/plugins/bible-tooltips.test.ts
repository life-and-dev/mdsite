import { describe, it, expect } from 'vitest'
import { createBibleReferencePatterns } from '../utils/bible-book-names'

/**
 * Unit tests for Bible reference parsing regex patterns
 */
describe('Bible Reference Parsing', () => {
  const patterns = createBibleReferencePatterns()

  function findAllMatches(text: string): string[] {
    const matches: Array<{index: number, length: number, text: string}> = []

    // First, find all explicit book references
    patterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(text)) !== null) {
        const matchStart = match.index
        const matchText = match[0]
        const matchEnd = matchStart + matchText.length

        // Check if this match overlaps with any existing match
        const overlaps = matches.some(m =>
          (matchStart >= m.index && matchStart < m.index + m.length) ||
          (matchEnd > m.index && matchEnd <= m.index + m.length) ||
          (matchStart <= m.index && matchEnd >= m.index + m.length)
        )

        if (!overlaps) {
          matches.push({
            index: matchStart,
            length: matchText.length,
            text: matchText
          })
        }
      }
      pattern.lastIndex = 0 // Reset regex
    })

    // Sort matches by index
    matches.sort((a, b) => a.index - b.index)

    // Now expand shorthand notation (e.g., "John 14:16,26" or "Revelation 1:5, 17:14")
    const expanded: Array<{index: number, length: number, text: string}> = []

    matches.forEach(match => {
      const fullText = match.text

      // Check if followed by comma-separated shorthand (e.g., ",26" or ", 17:14")
      const afterMatch = text.substring(match.index + match.length)
      const shorthandPattern = /^(?:,\s*(\d+(?::\d+)?(?:-\d+(?::\d+)?)?))*/
      const shorthandMatch = afterMatch.match(shorthandPattern)

      if (shorthandMatch && shorthandMatch[0].length > 0) {
        // Extract book name and chapter from the original match
        const refMatch = fullText.match(/^(.+?)\s+(\d+):(\d+)/)
        if (refMatch) {
          const book = refMatch[1]
          const chapter = refMatch[2]

          // Add the original match
          expanded.push(match)

          // Parse shorthand references
          const shorthands = shorthandMatch[0].split(',').filter(s => s.trim())
          let currentIndex = match.index + match.length

          shorthands.forEach(shorthand => {
            const trimmed = shorthand.trim()
            if (trimmed) {
              let expandedRef = ''
              if (trimmed.includes(':')) {
                // Chapter:verse format (e.g., "17:14")
                expandedRef = `${book} ${trimmed}`
              } else {
                // Just verse number (e.g., "26")
                expandedRef = `${book} ${chapter}:${trimmed}`
              }

              // Find the actual position of this shorthand in text
              const shorthandIndex = text.indexOf(shorthand, currentIndex)
              if (shorthandIndex !== -1) {
                expanded.push({
                  index: shorthandIndex,
                  length: shorthand.length,
                  text: expandedRef
                })
                currentIndex = shorthandIndex + shorthand.length
              }
            }
          })
        } else {
          // Not a chapter:verse pattern, just add original
          expanded.push(match)
        }
      } else {
        // No shorthand, just add original
        expanded.push(match)
      }
    })

    // Sort by index and return text only
    expanded.sort((a, b) => a.index - b.index)
    return expanded.map(m => m.text)
  }

  it('should parse single verse references', () => {
    const text = 'Read John 3:16 for God\'s love.'
    const matches = findAllMatches(text)
    expect(matches).toEqual(['John 3:16'])
  })

  it('should parse shorthand comma-separated verses in same chapter', () => {
    const text = 'See John 14:16,26 for the Helper.'
    const matches = findAllMatches(text)
    expect(matches).toEqual(['John 14:16', 'John 14:26'])
  })

  it('should parse shorthand comma-separated verses with different chapters', () => {
    const text = 'Read Revelation 1:5, 17:14, 19:16 about Jesus.'
    const matches = findAllMatches(text)
    expect(matches).toEqual(['Revelation 1:5', 'Revelation 17:14', 'Revelation 19:16'])
  })

  it('should parse full references with commas', () => {
    const text = 'See Matthew 10:28-33, Matthew 25:31-46 for judgment.'
    const matches = findAllMatches(text)
    expect(matches).toEqual(['Matthew 10:28-33', 'Matthew 25:31-46'])
  })

  it('should parse cross-chapter ranges', () => {
    const text = 'Read 2 Corinthians 4:16-5:9 for encouragement.'
    const matches = findAllMatches(text)
    expect(matches).toEqual(['2 Corinthians 4:16-5:9'])
  })

  it('should parse same-chapter ranges', () => {
    const text = 'John 3:16-18 is about salvation.'
    const matches = findAllMatches(text)
    expect(matches).toEqual(['John 3:16-18'])
  })

  it('should parse chapter-only references', () => {
    const text = 'Psalm 23 is for comfort.'
    const matches = findAllMatches(text)
    expect(matches).toEqual(['Psalm 23'])
  })

  it('should parse multiple different reference types', () => {
    const text = 'Genesis 1:1, Psalm 23, John 3:16-18, and 2 Corinthians 4:16-5:9.'
    const matches = findAllMatches(text)
    expect(matches).toEqual([
      'Genesis 1:1',
      'Psalm 23',
      'John 3:16-18',
      '2 Corinthians 4:16-5:9'
    ])
  })

  it('should not create overlapping matches', () => {
    const text = 'Read (Ecclesiastes 1:2-4) for vanity.'
    const matches = findAllMatches(text)
    expect(matches).toEqual(['Ecclesiastes 1:2-4'])
  })

  it('should parse references with book names containing numbers', () => {
    const text = 'Read 1 Corinthians 13:4-8 and 2 Timothy 3:16.'
    const matches = findAllMatches(text)
    expect(matches).toEqual(['1 Corinthians 13:4-8', '2 Timothy 3:16'])
  })

  it('should parse references in parentheses', () => {
    const text = 'Our life is short (Ecclesiastes 1:2-4) compared to eternity.'
    const matches = findAllMatches(text)
    expect(matches).toEqual(['Ecclesiastes 1:2-4'])
  })

  it('should handle shorthand ranges in same chapter', () => {
    const text = 'See Matthew 9:18-19,23-26 for miracles.'
    const matches = findAllMatches(text)
    expect(matches).toEqual(['Matthew 9:18-19', 'Matthew 9:23-26'])
  })

  it('should correctly identify match indices in parentheses', () => {
    const text = 'Our life is short (Ecclesiastes 1:2-4) compared to eternity.'
    const matches: Array<{index: number, length: number, text: string}> = []

    patterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(text)) !== null) {
        matches.push({
          index: match.index,
          length: match[0].length,
          text: match[0]
        })
      }
      pattern.lastIndex = 0
    })

    expect(matches.length).toBe(1)
    expect(matches[0]).toEqual({
      index: 19,
      length: 18,
      text: 'Ecclesiastes 1:2-4'
    })

    // Verify reconstruction works
    const match = matches[0]
    if (match) {
      const before = text.substring(0, match.index)
      const after = text.substring(match.index + match.length)
      const reconstructed = before + '[MATCH]' + after

      expect(reconstructed).toBe('Our life is short ([MATCH]) compared to eternity.')
    }
  })

  it('should correctly replace text in parentheses without losing brackets', () => {
    const text = 'Our life is short (Ecclesiastes 1:2-4) compared to eternity.'

    // Simulate the replacement logic from the plugin
    const matches: Array<{index: number, length: number, text: string, displayText: string}> = []

    patterns.forEach(pattern => {
      let match: RegExpExecArray | null
      while ((match = pattern.exec(text)) !== null) {
        const matchIndex = match.index
        const matchLength = match[0].length
        const matchText = match[0]

        const overlaps = matches.some(m =>
          (matchIndex >= m.index && matchIndex < m.index + m.length) ||
          (matchIndex + matchLength > m.index && matchIndex + matchLength <= m.index + m.length)
        )

        if (!overlaps) {
          matches.push({
            index: matchIndex,
            length: matchLength,
            text: matchText,
            displayText: matchText
          })
        }
      }
      pattern.lastIndex = 0
    })

    // Sort in reverse order for replacement
    matches.sort((a, b) => b.index - a.index)

    // Replace from end to start
    let newHTML = text
    matches.forEach(match => {
      const replacement = `<span class="bible-ref">${match.displayText}</span>`
      newHTML = newHTML.substring(0, match.index) + replacement + newHTML.substring(match.index + match.length)
    })

    expect(newHTML).toBe('Our life is short (<span class="bible-ref">Ecclesiastes 1:2-4</span>) compared to eternity.')
  })

  it('should parse verse ranges followed by colon (list formatting)', () => {
    const text = '3. Isaiah 53:3-12: "Pierced for our transgressions"'
    const matches = findAllMatches(text)
    expect(matches).toEqual(['Isaiah 53:3-12'])
  })

  it('should parse verse ranges followed by period', () => {
    const text = 'Read Isaiah 53:3-12.'
    const matches = findAllMatches(text)
    expect(matches).toEqual(['Isaiah 53:3-12'])
  })

  it('should parse single verses followed by colon', () => {
    const text = 'John 3:16: For God so loved the world'
    const matches = findAllMatches(text)
    expect(matches).toEqual(['John 3:16'])
  })

  it('should NOT match partial cross-chapter references', () => {
    // Pattern 2 should NOT match "53:3-5" if it's actually "53:3-5:2"
    const text = 'Isaiah 53:3-5:2 discusses suffering'
    const matches = findAllMatches(text)
    expect(matches).toEqual(['Isaiah 53:3-5:2']) // Should match Pattern 1, not Pattern 2
  })
})
