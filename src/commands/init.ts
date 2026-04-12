import { access, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { buildDefaultMdsiteConfig, serializeMdsiteConfig } from '../config/mdsite-config.js'

export async function runInitCommand(contentDir: string): Promise<void> {
  const configPath = path.join(contentDir, '_mdsite.yml')

  try {
    await access(configPath)
  } catch {
    const config = await buildDefaultMdsiteConfig(contentDir)
    await writeFile(configPath, serializeMdsiteConfig(config), 'utf8')
    return
  }

  throw new Error(`_mdsite.yml already exists at ${configPath}.`)
}
