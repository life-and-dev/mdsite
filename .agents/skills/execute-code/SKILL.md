---
name: execute-code
description: Use `execute-code` to get "Technical Design" when you must design technical tasks, implement features or refactor code.
---

# Technical Design

## Architectural Overview
Local-first `mdsite` CLI drives checked-in `mdsite-nuxt` renderer from current content dir. CLI loads `mdsite.yml`, prepares renderer env/files, runs Nuxt scripts, syncs generated output back to content dir, and tracks background PIDs.

## Technology Choices
- **TypeScript**: CLI, config, process, renderer glue live in `src/`.
- **YAML**: `mdsite.yml`, `_menu.yml`, renderer compat files use YAML.
- **Node child process APIs**: start/stop/background orchestration.

## Key Data Models
- **MdsiteConfig** (`src/config/mdsite-config.ts`): site, menu, server, theme, feature config.
- **RuntimeProcessState** (`src/process/runtime-state.ts`): tracked `start`/`preview` PID and log state.

## Key API Endpoints
- `mdsite help` (`src/index.ts`): show supported commands.
- `mdsite init` (`src/index.ts`): create `mdsite.yml`.
- `mdsite start` (`src/index.ts`): start renderer dev server.
- `mdsite generate` (`src/index.ts`): build static output.
- `mdsite preview` (`src/index.ts`): preview generated output.
- `mdsite stop` (`src/index.ts`): stop tracked processes.
- `mdsite prepare github` (`src/index.ts`): generate GitHub Pages workflow.

## Error Handling
- **loadMdsiteConfig** (`src/config/mdsite-config.ts`): missing `mdsite.yml` throws init hint.
- **runStartCommand** (`src/commands/start.ts`): blocks duplicate running PID.
- **runPreviewCommand** (`src/commands/preview.ts`): blocks duplicate preview PID.
- **ensurePreviewArtifacts** (`src/renderer/mdsite-nuxt.ts`): preview needs prior `generate`.

## Security Design
No auth or role layer in CLI. Renderer env built from local content dir and current process env. Config paths stay local; renderer resolution is local-only, with fallback to checked-in `mdsite-nuxt` when `server.path` path not present.

## External Integrations
- **mdsite-nuxt** (`mdsite-nuxt/`): Nuxt renderer scripts, build, dev, preview, prepare.
- **GitHub Pages workflow** (`src/commands/prepare.ts`): writes `.github/workflows/deploy.yml`.

## Directory Structure
- **CLI source** (`src/`): commands, config, renderer prep, process state.
- **Renderer assets** (`mdsite-nuxt/`): checked-in Nuxt app used by CLI.
- **Runtime state** (`.mdsite-runtime/`): tracked process JSON and logs.

## Special Files
- `mdsite.yml`: single content-dir config file.
- `_menu.yml`: generated menu compatibility file.
- `.mdsite-runtime/`: start/preview state and logs.
- `mdsite-nuxt/.env`: renderer env written by CLI.
- `mdsite-nuxt/content.config.yml`: renderer compat config written by CLI.
- `mdsite-nuxt/.mdsite-compat.yml`: checked-in compat config.

## Known Risks & Anti-Patterns
- **Local fallback renderer**: `server.path` missing falls back to checked-in `mdsite-nuxt`.
- **Generated state files**: CLI writes runtime and compat files into content/renderer dirs.
- **Preview depends on generate**: no built output means preview fails.

---

**IMPORTANT**: Update `.agents/skills/execute-code/SKILL.md` whenever architecture, APIs, data models, security, or integrations change.
