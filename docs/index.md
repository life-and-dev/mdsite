![MD-Site](favicon.svg)

# MD Site Documentation

Welcome to MD-Site! This project is a local CLI for Markdown sites where content files are separated from the Nuxt renderer.

Install the published CLI from npm, run it from a content directory, and configure that content directory with `mdsite.yml`.

A preview of MD Site's output is available at [https://life-and-dev.github.io/mdsite/](https://life-and-dev.github.io/mdsite/).

## Getting Started

### 0. Prerequisites

- Node.js (>= 24.0.0)
- NPM (>= 10.0.0)
- Git

### 1. Install

Install the CLI globally from the npm registry on any machine that meets the prerequisites above:

```bash
npm install -g @life-and-dev/mdsite
```

This exposes the `mdsite` command system-wide. Verify it is available:

```bash
mdsite version
```

To set up a content directory, change into it and run `init` once to create `mdsite.yml` (and a `.nvmrc` pinning Node 24), then `start` to launch the local renderer:

```bash
cd /path/to/your/content
mdsite init
mdsite start
```

> [!NOTE]
> If you prefer to contribute to MDsite itself or need an unreleased change, see [Developing MDsite](develop) for the clone-and-build workflow, renderer internals, testing, and releases.

### 2. Implemented commands

```bash
mdsite help
mdsite version
mdsite init
mdsite start
mdsite generate
mdsite preview
mdsite stop
mdsite prepare github
```

`version` prints the CLI version from the root `package.json`.

> [!NOTE]
> The `/docs` directory in this repository contains this documentation as sample content. To preview it with the npm-installed CLI, run `mdsite init && mdsite start` from the `docs/` directory. You can also create your own content at any other location and configure it independently.

### Local server options

`mdsite start` and `mdsite preview` share the following options:

- `-d`, `--detached` — run the server as a tracked background process instead of in the foreground.
- `--host` — expose the server on the network by binding `0.0.0.0`, so other devices on your LAN can reach the site (for example `mdsite start --host`).
- `--host <addr>` — bind a specific network address instead of the default (for example `mdsite preview --host 192.168.1.10`).

Options can be combined, for example `mdsite start -d --host` runs a background server reachable from the network. Without `--host`, the server only listens on `localhost`.

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

- **[Generating Favicons](favicon)**  
  Learn how to configure a favicon path in `mdsite.yml`.

- **[Theme Configuration](theme)**  
  Learn how to customize the look and feel of your site with custom color tokens and automatic dark mode support.

- **[Deployment](deploy)**  
  Ready to go live? This guide explains how to deploy your content to production using Cloudflare Pages.

- **[Developing MDsite](develop)**  
  Working on MDsite itself? The developer docs cover repository layout, the mdsite-nuxt submodule, testing, and releases.

## Local Development

The contributor workflow (clone, build, run the demo) is documented in [Developing MDsite](develop). Start there if you want to hack on the CLI or the renderer.

## Contribute

Contribute to the source code at [https://github.com/life-and-dev/mdsite](https://github.com/life-and-dev/mdsite).
