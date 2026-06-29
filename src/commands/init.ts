import { access, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { buildDefaultMdsiteConfig, serializeMdsiteConfig } from '../config/mdsite-config.js'

const NVMRC_VERSION = '24'

function buildNvmrcContent(): string {
  return `${NVMRC_VERSION}\n`
}

export async function runInitCommand(contentDir: string): Promise<string> {
  const configPath = path.join(contentDir, 'mdsite.yml')
  const nvmrcPath = path.join(contentDir, '.nvmrc')

  try {
    await access(configPath)
  } catch {
    const config = await buildDefaultMdsiteConfig(contentDir)
    await writeFile(configPath, serializeMdsiteConfig(config), 'utf8')

    try {
      await access(nvmrcPath)
      return `Created mdsite.yml in ${contentDir} (.nvmrc was already present)`
    } catch {
      await writeFile(nvmrcPath, buildNvmrcContent(), 'utf8')
      return `Created mdsite.yml and .nvmrc in ${contentDir}`
    }
  }

  throw new Error(`mdsite.yml already exists at ${configPath}.`)
}
