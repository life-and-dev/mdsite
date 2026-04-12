/**
 * Bible book names whitelist (66 books)
 * Used for detecting Bible references while avoiding false positives
 */
export const BIBLE_BOOK_NAMES = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
  'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalm', 'Psalms', 'Proverbs', 'Ecclesiastes',
  'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel',
  'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk',
  'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
  '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians',
  'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy',
  'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter',
  '1 John', '2 John', '3 John', 'Jude', 'Revelation'
] as const

/**
 * Creates Bible reference detection patterns using book name whitelist
 * @returns Array of RegExp patterns for matching Bible references (with optional translation in brackets)
 */
export function createBibleReferencePatterns(): RegExp[] {
  const bookPattern = BIBLE_BOOK_NAMES.join('|').replace(/\s/g, '\\s+')
  const translationPattern = '(?:\\s*\\([A-Z]+\\))?'  // Optional (ESV), (KJV), etc.

  return [
    // Cross-chapter range: "2 Corinthians 4:16-5:9 (ESV)"
    new RegExp(`\\b(${bookPattern})\\s+(\\d+):(\\d+)-(\\d+):(\\d+)${translationPattern}\\b`, 'g'),
    // Same chapter range: "John 3:16-18 (ESV)" - ensure we don't match if followed by digits (prevents matching "3:16-5" in "3:16-5:9")
    new RegExp(`\\b(${bookPattern})\\s+(\\d+):(\\d+)-(\\d+)${translationPattern}\\b(?!\\d)`, 'g'),
    // Single verse: "John 3:16 (ESV)" - ensure we don't match if followed by dash or digits (allows punctuation like colon, period, comma)
    new RegExp(`\\b(${bookPattern})\\s+(\\d+):(\\d+)${translationPattern}\\b(?![\\d-])`, 'g'),
    // Chapter only: "John 3 (ESV)", "Psalm 23 (ESV)" - ensure not followed by colon
    new RegExp(`\\b(${bookPattern})\\s+(\\d+)${translationPattern}\\b(?!\\s*:)`, 'g')
  ]
}
