/**
 * Shared utility functions for Bible verse handling with Bolls.life API
 */

/**
 * Bolls.life API response format for single verse
 */
interface BollsVerseResponse {
  pk: number
  verse: number
  text: string
  comment?: string  // HTML cross-references
}

export interface ProcessedBibleVerse {
  text: string
  translation: string
}

export interface ParsedReference {
  reference: string  // Reference without translation (e.g., "John 3:16")
  translation: string  // Translation code (e.g., "ESV", defaults to "ESV")
}

/**
 * Standard Bible book numbering (1-66)
 * Used by Bolls.life API
 */
const BOOK_NUMBERS: Record<string, number> = {
  // Old Testament (1-39)
  'genesis': 1, 'gen': 1,
  'exodus': 2, 'exo': 2, 'exod': 2,
  'leviticus': 3, 'lev': 3,
  'numbers': 4, 'num': 4,
  'deuteronomy': 5, 'deut': 5, 'deu': 5,
  'joshua': 6, 'josh': 6, 'jos': 6,
  'judges': 7, 'judg': 7, 'jdg': 7,
  'ruth': 8, 'rut': 8,
  '1 samuel': 9, '1samuel': 9, '1sam': 9, '1sa': 9, 'i samuel': 9,
  '2 samuel': 10, '2samuel': 10, '2sam': 10, '2sa': 10, 'ii samuel': 10,
  '1 kings': 11, '1kings': 11, '1kgs': 11, '1ki': 11, 'i kings': 11,
  '2 kings': 12, '2kings': 12, '2kgs': 12, '2ki': 12, 'ii kings': 12,
  '1 chronicles': 13, '1chronicles': 13, '1chr': 13, '1ch': 13, 'i chronicles': 13,
  '2 chronicles': 14, '2chronicles': 14, '2chr': 14, '2ch': 14, 'ii chronicles': 14,
  'ezra': 15, 'ezr': 15,
  'nehemiah': 16, 'neh': 16,
  'esther': 17, 'est': 17, 'esth': 17,
  'job': 18,
  'psalm': 19, 'psalms': 19, 'psa': 19, 'ps': 19,
  'proverbs': 20, 'prov': 20, 'pro': 20,
  'ecclesiastes': 21, 'eccl': 21, 'ecc': 21, 'eccles': 21,
  'song of solomon': 22, 'song': 22, 'sos': 22, 'song of songs': 22,
  'isaiah': 23, 'isa': 23,
  'jeremiah': 24, 'jer': 24,
  'lamentations': 25, 'lam': 25,
  'ezekiel': 26, 'ezek': 26, 'eze': 26,
  'daniel': 27, 'dan': 27,
  'hosea': 28, 'hos': 28,
  'joel': 29, 'joe': 29,
  'amos': 30, 'amo': 30,
  'obadiah': 31, 'obad': 31, 'oba': 31,
  'jonah': 32, 'jon': 32,
  'micah': 33, 'mic': 33,
  'nahum': 34, 'nah': 34, 'nam': 34,
  'habakkuk': 35, 'hab': 35,
  'zephaniah': 36, 'zeph': 36, 'zep': 36,
  'haggai': 37, 'hag': 37,
  'zechariah': 38, 'zech': 38, 'zec': 38,
  'malachi': 39, 'mal': 39,
  // New Testament (40-66)
  'matthew': 40, 'matt': 40, 'mat': 40, 'mt': 40,
  'mark': 41, 'mar': 41, 'mk': 41, 'mrk': 41,
  'luke': 42, 'luk': 42, 'lk': 42,
  'john': 43, 'joh': 43, 'jn': 43,
  'acts': 44, 'act': 44,
  'romans': 45, 'rom': 45, 'rm': 45,
  '1 corinthians': 46, '1corinthians': 46, '1cor': 46, '1co': 46, 'i corinthians': 46,
  '2 corinthians': 47, '2corinthians': 47, '2cor': 47, '2co': 47, 'ii corinthians': 47,
  'galatians': 48, 'gal': 48,
  'ephesians': 49, 'eph': 49,
  'philippians': 50, 'phil': 50, 'php': 50,
  'colossians': 51, 'col': 51,
  '1 thessalonians': 52, '1thessalonians': 52, '1thess': 52, '1th': 52, 'i thessalonians': 52,
  '2 thessalonians': 53, '2thessalonians': 53, '2thess': 53, '2th': 53, 'ii thessalonians': 53,
  '1 timothy': 54, '1timothy': 54, '1tim': 54, '1ti': 54, 'i timothy': 54,
  '2 timothy': 55, '2timothy': 55, '2tim': 55, '2ti': 55, 'ii timothy': 55,
  'titus': 56, 'tit': 56,
  'philemon': 57, 'philem': 57, 'phm': 57,
  'hebrews': 58, 'heb': 58,
  'james': 59, 'jas': 59, 'jam': 59,
  '1 peter': 60, '1peter': 60, '1pet': 60, '1pe': 60, 'i peter': 60,
  '2 peter': 61, '2peter': 61, '2pet': 61, '2pe': 61, 'ii peter': 61,
  '1 john': 62, '1john': 62, '1jn': 62, 'i john': 62,
  '2 john': 63, '2john': 63, '2jn': 63, 'ii john': 63,
  '3 john': 64, '3john': 64, '3jn': 63, 'iii john': 64,
  'jude': 65, 'jud': 65,
  'revelation': 66, 'rev': 66,
}

