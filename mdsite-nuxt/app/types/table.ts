/**
 * TypeScript types for table parsing and v-data-table integration
 */

/**
 * v-data-table header configuration
 */
export interface TableHeader {
  /** Display title for the column */
  title: string
  /** Unique key for accessing data */
  key: string
  /** Whether column is sortable (default: true) */
  sortable?: boolean
  /** Column alignment */
  align?: 'start' | 'end' | 'center'
  /** Column width */
  width?: string | number
}

/**
 * v-data-table item (row data)
 * Dynamic object with keys matching header keys
 */
export type TableItem = Record<string, any>

/**
 * Parsed table structure ready for v-data-table
 */
export interface ParsedTable {
  /** Column headers */
  headers: TableHeader[]
  /** Row data */
  items: TableItem[]
}

/**
 * Raw table cell data during parsing
 */
export interface TableCell {
  /** Text content of cell */
  text: string
  /** HTML content of cell (for complex formatting) */
  html: string
  /** Column index */
  colIndex: number
}

/**
 * Raw table row data during parsing
 */
export interface TableRow {
  /** Cells in this row */
  cells: TableCell[]
  /** Row index */
  rowIndex: number
}
