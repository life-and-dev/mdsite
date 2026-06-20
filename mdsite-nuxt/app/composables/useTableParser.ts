import type { ParsedTable, TableHeader, TableItem } from '~/types/table'

/**
 * Converts text to kebab-case for use as table column keys
 */
function toKebabCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-')     // Replace spaces with hyphens
    .replace(/-+/g, '-')      // Remove duplicate hyphens
    .trim()
}

/**
 * Extracts headers from table's <thead> element
 */
function parseHeaders(tableElement: HTMLTableElement): TableHeader[] {
  const thead = tableElement.querySelector('thead')
  if (!thead) return []

  const headerRow = thead.querySelector('tr')
  if (!headerRow) return []

  const headers: TableHeader[] = []
  const thElements = headerRow.querySelectorAll('th')

  thElements.forEach((th, index) => {
    const title = th.textContent?.trim() || `Column ${index + 1}`
    const key = toKebabCase(title) || `col-${index}`

    headers.push({
      title,
      key,
      sortable: true,
      align: 'start'
    })
  })

  return headers
}

/**
 * Extracts row data from table's <tbody> element
 */
function parseRows(
  tableElement: HTMLTableElement,
  headers: TableHeader[]
): TableItem[] {
  const tbody = tableElement.querySelector('tbody')
  if (!tbody) return []

  const items: TableItem[] = []
  const rows = tbody.querySelectorAll('tr')

  rows.forEach((row) => {
    const item: TableItem = {}
    const cells = row.querySelectorAll('td')

    cells.forEach((cell, colIndex) => {
      // Use header key if available, otherwise fallback to col-N
      const key = headers[colIndex]?.key || `col-${colIndex}`

      // Check if cell contains HTML (links, formatting, line breaks, lists, etc.)
      const hasHtml = cell.querySelector('a, strong, em, code, span, br, ul, ol, li, p, div')

      if (hasHtml) {
        // Store innerHTML for complex content
        item[key] = cell.innerHTML.trim()
      } else {
        // Store plain text for simple content
        item[key] = cell.textContent?.trim() || ''
      }
    })

    items.push(item)
  })

  return items
}

/**
 * Composable for parsing HTML table into v-data-table format
 */
export function useTableParser() {
  /**
   * Parse an HTML table element into v-data-table headers and items
   */
  const parseTable = (tableElement: HTMLTableElement | null): ParsedTable => {
    if (!tableElement) {
      return { headers: [], items: [] }
    }

    // Extract headers from <thead>
    const headers = parseHeaders(tableElement)

    // Extract rows from <tbody>
    const items = parseRows(tableElement, headers)

    return { headers, items }
  }

  return {
    parseTable
  }
}
