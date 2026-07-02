# Deployment Guide

## Prerequisites

You need:

1. The `mdsite` CLI installed via `npm install -g @life-and-dev/mdsite` (or from [local development project](develop.md)).
2. A content directory with `mdsite.yml`.
3. A GitHub repository for GitHub Pages or Cloudflare Pages.
4. A Cloudflare account if you deploy with Cloudflare Pages.

Run all `mdsite` commands from the content directory that contains `mdsite.yml`.

> [!NOTE] 
> Pay attention to `server.output` in `mdsite.yml` which indicates where generated static pages will be written to. The default value is `.output`, so the static site is generated in `.output/public` by default.

> [!NOTE] 
> `mdsite` requires Node.js 24. Some builders defaults to different Node versions. `mdsite init` writes a `.nvmrc` containing `24` that should also be Git committed.

## Preview Locally

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

## GitHub Pages

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

## Cloudflare Pages

### ☁️ Create a Pages project

In Cloudflare Pages, connect the repository that contains your mdsite content and `mdsite.yml`.

### ⚙️ Configure build settings

| Setting | Value |
| :--- | :--- |
| Build command | `npx @life-and-dev/mdsite generate` |
| Build output directory | `.output/public` |
| Root directory | Your content directory, or `/` if the repository root is the content directory |

If `mdsite.yml` sets a different `server.output`, set the **Build output directory** to `<server.output>/public`.

## Troubleshooting

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
