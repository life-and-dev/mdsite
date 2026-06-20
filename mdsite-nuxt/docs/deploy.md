
# Deployment Guide

> [!NOTE]
> **Goal**: This tutorial guides you through deploying your content to production using Cloudflare Pages.

## 1. Prerequisites

You need:
1.  A GitHub repository containing this codebase.
2.  A Cloudflare account.

## 2. Choosing a Deployment Strategy

There are two ways to deploy this Nuxt application:

### A. Static Site Generation (SSG) - **Highly Recommended**
Run `npm run generate {domain}`. This crawls your site and generates static HTML files.
*   **Pros**: Fastest performance, zero server cost, ultra-secure (no server-side code), can be hosted anywhere.
*   **Cons**: Requires a redeploy/rebuild to see content changes.

### B. Server-Side Rendering (SSR)
Run `npm run build {domain}`. This creates Nuxt server output.
*   **Pros**: Real-time content updates (if linked to a live CMS), dynamic features.
*   **Cons**: Requires a running Nuxt server (more complex/expensive), slightly slower time-to-first-byte.

> [!TIP]
> **Use Static Generation** unless you are an advanced user with a specific requirement for a live Nuxt server in production. Unless you know what you are doing, `npm run generate` is the correct choice.

## 3. Cloudflare Pages Configuration

When you create a new project in Cloudflare Pages, connect it to your GitHub repo and use the following settings:

*   **Build command**: `npm run generate`
*   **Build output directory**: `.output/public`
*   **Root directory**: `/` (Leave default)

## 4. Environment Variables

This is the most critical part. Your application is "content-agnostic" until you tell it which domain to build.

Go to **Settings > Environment variables** in Cloudflare and add:

| Variable         | Example Value | Description                                                                         |
| :--------------- | :------------ | :---------------------------------------------------------------------------------- |
| `CONTENT`        | `example`     | (Optional) The name of the configuration. If omitted, it uses `content.config.yml`. |
| `CONTENT_CONFIG` | (Optional)    | JSON string of configuration if you need to override defaults without a file.       |

> [!TIP]
> If you only host **one site**, you don't need to specify a domain. Just create a `content.config.yml` in the root and run commands without arguments.

## 5. Local Usage

You can now run commands with or without a domain parameter:

```bash
# Start development for the default site (uses content.config.yml)
npm start

# Generate a static version of a specific site
npm run generate example

# Build a production server version of the default site
npm run build
```

## 6. The Build Process

When Cloudflare runs `npm run generate`:
1.  It installs dependencies.
2.  The `start.ts` script checks for a domain argument or the `CONTENT` environment variable.
3.  If no domain is found, it loads the default `content.config.yml` configuration.
4.  If `content.git.repo` is specified in the config, it automatically checks out (clones or pulls) that repository:
    - **In all modes**: It automatically clones the repo if the destination is missing.
    - **In Build/Generate modes**: It also pulls the latest changes if the repo already exists.
    - Target directory: `content.git.path` (defaults to `content.path`).
    - Branch: `content.git.branch` (defaults to `main`).
    - If the git operation fails, the operation aborts with an error.
5.  It resolves the content source directory:
    - Path: `content.path` (defaults to `../{domain}` relative to project root, where domain is the config name or `cms`).
6.  It syncs your images and assets into the `public/` folder.
7.  It generates the static JSON indices (`_navigation.json`, `_search-index.json`).
8.  Nuxt crawls all your pages and generates static HTML in `.output/public`.
