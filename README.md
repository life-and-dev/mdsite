![MDsite](docs/logo.svg)

# MDsite

## Current workflow

Use the CLI from the root package, then operate on your markdown project directory:

1. Build the local CLI in this repository.
2. Change into the markdown/content directory you want to serve.
3. Invoke the built CLI from this repository path, or use a local alias/link that points to it.
4. Run `init` once to create `mdsite.yml`.
5. Run `start` for foreground local development, or `start -d` for a tracked background process that opens the browser after the server is ready.
6. Run `generate` to build static output.
7. Run `preview` after `generate` for a foreground local preview, or `preview -d` for a tracked background preview.
8. Run `stop` to stop tracked detached `start` and `preview` processes.

## Documentation location

[Primary project documentation](docs/index.md) and demo content belong in this repository root, such as this `README.md` and `docs/`. Keep `mdsite-nuxt/` documentation limited to renderer internals.

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

All commands operate on the **current working directory** as the content/project directory.
`version` prints the CLI version from the root `package.json`; run it as `mdsite version` or `node /path/to/md-site/dist/index.js version`.
`prepare github` also requires `mdsite.yml` and writes a GitHub Pages workflow for that content directory.

## Local Development Setup

This repository currently documents a **local-only** workflow:

```bash
# in this repository
npm install
npm run build
npm run install-alias
```

Restart CLI terminal session.

Then run the `mdsite-dev` alias from any directory containing `mdsite.yml`:

```bash
mdsite-dev start
```

Open http://localhost:3000/. The command runs in the foreground and writes renderer output to the terminal; closing the terminal or interrupting the command stops the process.

To run the demo as a tracked background process instead, use `mdsite-dev start -d` or `mdsite-dev start --detached`. Detached start logs to `.mdsite-runtime/start.log` in the content directory and opens the browser automatically after the server is ready.

To stop a detached local preview:

```bash
mdsite-dev stop
```

> [!NOTE] When using `mdsite-dev` locally (e.g. `npm run install-alias`), the CLI utility is called `mdsite-dev`. When installed globally via npm registry, the CLI utility is called `mdsite` instead.

## Release version and npm publish

The npm package is `@life-and-dev/mdsite`. To bump the package version and create a release tag, run:

```bash
npm run release:version -- patch
npm run release:version -- minor
npm run release:version -- major
npm run release:version -- x.y.z
```

The script updates `package.json` and `package-lock.json` with `npm version`, runs typecheck, build, and package verification, commits `chore: release v<version>`, and creates a local annotated tag named `v<version>`.

The script does not push changes or publish to npm. Push the release commit and tag manually:

```bash
git push origin main
git push origin v<version>
```

> [!WARNING]
> Pushing the `v<version>` tag triggers the GitHub Actions npm publish workflow with provenance. The `npm-publish.yml` workflow requires npm Trusted Publisher configuration for `@life-and-dev/mdsite`.

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

`preview` is a **post-generate** local preview step. It requires `mdsite.yml` and an existing generated renderer build.
By default, it runs in the foreground with terminal output. Closing the terminal or interrupting the command stops the foreground preview.

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

## Renderer resolution

Renderer resolution is currently **local-only**:

- If `mdsite.yml` sets `server.path`, the CLI first looks for that path **relative to the content directory**.
- If that directory is not present, the CLI falls back to the checked-in repository renderer at `mdsite-nuxt/`.
- If the renderer's `node_modules` directory is missing, the CLI runs `npm install` in the renderer directory.
- `prepare github` requires the configured `server.path` renderer directory to exist; unlike `start`, `generate`, and `preview`, it does not fall back to the checked-in renderer when that configured path is absent.

Current documentation does **not** describe clone/pull behavior as active usage.

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

The CLI also writes renderer compatibility files such as `_menu.yml`, `mdsite-nuxt/.env`, and `mdsite-nuxt/content.config.yml` as part of orchestration. Tracked background commands write runtime files under `.mdsite-runtime/`.

## Migration notes for existing users

If you previously used the legacy root workflow:

- Replace `npm start` with `node /path/to/md-site/dist/index.js start`.
- Replace `npm run generate` with `node /path/to/md-site/dist/index.js generate`.
- Replace `npm run preview` with `node /path/to/md-site/dist/index.js preview` after `node /path/to/md-site/dist/index.js generate`.
- Replace legacy root/domain config assumptions with a single `mdsite.yml` in the content directory.
- Treat `content.config.yml` and domain-specific `*.config.yml` files as legacy reference, not current setup.
- Keep custom markdown content, menus, and theme values, but move current configuration intent into `mdsite.yml`.

## Troubleshooting

### `mdsite.yml` is missing

If `start`, `generate`, `preview`, or `stop` are not behaving as expected, first confirm you are in the intended content directory and that `mdsite.yml` exists there:

```bash
mdsite init
```

### Renderer directory issues

- If `server.path` is set, confirm it points to a renderer directory relative to the content directory.
- If that path does not exist, the CLI falls back to the checked-in `mdsite-nuxt` directory in this repository.
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

## Configuration reference

`mdsite.yml` is the only active content-directory configuration file. `mdsite init` creates it and fills defaults from local markdown files where possible.

| Key                      | Default                                  | Description                                                                                                                                               |
| ------------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `favicon`                | empty string                             | Optional favicon path relative to the content directory.                                                                                                  |
| `features.bibleTooltips` | `true`                                   | Enables renderer Bible tooltip support.                                                                                                                   |
| `features.sourceEdit`    | `true`                                   | Enables renderer source-edit support.                                                                                                                     |
| `menu`                   | derived from markdown files              | Menu structure used to generate `_menu.yml`.                                                                                                              |
| `server.output`          | `.output`                                | Static output path under the content directory.                                                                                                           |
| `server.path`            | `.mdsite`                                | Renderer path relative to the content directory. Local commands fall back to checked-in `mdsite-nuxt/` when this path is absent, except `prepare github`. |
| `server.repo`            | `https://github.com/life-and-dev/mdsite` | Stored for compatibility and generated renderer config. It is not used for active clone/pull behaviour.                                                   |
| `site.canonical`         | empty string                             | Canonical site URL passed to the renderer.                                                                                                                |
| `site.name`              | derived from `index.md` or directory     | Site name passed to the renderer.                                                                                                                         |
| `themes.light.colors`    | built-in palette                         | Light theme colour overrides.                                                                                                                             |
| `themes.dark.colors`     | built-in palette                         | Dark theme colour overrides.                                                                                                                              |
