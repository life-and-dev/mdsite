#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aliasName = "mdsite-dev";
const beginMarker = `# >>> mdsite managed alias: ${aliasName} >>>`;
const endMarker = `# <<< mdsite managed alias: ${aliasName} <<<`;
const blockPattern = new RegExp(`${escapeRegExp(beginMarker)}\n[\\s\\S]*?\n${escapeRegExp(endMarker)}\n?`, "g");

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const entrypoint = path.join(projectRoot, "dist", "index.js");
const managedBlock = `${beginMarker}\nalias ${aliasName}="node ${entrypoint}"\n${endMarker}\n`;
const rcFiles: string[] = [path.join(os.homedir(), ".bashrc"), path.join(os.homedir(), ".zshrc")];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readIfExists(filePath: string): string | undefined {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  return fs.readFileSync(filePath, "utf8");
}

function removeManagedBlock(content: string): string {
  return content.replace(blockPattern, "");
}

function installAlias(filePath: string): void {
  const currentContent = readIfExists(filePath) ?? "";
  const withoutManagedBlock = removeManagedBlock(currentContent);
  const separator = withoutManagedBlock.length > 0 && !withoutManagedBlock.endsWith("\n") ? "\n" : "";

  fs.writeFileSync(filePath, `${withoutManagedBlock}${separator}${managedBlock}`);
}

function uninstallAlias(filePath: string): void {
  const currentContent = readIfExists(filePath);
  if (currentContent === undefined) {
    return;
  }

  fs.writeFileSync(filePath, removeManagedBlock(currentContent));
}

function getInstallTargets(): string[] {
  const existingFiles = rcFiles.filter((filePath) => fs.existsSync(filePath));
  if (existingFiles.length > 0) {
    return existingFiles;
  }

  return [process.env.SHELL?.includes("zsh") ? rcFiles[1] : rcFiles[0]];
}

function main(): void {
  const command = process.argv[2];

  if (command === "install") {
    getInstallTargets().forEach(installAlias);
    return;
  }

  if (command === "uninstall") {
    rcFiles.forEach(uninstallAlias);
    return;
  }

  console.error("Usage: node scripts/mdsite-dev-alias.ts <install|uninstall>");
  process.exitCode = 1;
}

main();
