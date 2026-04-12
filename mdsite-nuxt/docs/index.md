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

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/gizbar/md-site.git

# Navigate to the project directory
cd md-site

# Install dependencies
npm install
```

### 2. Starting the Project

The most common way to start the project is using the `npm start` command.

```bash
# Start the project with the default `content.config.yml` configuration
npm start
```

By running this command, you should see this documentation site running at `http://localhost:3000`.

This command does several things behind the scenes:
1.  **Reads Configuration**: It looks for `content.config.yml` (or `.yaml`) in the root directory.
2.  **Starts the Watcher**: It fires up the `sync-content.ts` script to watch for file changes.
3.  **Launches Nuxt**: It starts the local development server.

> [!NOTE]
> The `/docs` directory contains this documentation as sample content to get you started. You can create your own content at any other location and configure it independantly.

#### Multiple Domains

If you want to start the project with a different configuration file, you can specify the domain as a parameter:

```bash
# Start the project with the `example.config.yml` configuration instead of the default `content.config.yml`
npm start example
```

For every domain (like `example`), there must be a corresponding configuration file in the root directory:

**Example: `example.config.yaml`**
```yaml
contentPath: "../relative/path/to/content"
# Add other specific configurations here
```

The content does not have to live inside the same project as your md-cms project. You can point it to any directory you want. Preferrably you want to keep it in a separate git repository so that you can version control your content independantly.

If you don't provide a `contentPath`, the system defaults to assuming your content is in `../md-content/<domain>`.

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
