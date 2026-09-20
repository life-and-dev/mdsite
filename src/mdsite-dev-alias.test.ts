import { execFileSync, spawnSync, type SpawnSyncReturns } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

const generatorPath = fileURLToPath(new URL('../scripts/mdsite-dev-alias.ts', import.meta.url))
const projectRoot = path.resolve(path.dirname(generatorPath), '..')
const temporaryDirectories: string[] = []

function installLauncher(): { home: string; rcFile: string } {
  const home = mkdtempSync(path.join(tmpdir(), 'mdsite-dev-'))
  const rcFile = path.join(home, '.bashrc')
  temporaryDirectories.push(home)
  writeFileSync(rcFile, '')
  execFileSync(process.execPath, [generatorPath, 'install'], {
    env: { ...process.env, HOME: home, SHELL: '/bin/bash' }
  })
  return { home, rcFile }
}

function runLauncher(rcFile: string, home: string, setup: string): SpawnSyncReturns<string> {
  return spawnSync('/bin/bash', ['--noprofile', '--norc', '-c', `${setup}\nsource "$RC_FILE"\nmdsite-dev "live mode" "/tmp/path with spaces"`], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home, RC_FILE: rcFile }
  })
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('mdsite-dev launcher generator', () => {
  it('generates an NVM launcher that preserves CLI arguments and quoted paths', () => {
    const { home, rcFile } = installLauncher()
    const launcher = readFileSync(rcFile, 'utf8')
    const result = runLauncher(rcFile, home, `
nvm() {
  if [ "$1" = "version" ]; then
    printf 'v24.0.0\\n'
    return
  fi
  shift
  [ "$1" = "--silent" ] && shift
  printf 'version=<%s>\\n' "$1"
  shift
  for argument in "$@"; do printf 'arg=<%s>\\n' "$argument"; done
}`)

    expect(launcher).toContain('nvm exec --silent "$node_version" node "$mdsite_root/dist/index.js" "$@"')
    expect(result.status).toBe(0)
    expect(result.stdout).toBe([
      'version=<24>',
      'arg=<node>',
      `arg=<${path.join(projectRoot, 'dist', 'index.js')}>`,
      'arg=<live mode>',
      'arg=</tmp/path with spaces>',
      ''
    ].join('\n'))
  })

  it('loads NVM from NVM_DIR when the shell has not loaded it', () => {
    const { home, rcFile } = installLauncher()
    const nvmDir = path.join(home, 'nvm with spaces')
    mkdirSync(nvmDir)
    writeFileSync(path.join(nvmDir, 'nvm.sh'), `
nvm() {
  [ "$1" = "version" ] && { printf 'v24.0.0\\n'; return; }
  printf 'loaded=<%s>\\n' "$4"
}`)
    const result = runLauncher(rcFile, home, 'export NVM_DIR="$HOME/nvm with spaces"')

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('loaded=<node>')
  })

  it('fails with an actionable error when NVM is unavailable', () => {
    const { home, rcFile } = installLauncher()
    const result = runLauncher(rcFile, home, 'unset -f nvm; export PATH=/usr/bin:/bin; export NVM_DIR="$HOME/missing-nvm"')

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('NVM is required. Install NVM or load nvm.sh, then retry.')
  })

  it('fails with an install command when pinned Node is unavailable', () => {
    const { home, rcFile } = installLauncher()
    const result = runLauncher(rcFile, home, `nvm() { [ "$1" = "version" ] && printf 'N/A\\n'; }`)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Node 24 is not installed. Run "nvm install 24".')
  })
})
