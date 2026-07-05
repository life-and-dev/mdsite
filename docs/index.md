![mdsite](logo.svg)

# Markdown Site Documentation

## Quick Start

From the directory containing your Markdown files run:

```bash
mdsite static -d
```

This command:

1. Convert your markdown pages to a static html files.
2. Start a webserver as a detached process.
3. Open your browser to the hosted by the webserver.

## How it works

You write Markdown. For example, your content directory with a few pages and a logo:

```yaml
my-docs/
├── index.md
├── about.md
├── blog/
│   ├── 2026-01-hello.md
│   └── 2026-03-release.md
└── logo.png
```

Run the `mdsite static` in your repo to generate the static pages:

```yaml
my-docs/
├── index.md
├── about.md
├── blog/
│   ├── 2026-01-hello.md
│   └── 2026-03-release.md
├── logo.png
├── mdsite.yml                  # site configuration
├── .mdsite/                    # renderer working dir (gitignored)
│   ├── mdsite.log              # detached webserver logs
│   └── ...                     # Other Node and Nuxt render files
└── .output/                    # deployable static site
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

## Install

Install the CLI globally from the npm registry on any machine with Node.js (>= 24.0.0) and npm:

```bash
npm install -g @life-and-dev/mdsite
```

After install, the `mdsite` commands are available from any content directory:

1. `mdsite init` : Create `mdsite.yml` and project files without staring any services.
2. `mdsite live` : Start the live website - editing content changes immediately on hosted website without restart.
3. `mdsite generate` : Build static output.
4. `mdsite static` : Start the static website - preview how it would behave on static webserver like Cloudflare Pages.
5. `mdsite stop` : Stop tracked detached `mdsite live -d` or `mdsite static -d` processes.
6. `mdsite prepare github` : Generate a Github Pages deployment workflow.
7. `mdsite clean` : Delete the renderer working dir and the generated output (refuses while a tracked process is running).

All commands operate on the **current working directory** as the content/project directory. `-d`/`--detached` to runs a tracked background webserver, and `--host` (or `--host <addr>`) to expose the server on the network — see the start and preview sections below. Run `mdsite help` for more details.

## Configuration Reference

`mdsite.yml` is the only active content-directory configuration file. `mdsite init` creates it and fills defaults from local markdown files where possible.

| Key                       | Default                              | Description                                                                                                                                                                                                                                    |
| ------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features.bible-tooltips` | `true`                               | Enables renderer Bible tooltip support.                                                                                                                                                                                                        |
| `features.source-edit`    | empty string                         | URL prefix for the Edit button. When non-empty, the renderer appends `<page>.md` to this prefix to build the Edit link (typically `https://github.com/<owner>/<repo>/blob/<branch>/`). An empty string (the default) disables the Edit button entirely. |
| `features.footer`         | empty array                          | List of links, separators, and external URLs rendered in the bottom bar. Mirrors the `menu` item shape (string, `null`, or single-key object) without sub-menus.                                                                               |
| `menu`                    | derived from markdown files          | Menu structure for the sidebar navigation.                                                                                                                                                                                                     |
| `paths.input`             | directory of `mdsite.yml`            | Path to the directory holding your Markdown files, relative to the directory containing `mdsite.yml`. When omitted, MD-Site uses the directory of `mdsite.yml` as the content directory.                                                       |
| `paths.build`             | `.mdsite`                            | The renderer working directory, relative to the content directory. End-user runs materialize the bundled renderer here; in the dev repo the bundled submodule runs in place.                                                                   |
| `paths.output`            | `.output`                            | Static output path under the content directory.                                                                                                                                                                                                |
| `site.canonical`          | empty string                         | Canonical site URL passed to the renderer.                                                                                                                                                                                                     |
| `site.favicon`            | empty string                         | Source image path relative to the content directory (any format `sharp` supports). The renderer generates derived favicons into the renderer's `public/` dir.                                                                                  |
| `site.name`               | derived from `index.md` or directory | Browser title, navbar, breadcrumb root, and web manifest name; overrides `index.md` H1.                                                                                                                                                        |
| `themes.light.colors`     | built-in palette                     | Light theme colour overrides.                                                                                                                                                                                                                  |
| `themes.dark.colors`      | built-in palette                     | Dark theme colour overrides.                                                                                                                                                                                                                   |

## Tutorials

We have prepared a series of tutorials to guide you through every aspect of working with this project.

- **[Content Directory](content)**  
  Learn how the `content` field in `mdsite.yml` tells MD-Site where your Markdown files live (and how `index.md` becomes the homepage).
  
- **[Markdown Reference](markdown)**  
  Learn about the supported GFM alerts, Bible references, and custom markdown rendering.

- **[Features](features)**  
  Learn how to toggle and configure site features like Bible tooltips and source editing.

- **[Menu Configuration](menu)**  
  Learn the syntax of the `menu` section in `mdsite.yml`.

- **[Footer Configuration](footer)**  
  Learn how to put links, separators, and external URLs in the bottom bar with the `footer` section in `mdsite.yml`.

- **[Generating Favicons](favicon)**  
  Learn how to configure a favicon path in `mdsite.yml`.

- **[Theme Configuration](theme)**  
  Learn how to customize the look and feel of your site with custom color tokens and automatic dark mode support.

- **[Deployment](deploy)**  
  Ready to go live? This guide explains how to deploy your content to production using Cloudflare Pages.

- **[Developing mdsite](develop)**  
  Working on mdsite itself? The developer docs cover repository layout, the mdsite-nuxt submodule, testing, and releases.

## For Developers

`mdsite` is a thin TypeScript CLI that orchestrates a Nuxt renderer shipped as a git submodule. If you want to contribute, customize the renderer, run the test suites, or cut a release, the developer documentation lives at:

- [GitHub repo](https://github.com/life-and-dev/mdsite) - the `mdsite` source code repo.
- [Developing mdsite](develop.md) — repository layout, CLI architecture, and CLI ↔ Nuxt integration.
- [Renderer (mdsite-nuxt submodule)](develop/nuxt.md) — what the submodule is, how to customize it, how to extend Nuxt with custom components.
- [Testing](develop/tests.md) — how to run the CLI and renderer test suites.
- [Release](develop/release.md) — how to cut and publish a new version of `@life-and-dev/mdsite`.
