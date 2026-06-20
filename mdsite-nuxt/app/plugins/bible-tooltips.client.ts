// Custom Bible Verse Tooltip Plugin using Bolls.life API
import {
  processBollsVerse,
  processBollsVerseRange,
  createBibleHubInterlinearUrl,
  parseReference,
  getBookNumber,
  type ProcessedBibleVerse
} from '~/utils/bible-verse-utils'

export default defineNuxtPlugin((nuxtApp) => {
  if (process.server) return

  class BibleTooltips {
    private cache = new Map<string, ProcessedBibleVerse>()
    private tooltip: HTMLElement | null = null
    private overlay: HTMLElement | null = null
    private currentLockState = false
    private currentCloseTimeout: NodeJS.Timeout | null = null
    private onHideCallback: (() => void) | null = null
    private currentElement: HTMLElement | null = null // Track which element currently owns the tooltip

    constructor() {
      // Create overlay immediately on construction
      this.overlay = this.createOverlay()
      this.setupOverlayHandlers()
      this.initializeTooltips()
    }

    private setupOverlayHandlers() {
      if (!this.overlay) return

      // Add touchstart handler in CAPTURE phase to catch events early
      this.overlay.addEventListener('touchstart', (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.hideTooltip()
      }, { capture: true })

      // Add touchend handler in CAPTURE phase
      this.overlay.addEventListener('touchend', (e) => {
        e.preventDefault()
        e.stopPropagation()
      }, { capture: true })

      // Add click handler for desktop
      this.overlay.addEventListener('click', (e) => {
        e.stopPropagation()
        this.hideTooltip()
      }, { capture: true })
    }

    private async fetchVerse(fullReference: string): Promise<ProcessedBibleVerse> {
      if (this.cache.has(fullReference)) {
        return this.cache.get(fullReference)!
      }

      // Parse reference to extract translation (defaults to ESV)
      const { reference, translation } = parseReference(fullReference)

      try {
        // Parse the reference: "John 3:16" or "John 3:16-18"
        const match = reference.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?/)

        if (!match) {
          throw new Error(`Invalid reference format: ${reference}`)
        }

        const [, bookName, chapter, startVerse, endVerse] = match

        // Type guards: ensure captured groups exist
        if (!bookName || !chapter || !startVerse) {
          throw new Error(`Invalid reference format: ${reference}`)
        }

        // Get book number (1-66)
        const bookNumber = getBookNumber(bookName)
        if (bookNumber === null) {
          throw new Error(`Unknown book: ${bookName}`)
        }

        let result: ProcessedBibleVerse

        if (endVerse) {
          // Verse range: fetch entire chapter and filter
          // Format: https://bolls.life/get-text/ESV/43/3/
          const url = `https://bolls.life/get-text/${translation}/${bookNumber}/${chapter}/`
          const response = await fetch(url)

          if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`)
          }

          const data = await response.json()
          result = processBollsVerseRange(
            data,
            translation,
            parseInt(startVerse),
            parseInt(endVerse)
          )
        } else {
          // Single verse
          // Format: https://bolls.life/get-verse/ESV/43/3/16/
          const url = `https://bolls.life/get-verse/${translation}/${bookNumber}/${chapter}/${startVerse}/`
          const response = await fetch(url)

          if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`)
          }

          const data = await response.json()
          result = processBollsVerse(data, translation)
        }

        if (!result.text) {
          return {
            text: 'Click the links below to read this verse:',
            translation: translation
          }
        }

        this.cache.set(fullReference, result)
        return result
      } catch (error) {
        console.warn('Bible API unavailable:', error)
        // Return friendly message with working links
        return {
          text: 'Click the links below to read this verse:',
          translation: translation
        }
      }
    }

    private createOverlay(): HTMLElement {
      const overlay = document.createElement('div')
      overlay.className = 'bible-tooltip-overlay'
      document.body.appendChild(overlay)
      return overlay
    }

    private createTooltip(): HTMLElement {
      const tooltip = document.createElement('div')
      tooltip.className = 'bible-tooltip'
      document.body.appendChild(tooltip)
      return tooltip
    }

    private showTooltip(element: HTMLElement, verseData: ProcessedBibleVerse, event: MouseEvent) {
      if (!this.tooltip) {
        this.tooltip = this.createTooltip()

        // Prevent tooltip from closing when mouse is over it
        this.tooltip.addEventListener('mouseenter', () => {
          // Cancel any pending hide
          if (this.currentCloseTimeout) {
            clearTimeout(this.currentCloseTimeout)
            this.currentCloseTimeout = null
          }
        })

        this.tooltip.addEventListener('mouseleave', () => {
          // Only hide if not locked, with small delay to allow moving to next verse
          if (!this.currentLockState) {
            this.currentCloseTimeout = setTimeout(() => {
              if (!this.currentLockState) {
                this.hideTooltip()
              }
            }, 100)
          }
        })
      }

      // Get full reference from data-reference attribute (handles shorthand expansion)
      const reference = (element as HTMLElement).getAttribute('data-reference') || element.textContent || ''
      const bibleGatewayUrl = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(reference)}&version=ESV`
      const bibleHubUrl = createBibleHubInterlinearUrl(reference)

      // Build title with translation
      const title = verseData.translation
        ? `${reference} <span class="bible-tooltip-translation">(${verseData.translation})</span>`
        : reference

      this.tooltip.innerHTML = `
        <div class="bible-tooltip-title">${title}</div>
        <div class="bible-tooltip-text">${verseData.text}</div>
        <div class="bible-tooltip-footer">
          <a href="${bibleGatewayUrl}" target="_blank" rel="noopener noreferrer" class="bible-tooltip-link"><i class="mdi mdi-book-open-variant"></i><span class="bible-tooltip-link-text">Full Context</span></a>
          <a href="${bibleHubUrl}" target="_blank" rel="noopener noreferrer" class="bible-tooltip-link"><span class="bible-tooltip-hebrew-greek">אΩ</span><span class="bible-tooltip-link-text">Interlinear</span></a>
        </div>
      `

      this.tooltip.style.display = 'block'

      // Position tooltip
      const rect = element.getBoundingClientRect()
      let left = event.clientX
      let top = rect.top - this.tooltip.offsetHeight - 10

      // Adjust if tooltip goes off screen
      if (left + this.tooltip.offsetWidth > window.innerWidth) {
        left = window.innerWidth - this.tooltip.offsetWidth - 10
      }
      if (top < 10) {
        top = rect.bottom + 10
      }

      this.tooltip.style.left = left + 'px'
      this.tooltip.style.top = top + 'px'
    }

    private hideTooltip() {
      if (this.tooltip) {
        this.tooltip.style.display = 'none'
      }
      if (this.overlay) {
        this.overlay.style.display = 'none'
      }
      this.currentLockState = false
      this.currentElement = null // Clear current element owner
      if (this.currentCloseTimeout) {
        clearTimeout(this.currentCloseTimeout)
        this.currentCloseTimeout = null
      }

      // Notify element that tooltip is hidden
      if (this.onHideCallback) {
        this.onHideCallback()
        this.onHideCallback = null
      }
    }

    private async handleMouseEnter(element: HTMLElement, reference: string, event: MouseEvent) {
      // Show loading tooltip immediately
      this.showTooltip(element, { text: 'Loading...', translation: '' }, event)

      // Fetch verse
      const verseData = await this.fetchVerse(reference)

      // Only show if tooltip is still visible (not dismissed while fetching)
      if (this.tooltip && this.tooltip.style.display === 'block') {
        this.showTooltip(element, verseData, event)
      }
    }


    public scan(container?: HTMLElement) {
      // Bible verses are now wrapped in spans at build time (via content transformer)
      // We just need to attach event listeners to existing .bible-ref elements
      this.attachEventListeners(container)
    }

    /**
     * Attach event listeners to pre-existing .bible-ref spans
     * (Spans are created at build time by the content transformer)
     */
    private attachEventListeners(container?: HTMLElement) {
      const root = container || document.body

      // Find all .bible-ref elements that don't have event listeners yet
      root.querySelectorAll('.bible-ref:not([data-bible-processed])').forEach(element => {
        element.setAttribute('data-bible-processed', 'true')

        const reference = element.getAttribute('data-reference')
        if (!reference) return

        let isTooltipVisible = false

        // Mouse events for desktop
        element.addEventListener('mouseenter', (e) => {
          if (!isTooltipVisible) {
            // If another element currently owns the tooltip, reset its state
            if (this.currentElement && this.currentElement !== element && this.onHideCallback) {
              this.onHideCallback()
              this.onHideCallback = null
            }

            // Clear any pending close timeout from OTHER verses
            if (this.currentCloseTimeout) {
              clearTimeout(this.currentCloseTimeout)
              this.currentCloseTimeout = null
            }

            this.handleMouseEnter(element as HTMLElement, reference, e as MouseEvent)
            isTooltipVisible = true
            this.currentElement = element as HTMLElement // Track this element as owner

            // Register callback to reset visible state when hidden
            this.onHideCallback = () => {
              isTooltipVisible = false
            }
          }
        })

        element.addEventListener('mouseleave', () => {
          // Only auto-close if THIS element owns the tooltip and not locked
          if (!this.currentLockState && this.currentElement === element) {
            this.currentCloseTimeout = setTimeout(() => {
              // Double-check this element still owns the tooltip
              if (!this.currentLockState && this.currentElement === element) {
                this.hideTooltip()
                isTooltipVisible = false
              }
            }, 300)
          }
        })

        // Click event to lock tooltip
        element.addEventListener('click', (e) => {
          e.preventDefault()
          e.stopPropagation()

          // Clear any pending close timeout
          if (this.currentCloseTimeout) {
            clearTimeout(this.currentCloseTimeout)
            this.currentCloseTimeout = null
          }

          // Lock the tooltip and show overlay
          this.currentLockState = true
          if (this.overlay) {
            this.overlay.style.display = 'block'
          }

          if (!isTooltipVisible) {
            this.handleMouseEnter(element as HTMLElement, reference, e as MouseEvent)
            isTooltipVisible = true
          }
        })

        // Touch events for mobile
        element.addEventListener('touchstart', (e: Event) => {
          const touchEvent = e as TouchEvent
          touchEvent.preventDefault() // Prevent mouse events from firing

          // Clear any pending close timeout
          if (this.currentCloseTimeout) {
            clearTimeout(this.currentCloseTimeout)
            this.currentCloseTimeout = null
          }

          // Lock the tooltip and show overlay
          this.currentLockState = true
          if (this.overlay) {
            this.overlay.style.display = 'block'
          }

          if (touchEvent.touches.length > 0) {
            const touch = touchEvent.touches[0]
            if (touch) {
              const syntheticEvent = new MouseEvent('mouseenter', {
                clientX: touch.clientX,
                clientY: touch.clientY
              })
              this.handleMouseEnter(element as HTMLElement, reference, syntheticEvent)
              isTooltipVisible = true
            }
          }
        })

        // Global click handler to close locked tooltip when clicking outside
        const closeOnOutsideClick = (e: MouseEvent) => {
          if (this.currentLockState && isTooltipVisible && this.tooltip && !this.tooltip.contains(e.target as Node) && !element.contains(e.target as Node)) {
            this.hideTooltip()
            isTooltipVisible = false
          }
        }
        document.addEventListener('click', closeOnOutsideClick)
      })
    }

    private initializeTooltips() {
      // No initial scan - pages will trigger manually after ContentRenderer completes
      // This prevents unnecessary duplicate scans
    }
  }

  // Create global instance
  const bibleTooltips = new BibleTooltips()

  // Provide scan function for manual triggering after ContentRenderer completes
  nuxtApp.provide('bibleTooltips', {
    scan: (container?: HTMLElement) => bibleTooltips.scan(container)
  })
})

// TypeScript declarations
declare module '#app' {
  interface NuxtApp {
    $bibleTooltips: {
      scan: (container?: HTMLElement) => void
    }
  }
}

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $bibleTooltips: {
      scan: (container?: HTMLElement) => void
    }
  }
}