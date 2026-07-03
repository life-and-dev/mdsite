import { describe, expect, it } from 'vitest'

import { createDefaultMdsiteConfig } from './default-mdsite-config.js'

describe('createDefaultMdsiteConfig', () => {
  it('builds the expected default shape with provided site name and menu', () => {
    const menu = ['guide/getting-started', { Docs: ['guide/advanced'] }]

    const config = createDefaultMdsiteConfig('My Site', menu)

    expect(config).toEqual({
      favicon: '',
      features: {
        bibleTooltips: true,
        sourceEdit: true
      },
      menu,
      footer: [],
      server: {
        output: '.output',
        path: '.mdsite',
        repo: 'https://github.com/life-and-dev/mdsite'
      },
      site: {
        canonical: '',
        name: 'My Site'
      },
      themes: {
        light: {
          colors: expect.objectContaining({
            primary: '#0969da',
            background: '#f6f8fa',
            'on-primary': '#ffffff'
          })
        },
        dark: {
          colors: expect.objectContaining({
            primary: '#58a6ff',
            background: '#161b22',
            'on-primary': '#0d1117'
          })
        }
      }
    })
  })
})
