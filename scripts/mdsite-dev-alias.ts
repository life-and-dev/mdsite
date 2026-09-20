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
const managedBlock = `${beginMarker}
${aliasName}() {
  local mdsite_root=${shellQuote(projectRoot)}
  local nvmrc="$mdsite_root/.nvmrc"
  local nvm_script=""
  local node_version
  local resolved_version

  if ! IFS= read -r node_version < "$nvmrc" || [ -z "$node_version" ]; then
    echo "mdsite-dev: Cannot read pinned Node version from $nvmrc." >&2
    return 1
  fi

  if ! command -v nvm >/dev/null 2>&1; then
    if [ -n "\${NVM_DIR:-}" ] && [ -s "$NVM_DIR/nvm.sh" ]; then
      nvm_script="$NVM_DIR/nvm.sh"
    elif [ -s "$HOME/.nvm/nvm.sh" ]; then
      nvm_script="$HOME/.nvm/nvm.sh"
    elif [ -s "\${XDG_CONFIG_HOME:-$HOME/.config}/nvm/nvm.sh" ]; then
      nvm_script="\${XDG_CONFIG_HOME:-$HOME/.config}/nvm/nvm.sh"
    else
      echo 'mdsite-dev: NVM is required. Install NVM or load nvm.sh, then retry.' >&2
      return 1
    fi

    . "$nvm_script"
  fi

  if ! command -v nvm >/dev/null 2>&1; then
    echo "mdsite-dev: NVM setup $nvm_script did not define nvm." >&2
    return 1
  fi

  resolved_version="$(nvm version "$node_version" 2>/dev/null)"
  if [ -z "$resolved_version" ] || [ "$resolved_version" = "N/A" ]; then
    echo "mdsite-dev: Node $node_version is not installed. Run \\"nvm install $node_version\\"." >&2
    return 1
  fi

  nvm exec --silent "$node_version" node "$mdsite_root/dist/index.js" "$@"
}
${endMarker}
`;
const rcFiles: string[] = [path.join(os.homedir(), ".bashrc"), path.join(os.homedir(), ".zshrc")];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
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
