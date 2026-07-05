***Markdown Site** is a CLI util that turns a directory of **Markdown** files into a static **site***.

---

![mdsite](docs/logo.svg)

# Markdown Site

---

## Features

- 🚀 **One CLI command** — run only `mdsite static` to convert, build, deploy and host Markdown files as a static site.
- 👀 **Live local previews** — run `mdsite live` and see every Markdown edit appear instantly in your browser.
- 🔍 **Built-in search** — type any keyword to jump straight to matching pages or headings — no setup needed.
- 🗂️ **Auto-generated TOC** — let every page build a navigable table of contents from your Markdown headings.
- ☰ **Configurable menu** — arrange and group navigation links to match your site's structure and content.
- 📌 **Configurable footer** — pin links, branding, and contact info to the bottom of every page.
- ☁️ **Static-first hosting** — deploy to GitHub Pages, Cloudflare Pages, Netlify, or any static host.
- 🍃 **No DB, no backend** — pure static output means zero servers, databases, or maintenance to worry about.
- ✍️ **Markdown only** — write plain Markdown; no HTML, CSS, or programming skills required to publish.
- ✝️ **Bible tooltips** — hover any verse reference to reveal the full scripture passage inline.

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

The following commands will be available after installation:

1. `mdsite init` : Create `mdsite.yml` and project files without staring any services.
2. `mdsite live` : Start the live website - editing content changes immediately on hosted website without restart.
3. `mdsite generate` : Build static output.
4. `mdsite static` : Start the static website - preview how it would behave on static webserver like Cloudflare Pages.
5. `mdsite stop` : Stop tracked detached `mdsite live -d` or `mdsite static -d` processes.
6. `mdsite prepare github` : Generate a Github Pages deployment workflow.
7. `mdsite clean` : Delete the renderer working dir and the generated output (refuses while a tracked process is running).

All commands operate on the **current working directory** as the content/project directory. `-d`/`--detached` to runs a tracked background webserver, and `--host` (or `--host <addr>`) to expose the server on the network — see the start and preview sections below. Run `mdsite help` for more details.

## Configuration Reference

`mdsite.yml` is the only active content-directory configuration file. `mdsite init` creates it and fills defaults from local markdown files, a favicon image, and the git remote where possible.

| Key                       | Default                            | Description                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features.bible-tooltips` | `true`                             | Enables renderer Bible tooltip support.                                                                                                                                                                                                                                                                                                                                    |
| `features.source-edit`    | auto-detected from git remote      | URL prefix for the Edit button. `mdsite init` derives it from the `origin` remote and current branch (`https://github.com/<owner>/<repo>/blob/<branch>/`); falls back to empty when no GitHub remote is found. An empty string disables the Edit button.                                                                                                                 |
| `features.footer`         | empty array                        | List of links, separators, and external URLs rendered in the bottom bar. Mirrors the `menu` item shape (string, `null`, or single-key object) without sub-menus.                                                                                                                                                                                                           |
| `menu`                    | derived from markdown files        | Menu structure for the sidebar navigation.                                                                                                                                                                                                                                                                                                                                 |
| `paths.input`             | auto-detected `docs`/`doc` subdir  | Path to the directory holding your Markdown files, relative to the directory containing `mdsite.yml`. `mdsite init` sets this to `docs` (or `doc`) when such a subdirectory exists; otherwise it stays empty and MD-Site uses the directory of `mdsite.yml` as the content directory.                                                                                       |
| `paths.build`             | `.mdsite`                          | The renderer working directory, relative to the content directory. End-user runs materialize the bundled renderer here; in the dev repo the bundled submodule runs in place.                                                                                                                                                                                               |
| `paths.output`            | `.output`                          | Static output path under the content directory.                                                                                                                                                                                                                                                                                                                            |
| `site.canonical`          | empty string                       | Canonical site URL passed to the renderer.                                                                                                                                                                                                                                                                                                                                 |
| `site.favicon`            | auto-detected favicon image        | Source image path relative to the content directory (any format `sharp` supports). `mdsite init` picks the first `logo`/`favicon` image (`.webp`/`.jpg`/`.png`/`.ico`) it finds, top-level first; otherwise empty. The renderer generates derived favicons into the renderer's `public/` dir.                                                                              |
| `site.name`               | derived from `README.md` H1        | Browser title, navbar, breadcrumb root, and web manifest name. `mdsite init` uses the first H1 in `README.md`, then `index.md`, else leaves it empty.                                                                                                                                                                                                                      |
| `themes.light.colors`     | built-in palette                   | Light theme colour overrides.                                                                                                                                                                                                                                                                                                                                              |
| `themes.dark.colors`      | built-in palette                   | Dark theme colour overrides.                                                                                                                                                                                                                                                                                                                                               |

## Tutorials

We have prepared a series of tutorials to guide you through every aspect of working with this project.

- **[Content Directory](https://life-and-dev.github.io/mdsite/content)**  
  Learn how the `content` field in `mdsite.yml` tells MD-Site where your Markdown files live (and how `index.md` becomes the homepage).
  
- **[Markdown Reference](https://life-and-dev.github.io/mdsite/markdown)**  
  Learn about the supported GFM alerts, Bible references, and custom markdown rendering.

- **[Features](https://life-and-dev.github.io/mdsite/features)**  
  Learn how to toggle and configure site features like Bible tooltips and source editing.

- **[Menu Configuration](https://life-and-dev.github.io/mdsite/menu)**  
  Learn the syntax of the `menu` section in `mdsite.yml`.

- **[Footer Configuration](https://life-and-dev.github.io/mdsite/footer)**  
  Learn how to populate the bottom bar with links, separators, and external URLs via the `footer` section in `mdsite.yml`.

- **[Generating Favicons](https://life-and-dev.github.io/mdsite/favicon)**  
  Learn how to configure a favicon path in `mdsite.yml`.

- **[Theme Configuration](https://life-and-dev.github.io/mdsite/theme)**  
  Learn how to customize the look and feel of your site with custom color tokens and automatic dark mode support.

- **[Deployment](https://life-and-dev.github.io/mdsite/deploy)**  
  Ready to go live? This guide explains how to deploy your content to production using Cloudflare Pages.

## For Developers

`mdsite` is a thin TypeScript CLI that orchestrates a Nuxt renderer shipped as a git submodule. If you want to contribute, customize the renderer, run the test suites, or cut a release, the developer documentation lives at:

- [Developing mdsite](https://life-and-dev.github.io/mdsite/develop) — repository layout, CLI architecture, and CLI ↔ Nuxt integration.
- [Renderer (mdsite-nuxt submodule)](https://life-and-dev.github.io/mdsite/develop/nuxt) — what the submodule is, how to customize it, how to extend Nuxt with custom components.
- [Testing](https://life-and-dev.github.io/mdsite/develop/tests) — how to run the CLI and renderer test suites.
- [Release](https://life-and-dev.github.io/mdsite/develop/release) — how to cut and publish a new version of `@life-and-dev/mdsite`.

## Demo Sites

- [MD Site Documentation](https://life-and-dev.github.io/mdsite)
- [Our Father God](https://ofgod.info)
- [Kingdom of God](https://kingom.ofgod.info)
- [Prophecies of God](https://prophecies.ofgod.info)
- [Word of God](https://prophecies.ofgod.info)
- [Church of God](https://church.ofgod.info)
- [Son of God](https://son.ofgod.info)
