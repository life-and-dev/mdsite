
# Nuxt Configuration & Workflow

> [!NOTE]
> **Goal**: This tutorial explains how our Nuxt application is configured, why we use specific settings, and how to use the low-level development commands if you need more control.

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
    - **When**: Runs before `npm run generate` (production build).
    - **What**: Runs `generate-indices.ts` to build the search index and navigation tree ONE TIME. It also generates favicons.

3.  **`content:file:beforeParse` Hook**:
    - **What**: This is a special hook for `@nuxt/content`.
    - **Why**: We use it to find Bible references (e.g., `John 3:16`) and GFM Alerts (e.g., `> [!NOTE]`) in your Markdown and transform them *before* the markdown parser sees them. This allows us to add tooltips and custom styling automatically!

## 2. Universal Command Wrapper

Most `npm` scripts in this project are wrappers around `scripts/start.ts`. This script handles configuration loading and environment setup.

### `npm start [domain]`
- **What**: The primary command for development.
- **Default**: It looks for `content.config.yml`.
- **Domain**: If you provide a domain (e.g., `npm start example`), it looks for `example.config.yml`.

### `npm run dev`
- **What**: Similar to `npm start`, but clears the `.data` directory (hard restart) before starting.
- **Use when**: You want a clean slate or if you suspect caching issues.

### `npm run dev:cached`
- **What**: Runs without cleaning the `.data` directory.
- **Use when**: You want the fastest possible restart time.

### `npm run build` vs `npm run generate`
- **`build`**: Produces a build meant for a Nuxt server.
- **`generate`**: The command we use for production. It builds the static HTML files into `.output/public`.

## 3. Advanced Development Modes

### Cached vs. Uncached Start
When using the wrapper `npm start`, you can choose to skip the cache cleaning step.

*   **Uncached (Default)**: `npm start [domain]`
*   **Cached Mode**: `npm start [domain] --cached`

### Manual Configuration
Sometimes you might want to run the lower-level scripts directly for debugging. You can simulate what `npm start` does by setting environment variables manually:

```bash
# 1. Set the variables
export CONTENT=example
export CONTENT_DIR=/absolute/path/to/my/content

# 2. Run the Nuxt dev server manually
npx nuxt dev
```

> [!WARNING]
> If you run `npx nuxt dev` directly without setting these variables:
> - `CONTENT` will default to `cms`.
> - `CONTENT_DIR` will default to the `docs/` folder in the project root.

---

> [!TIP]
> **Output**: You now understand that `npm start` is just a convenience wrapper. You also know that our project relies on "Hooks" to bridge the gap between static files and the Nuxt runtime.
