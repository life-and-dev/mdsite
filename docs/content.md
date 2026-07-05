
# Content Directory

This is a reference for the `paths.input` field in `mdsite.yml`. It controls where MD-Site looks for your Markdown files.

> [!IMPORTANT]
> Edit the `paths.input` field in `mdsite.yml` when your Markdown files live in a subdirectory rather than next to `mdsite.yml`. The renderer reads it directly from `mdsite.yml`.

## 1. Default Behavior

If you omit `paths.input`, MD-Site treats the directory that contains `mdsite.yml` as the content directory. This is what `mdsite init` assumes: your Markdown files sit alongside `mdsite.yml`.

```text
my-site/
├── mdsite.yml
├── index.md      ← homepage
├── guide.md
└── about.md
```

## 2. Pointing at a Subdirectory

When you want to keep `mdsite.yml` (and files like `.nvmrc`, `.gitignore`, your favicon source) at the project root but organize all Markdown in a dedicated folder, set `paths.input` to that folder. The path is resolved relative to the directory containing `mdsite.yml`.

```yaml
paths:
  input: content
```

This reads Markdown from the `content/` subdirectory, producing this layout:

```text
my-site/
├── mdsite.yml     ← config lives here
├── .nvmrc
├── .gitignore
└── content/       ← Markdown lives here
    ├── index.md   ← homepage
    ├── about.md
    └── guide/
        └── intro.md
```

> [!NOTE]
> `mdsite init` does not write a `paths:` block. Add it by hand if you move your Markdown into a subdirectory.

## 3. The Homepage

The file named `index.md` at the **root of the content directory** becomes your site's homepage and is served at `/`.

- With the default layout, that is `index.md` next to `mdsite.yml`.
- With `paths.input: content`, that is `content/index.md`.

If the homepage is missing, check that an `index.md` exists at the content directory root. A common cause is a `paths.input` value that does not point at the folder actually holding `index.md`.

## 4. What Goes Where

| Location | Holds |
| --- | --- |
| Config directory (where `mdsite.yml` lives) | `mdsite.yml`, `.nvmrc`, `.gitignore`, favicon source |
| Content directory (where Markdown lives) | all `*.md` files, including `index.md` |

Keeping these concerns separate keeps your repository tidy when it also holds non-site files alongside `mdsite.yml`.

---

> [!TIP]
> **Output**: With the correct `paths.input` value, every Markdown file in that directory becomes a page, and `index.md` becomes the homepage.
