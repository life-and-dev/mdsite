
# Footer Configuration

This is a reference for the `footer` section in `mdsite.yml`. Use it to populate the bottom bar of every page with links to selected pages on your site.

> [!IMPORTANT]
> Edit the `footer` section in `mdsite.yml` when changing your site's bottom bar. The renderer reads it directly from `mdsite.yml` and regenerates the link list whenever you save a markdown file.

## 1. Basic Structure

The `footer` section is a flat YAML list. Each item is a markdown file reference (no `.md`, no nested objects) and becomes a link in the bottom bar.

```yaml
footer:
  - about
  - contacts
```

The renderer resolves each entry against the content root, reads the file's `h1` for the link text, and builds the URL from the file path. In the example above the bottom bar shows two links pointing at `/about` and `/contacts`.

## 2. Item Format

*   **Bare file name** — `about` resolves to `about.md` and links to `/about`.
*   **Relative path** — `features/source-edit` resolves to `features/source-edit.md` and links to `/features/source-edit`.
*   **Title resolution** — the file's first `h1` is used as the link text. If the file has no `h1`, the bare name is used (e.g. `about`).
*   **No nesting** — unlike `menu`, the `footer` does not support submenus, separators, headers, custom labels, or external links. Use `menu` for those.

## 3. Menu Deduplication

Any file listed in `footer:` is **excluded from `menu:`**. The renderer removes the matching entry from the sidebar so a page does not appear twice.

```yaml
menu:
  - index
  - guide
footer:
  - about
  - contacts
```

With this configuration the sidebar shows `index` and `guide`, and the bottom bar shows `about` and `contacts`. If a file is listed in both places it is dropped from the sidebar. See [Menu Configuration](menu) for the full `menu:` syntax.

The "Edit" link in the bottom bar is controlled separately by `features.sourceEdit` and `server.repo`; it is only rendered inside the bar when the bar itself is visible (see below).

## 4. When the Bar Is Hidden

The entire bottom bar (including the Edit button) is hidden when `footer:` is missing or set to an empty array. The bar only appears when at least one entry is configured.

```yaml
footer: []   # bar is hidden
```

```yaml
footer:
  - about    # bar is visible with one link
```

While the renderer is loading the footer index on the client, the bar is also hidden. This avoids a brief flash of an empty bar before the JSON arrives.

---

> [!TIP]
> **Output**: When you set `footer:` in `mdsite.yml` to a non-empty list, the bottom bar of every page lists each entry as a link. With no entries (or no `footer:` key) the bar is not rendered at all.
