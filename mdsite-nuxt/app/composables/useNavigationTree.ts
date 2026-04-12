import type { MinimalTreeNode } from '../../scripts/generate-indices'

export interface TreeNode {
  id: string
  title: string
  path: string
  order: number
  children: TreeNode[]
  parent?: TreeNode
  externalUrl?: string
  isExternal?: boolean
  isSeparator?: boolean
  isHeader?: boolean
  isPrimary?: boolean  // Marks primary menu items (string/array syntax, not aliases)
  description?: string
  keywords?: string[]
}

/**
 * Generate cache key that changes every hour
 * This ensures menu changes are picked up within 1 hour
 */
function getCacheKey(): string {
  const now = new Date()
  const hourTimestamp = Math.floor(now.getTime() / (1000 * 60 * 60)) // Changes every hour
  return `navigation-tree-${hourTimestamp}`
}

/**
 * Build hierarchical navigation tree from @nuxt/content collection
 */
export function useNavigationTree() {
  // Use useState for server-side rendering and client hydration
  // Cache key changes hourly to pick up menu structure changes
  const tree = useState<TreeNode | null>(getCacheKey(), () => null)
  // Use useState for loading state to prevent duplicate fetches across components
  const isLoading = useState<boolean>(`${getCacheKey()}-loading`, () => false)

  /**
   * Load navigation tree from pre-built JSON file
   * Uses cached tree if available to avoid rebuilding on every navigation
   * Prevents concurrent fetches when multiple components mount simultaneously
   */
  async function loadTree() {
    // Return if already loaded OR currently loading (prevents race condition)
    if (tree.value !== null || isLoading.value) {
      return
    }

    isLoading.value = true
    try {
      // Fetch pre-built navigation JSON
      const minimalNodes = await $fetch<MinimalTreeNode[]>('/_navigation.json')

      // Convert to TreeNode format with parent references
      tree.value = buildTreeFromMinimalNodes(minimalNodes)
    } catch (error) {
      console.error('Error loading navigation tree:', error)
      tree.value = null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Find node by path in tree
   */
  function findNodeByPath(path: string, node: TreeNode | null = tree.value): TreeNode | null {
    if (!node) return null
    if (node.path === path) return node

    for (const child of node.children) {
      const found = findNodeByPath(path, child)
      if (found) return found
    }

    return null
  }

  /**
   * Find primary node by path in tree (only returns nodes with isPrimary=true)
   */
  function findPrimaryNodeByPath(path: string, node: TreeNode | null = tree.value): TreeNode | null {
    if (!node) return null
    if (node.path === path && node.isPrimary) return node

    for (const child of node.children) {
      const found = findPrimaryNodeByPath(path, child)
      if (found) return found
    }

    return null
  }

  /**
   * Get all ancestor paths for a given path
   */
  function getAncestorPaths(path: string): string[] {
    const segments = path.split('/').filter(Boolean)
    const ancestors: string[] = ['/']

    for (let i = 0; i < segments.length - 1; i++) {
      ancestors.push('/' + segments.slice(0, i + 1).join('/'))
    }

    return ancestors
  }

  /**
   * Get sibling nodes at the same level
   */
  function getSiblings(nodePath: string): TreeNode[] {
    const node = findNodeByPath(nodePath)
    if (!node || !node.parent) return []
    return node.parent.children.filter(child => child.path !== nodePath)
  }

  return {
    tree,
    isLoading,
    loadTree,
    findNodeByPath,
    findPrimaryNodeByPath,
    getAncestorPaths,
    getSiblings
  }
}

/**
 * Convert MinimalTreeNode array to TreeNode with parent references
 */
function buildTreeFromMinimalNodes(minimalNodes: MinimalTreeNode[]): TreeNode {
  // Create root node
  const root: TreeNode = {
    id: 'root',
    title: 'Home',
    path: '/',
    order: -1,
    children: []
  }

  // Recursively convert minimal nodes to TreeNode format
  function convertNode(minimalNode: MinimalTreeNode, parent: TreeNode, order: number): TreeNode {
    const node: TreeNode = {
      id: minimalNode.id,
      title: minimalNode.title,
      path: minimalNode.path,
      order,
      children: [],
      parent,
      description: minimalNode.description,
      isPrimary: minimalNode.isPrimary,
      isExternal: minimalNode.type === 'external',
      isSeparator: minimalNode.type === 'separator',
      isHeader: minimalNode.type === 'header',
      externalUrl: minimalNode.type === 'external' ? minimalNode.path : undefined
    }

    // Recursively convert children
    if (minimalNode.children) {
      node.children = minimalNode.children.map((child, index) =>
        convertNode(child, node, index)
      )
    }

    return node
  }

  // Convert all top-level nodes
  root.children = minimalNodes.map((node, index) => convertNode(node, root, index))

  return root
}
