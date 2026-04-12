![MD-Site](docs/logo.svg)

# MD-Site

> **Current status:** MD-Site is a CLI (`mdsite`) from this repository's root package. It orchestrates the `mdsite-nuxt` renderer around a single `_mdsite.yml` file in your content directory for local development and static deployment workflows.

## Current workflow

Use the CLI from the root package, then operate on your markdown project directory:

1. Build the local CLI in this repository.
2. Change into the markdown/content directory you want to serve.
3. Invoke the built CLI from this repository path, or use a local alias/link that points to it.
4. Run `init` once to create `_mdsite.yml`.
5. Run `start` for local development.
6. Run `generate` to build static output.
7. Run `preview` after `generate` for a local preview.
8. Run `prepare github` to generate a GitHub Pages workflow in the content directory.
9. Run `stop` to stop tracked background `start` and `preview` processes.

Legacy root workflows such as `npm start`, `npm run generate`, and `npm run preview` are **not** the supported user workflow anymore.

## Implemented commands

```text
mdsite help
mdsite init
mdsite start
mdsite generate
mdsite preview
mdsite prepare github
mdsite stop
```

All commands operate on the **current working directory** as the content/project directory.

## Minimum local setup

This repository documents the supported CLI workflow for local development and static deployment packaging:

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

`generate` requires `_mdsite.yml`, prepares the renderer, runs the renderer generate step, and syncs renderer `.output/public` into `server.output` under the content directory. The default `server.output` is `.output`.

### 4. Preview generated output

```bash
cd /path/to/your/content
node /path/to/md-site/dist/index.js preview
```

`preview` is a **post-generate** local preview step. It requires `_mdsite.yml` and an existing generated renderer build.

### 5. Prepare a GitHub Pages workflow

```bash
cd /path/to/your/content
node /path/to/md-site/dist/index.js prepare github
```

`prepare github` generates `.github/workflows/deploy.yml` in the current content directory for GitHub Pages deployment.

### 6. Stop background processes

```bash
cd /path/to/your/content
node /path/to/md-site/dist/index.js stop
```

`stop` is intended for initialized content directories and stops tracked `start` and `preview` background processes for the current content directory.

## Renderer resolution

Renderer resolution follows the current CLI implementation:

- If `_mdsite.yml` sets `server.path`, the CLI first looks for that path **relative to the content directory**.
- If that directory is not present, the CLI clones `server.repo` into that location.
- If the renderer's `node_modules` directory is missing, the CLI runs `npm install` in the renderer directory.

This applies to local runs and CI builds such as GitHub Pages or Cloudflare Pages.

## Deployment

Deployment is based on a content repository or repo root that contains markdown files and `_mdsite.yml`.

### Static packaging with `mdsite generate`

Run `mdsite generate` from the content directory or repository root that contains `_mdsite.yml`.

- The CLI reads `_mdsite.yml` from the current working directory.
- It prepares the renderer using `server.path` relative to the content directory.
- If `server.path` does not exist, it clones `server.repo` there.
- If renderer dependencies are missing, it runs `npm install` in the renderer directory.
- It runs the renderer generate step and syncs the built site into `server.output` under the content directory.

That output directory is the packaged static site for any static web server. If `server.output` is omitted, the generated site is written to `.output`.

### GitHub Pages

Use the implemented workflow-generation command:

```bash
cd /path/to/your/content
node /path/to/md-site/dist/index.js prepare github
```

This generates `.github/workflows/deploy.yml` in the content directory. The generated workflow builds the CLI, runs `node dist/index.js generate`, uploads the generated files from `server.output`, and deploys them with GitHub Pages actions.

### Cloudflare Pages

Cloudflare support is the same static-output flow from `mdsite generate`.

- Build command: `npm install && npm run build && node dist/index.js generate`
- Output directory: the generated `server.output` directory from `_mdsite.yml` relative to the repo root, or `.output` by default

The Cloudflare build environment must be able to fetch or access the renderer and install its dependencies. If `_mdsite.yml` points `server.path` at a missing renderer directory, the build depends on `server.repo` being reachable so the CLI can clone it before generating the site.

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

The CLI also writes renderer compatibility/runtime files such as `_menu.yml`, `.mdsite-runtime/`, and renderer env/config files as part of orchestration.

## Migration notes for existing users

If you previously used the legacy monolithic or root workflow:

- Replace `npm start` with `node /path/to/md-site/dist/index.js start`.
- Replace `npm run generate` with `node /path/to/md-site/dist/index.js generate`.
- Replace `npm run preview` with `node /path/to/md-site/dist/index.js preview` after `node /path/to/md-site/dist/index.js generate`.
- Use repo-root or content-directory `_mdsite.yml` as the source of configuration for development and deployment.
- Treat `node /path/to/md-site/dist/index.js generate` as the static packaging step for generic hosting, including Cloudflare Pages.
- Use `node /path/to/md-site/dist/index.js prepare github` to generate the GitHub Pages workflow for the current content repository.
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
- If that path does not exist, the CLI clones `server.repo` into that location.
- If clone or renderer access fails, fix the `server.repo` / `server.path` configuration and rerun the command.

### Renderer dependencies missing

If the renderer has no `node_modules`, the CLI runs `npm install` in the renderer directory automatically. If that install fails, fix the renderer dependency issue and rerun the command.

### Preview fails

Run `node /path/to/md-site/dist/index.js generate` first. `preview` requires an existing generated renderer build.

### Config problems

- `_mdsite.yml` must be valid YAML.
- `server.output` is resolved under the content directory.
- `server.path` is resolved relative to the content directory.
- If `favicon` is configured, the referenced file must exist.

## Deferred follow-up items

The following work is still deferred and is **not** documented as current behavior:

- npm packaging and publishing hardening
- true git submodule conversion
- advanced migration utilities
- broad backward-compatibility bridges
- performance tuning and benchmarking
- full release management and distribution hardening

These remain follow-up items from `.kiro/specs/cli-migration/tasks.md` and `.kiro/specs/cli-migration/requirements.md`, not part of the current supported workflow.

## Legacy reference

`LEGACY.md` remains available as **reference-only** documentation for the previous monolithic Nuxt workflow.

## Additional project documentation

The renderer and feature documentation in `docs/` remains useful for content/rendering context, but root command examples should be interpreted through the current CLI-first workflow above.
