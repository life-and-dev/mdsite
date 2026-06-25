# MD-Site local CLI

MD-Site is a local-use CLI for markdown sites.
It drives `mdsite-nuxt` from one `mdsite.yml` in content dir.

## Primary features

- **`mdsite help`**: Show CLI help.
- **`mdsite init`**: Create `mdsite.yml` from local markdown files.
- **`mdsite start`**: Start local renderer in the foreground for current content directory.
- **`mdsite start -d` / `mdsite start --detached`**: Start tracked background renderer and log to `.mdsite-runtime/start.log`.
- **`mdsite generate`**: Build static output into `server.output`.
- **`mdsite preview`**: Preview generated output after `generate` in the foreground.
- **`mdsite preview -d` / `mdsite preview --detached`**: Start tracked background preview and log to `mdsite.log`.
- **`mdsite stop`**: Stop tracked detached `start` and `preview` processes.
- **`mdsite prepare github`**: Generate `.github/workflows/deploy.yml` for this content dir.

## Core flow or states

- `init` runs in current content directory.
- `start`, `generate`, `preview`, and `stop` use current working directory.
- `prepare github` uses current working directory.
- `start` and `preview` run in the foreground with terminal output; closing the terminal or interrupting the command stops them.
- `start -d` / `start --detached` and `preview -d` / `preview --detached` are tracked background processes.
- `preview` expects a prior `generate` run.
- Missing renderer `node_modules` triggers `npm install` in renderer dir.
- CLI writes compatibility artifacts during orchestration and runtime artifacts for tracked background processes.

## Architecture map

- `src/index.ts`: CLI entrypoint and command dispatch.
- `src/commands/`: Command handlers.
- `src/renderer/mdsite-nuxt.ts`: Renderer prep and run helpers.
- `mdsite-nuxt/`: Checked-in renderer used by the CLI.
- `package.json`: Root CLI package config.
- `.agent/plan.md`: Phase 1 spec source.

## Rules

- Keep docs truthful to current local CLI behavior.
- Do not document clone/pull workflow as active behavior.
- Do not move rendering logic into the CLI.
- Prefer TypeScript for new code.
- Breaking changes are acceptable during Phase 1 stabilization.
- Treat npm release hardening and true git submodule conversion as deferred.
