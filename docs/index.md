![MD-Site](favicon.svg)

# MD Site Documentation

Welcome to MD-Site! This project is a local CLI for Markdown sites where content files are separated from the Nuxt renderer.

The current workflow is local-only: build the CLI from this repository, run it from a content directory, and configure that content directory with `mdsite.yml`.

A preview of MD Site's output is available at [https://life-and-dev.github.io/md-site](https://life-and-dev.github.io/md-site).

## Getting Started

### 0. Prerequisites

- Node.js (>= 24.0.0)
- NPM (>= 10.0.0)
- Git

### 1. Local CLI setup

```bash
# In this repository
npm install
npm run build
```

Use the built CLI from your markdown content directory. Run `init` once to create `mdsite.yml`:

```bash
cd /path/to/your/content
node /path/to/md-site/dist/index.js init
```

If you create a local alias or link for the built CLI, the shorter `mdsite ...` examples refer to that alias or link.

You can also install the local development alias from the repository root:

```bash
npm run install-alias
```

After restarting your terminal session, use `mdsite-dev ...` from any content directory.

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

`version` prints the CLI version from the root `package.json`; run it as `mdsite version` or `node /path/to/md-site/dist/index.js version`.

### 3. Starting the demo documentation site

From the repository root, build the CLI, initialize `docs/` if needed, and start it as a local mdsite preview:

```bash
npm install
npm run build
(cd docs && node ../dist/index.js init)
(cd docs && node ../dist/index.js start)
```

Open `http://localhost:3000/`. `mdsite start` runs in the foreground and writes output to the terminal; closing the terminal or interrupting the command stops the process.

Use `mdsite start -d` or `mdsite start --detached` for a tracked background process. Detached start logs to `.mdsite-runtime/start.log` in the content directory and opens the browser automatically after the server is ready.

After `mdsite generate`, use `mdsite preview` for a foreground local preview. Closing the terminal or interrupting the command stops it. Use `mdsite preview -d` or `mdsite preview --detached` for a tracked background preview that logs to `mdsite.log` in the content directory.

Use `mdsite stop` to stop tracked detached `start` and `preview` processes, not foreground processes.

> [!NOTE]
> The `/docs` directory contains this documentation as sample content to get you started. You can create your own content at any other location and configure it independantly.

## Tutorials

We have prepared a series of tutorials to guide you through every aspect of working with this project.

- **[Markdown Reference](markdown)**  
  Learn about the supported GFM alerts, Bible references, and custom markdown rendering.

- **[Menu Configuration](menu)**  
  Learn the syntax of the `menu` section in `mdsite.yml`. The generated `_menu.yml` file is a renderer compatibility artifact.

- **[Generating Favicons](favicon)**  
  Learn how to configure a favicon path in `mdsite.yml`.

- **[Theme Configuration](theme)**  
  Learn how to customize the look and feel of your site with custom color tokens and automatic dark mode support.

- **[Features](features)**  
  Learn how to toggle and configure site features like Bible tooltips and source editing.

- **[Nuxt Configuration](nuxt)**  
  Dive into the `nuxt.config.ts` file and how the CLI orchestrates the local renderer.

- **[Architecture](architecture)**  
  Understand the "Why" and "How". This tutorial explains the separation of concerns between content directories and the renderer.

- **[Testing](tests)**  
  Learn how to run our automated test suite to ensure your changes don't break anything.

- **[Release](release)**  
  Learn how to bump the npm package version and trigger tag-based publishing.

- **[Deployment](deploy)**  
  Ready to go live? This guide explains how to deploy your content to production using Cloudflare Pages.

## Contribute

Contribute to the source code at [https://github.com/life-and-dev/md-site](https://github.com/life-and-dev/md-site).
