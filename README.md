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

All commands operate on the **current working directory** as the content/project directory. `version` prints the CLI version from the root `package.json`. `prepare github` requires `mdsite.yml` and writes a GitHub Pages workflow for that content directory.

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

Use `mdsite start -d` or `mdsite start --detached` to run a tracked background renderer instead. Detached start logs to `.mdsite-runtime/start.log` in the content directory and opens the browser automatically after the server is ready.

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

Use `mdsite preview -d` or `mdsite preview --detached` to run a tracked background preview instead. Detached preview logs to `mdsite.log` in the content directory and writes runtime state under `.mdsite-runtime/`.

### 5. Stop background processes

```bash
mdsite stop
```

`stop` is intended for initialized content directories and stops tracked detached `start` and `preview` background processes for the current content directory, not foreground processes.

### 6. Prepare a GitHub Pages workflow

```bash
mdsite prepare github
```

`prepare github` requires `mdsite.yml`, prepares the configured local renderer, and writes `.github/workflows/deploy.yml` in the current content directory. The generated workflow uses the configured local `server.path` during GitHub Actions; it does not add a renderer clone or pull workflow.

For production deployments, see the [Deployment guide](https://life-and-dev.github.io/mdsite/deploy).

## Renderer resolution

Renderer resolution is **local-only**:

- If `mdsite.yml` sets `server.path`, the CLI first looks for that path **relative to the content directory**.
- If that directory is not present, the CLI falls back to the bundled renderer shipped with the package.
- If the renderer's `node_modules` directory is missing, the CLI runs `npm install` in the renderer directory.
- `prepare github` requires the configured `server.path` renderer directory to exist; unlike `start`, `generate`, and `preview`, it does not fall back to the bundled renderer when that configured path is absent.

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
├── mdsite.yml
├── _menu.yml                # orchestration/compatibility artifact
├── .mdsite-runtime/         # created when tracked background processes are started
├── .output/                 # created by mdsite generate, or server.output
├── index.md
└── other-pages.md
```

The CLI also writes renderer compatibility files such as `_menu.yml` and the renderer's `.env` / `content.config.yml` as part of orchestration. Tracked background commands write runtime files under `.mdsite-runtime/`.

## Troubleshooting

### `mdsite.yml` is missing

If `start`, `generate`, `preview`, or `stop` are not behaving as expected, first confirm you are in the intended content directory and that `mdsite.yml` exists there:

```bash
mdsite init
```

### Renderer directory issues

- If `server.path` is set, confirm it points to a renderer directory relative to the content directory.
- If that path does not exist, the CLI falls back to the bundled renderer shipped with the package.
- If neither renderer location exists, the CLI cannot run.
- For `prepare github`, the configured `server.path` must exist because workflow generation uses the configured renderer path directly.

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
| `favicon`                | empty string                             | Optional favicon path relative to the content directory.                                                                                                  |
| `features.bibleTooltips` | `true`                                   | Enables renderer Bible tooltip support.                                                                                                                   |
| `features.sourceEdit`    | `true`                                   | Enables renderer source-edit support.                                                                                                                     |
| `menu`                   | derived from markdown files              | Menu structure used to generate `_menu.yml`.                                                                                                              |
| `server.output`          | `.output`                                | Static output path under the content directory.                                                                                                           |
| `server.path`            | `.mdsite`                                | Renderer path relative to the content directory. Local commands fall back to the bundled renderer when this path is absent, except `prepare github`.      |
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
