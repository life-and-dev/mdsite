import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { loadMdsiteConfig } from '../config/mdsite-config.js'
import { ensureConfiguredRendererInstalled, ensureRendererDependencies, prepareConfiguredRenderer, prepareRendererBackend } from '../renderer/mdsite-nuxt.js'

export async function runPrepareGithubCommand(contentDir: string): Promise<string> {
  const loaded = await loadMdsiteConfig(contentDir)
  await ensureConfiguredRendererInstalled(loaded.contentDir, loaded.config, loaded)
  const { rendererDir, rendererEnv } = await prepareConfiguredRenderer(loaded.contentDir, loaded.config, loaded)

  await ensureRendererDependencies(rendererDir)
  await prepareRendererBackend(rendererDir, rendererEnv)

  const workflowPath = path.join(contentDir, '.github', 'workflows', 'deploy.yml')
  await mkdir(path.dirname(workflowPath), { recursive: true })
  await writeFile(workflowPath, buildGithubWorkflow(loaded.config), 'utf8')

  return `Generated GitHub Pages workflow at ${workflowPath}`
}

function buildGithubWorkflow(config: Awaited<ReturnType<typeof loadMdsiteConfig>>['config']): string {
  const outputPath = path.posix.normalize(config.paths.output.replace(/\\/g, '/'))
  const workflowName = 'Deploy Docs'
  const artifactPath = `./${outputPath}/public`
  const workspaceContentPath = config.paths.input ? `\${{ github.workspace }}/${path.posix.normalize(config.paths.input.replace(/\\/g, '/'))}` : '${{ github.workspace }}'

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
    '        uses: actions/checkout@v7',
    '        with:',
    '          submodules: true',
    '',
    '      - name: Detect mdsite layout',
    '        id: detect',
    '        shell: bash',
    '        run: echo "is_source=$(if [ -f bin/mdsite.js ]; then echo true; else echo false; fi)" >> "$GITHUB_OUTPUT"',
    '',
    '      - name: Setup Node',
    '        uses: actions/setup-node@v6',
    '        with:',
    '          node-version: "24"',
    '',
    '      - name: Setup Pages',
    '        id: pages',
    '        uses: actions/configure-pages@v6',
    '',
    '      - name: Build and generate (source)',
    "        if: steps.detect.outputs.is_source == 'true'",
    '        shell: bash',
    '        run: |',
    '          npm install',
    '          npm run build',
    '          node bin/mdsite.js generate',
    '        env:',
    '          NUXT_APP_BASE_URL: ${{ steps.pages.outputs.base_path }}/',
    '',
    '      - name: Generate (npx)',
    "        if: steps.detect.outputs.is_source != 'true'",
    '        run: npx -y @life-and-dev/mdsite generate',
    '        env:',
    '          NUXT_APP_BASE_URL: ${{ steps.pages.outputs.base_path }}/',
    '',
    '      - name: Upload artifact',
    '        uses: actions/upload-pages-artifact@v5',
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
    '        uses: actions/deploy-pages@v5'
  ].join('\n') + '\n'
}
