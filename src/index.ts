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
  mdsite help [-h|--help]
  mdsite init
  mdsite live|live [-d|--detached] [--host [addr]]
  mdsite generate
  mdsite static|static [-d|--detached] [--host [addr]]
  mdsite stop
  mdsite version
  mdsite prepare github

Commands:
  init      Ensure mdsite files exist in the current directory (idempotent; creates missing files, never overwrites)
  start     Start the checked-in mdsite-nuxt renderer for local content (alias: live)
  generate  Build static output through mdsite-nuxt
  preview   Preview the generated site through mdsite-nuxt (alias: static)
  stop      Stop tracked start and preview processes
  version   Print the CLI package version
  prepare   Generate the GitHub Pages workflow for this content directory

Options:
  -h, --help       Show this help output
  -d, --detached   Run mdsite live or preview in the background and write runtime state
  --host [addr]    Expose start/preview on the network (binds 0.0.0.0 by default, or a given addr)
`

const DEFAULT_NETWORK_HOST = '0.0.0.0'

interface ServerCommandFlags {
  detached: boolean
  host?: string
}

function parseServerCommandFlags(args: string[]): ServerCommandFlags {
  const flags: ServerCommandFlags = { detached: false }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '-d' || arg === '--detached') {
      flags.detached = true
      continue
    }

    if (arg === '--host') {
      const next = args[index + 1]
      if (next !== undefined && !next.startsWith('-')) {
        flags.host = next
        index += 1
      } else {
        flags.host = DEFAULT_NETWORK_HOST
      }
      continue
    }

    throw new Error(`Unsupported option: ${arg}. Run \`mdsite help\` for supported options.`)
  }

  return flags
}

function buildServerCommandOptions(flags: ServerCommandFlags): { detached: boolean, host?: string } {
  if (flags.host === undefined) {
    return { detached: flags.detached }
  }
  return { detached: flags.detached, host: flags.host }
}

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
  const argv = process.argv.slice(2)
  const command = argv[0]
  const subcommand = argv[1]
  const currentDirectory = process.cwd()

  switch (command) {
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      console.log(helpText)
      return
    case 'init':
      console.log(await runInitCommand(currentDirectory))
      return
    case 'start':
    case 'live':
      {
        const flags = parseServerCommandFlags(argv.slice(1))
        const message = await runStartCommand(currentDirectory, buildServerCommandOptions(flags))
        if (message) {
          console.log(message)
        }
      }
      return
    case 'generate':
      console.log(await runGenerateCommand(currentDirectory))
      return
    case 'preview':
    case 'static':
      {
        const flags = parseServerCommandFlags(argv.slice(1))
        const message = await runPreviewCommand(currentDirectory, buildServerCommandOptions(flags))
        if (message) {
          console.log(message)
        }
      }
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
