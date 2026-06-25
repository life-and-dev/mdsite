# Deployment Guide

## 1. Prerequisites

You need:

1. A content directory with `mdsite.yml`.
2. The built `mdsite` CLI available where you run deployment commands.
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

### 🛠️ Configure build settings

Use these settings when `server.output` is the default `.output`:

| Setting                | Value                                                                          |
| :--------------------- | :----------------------------------------------------------------------------- |
| Build command          | `mdsite generate`                                                              |
| Build output directory | `.output/public`                                                               |
| Root directory         | Your content directory, or `/` if the repository root is the content directory |

If `mdsite.yml` sets a different `server.output`, set the Cloudflare **Build output directory** to `<server.output>/public`.

> [!IMPORTANT]
> The Cloudflare build environment must be able to run `mdsite generate` from the content directory. Provide the built CLI in your project setup.

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
