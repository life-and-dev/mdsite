# MD-Site local CLI

MD-Site is a local-use CLI for markdown sites.
It drives `mdsite-nuxt` from one `mdsite.yml` in content dir.

## Primary features

- **`mdsite help`**: Show CLI help.
- **`mdsite init`**: Create `mdsite.yml` from local markdown files. Also writes a `.nvmrc` pinning Node 24 so Cloudflare, Netlify, and other hosts use the right Node version.
- **`mdsite live`**: Start local renderer in the foreground for current content directory.
- **`mdsite live -d` / `mdsite live --detached`**: Start tracked background renderer and log to `<server.path>/start.log`.
- **`mdsite live --host [addr]`** / **`mdsite static --host [addr]`**: Expose the `start`/`preview` server on the network by binding `0.0.0.0` (or a given addr) via `NUXT_HOST`/`HOST`/`NITRO_HOST`. Combinable with `-d`/`--detached`.
- **`mdsite generate`**: Build static output into `server.output`.
- **`mdsite static`**: Preview generated output after `generate` in the foreground.
- **`mdsite static -d` / `mdsite static --detached`**: Start tracked background preview and log to `<server.path>/preview.log`.
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
- `src/process/`: Foreground/background child-process helpers and runtime-state (writes tracked-detached PIDs/logs into the renderer working dir, not `.mdsite-runtime`).
- `src/renderer/mdsite-nuxt.ts`: Renderer prep and run helpers.
- `mdsite init`: writes `mdsite.yml`, `.nvmrc`, a managed `.gitignore`, and writes the renderer `package.json` + `package-lock.json` into `.mdsite/` from the bundled renderer with the project identity rewritten: `package.json` `name` = sanitized content-dir basename, `description` = `site.name`; both `package-lock.json` `name` fields are synced to match so `npm ci` won't dirty the committed lockfile.
- `mdsite-nuxt/`: Nuxt renderer, pulled in as a git submodule pinned in `.gitmodules` (source: https://github.com/life-and-dev/mdsite-nuxt).
- `package.json`: Root CLI package config.
- `docs/develop.md`: Contributor-facing architecture overview. Read this before changing CLI/renderer integration.

## Directory model

- **Content dir**: holds only user-authored files (`*.md`, `mdsite.yml`, `.nvmrc`, `.gitignore`, the user's favicon source). The CLI writes no generated non-config files to the content root.
- **`.mdsite/`** (`<server.path>`): the single renderer working dir — materialized renderer source (gitignored), `node_modules`, `.env`, `content.config.yml`, generated favicons, and detached-process runtime state (`start.json`/`preview.json`/`start.log`/`preview.log`). Only `package.json` + `package-lock.json` are committed.
- **`.output/`** (`<server.output>`): the deployable static site at the content root, synced by `mdsite generate`.
- `.mdsite-runtime/` and content-root `mdsite.log` no longer exist.

## Rules

- Keep docs truthful to current CLI behavior.
- Do not move rendering logic into the CLI; rendering belongs in `mdsite-nuxt/`.
- Prefer TypeScript for new code.
- `mdsite-nuxt/` is a git submodule: edit it inside its own repository, then bump the submodule pointer in the parent repo. Never vendor renderer source into the CLI.
- npm releases are tag-driven via `.github/workflows/npm-publish.yml` with provenance and Trusted Publisher. Cut releases with `npm run release:version -- <bump>`, then push the tag.
- User-facing docs go in `README.md` and `docs/` (top-level + user tutorials). Contributor docs go in `docs/develop.md` and `docs/develop/`.
- In `README.md`, link to documentation with absolute URLs prefixed `https://life-and-dev.github.io/mdsite/` so links resolve from the npm registry. In other markdown files, use relative links.
