![MDsite](docs/logo.svg)

# MDsite

MDsite is a local-first CLI that turns a directory of Markdown files into a static site using the bundled Nuxt renderer.

## How it works

You write Markdown. For example, your content directory with a few pages and a logo:

```text
my-docs/
├── index.md
├── about.md
├── blog/
│   ├── 2026-01-hello.md
│   └── 2026-03-release.md
└── logo.png
```

1. After you run `mdsite init` it creates `mdsite.yml` and required project files.
2. Configure `mdsite.yml` as needed.
3. Then run `mdsite generate` builds a static website under `.output/public/`:

```text
my-docs/
├── index.md
├── about.md
├── blog/
│   ├── 2026-01-hello.md
│   └── 2026-03-release.md
├── logo.png
├── mdsite.yml                  # site configuration (created by "mdsite init")
├── package.json                # package configuration (created by "mdsite init")
├── package-lock.json           # package lock (created by "mdsite init")
├── .mdsite/                    # renderer working dir (gitignored)
│   └── ...                     # Nuxt render files (created by "mdsite init")
└── .output/                    # deployable static site (created by "mdsite generate")
    └── public/
        ├── index.html          
        ├── about/
        │   └── index.html      
        ├── blog/
        │   ├── 2026-01-hello/
        │   │   └── index.html
        │   └── 2026-03-release/
        │       └── index.html
        ├── logo.png
        ├── favicon.ico         
        └── ...
```

**The benefit:** your source tree is only Markdown files and images — no `node_modules`, no HTML, no build config. `mdsite init` scaffolds nodejs. `mdsite generate` materializes the Nuxt renderer into `.mdsite/`, pre-renders each `.md` to an HTML page, bundles JS/CSS, generates favicons, and writes the whole site ready to upload to any static host (GitHub Pages, Netlify, Cloudflare Pages, S3, etc.).

## Install

Install the CLI globally from the npm registry on any machine with Node.js (>= 24.0.0) and npm:

```bash
npm install -g @life-and-dev/mdsite
```

After install, the `mdsite` command is available from any content directory.

## Quick start

From the directory containing your Markdown files:

1. Run `mdsite init` once to create `mdsite.yml` and project files.
2. Run `mdsite start` for foreground local development.
3. Run `mdsite generate` to build static output.
4. Run `mdsite preview` after `generate` for a foreground local preview.
5. Run `mdsite stop` to stop tracked detached `start` and `preview` processes.
6. Run `mdsite prepare github` to generate a Github Pages deployment workflow.

All commands operate on the **current working directory** as the content/project directory. `start` and `preview` also accept `-d`/`--detached` to run a tracked background server, and `--host` (or `--host <addr>`) to expose the server on the network — see the start and preview sections below.

For production deployments, see the [Deployment guide](https://life-and-dev.github.io/mdsite/deploy).

## Configuration reference

`mdsite.yml` is the only active content-directory configuration file. `mdsite init` creates it and fills defaults from local markdown files where possible.

| Key                      | Default                                  | Description                                                                                                                                                                  |
| ------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `favicon`                | empty string                             | Source image path relative to the content directory (any format `sharp` supports). The renderer generates derived favicons into the renderer's `public/` dir.                |
| `features.bibleTooltips` | `true`                                   | Enables renderer Bible tooltip support.                                                                                                                                      |
| `features.sourceEdit`    | `true`                                   | Enables renderer source-edit support.                                                                                                                                        |
| `menu`                   | derived from markdown files              | Menu structure for the sidebar navigation.                                                                                                                                   |
| `server.output`          | `.output`                                | Static output path under the content directory.                                                                                                                              |
| `server.path`            | `.mdsite`                                | The renderer working directory, relative to the content directory. End-user runs materialize the bundled renderer here; in the dev repo the bundled submodule runs in place. |
| `server.repo`            | `https://github.com/life-and-dev/mdsite` | Stored for compatibility and generated renderer config. It is not used for active clone/pull behaviour.                                                                      |
| `site.canonical`         | empty string                             | Canonical site URL passed to the renderer.                                                                                                                                   |
| `site.name`              | derived from `index.md` or directory     | Site name passed to the renderer.                                                                                                                                            |
| `themes.light.colors`    | built-in palette                         | Light theme colour overrides.                                                                                                                                                |
| `themes.dark.colors`     | built-in palette                         | Dark theme colour overrides.                                                                                                                                                 |

The full documentation lives at [https://life-and-dev.github.io/mdsite/](https://life-and-dev.github.io/mdsite/).

## For Developers

MDsite is a thin TypeScript CLI that orchestrates a Nuxt renderer shipped as a git submodule. If you want to contribute, customize the renderer, run the test suites, or cut a release, the developer documentation lives at:

- [Developing MDsite](https://life-and-dev.github.io/mdsite/develop) — repository layout, CLI architecture, and CLI ↔ Nuxt integration.
- [Renderer (mdsite-nuxt submodule)](https://life-and-dev.github.io/mdsite/develop/nuxt) — what the submodule is, how to customize it, how to extend Nuxt with custom components.
- [Testing](https://life-and-dev.github.io/mdsite/develop/tests) — how to run the CLI and renderer test suites.
- [Release](https://life-and-dev.github.io/mdsite/develop/release) — how to cut and publish a new version of `@life-and-dev/mdsite`.
