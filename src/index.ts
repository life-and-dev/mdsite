#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import process from 'node:process'

import { runGenerateCommand } from './commands/generate.js'
import { runInitCommand } from './commands/init.js'
import { runPrepareGithubCommand } from './commands/prepare.js'
import { runPreviewCommand } from './commands/preview.js'
import { runStartCommand } from './commands/start.js'
import { runStopCommand } from './commands/stop.js'

const helpText = `mdsite - local-first CLI for mdsite-nuxt

Usage:
  mdsite help
  mdsite init
  mdsite start
  mdsite generate
  mdsite preview
  mdsite stop
  mdsite version
  mdsite prepare github

Commands:
  init      Create _mdsite.yml in the current directory
  start     Start the checked-in mdsite-nuxt renderer for local content
  generate  Build static output through mdsite-nuxt
  preview   Preview the generated site through mdsite-nuxt
  stop      Stop tracked start and preview processes
  version   Print the CLI package version
  prepare   Generate the GitHub Pages workflow for this content directory
`

type PackageMetadata = {
  version?: unknown
}

async function readPackageVersion(): Promise<string> {
  const packageJsonPath = new URL('../package.json', import.meta.url)
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as PackageMetadata

  if (typeof packageJson.version !== 'string') {
    throw new Error('Unable to read package version from package.json')
  }

  return packageJson.version
}

async function main(): Promise<void> {
  const [command, subcommand] = process.argv.slice(2)
  const currentDirectory = process.cwd()

  switch (command) {
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      console.log(helpText)
      return
    case 'init':
      await runInitCommand(currentDirectory)
      console.log(`Created _mdsite.yml in ${currentDirectory}`)
      return
    case 'start':
      console.log(await runStartCommand(currentDirectory))
      return
    case 'generate':
      console.log(await runGenerateCommand(currentDirectory))
      return
    case 'preview':
      console.log(await runPreviewCommand(currentDirectory))
      return
    case 'stop':
      console.log(await runStopCommand(currentDirectory))
      return
    case 'version':
    case '--version':
    case '-v':
      console.log(await readPackageVersion())
      return
    case 'prepare':
      if (subcommand === 'github') {
        console.log(await runPrepareGithubCommand(currentDirectory))
        return
      }

      throw new Error(`Unsupported command: prepare${subcommand ? ` ${subcommand}` : ''}. Run \`mdsite help\` for supported local commands.`)
    default:
      throw new Error(`Unsupported command: ${command}. Run \`mdsite help\` for supported local commands.`)
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Error: ${message}`)
  process.exitCode = 1
})
