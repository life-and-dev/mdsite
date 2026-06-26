#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const versionArg = process.argv[2];
const validVersionArgPattern = /^(patch|minor|major|(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)$/;
const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const packageJsonPath = resolve(projectRoot, 'package.json');

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error !== undefined) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function readPackageVersion() {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  return packageJson.version;
}

if (process.argv.length !== 3 || !validVersionArgPattern.test(versionArg)) {
  console.error('Usage: npm run release:version -- <patch|minor|major|x.y.z>');
  process.exit(1);
}

runCommand('npm', ['version', versionArg, '--no-git-tag-version']);
runCommand('npm', ['run', 'typecheck']);
runCommand('npm', ['run', 'build']);
runCommand('npm', ['run', 'verify:package']);

const version = readPackageVersion();

runCommand('git', ['add', 'package.json', 'package-lock.json']);
runCommand('git', ['commit', '-m', `chore: release v${version}`]);
runCommand('git', ['tag', '-a', `v${version}`, '-m', `@life-and-dev/mdsite v${version}`]);

console.log('\nNext manual commands:');
console.log('  git push origin main');
console.log(`  git push origin v${version}`);
console.log('\nWarning: pushing the tag triggers npm publish.');
