![MD-Site](docs/logo.svg)

# MD-Site

> **Current status:** MD-Site is a **local-use CLI** (`mdsite`) from this repository's root package. It orchestrates the checked-in `mdsite-nuxt` renderer around a single `_mdsite.yml` file in your content directory.

## Current workflow

Use the CLI from the root package, then operate on your markdown project directory:

1. Build the local CLI in this repository.
2. Change into the markdown/content directory you want to serve.
3. Invoke the built CLI from this repository path, or use a local alias/link that points to it.
4. Run `init` once to create `_mdsite.yml`.
5. Run `start` for local development.
6. Run `generate` to build static output.
7. Run `preview` after `generate` for a local preview.
8. Run `stop` to stop tracked background `start` and `preview` processes.

## Implemented commands

```text
mdsite help
mdsite init
mdsite start
mdsite generate
mdsite preview
mdsite stop
mdsite prepare github
```

All commands operate on the **current working directory** as the content/project directory.
`prepare github` also requires `_mdsite.yml` and writes a GitHub Pages workflow for that content directory.

## Minimum local setup

This repository currently documents a **local-only** workflow:

```bash
# in this repository
npm install
npm run build

# invoke the built CLI directly from the repo path
node /path/to/md-site/dist/index.js help
```

If you create a local shell alias or link for that built file, the shorter `mdsite ...` examples below refer to that local alias/link.

For example, without any alias:

```bash
cd /path/to/your/content
node /path/to/md-site/dist/index.js help
```

## Supported CLI flow

### 1. Initialize a content directory

```bash
cd /path/to/your/content
node /path/to/md-site/dist/index.js init
```

`init` creates `_mdsite.yml` in the current directory and derives defaults from local markdown files.

### 2. Start local development

```bash
cd /path/to/your/content
node /path/to/md-site/dist/index.js start
```

`start` requires `_mdsite.yml`, prepares renderer compatibility files, installs renderer dependencies when `node_modules` is missing, and starts the renderer in the background.

### 3. Generate static output

```bash
cd /path/to/your/content
node /path/to/md-site/dist/index.js generate
```

`generate` requires `_mdsite.yml` and writes the generated site to `server.output` under the content directory.

### 4. Preview generated output

```bash
cd /path/to/your/content
node /path/to/md-site/dist/index.js preview
```

`preview` is a **post-generate** local preview step. It requires `_mdsite.yml` and an existing generated renderer build.

### 5. Stop background processes

```bash
cd /path/to/your/content
node /path/to/md-site/dist/index.js stop
```

`stop` is intended for initialized content directories and stops tracked `start` and `preview` background processes for the current content directory.

### 6. Prepare a GitHub Pages workflow

```bash
cd /path/to/your/content
node /path/to/md-site/dist/index.js prepare github
```

`prepare github` requires `_mdsite.yml`, prepares the configured local renderer, and writes `.github/workflows/deploy.yml` in the current content directory. The generated workflow uses the configured local `server.path` during GitHub Actions; it does not add a renderer clone or pull workflow.

## Renderer resolution

Renderer resolution is currently **local-only**:

- If `_mdsite.yml` sets `server.path`, the CLI first looks for that path **relative to the content directory**.
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

After `mdsite init` and `mdsite generate`:

```text
your-content/
├── _mdsite.yml
├── _menu.yml                # orchestration/compatibility artifact
├── .mdsite-runtime/         # created when tracked background processes are started
├── .output/                 # created by mdsite generate, or server.output
├── index.md
└── other-pages.md
```

The CLI also writes renderer compatibility/runtime files such as `_menu.yml`, `_mdsite.log`, `.mdsite-runtime/`, `mdsite-nuxt/.env`, and `mdsite-nuxt/content.config.yml` as part of orchestration.

## Migration notes for existing users

If you previously used the legacy root workflow:

- Replace `npm start` with `node /path/to/md-site/dist/index.js start`.
- Replace `npm run generate` with `node /path/to/md-site/dist/index.js generate`.
- Replace `npm run preview` with `node /path/to/md-site/dist/index.js preview` after `node /path/to/md-site/dist/index.js generate`.
- Replace legacy root/domain config assumptions with a single `_mdsite.yml` in the content directory.
- Treat `content.config.yml` and domain-specific `*.config.yml` files as legacy reference, not current setup.
- Keep custom markdown content, menus, and theme values, but move current configuration intent into `_mdsite.yml`.

## Troubleshooting

### `_mdsite.yml` is missing

If `start`, `generate`, `preview`, or `stop` are not behaving as expected, first confirm you are in the intended content directory and that `_mdsite.yml` exists there:

```bash
node /path/to/md-site/dist/index.js init
```

### Renderer directory issues

- If `server.path` is set, confirm it points to a renderer directory relative to the content directory.
- If that path does not exist, the CLI falls back to the checked-in `mdsite-nuxt` directory in this repository.
- If neither renderer location exists, the CLI cannot run.
- For `prepare github`, the configured `server.path` must exist because workflow generation uses the configured renderer path directly.

### Renderer dependencies missing

If the renderer has no `node_modules`, the CLI runs `npm install` in the renderer directory automatically. If that install fails, fix the renderer dependency issue and rerun the command.

### Preview fails

Run `node /path/to/md-site/dist/index.js generate` first. `preview` requires an existing generated renderer build.

### Config problems

- `_mdsite.yml` must be valid YAML.
- `server.output` is resolved under the content directory.
- `server.path` is resolved relative to the content directory.
- If `favicon` is configured, the referenced file must exist.

## Configuration reference

`_mdsite.yml` is the only active content-directory configuration file. `mdsite init` creates it and fills defaults from local markdown files where possible.

| Key | Default | Description |
| --- | --- | --- |
| `favicon` | empty string | Optional favicon path relative to the content directory. |
| `features.bibleTooltips` | `true` | Enables renderer Bible tooltip support. |
| `features.sourceEdit` | `true` | Enables renderer source-edit support. |
| `menu` | derived from markdown files | Menu structure used to generate `_menu.yml`. |
| `server.output` | `.output` | Static output path under the content directory. |
| `server.path` | `.mdsite` | Renderer path relative to the content directory. Local commands fall back to checked-in `mdsite-nuxt/` when this path is absent, except `prepare github`. |
| `server.repo` | `https://github.com/life-and-dev/mdsite` | Stored for compatibility and generated renderer config. It is not used for active clone/pull behaviour. |
| `site.canonical` | empty string | Canonical site URL passed to the renderer. |
| `site.name` | derived from `index.md` or directory | Site name passed to the renderer. |
| `themes.light.colors` | built-in palette | Light theme colour overrides. |
| `themes.dark.colors` | built-in palette | Dark theme colour overrides. |

## Deferred follow-up items

The following work is still deferred and is **not** documented as current behavior:

- renderer clone/pull flows via `server.repo`
- npm packaging and publishing hardening
- true git submodule conversion
- advanced migration utilities
- broad backward-compatibility bridges
- performance tuning and benchmarking
- full release management and distribution hardening

These remain follow-up items from `.kiro/specs/cli-migration/tasks.md` and `.kiro/specs/cli-migration/requirements.md`, not part of the current supported workflow.

## Additional project documentation

The renderer and feature documentation in `docs/` remains useful for content/rendering context, but root command examples should be interpreted through the current CLI-first workflow above.
