# Favicon Configuration

MD-Site uses the `favicon` value in `mdsite.yml` to pass a favicon path to the local renderer.

## How it Works

The configured favicon path is resolved relative to your content directory. If `favicon` is configured, the referenced file must exist.

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
