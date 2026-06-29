# Deployment Guide

## 1. Prerequisites

You need:

1. A content directory with `mdsite.yml`.
2. The `mdsite` CLI installed via `npm install -g @life-and-dev/mdsite` (or otherwise available where you run deployment commands).
3. A GitHub repository for GitHub Pages or Cloudflare Pages.
4. A Cloudflare account if you deploy with Cloudflare Pages.

Run all `mdsite` commands from the content directory that contains `mdsite.yml`.

## 2. Preview Locally

### 🧭 Configure your Markdown Site

Confirm `mdsite.yml` exists and has correct configuration in the content directory.

Pay attention to `server.output` which indicates where generated static pages will be written to. The default value is `.output`, so the static site is generated in `.output/public` by default.

### 🏗️ Generate the static site

```bash
mdsite generate
```

`mdsite generate` builds the static site.

### 🔎 Preview the generated site

```bash
mdsite preview
```

Use `mdsite preview` after `mdsite generate` to check the generated static site locally before deploying. The foreground preview stops when you interrupt the command or close the terminal. Use `mdsite preview -d` for a tracked background preview, and `mdsite stop` to stop tracked detached previews.

## 3. GitHub Pages

### ⚙️ Generate the workflow

From the content directory, run:

```bash
mdsite prepare github
```

This creates `.github/workflows/deploy.yml` in the current content directory.

### 🚀 Deploy with GitHub Actions

Commit `mdsite.yml`, your content files, and the generated workflow:

```bash
git add .
git commit -m "Add GitHub Pages deployment"
git push
```

In GitHub, set **Settings > Pages > Build and deployment > Source** to **GitHub Actions**. The generated workflow builds on pushes to `main` and publishes the static site from `<server.output>/public`.

After the workflow finishes, preview the site online at:

```text
https://<github-username>.github.io/<repository-name>/
```

## 4. Cloudflare Pages

### ☁️ Create a Pages project

In Cloudflare Pages, connect the repository that contains your mdsite content and `mdsite.yml`.

### 🔒 Pin Node.js to version 24

`mdsite` requires **Node.js >= 24.0.0**. The Cloudflare Pages v3 build image defaults to **Node 22.16.0**, which is too old, so `mdsite generate` fails during the build. You **must** pin Node 24 in your project.

> [!WARNING]
> Cloudflare Pages v3 does **not** read the `engines` field in `package.json`. Setting `engines.node` alone is not enough — use one of the override methods below.

Choose **one** of these methods to override the default Node version:

| Method | What to do | Notes |
| :------------------- | :------------------------------------------------------------------------- | :-------------------------------------- |
| `.nvmrc` (recommended) | Commit a `.nvmrc` file containing `24` | Standard, committed to the repository. |
| `.node-version` | Commit a `.node-version` file containing `24` | Also read by the v3 build image. |
| Environment variable | Set `NODE_VERSION=24` in the Cloudflare dashboard (**Settings → Environment variables**) | Set in the dashboard; not in the repo. |

The `.nvmrc` or `.node-version` file contains just the version:

```text
24
```

### 📦 Make the build self-contained (recommended)

For reproducible builds, commit a `package.json` that declares `mdsite` and exposes a `build` script. Cloudflare automatically runs `npm ci` whenever a `package.json` is present, so a committed `package-lock.json` is **required** (`npm ci` fails without it).

Create a `package.json` in the content directory:

```json
{
  "private": true,
  "scripts": {
    "build": "mdsite generate"
  }
}
```

Then install `mdsite` to generate the lockfile, and commit both files:

```bash
npm install --save-dev @life-and-dev/mdsite
git add package.json package-lock.json
git commit -m "Pin mdsite build for Cloudflare Pages"
```

`npm install --save-dev @life-and-dev/mdsite` adds the package to `devDependencies`. Set the Cloudflare **Build command** to:

```bash
npm run build
```

### ⚡ Alternative: build with npx (no package.json)

If you prefer not to commit a `package.json`, point the Cloudflare **Build command** directly at `npx`:

```bash
npx @life-and-dev/mdsite generate
```

This downloads `mdsite` on every build without pinning a version, so builds are **less reproducible** than the `package.json` path above. You still must pin Node 24 (see *🔒 Pin Node.js to version 24* above).

### ⚙️ Configure build settings

Use these settings when `server.output` is the default `.output`:

| Setting | Value |
| :--------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| Build command | `npm run build` (recommended), or `npx @life-and-dev/mdsite generate` |
| Build output directory | `.output/public` |
| Root directory | Your content directory, or `/` if the repository root is the content directory |
| Node version override | `24` via `.nvmrc`, `.node-version`, or the `NODE_VERSION` environment variable |

If `mdsite.yml` sets a different `server.output`, set the Cloudflare **Build output directory** to `<server.output>/public`.

## 5. Troubleshooting

### ⚠️ `mdsite.yml` is missing

In the content directory, run:

```bash
mdsite init
```

Then configure the generated `mdsite.yml`

### ⚠️ Deployed site is empty or 404s

Check that the host publishes `<server.output>/public`. With the default config, this is `.output/public`.

### ⚠️ GitHub workflow generation fails

`mdsite prepare github` requires a valid `mdsite.yml` and the configured local renderer path to exist when the workflow is generated.

### ⚠️ Renderer clone or pull expected

Current MD-Site commands use local renderer resolution. `start`, `generate`, and `preview` fall back to the checked-in `mdsite-nuxt/` renderer when `server.path` is absent; `prepare github` requires the configured local renderer path to exist. The CLI does not use active clone or pull behavior.
