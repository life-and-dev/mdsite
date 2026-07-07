# Favicon Configuration

mdsite uses the `site.favicon` value in `mdsite.yml` to pass a favicon path to the local renderer. `mdsite init` auto-detects a favicon by scanning the content directory's top level and its immediate subdirectories in priority order — `favicon.<ext>` → `<project-name>-logo.<ext>` → `<project-name>.<ext>` → `logo.<ext>`, where `<ext>` is tried as `.svg` > `.png` > `.webp` > `.jpg` > `.ico` (with `.ico` as a last-resort legacy format) and `<project-name>` is the basename of the directory you run `mdsite init` in. You can also set `site.favicon` by hand.

## How it Works

The `site.favicon` path is resolved first relative to your **input directory** (e.g. `docs/`), then — if not found there — relative to the **directory containing `mdsite.yml`** (the project root). It may be any raster or vector image format that [`sharp`](https://sharp.pixelplumbing.com/) supports, so both `favicon.png` (a file in the input dir) and `docs/favicon.png` (project-root-relative) work. If `site.favicon` is configured, the referenced file must exist under one of those bases.

The renderer reads that source image directly and generates all derived favicon assets — `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, and `site.webmanifest` — into the renderer's own `public/` directory (the renderer working dir, e.g. `.mdsite/public/`). No favicon files are written into your content directory, and no `favicon/` subdirectory is created.

## When No Favicon Is Set

If `site.favicon` is empty or the referenced file is missing, the renderer generates a monogram favicon: the first letter of `site.name` rendered in `themes.light.colors.on-primary` on a rounded square filled with `themes.light.colors.primary` (each falling back to a built-in default when unset). This avoids leaking any default branding and gives every site a distinct favicon out of the box.

## Configuration Steps

### 1. Add a favicon file

Place your favicon in the content directory, for example:

```bash
your-content/favicon.svg
```

### 2. Set `site.favicon` in `mdsite.yml`

```yaml
site:
  favicon: favicon.svg
```

### 3. Run the CLI

```bash
mdsite live
```

Use `mdsite generate` when building static output.
