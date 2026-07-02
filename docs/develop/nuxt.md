# Renderer: mdsite-nuxt Submodule

This page covers the renderer half of MDsite: what `mdsite-nuxt/` is, how to customize it, and how to extend Nuxt with your own components. For the high-level CLI/submodule integration, start at [Developing mdsite](../develop.md) instead.

## 1. What the submodule is

`mdsite-nuxt/` is a [git submodule](https://git-scm.com/book/en/v2/Git-Tools-Submodules) — a separate repository pinned inside this one. Its source of truth is [life-and-dev/mdsite-nuxt](https://github.com/life-and-dev/mdsite-nuxt), and the parent repo records the exact commit it should check out via `.gitmodules` plus a gitlink entry.

The submodule is a self-contained Nuxt 4 application. It owns:

- `nuxt.config.ts` — Nuxt configuration, Vuetify theme, and the content hooks that transform Markdown before parsing.
- `app/` — Vue components, pages, layouts, composables, plugins, and assets.
- `content.config.ts` — declares the `content` collection that reads Markdown from the active content directory.
- `scripts/` — renderer-side scripts invoked as npm scripts: `start.ts`, `generate-indices.ts`, `sync-content.ts`, `generate-favicons.ts`, `renderer-hooks.ts`.
- `utils/` — `mdsite-config.ts` (loads `mdsite.yml`) and `base-url.ts`.

The CLI never edits source files inside the submodule. It only writes compatibility artifacts at known paths (`.env`, `content.config.yml`) so the renderer can find the user's content. This keeps the submodule clean and reusable across content projects.

## 2. Why a submodule?

Keeping the renderer in its own repository gives us:

- **Independent versioning** — bump the submodule in the parent repo to ship a new renderer version, without touching CLI code.
- **Reusable across content projects** — any content directory can pin the same renderer version.
- **Clean separation of concerns** — the CLI stays a thin orchestrator; rendering logic lives entirely in the submodule.

## 3. Working with the submodule

### Initial checkout

```bash
git clone --recurse-submodules https://github.com/life-and-dev/mdsite.git
```

If you already cloned without `--recurse-submodules`:

```bash
git submodule update --init --recursive
```

### Bumping the renderer

```bash
cd mdsite-nuxt
git fetch origin
git checkout v0.2.0        # or any commit/branch/tag
cd ..
git add mdsite-nuxt
git commit -m "chore: bump mdsite-nuxt to v0.2.0"
```

The parent repo records the new SHA. Pushing that commit ships the new renderer version with the next CLI release.

### Making changes to the renderer

Because `mdsite-nuxt/` is a submodule, edits made inside it are commits in the *submodule's* repository, not the parent's. The typical workflow is:

1. `cd mdsite-nuxt`
2. Create a branch, make changes, commit, push to a fork or branch of `life-and-dev/mdsite-nuxt`.
3. Open a PR against [life-and-dev/mdsite-nuxt](https://github.com/life-and-dev/mdsite-nuxt).
4. After merge, bump the submodule pointer in the parent repo (as above).

If you only need to test a local change end-to-end, you can commit on a feature branch of the submodule and point the parent at that branch commit — no PR required for local iteration.

## 4. Customizing the renderer

Most renderer behavior is driven by `mdsite.yml` (themes, features, site name, favicon, canonical URL). The CLI serializes the relevant fields into `mdsite-nuxt/content.config.yml` on every run, so editing `mdsite.yml` in your content directory is the supported way to customize the look and feel without touching submodule code.

The renderer reads `mdsite.yml` directly via `utils/mdsite-config.ts` for some low-level concerns (themes, content path). For everything else, the CLI-prepared `content.config.yml` is the source of truth.

### What you can configure from `mdsite.yml`

- **Themes** — Vuetify color tokens for light/dark mode (see [Theme Configuration](https://life-and-dev.github.io/mdsite/theme)).
- **Features** — Bible tooltips, source-edit links (see [Features](https://life-and-dev.github.io/mdsite/features)).
- **Site name and canonical URL** — used in metadata.
- **Favicon** — set `favicon` to a source image path relative to the content dir; the renderer generates all derived icons and the web manifest directly into its own `public/` dir (the renderer working dir, e.g. `.mdsite/public/`). No files are written into the content dir.

### What requires editing the submodule

Changes that need new code in the renderer (new components, new Nuxt hooks, new pages, new Vuetify defaults) belong in `mdsite-nuxt/`. The sections below describe where each kind of change goes.

## 5. Extending Nuxt with custom components

The renderer follows standard Nuxt 4 conventions. Components live in `app/components/` and are auto-imported. Existing components include `AppBar.vue`, `AppFooter.vue`, `AppNavigation.vue`, `AppTableOfContents.vue`, `BreadcrumbNav.vue`, `SearchBox.vue`, and the navigation tree components.

### Add a new global component

1. Create `mdsite-nuxt/app/components/MyComponent.vue`:

   ```vue
   <template>
     <v-card class="my-component">
       <slot />
     </v-card>
   </template>

   <script setup lang="ts">
   // Component logic here
   </script>
   ```

2. Use it anywhere — Nuxt auto-imports components in `app/components/` based on filename. `<MyComponent>` is available in every page and layout without an explicit import.

3. To use the component in Markdown content, enable the `<component>` syntax in `@nuxt/content` (it is supported by default in Nuxt Content v3 for components in `app/components/content/`). Drop the file in `app/components/content/MyComponent.vue` and reference it as `::my-component` or `<MyComponent />` in your Markdown.

### Override an existing component

Nuxt auto-imports components by filename, but you can also register explicit aliases. To replace `AppBar.vue` without deleting it, either:

- Rename the file (cleanest, but breaks existing references), or
- Create a new component and update `app/layouts/default.vue` to use it.

### Add a new page

Pages live in `app/pages/`. The renderer currently uses `[...slug].vue` to render any Markdown route and `index.vue` for the root. Add a new `.vue` file to introduce a custom route that does not come from Markdown:

```vue
<!-- app/pages/custom.vue -->
<template>
  <v-container>
    <h1>Custom route</h1>
  </v-container>
</template>
```

It is reachable at `/custom`.

### Add a new layout

Layouts live in `app/layouts/`. The default layout wraps every page with `AppBar`, `AppNavigation`, and `AppFooter`. To introduce an alternative layout (for example, a barebones print layout), create `app/layouts/print.vue` and reference it from a page via `definePageMeta({ layout: 'print' })`.

### Add a Nuxt plugin

Plugins live in `app/plugins/`. Use them for one-time setup like registering Vue directives, initializing third-party libraries, or injecting helpers via `nuxtApp.provide`.

## 6. Nuxt hooks the renderer relies on

`nuxt.config.ts` registers three hooks that you should be aware of before extending the renderer:

| Hook | When it runs | What it does |
| --- | --- | --- |
| `content:file:beforeParse` | Before `@nuxt/content` parses each Markdown file | Transforms GFM alerts into `::markdown-alert` MDC components, and (if `features.bibleTooltips` is on) wraps Bible references in `<span class="bible-ref">`. |
| `build:before` | Before the production build | Runs `scripts/renderer-hooks.ts` to build search indices, navigation trees, and favicons. Skipped when the CLI has already orchestrated these. |
| `ready` (via `scripts/start.ts`) | When the dev server starts | Starts the `sync-content.ts` watcher that copies images and regenerates JSON as you edit. |

If you add new pre-parse transforms, follow the same `content:file:beforeParse` pattern — mutate `file.body` in place and respect the existing code-block/inline-code/link exclusion checks to avoid transforming code.

## 7. Low-level renderer commands

For normal content work, use the CLI (`mdsite live`, `mdsite generate`, `mdsite static`). The renderer exposes its own npm scripts for direct development inside `mdsite-nuxt/`:

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Nuxt dev server (used by `mdsite live`). |
| `npm run build` | Production build via `scripts/start.ts --build`. |
| `npm run generate` | Static build via `scripts/start.ts --generate` (used by `mdsite generate`). |
| `npm run preview` | Preview a generated build (used by `mdsite static`). |
| `npm run prepare:nuxt` | `nuxt prepare` — regenerates `.nuxt/` types. Runs automatically on `npm install` via `postinstall`. |
| `npm run favicon` | Regenerate favicons from a source SVG. |
| `npm test` | Run the renderer's Vitest suite. |

Run these inside `mdsite-nuxt/` only when you are actively developing the renderer. Content projects should always go through the CLI.

## 8. Renderer tests

The renderer has its own Vitest config (`mdsite-nuxt/vitest.config.ts`) and Playwright config (`mdsite-nuxt/playwright.config.js`). Test files for utility scripts live next to their source (for example `scripts/generate-indices.test.ts`, `scripts/renderer-hooks.test.ts`). The CLI test suite (see [Testing](tests)) does not cover renderer code — run renderer tests separately from inside `mdsite-nuxt/`.

---

> [!TIP]
> If you find yourself wanting to change rendering behavior from inside `src/` (the CLI), it almost certainly belongs here in the submodule instead. The CLI's job is to *prepare* the renderer environment, not to render.
