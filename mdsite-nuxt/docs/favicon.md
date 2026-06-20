# Favicon Generation

The Markdown CMS includes a utility to automatically generate a full set of favicons and a PWA manifest from a single SVG logo.

## How it Works

The generator looks for a `logo.svg` file in your content directory and produces:
- `favicon.svg` (Standard SVG favicon)
- `favicon.ico` (Legacy 32x32 icon)
- `apple-touch-icon.png` (180x180 for iOS)
- `icon-192.png` & `icon-512.png` (For PWA support)
- `site.webmanifest` (Web app manifest)

## Generation Steps

### 1. Run the Command
You can generate favicons for any configured domain by passing its name as an argument:

```bash
npm run favicon docs
```

This will:
1.  Lookup the configuration for `docs` (e.g., `docs.config.yaml`).
2.  Find the `contentPath` defined in that config (e.g., `./docs`).
3.  Look for `logo.svg` inside that path.
4.  Generate all icons into a `favicon/` subdirectory within your content folder.
5.  Copy them to the `public/` folder so they are available to the browser immediately.

### 2. Automatic Updates (Watcher)
If you are already running the development server:

```bash
npm start docs
```

The system will **automatically regenerate** the favicons whenever the `logo.svg` file in the content directory is created or modified. You don't need to run the manual command if the watcher is already running.

## Configuration
The script uses the `siteName` from your configuration file for the PWA manifest metadata. If specific environment variables are set (`CONTENT_DIR`), they will take precedence over the config file path.
