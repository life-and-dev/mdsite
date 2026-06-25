
# Nuxt Configuration & Workflow

This tutorial explains how our Nuxt application is configured, why we use specific settings, and how to use the low-level development commands if you need more control.

## 1. `nuxt.config.ts` Overview

Our `nuxt.config.ts` is the heart of the application. Here are the key sections:

### Static Site Generation (SSG)
We use `nuxt generate` for production, which crawls the site and produces static HTML.
```typescript
nitro: {
  preset: 'static'
},
```
This means the application is designed to be built into standard HTML files for deployment (e.g., to Cloudflare Pages), rather than running as a Node.js server in production.

### Custom Hooks
We rely heavily on Nuxt "hooks" to integrate our custom scripts:

1.  **`ready` Hook**:
    - **When**: Runs when the development server starts.
    - **What**: Starts our `sync-content.ts` watcher. This ensures images are copied and JSON data is generated while you code.

2.  **`build:before` Hook**:
    - **When**: Runs before `mdsite generate` invokes the renderer production build.
    - **What**: Runs `generate-indices.ts` to build the search index and navigation tree ONE TIME. It also generates favicons.

3.  **`content:file:beforeParse` Hook**:
    - **What**: This is a special hook for `@nuxt/content`.
    - **Why**: We use it to find Bible references (e.g., `John 3:16`) and GFM Alerts (e.g., `> [!NOTE]`) in your Markdown and transform them *before* the markdown parser sees them. This allows us to add tooltips and custom styling automatically!

## 2. CLI Orchestration

The active workflow uses the root MD-Site CLI from a content directory.

```bash
mdsite init
mdsite start
mdsite generate
mdsite preview
mdsite stop
mdsite prepare github
```

All commands operate on the current working directory as the content directory. `mdsite.yml` is the active configuration file.

### Foreground and detached modes

- `mdsite start` runs the renderer in the foreground with terminal output.
- `mdsite start -d` or `mdsite start --detached` starts a tracked background renderer and logs to `.mdsite-runtime/start.log`.
- `mdsite generate` builds static output under `server.output`.
- `mdsite preview` previews generated output in the foreground after `generate`.
- `mdsite preview -d` or `mdsite preview --detached` starts a tracked background preview and logs to `mdsite.log`.
- `mdsite stop` stops tracked detached `start` and `preview` processes.

## 3. Renderer Resolution

Renderer resolution is local-only:

- If `mdsite.yml` sets `server.path`, the CLI first looks for that path relative to the content directory.
- If that directory is not present, `start`, `generate`, and `preview` fall back to the checked-in repository renderer at `mdsite-nuxt/`.
- If the renderer's `node_modules` directory is missing, the CLI runs `npm install` in the renderer directory.
- `prepare github` requires the configured `server.path` renderer directory to exist when the workflow is generated.

Current documentation does not describe renderer clone or pull behavior as active usage.

## 4. Low-Level Renderer Work

Use renderer-level Nuxt commands only when working directly on `mdsite-nuxt/` internals. For normal content projects, use the MD-Site CLI commands above.

---

> [!TIP]
> **Output**: You now understand how the local CLI prepares and runs the Nuxt renderer for content directories.