/**
 * Get standard book number (1-66) from book name
 * @param bookName - Bible book name (case-insensitive)
 * @returns Book number or null if not found
 */
export function getBookNumber(bookName: string): number | null {
  const normalized = bookName.toLowerCase().trim()
  return BOOK_NUMBERS[normalized] ?? null
}

/**
 * Parse a Bible reference and extract translation
 * @param fullReference - Full reference with optional translation (e.g., "John 3:16 (KJV)" or "John 3:16")
 * @returns Parsed reference object with reference and translation
 */
export function parseReference(fullReference: string): ParsedReference {
  // Match translation in parentheses at the end: (ESV), (KJV), etc.
  const match = fullReference.match(/^(.+?)\s*\(([A-Z]+)\)\s*$/)

  if (match && match[1] && match[2]) {
    return {
      reference: match[1].trim(),
      translation: match[2]
    }
  }

  // No translation specified, default to ESV
  return {
    reference: fullReference.trim(),
    translation: 'ESV'
  }
}

const MAX_VERSES = 4

/**
 * Strip HTML tags from text, preserving content
 * @param html - HTML string
 * @returns Plain text
 */
function stripHtml(html: string): string {
  return html
    .replace(/<S>\d+<\/S>/g, '')  // Remove Strong's numbers
    .replace(/<i>(.*?)<\/i>/g, '$1')  // Keep italicized content
    .replace(/<a[^>]*>(.*?)<\/a>/g, '$1')  // Keep link text
    .replace(/<[^>]+>/g, '')  // Remove all other tags
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .trim()
}

/**
 * Process Bolls.life API response for single verse
 * @param data - Response from Bolls.life API
 * @param translation - Translation code
 * @returns Processed verse with stripped HTML
 */
export function processBollsVerse(data: BollsVerseResponse, translation: string): ProcessedBibleVerse {
  const text = stripHtml(data.text)

  return {
    text,
    translation: translation.toUpperCase()
  }
}

/**
 * Process Bolls.life API response for verse range
 * @param data - Array of verses from Bolls.life API
 * @param translation - Translation code
 * @param startVerse - Starting verse number (optional, for range filtering)
 * @param endVerse - Ending verse number (optional, for range filtering)
 * @returns Processed verses with truncation if needed
 */
export function processBollsVerseRange(
  data: BollsVerseResponse[],
  translation: string,
  startVerse?: number,
  endVerse?: number
): ProcessedBibleVerse {
  let verses = data

  // Filter to verse range if specified
  if (startVerse !== undefined) {
    const end = endVerse ?? startVerse
    verses = data.filter(v => v.verse >= startVerse && v.verse <= end)
  }

  // Truncate to first 4 verses if needed
  const wasTruncated = verses.length > MAX_VERSES
  const limitedVerses = verses.slice(0, MAX_VERSES)

  // Join and strip HTML
  const text = limitedVerses
    .map(v => stripHtml(v.text))
    .join(' ')

  const finalText = wasTruncated ? text + ' ...' : text

  return {
    text: finalText,
    translation: translation.toUpperCase()
  }
}

/**
 * Create BibleHub interlinear URL from a Bible reference
 * @param reference - Bible reference (e.g., "John 3:16", "Genesis 1:1-3", "Psalm 23")
 * @returns BibleHub interlinear URL
 */
export function createBibleHubInterlinearUrl(reference: string): string {
  // Parse reference: "Book Chapter:Verse" or "Book Chapter:Verse-Verse2" or "Book Chapter"
  const match = reference.match(/^(.+?)\s+(\d+)(?::(\d+))?(?:-(\d+))?/)

  if (!match) {
    // Fallback to main interlinear page if we can't parse
    return 'https://biblehub.com/interlinear/'
  }

  const [, book, chapter, verse] = match

  // Type guard: ensure book and chapter exist
  if (!book || !chapter) {
    return 'https://biblehub.com/interlinear/'
  }

  // Normalize book name for URL (lowercase, replace spaces with underscores)
  const bookSlug = book.toLowerCase().replace(/\s+/g, '_')

  // Build URL
  if (verse) {
    // Specific verse: /interlinear/book/chapter-verse.htm
    return `https://biblehub.com/interlinear/${bookSlug}/${chapter}-${verse}.htm`
  } else {
    // Chapter only: /interlinear/book/chapter.htm
    return `https://biblehub.com/interlinear/${bookSlug}/${chapter}.htm`
  }
}
