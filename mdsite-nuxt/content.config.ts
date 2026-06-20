import { defineCollection, defineContentConfig } from '@nuxt/content'
import { loadMdsiteConfigSync } from './utils/mdsite-config.js'

const { contentDir } = loadMdsiteConfigSync()

export default defineContentConfig({
  collections: {
    content: defineCollection({
      type: 'page',
      source: {
        cwd: contentDir,
        include: '**/*.md',
        exclude: ['**/*.draft.md'],
        prefix: '/'
      }
    })
  }
})
