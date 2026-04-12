# AGENTS.md

This file provides guidance to AI agents when working with code in this repository.

<!-- Last updated: 2026-04-10 -->

## Project Status: CLI-FIRST STABILIZATION

**IMPORTANT**: User-facing documentation must describe the currently implemented local-use CLI workflow, not the former monolithic root workflow.

## Active Stabilization Target

The current Phase 1 target is a local-use CLI (`mdsite`) from the root package that orchestrates `mdsite-nuxt` via `_mdsite.yml`.

- Implemented commands: `help`, `init`, `start`, `generate`, `preview`, `stop`
- `init` creates `_mdsite.yml` in the current working directory and derives defaults from local markdown files
- `start`, `generate`, `preview`, and `stop` operate on the current working directory as the content/project directory
- `start`, `generate`, `preview`, and `stop` are documented for initialized content directories using `_mdsite.yml`
- `preview` is a post-`generate` local preview step
- `stop` stops tracked `start` and `preview` background processes
- Breaking changes are acceptable during this stabilization period
- Npm release hardening and true git submodule conversion are deferred until local workflows are reliable

## Current State vs Target State

**Legacy**: Monolithic Nuxt application with content processing and root npm workflows
**Current (Phase 1)**: Lightweight local-use CLI that orchestrates `mdsite-nuxt`

**DO NOT** document or reintroduce legacy root workflows as current usage. Treat `LEGACY.md` as reference-only.

## Development Guidelines

### For New Development
- Follow the specification in `.agent/plan.md`
- Create CLI commands in `src/` directory
- Use TypeScript for all new code
- Focus on orchestrating the Nuxt submodule, not duplicating its functionality
- Prioritize reliable local workflows over publish/release hardening
- Keep docs truthful to implemented behavior: local renderer resolution only, no current clone/pull workflow docs

### Legacy Reference
The previous version of this project (Nuxt-based monolithic SSG) is documented in `LEGACY.md`. This documentation describes how the project used to work and can be used as reference for understanding the existing codebase during the transition, but should NOT guide new development. Legacy root workflows are deprecated and reference-only.

## Project Structure (Target)

```
/
├── src/                 # CLI source code (TypeScript)
├── mdsite-nuxt/         # Nuxt renderer used by the CLI (submodule conversion deferred)
├── package.json         # CLI package configuration
├── .agent/plan.md       # Complete specification for new system
└── README.md           # User-facing documentation
```

## Key Implementation Notes

- CLI should be lightweight and focus on orchestration
- All rendering logic stays in the Nuxt submodule
- Configuration format changes from multiple YAML files to single `_mdsite.yml`
- Process management for starting/stopping Nuxt dev/preview servers
- Renderer resolution is local-only for now: use `server.path` relative to the content dir if present, otherwise fall back to checked-in `mdsite-nuxt`
- If renderer `node_modules` is missing, the CLI runs `npm install` in the renderer directory
- `generate` syncs built output into `server.output` under the content dir
- The CLI writes compatibility/runtime artifacts such as `_menu.yml`, `.mdsite-runtime/`, and renderer env/config files
- Git submodule management, clone/pull flows, and release hardening are post-stabilization concerns
