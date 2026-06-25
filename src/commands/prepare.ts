import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { loadMdsiteConfig, resolveContentOutputPath } from '../config/mdsite-config.js'
import { ensureRendererDependencies, prepareConfiguredRenderer, prepareRendererBackend } from '../renderer/mdsite-nuxt.js'

export async function runPrepareGithubCommand(contentDir: string): Promise<string> {
  const loaded = await loadMdsiteConfig(contentDir)
  const { rendererDir, rendererEnv } = await prepareConfiguredRenderer(loaded.contentDir, loaded.config, loaded)

  await ensureRendererDependencies(rendererDir)
  await prepareRendererBackend(rendererDir, rendererEnv)

  const workflowPath = path.join(contentDir, '.github', 'workflows', 'deploy.yml')
  await mkdir(path.dirname(workflowPath), { recursive: true })
  await writeFile(workflowPath, buildGithubWorkflow(loaded.configDir, loaded.config), 'utf8')

  return `Generated GitHub Pages workflow at ${workflowPath}`
}

function buildGithubWorkflow(contentDir: string, config: Awaited<ReturnType<typeof loadMdsiteConfig>>['config']): string {
  const rendererPath = path.posix.normalize(config.server.path.replace(/\\/g, '/'))
  const outputPath = path.posix.normalize(path.relative(contentDir, resolveContentOutputPath(contentDir, config)).replace(/\\/g, '/'))
  const workflowName = `Deploy ${config.site.name} to GitHub Pages`
  const artifactPath = `./${outputPath}/public`
  const workspaceContentPath = config.content?.path ? `\${{ github.workspace }}/${path.posix.normalize(config.content.path.replace(/\\/g, '/'))}` : '${{ github.workspace }}'

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
    '    env:',
    `      NUXT_CONTENT_PATH: "${workspaceContentPath}"`,
    `      CONTENT_DIR: "${workspaceContentPath}"`,
    '      MDSITE_CONFIG_PATH: "${{ github.workspace }}/mdsite.yml"',
    '    steps:',
    '      - name: Checkout',
    '        uses: actions/checkout@v4',
    '',
    '      - name: Setup Node',
    '        uses: actions/setup-node@v4',
    '        with:',
    '          node-version: "20"',
    '          cache: npm',
    `          cache-dependency-path: ${JSON.stringify(`${rendererPath}/package-lock.json`)}`,
    '',
    '      - name: Setup Pages',
    '        id: pages',
    '        uses: actions/configure-pages@v5',
    '',
    '      - name: Restore cache',
    '        uses: actions/cache@v4',
    '        with:',
    '          path: |',
    `            ${rendererPath}/node_modules`,
    `            ${rendererPath}/.nuxt`,
    `            ${rendererPath}/.output`,
    "          key: ${{ runner.os }}-nuxt-build-${{ hashFiles('" + rendererPath + "/package-lock.json') }}",
    '          restore-keys: |',
    '            ${{ runner.os }}-nuxt-build-',
    '',
    '      - name: Install dependencies',
    `        working-directory: ${rendererPath}`,
    '        run: npm install',
    '',
    '      - name: Generate static site',
    `        working-directory: ${rendererPath}`,
    '        run: npm run generate',
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
