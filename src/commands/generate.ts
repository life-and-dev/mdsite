import { cp, rm } from 'node:fs/promises'

import { loadMdsiteConfig, resolveContentOutputPath } from '../config/mdsite-config.js'
import { ensureRendererDependencies, generateRenderer, getRendererGeneratedOutputPath, prepareRenderer } from '../renderer/mdsite-nuxt.js'
import { ensureInitialized } from './init.js'

export async function runGenerateCommand(contentDir: string): Promise<string> {
  await ensureInitialized(contentDir)
  const loaded = await loadMdsiteConfig(contentDir)
  const { rendererDir, rendererEnv } = await prepareRenderer(loaded.contentDir, loaded.config, loaded)

  await ensureRendererDependencies(rendererDir)
  await generateRenderer(rendererDir, rendererEnv)

  const rendererOutputPath = getRendererGeneratedOutputPath(rendererDir)
  const destinationOutputPath = resolveContentOutputPath(loaded.configDir, loaded.config)

  try {
    await rm(destinationOutputPath, { recursive: true, force: true })
    await cp(rendererOutputPath, destinationOutputPath, { recursive: true, force: true })
  } catch (error) {
    throw new Error(`Failed to sync generated output to ${destinationOutputPath}: ${error instanceof Error ? error.message : String(error)}`)
  }

  return `Generated site synced to ${destinationOutputPath}`
}
