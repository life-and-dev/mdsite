![MD-Site](favicon.svg)

# MD Site Documentation

Welcome to the MD Site! This project is designed to be a flexible, file-based Markdown Static Site Generator (SSG) where content MD (Markdown) files are completely separated from the renderer (the Nuxt framework).

Our goal is to allow content creators to write simple Markdown files while this project provide a robust, high-performance rendering engine that can be deployed anywhere (like Cloudflare Pages).

A preview of MD Site's output is available at [https://life-and-dev.github.io/md-site](https://life-and-dev.github.io/md-site).

## Getting Started

### 0. Prerequisites

- Node.js (>= 20.0.0)
- NPM (>= 10.0.0)
- Git

### 1. Local CLI setup

```bash
# In this repository
npm install
npm run build
```

Use the built CLI from your markdown content directory:

```bash
cd /path/to/your/content
node /path/to/md-site/dist/index.js help
```

If you create a local alias or link for the built CLI, the shorter `mdsite ...` examples refer to that alias or link.

### 2. Implemented commands

```bash
mdsite help
mdsite version
mdsite init
mdsite start
mdsite start --detached
mdsite generate
mdsite preview
mdsite stop
mdsite prepare github
```

`version` prints the CLI version from the root `package.json`; run it as `mdsite version` or `node /path/to/md-site/dist/index.js version`.

### 3. Starting the demo documentation site

From the repository root, build the CLI and start `docs/` as a local mdsite preview:

```bash
npm install
npm run build
(cd docs && node ../dist/index.js start)
```

Open `http://localhost:3000/`. `mdsite start` runs in the foreground and writes output to the terminal; closing the terminal or interrupting the command stops the process.

Use `mdsite start -d` or `mdsite start --detached` for a tracked background process. Detached start logs to `.mdsite-runtime/start.log` in the content directory.

> [!NOTE]
> The `/docs` directory contains this documentation as sample content to get you started. You can create your own content at any other location and configure it independantly.

## Tutorials

We have prepared a series of tutorials to guide you through every aspect of working with this project.

- **[Markdown Reference](markdown)**  
  Learn about the supported GFM alerts, Bible references, and custom markdown rendering.

- **[Menu Configuration](menu)**  
  Learn the syntax of the `_menu.yml` file. We cover everything from simple links to dropdowns, external URLs, and separators.

- **[Generating Favicons](favicon)**  
  Learn how to generate favicons from a single SVG logo.

- **[Theme Configuration](theme)**  
  Learn how to customize the look and feel of your site with custom color tokens and automatic dark mode support.

- **[Features](features)**  
  Learn how to toggle and configure site features like Bible tooltips and source editing.

- **[Nuxt Configuration](nuxt)**  
  Dive into the `nuxt.config.ts` file. We explain the modules we use, the custom hooks we've written, and the difference between standard development and the low-level scripts.

- **[Architecture](architecture)**  
  Understand the "Why" and "How". This tutorial explains the separation of concerns between our content scripts and the frontend application.

- **[Testing](tests)**  
  Learn how to run our automated test suite to ensure your changes don't break anything.

- **[Deployment](deploy)**  
  Ready to go live? This guide explains how to deploy your content to production using Cloudflare Pages.

## Contribute

Contribute to the source code at [https://github.com/life-and-dev/md-site](https://github.com/life-and-dev/md-site).
