![MDsite](docs/logo.svg)

# MDsite

MDsite is a local-first CLI that turns a directory of Markdown files into a static site using the bundled Nuxt renderer.

The full documentation lives at [https://life-and-dev.github.io/mdsite/](https://life-and-dev.github.io/mdsite/). This README is a quick reference for end users; contributors should jump to [Developing MDsite](https://life-and-dev.github.io/mdsite/develop).

## Install

Install the CLI globally from the npm registry on any machine with Node.js (>= 24.0.0) and npm:

```bash
npm install -g @life-and-dev/mdsite
```

After install, the `mdsite` command is available from any content directory.

## Quick start

From the directory containing your Markdown files:

1. Run `mdsite init` once to create `mdsite.yml` and a `.nvmrc` pinning Node 24.
2. Run `mdsite start` for foreground local development, or `mdsite start -d` for a tracked background process that opens the browser after the server is ready.
3. Run `mdsite generate` to build static output.
4. Run `mdsite preview` after `generate` for a foreground local preview, or `mdsite preview -d` for a tracked background preview.
5. Run `mdsite stop` to stop tracked detached `start` and `preview` processes.

## Implemented commands

```text
mdsite help
mdsite version
mdsite init
mdsite start
mdsite generate
mdsite preview
mdsite stop
mdsite prepare github
```

All commands operate on the **current working directory** as the content/project directory. `version` prints the CLI version from the root `package.json`. `prepare github` requires `mdsite.yml` and writes a GitHub Pages workflow for that content directory. `start` and `preview` also accept `-d`/`--detached` to run a tracked background server, and `--host` (or `--host <addr>`) to expose the server on the network — see the start and preview sections below.

## Supported CLI flow

### Check the CLI version

```bash
mdsite version
```

`version` prints the CLI version from the root `package.json`.

### 1. Initialize a content directory

```bash
mdsite init
```

`init` creates `mdsite.yml` in the current directory and derives defaults from local markdown files.

### 2. Start local development

```bash
mdsite start
```

`start` requires `mdsite.yml`, prepares renderer compatibility files, installs renderer dependencies when `node_modules` is missing, and runs the renderer in the foreground with terminal output. Closing the terminal or interrupting the command stops the foreground process.

Use `mdsite start -d` or `mdsite start --detached` to run a tracked background renderer instead. Detached start logs to `<server.path>/start.log` (e.g. `.mdsite/start.log`) in the content directory and opens the browser automatically after the server is ready.

Add `--host` (or `--host <addr>`) to expose the dev server on the network, e.g. `mdsite start --host` binds `0.0.0.0` so other devices on your LAN can reach it; `mdsite start --host 192.168.1.10` binds a specific address. Combine with detached mode as in `mdsite start -d --host`.

### 3. Generate static output

```bash
mdsite generate
```

`generate` requires `mdsite.yml` and writes the generated site to `server.output` under the content directory.

### 4. Preview generated output

```bash
mdsite preview
```

`preview` is a **post-generate** local preview step. It requires `mdsite.yml` and an existing generated renderer build. By default, it runs in the foreground with terminal output. Closing the terminal or interrupting the command stops the foreground preview.

Use `mdsite preview -d` or `mdsite preview --detached` to run a tracked background preview instead. Detached preview logs to `<server.path>/preview.log` (e.g. `.mdsite/preview.log`) in the content directory and writes runtime state under `<server.path>/` (e.g. `.mdsite/`).

Add `--host` (or `--host <addr>`) to expose the preview server on the network, the same way as `mdsite start`, e.g. `mdsite preview --host` binds `0.0.0.0`.

### 5. Stop background processes

```bash
mdsite stop
```

`stop` is intended for initialized content directories and stops tracked detached `start` and `preview` background processes for the current content directory, not foreground processes.

### 6. Prepare a GitHub Pages workflow

```bash
mdsite prepare github
```

`prepare github` requires `mdsite.yml` and writes a **self-adapting** `.github/workflows/deploy.yml` in the current content directory. The workflow checks out with `submodules: true`, then detects `bin/mdsite.js` to choose how to build:

- **Source build** (when `bin/mdsite.js` is present — the source repo): `npm install && npm run build && node bin/mdsite.js generate`.
- **End-user build** (otherwise): `npx -y @life-and-dev/mdsite generate`.

Either way it uploads the root `.output/public/`, runs on Node 24 (pinned via `.nvmrc`), and caches dependencies keyed on `.mdsite/package-lock.json`. No committed renderer tree is required for end users.

For production deployments, see the [Deployment guide](https://life-and-dev.github.io/mdsite/deploy).

## Renderer resolution

The CLI is **dev-aware** about where it runs the renderer:

- **Bundled renderer as the local submodule (this repo / contributors)** — when the bundled renderer is the checked-out `mdsite-nuxt/` submodule and is NOT inside `node_modules`, the CLI runs it **in place**, so live-editing of `mdsite-nuxt/` keeps working.
- **Bundled renderer inside `node_modules` (end users / `npm install` / `npx` / CI)** — the CLI copies the bundled renderer into `<server.path>` (default `.mdsite`) under your content directory and runs it there. The copy preserves any committed `<server.path>/package.json` and `<server.path>/package-lock.json` so the lockfile pair can be version-controlled.
- If the resolved renderer directory has no `node_modules`, the CLI runs `npm install` in it.
- `mdsite prepare github` generates a **self-adapting** workflow (see below) and never clones or pulls the renderer itself.

## Expected content project layout

Before initialization:

```text
your-content/
├── index.md
└── other-pages.md
```

After `mdsite init`, `mdsite generate`, and optional tracked background commands:

```text
your-content/
├── mdsite.yml                # your site config (written by init)
├── .nvmrc                    # Node 24 (written by init)
├── .gitignore                # managed by init (ignores .mdsite/* and .output/)
├── .mdsite/                  # renderer working dir (<server.path>)
│   ├── package.json          # committed lockfile pair (written by init)
│   ├── package-lock.json     # committed lockfile pair (written by init)
│   ├── start.json            # tracked-detached runtime state (when used)
│   ├── preview.json          # tracked-detached runtime state (when used)
│   ├── start.log             # detached start log (when used)
│   ├── preview.log           # detached preview log (when used)
│   └── public/               # generated favicons + site.webmanifest
├── .output/                  # deployable static site (server.output)
│   └── public/
├── index.md
└── other-pages.md
```

The content directory holds only your own files (`*.md`, `mdsite.yml`, `.nvmrc`, `.gitignore`, your favicon source). Everything the renderer needs at runtime — materialized source, `node_modules`, compatibility files (`.env`, `content.config.yml`), generated favicons, and detached-process state — lives inside the `.mdsite/` renderer working dir. Only `.mdsite/package.json` and `.mdsite/package-lock.json` are meant to be committed; everything else under `.mdsite/` and `.output/` is gitignored.

## Troubleshooting

### `mdsite.yml` is missing

If `start`, `generate`, `preview`, or `stop` are not behaving as expected, first confirm you are in the intended content directory and that `mdsite.yml` exists there:

```bash
mdsite init
```

### Renderer directory issues

- In this repo (dev), the bundled `mdsite-nuxt/` submodule runs in place; make sure it is checked out (`git submodule update --init --recursive`).
- For end users (`npm install` / `npx`), the CLI materializes the bundled renderer into `<server.path>` (default `.mdsite`) under your content directory; no manual renderer checkout is needed.
- If the resolved renderer directory has no `node_modules`, the CLI runs `npm install` in it automatically.
- `mdsite prepare github` generates a self-adapting workflow and never clones or pulls the renderer itself.

### Renderer dependencies missing

If the renderer has no `node_modules`, the CLI runs `npm install` in the renderer directory automatically. If that install fails, fix the renderer dependency issue and rerun the command.

### Preview fails

Run `mdsite generate` first. `preview` requires an existing generated renderer build.

### Config problems

- `mdsite.yml` must be valid YAML.
- `server.output` is resolved under the content directory.
- `server.path` is resolved relative to the content directory.
- If `favicon` is configured, the referenced file must exist.

For more, see the user guides on [Markdown](https://life-and-dev.github.io/mdsite/markdown), [Menu](https://life-and-dev.github.io/mdsite/menu), [Favicon](https://life-and-dev.github.io/mdsite/favicon), [Theme](https://life-and-dev.github.io/mdsite/theme), and [Features](https://life-and-dev.github.io/mdsite/features).

## Configuration reference

`mdsite.yml` is the only active content-directory configuration file. `mdsite init` creates it and fills defaults from local markdown files where possible.

| Key                      | Default                                  | Description                                                                                                                                               |
| ------------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `favicon`                | empty string                             | Source image path relative to the content directory (any format `sharp` supports). The renderer generates derived favicons into the renderer's `public/` dir.                                                                                                  |
| `features.bibleTooltips` | `true`                                   | Enables renderer Bible tooltip support.                                                                                                                   |
| `features.sourceEdit`    | `true`                                   | Enables renderer source-edit support.                                                                                                                     |
| `menu`                   | derived from markdown files              | Menu structure for the sidebar navigation.                                                                                                              |
| `server.output`          | `.output`                                | Static output path under the content directory.                                                                                                           |
| `server.path`            | `.mdsite`                                | The renderer working directory, relative to the content directory. End-user runs materialize the bundled renderer here; in the dev repo the bundled submodule runs in place.      |
| `server.repo`            | `https://github.com/life-and-dev/mdsite` | Stored for compatibility and generated renderer config. It is not used for active clone/pull behaviour.                                                   |
| `site.canonical`         | empty string                             | Canonical site URL passed to the renderer.                                                                                                                |
| `site.name`              | derived from `index.md` or directory     | Site name passed to the renderer.                                                                                                                         |
| `themes.light.colors`    | built-in palette                         | Light theme colour overrides.                                                                                                                             |
| `themes.dark.colors`     | built-in palette                         | Dark theme colour overrides.                                                                                                                              |

For full descriptions of each section, see the corresponding guides under [Documentation](https://life-and-dev.github.io/mdsite/).

## For Developers

MDsite is a thin TypeScript CLI that orchestrates a Nuxt renderer shipped as a git submodule. If you want to contribute, customize the renderer, run the test suites, or cut a release, the developer documentation lives at:

- [Developing MDsite](https://life-and-dev.github.io/mdsite/develop) — repository layout, CLI architecture, and CLI ↔ Nuxt integration.
- [Renderer (mdsite-nuxt submodule)](https://life-and-dev.github.io/mdsite/develop/nuxt) — what the submodule is, how to customize it, how to extend Nuxt with custom components.
- [Testing](https://life-and-dev.github.io/mdsite/develop/tests) — how to run the CLI and renderer test suites.
- [Release](https://life-and-dev.github.io/mdsite/develop/release) — how to cut and publish a new version of `@life-and-dev/mdsite`.
