import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

import { prepareRendererRuntime, runSetupHooks } from './renderer-hooks.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')


// Parse arguments
const args = process.argv.slice(2)
const isBuild = args.includes('--build')
const isGenerate = args.includes('--generate')
const isCached = args.includes('--cached')
const isPreview = args.includes('--preview')
const isSetup = args.includes('--setup') || args.includes('--prepare')
const configArg = args.find(arg => !arg.startsWith('--') && /\.ya?ml$/i.test(arg))

// Determine the command to run
let nuxtCommand = 'dev'
if (isBuild) nuxtCommand = 'build'
if (isGenerate) nuxtCommand = 'generate'
if (isPreview) nuxtCommand = 'preview'
if (isCached && !isBuild && !isGenerate) nuxtCommand = 'dev:cached'

if (isSetup) {
    await runSetupHooks('setup', rootDir, { configPath: configArg })
    process.exit(0)
}

if (nuxtCommand.startsWith('dev')) {
    await runSetupHooks('dev', rootDir, {
        cached: isCached,
        configPath: configArg
    })
} else if (nuxtCommand === 'build' || nuxtCommand === 'generate') {
    await runSetupHooks(nuxtCommand, rootDir, { configPath: configArg })
} else {
    prepareRendererRuntime(rootDir, { configPath: configArg })
    process.env.MDSITE_RENDERER_ORCHESTRATED = '1'
}

console.log(`✨ Starting Nuxt ${nuxtCommand.toUpperCase()}...`)

const nuxtProcess = spawn('npx', ['nuxt', nuxtCommand], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env
})

nuxtProcess.on('close', (code) => {
    process.exit(code ?? 0)
})
