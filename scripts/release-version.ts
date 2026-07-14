#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";

const versionArg: string | undefined = process.argv[2];
const validVersionArgPattern = /^(patch|minor|major|(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)$/;
const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const packageJsonPath = resolve(projectRoot, "package.json");

function runCommand(command: string, args: string[]): void {
  const result: SpawnSyncReturns<Buffer> = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error !== undefined) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function readPackageVersion(): string {
  const packageJson: { version?: string } = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  if (typeof packageJson.version !== "string") {
    throw new Error("package.json is missing a string version field");
  }
  return packageJson.version;
}

if (process.argv.length !== 3 || versionArg === undefined || !validVersionArgPattern.test(versionArg)) {
  console.error("Usage: npm run release:version -- <patch|minor|major|x.y.z>");
  process.exit(1);
}

runCommand("npm", ["version", versionArg, "--no-git-tag-version"]);
runCommand("npm", ["run", "typecheck"]);
runCommand("npm", ["run", "build"]);
runCommand("npm", ["run", "verify:package"]);

const version = readPackageVersion();

runCommand("git", ["add", "package.json", "package-lock.json"]);
runCommand("git", ["commit", "-m", `chore(release): v${version}`]);
runCommand("git", ["tag", "-a", `v${version}`, `-m`, `@life-and-dev/mdsite v${version}`]);

console.log(`\nRelease v${version} prepared. Pushing branch and tag to origin...`);
