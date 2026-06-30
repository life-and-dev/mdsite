# Favicon Configuration

MD-Site uses the `favicon` value in `mdsite.yml` to pass a favicon path to the local renderer.

## How it Works

The `favicon` path is resolved relative to your content directory, and may be any raster or vector image format that [`sharp`](https://sharp.pixelplumbing.com/) supports. If `favicon` is configured, the referenced file must exist.

The renderer reads that source image directly and generates all derived favicon assets — `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, and `site.webmanifest` — into the renderer's own `public/` directory (the renderer working dir, e.g. `.mdsite/public/`). No favicon files are written into your content directory, and no `favicon/` subdirectory is created.

## Configuration Steps

### 1. Add a favicon file

Place your favicon in the content directory, for example:

```bash
your-content/favicon.svg
```

### 2. Set `favicon` in `mdsite.yml`

```yaml
favicon: favicon.svg
```

### 3. Run the CLI

```bash
mdsite start
```

Use `mdsite generate` when building static output.
