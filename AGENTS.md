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
- `src/config/`: `mdsite.yml` schema, defaults, and menu parsing.
- `src/process/`: Foreground/background child-process and runtime-state helpers.
- `src/renderer/mdsite-nuxt.ts`: Renderer prep and run helpers.
- `mdsite-nuxt/`: Nuxt renderer, pulled in as a git submodule pinned in `.gitmodules` (source: https://github.com/life-and-dev/mdsite-nuxt).
- `package.json`: Root CLI package config.
- `docs/develop.md`: Contributor-facing architecture overview. Read this before changing CLI/renderer integration.

## Rules

- Keep docs truthful to current CLI behavior.
- Do not move rendering logic into the CLI; rendering belongs in `mdsite-nuxt/`.
- Prefer TypeScript for new code.
- `mdsite-nuxt/` is a git submodule: edit it inside its own repository, then bump the submodule pointer in the parent repo. Never vendor renderer source into the CLI.
- npm releases are tag-driven via `.github/workflows/npm-publish.yml` with provenance and Trusted Publisher. Cut releases with `npm run release:version -- <bump>`, then push the tag.
- User-facing docs go in `README.md` and `docs/` (top-level + user tutorials). Contributor docs go in `docs/develop.md` and `docs/develop/`.
- In `README.md`, link to documentation with absolute URLs prefixed `https://life-and-dev.github.io/mdsite/` so links resolve from the npm registry. In other markdown files, use relative links.
