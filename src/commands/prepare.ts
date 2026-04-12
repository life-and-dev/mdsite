import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { loadMdsiteConfig, resolveContentOutputPath } from '../config/mdsite-config.js'
import { ensureRendererDependencies, prepareRenderer, prepareRendererBackend } from '../renderer/mdsite-nuxt.js'

export async function runPrepareGithubCommand(contentDir: string): Promise<string> {
  const { config } = await loadMdsiteConfig(contentDir)
  const { rendererDir, rendererEnv } = await prepareRenderer(contentDir, config)

  await ensureRendererDependencies(rendererDir)
  await prepareRendererBackend(rendererDir, rendererEnv)

  const workflowPath = path.join(contentDir, '.github', 'workflows', 'deploy.yml')
  await mkdir(path.dirname(workflowPath), { recursive: true })
  await writeFile(workflowPath, buildGithubWorkflow(contentDir, config), 'utf8')

  return `Generated GitHub Pages workflow at ${workflowPath}`
}

function buildGithubWorkflow(contentDir: string, config: Awaited<ReturnType<typeof loadMdsiteConfig>>['config']): string {
  const outputPath = path.posix.normalize(path.relative(contentDir, resolveContentOutputPath(contentDir, config)).replace(/\\/g, '/'))
  const workflowName = `Deploy ${config.site.name} to GitHub Pages`
  const artifactPath = `./${outputPath}`

  return [
    `name: ${JSON.stringify(workflowName)}`,
    '',
    'on:',
    '  push:',
    '    branches: ["main"]',
    '  workflow_dispatch:',
    '',
    'permissions:',
    '  contents: read',
    '  pages: write',
    '  id-token: write',
    '',
    'concurrency:',
    '  group: "pages"',
    '  cancel-in-progress: false',
    '',
    'jobs:',
    '  build:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - name: Checkout',
    '        uses: actions/checkout@v4',
    '',
    '      - name: Setup Node',
    '        uses: actions/setup-node@v4',
    '        with:',
    '          node-version: "20"',
    '          cache: npm',
    '          cache-dependency-path: package-lock.json',
    '',
    '      - name: Setup Pages',
    '        id: pages',
    '        uses: actions/configure-pages@v5',
    '',
    '      - name: Install CLI dependencies',
    '        run: npm ci',
    '',
    '      - name: Build CLI',
    '        run: npm run build',
    '',
    '      - name: Generate static site',
    '        run: node dist/index.js generate',
    '        env:',
    '          NUXT_APP_BASE_URL: ${{ steps.pages.outputs.base_path }}',
    '',
    '      - name: Upload artifact',
    '        uses: actions/upload-pages-artifact@v3',
    '        with:',
    `          path: ${JSON.stringify(artifactPath)}`,
    '',
    '  deploy:',
    '    environment:',
    '      name: github-pages',
    '      url: ${{ steps.deployment.outputs.page_url }}',
    '    runs-on: ubuntu-latest',
    '    needs: build',
    '    steps:',
    '      - name: Deploy to GitHub Pages',
    '        id: deployment',
    '        uses: actions/deploy-pages@v4'
  ].join('\n') + '\n'
}
