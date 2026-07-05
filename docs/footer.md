
# Footer Configuration

This is a reference for the `features.footer` section in `mdsite.yml`. Use it to populate the bottom bar of every page with links to selected pages on your site (or to external sites).

> [!IMPORTANT]
> Edit the `features.footer` section in `mdsite.yml` when changing your site's bottom bar. The renderer reads it directly from `mdsite.yml` and regenerates the link list whenever you save a markdown file.

## 1. Basic Structure

The `features.footer` section is a YAML list nested under the `features` block. Each item becomes a link, a separator, or a labelled link in the bottom bar. The syntax mirrors the `menu` section, except sub-menus are not supported.

```yaml
features:
  footer:
    - about
    - contacts
    - "About Page": about
    - "GitHub Repo": https://github.com/life-and-dev/mdsite
```

The renderer resolves each entry against the content root, reads the file's `h1` for the link text (unless a custom label is supplied), and builds the URL from the file path. External URLs are passed through unchanged and open in a new tab.

## 2. Item Types

### A. Simple Link (String)
If you just provide a filename, the system will look up that file's `h1` title and use it as the link text.

```yaml
- my-page
```
*   **Link Text**: (Title from `my-page.md`)
*   **href**: `/my-page`

### B. Custom Label (Key-Value)
Override the title shown in the footer by providing a key-value pair. The key is the link text, the value is the file path (without `.md`) or an external URL.

```yaml
- "About Us": about
```
*   **Link Text**: "About Us"
*   **href**: `/about`

> Custom labels always win — the file's `h1` is ignored when a label is supplied.

### C. External Links
Paste an `http://` or `https://` URL as the value. External links open in a new tab and show an inline `open-in-new` icon.

```yaml
- "GitHub Repo": https://github.com/life-and-dev/mdsite
- "NPM Registry": https://www.npmjs.com/package/@life-and-dev/mdsite
```

### D. Separators
Use `null` to insert a vertical separator between groups of links.

```yaml
features:
  footer:
    - about
    - contacts
    - null
    - "GitHub Repo": https://github.com/life-and-dev/mdsite
```

### E. What Is *Not* Supported
Unlike `menu`, the `features.footer` section does **not** support nested sub-menus (a value can only be a string or `null`, never a list). Use `menu` for grouped navigation.

## 3. Path Resolution

*   **Relative paths** — `about` and `features/source-edit` resolve against the content root. The `.md` extension is implied.
*   **External URLs** — Anything starting with `http://` or `https://` is passed through unchanged.

## 4. Menu Deduplication

Any internal file listed in `features.footer` is **excluded from `menu:`**. The renderer removes the matching entry from the sidebar so a page does not appear twice.

```yaml
menu:
  - index
  - guide
features:
  footer:
    - about
    - contacts
```

With this configuration the sidebar shows `index` and `guide`, and the bottom bar shows `about` and `contacts`. If a file is listed in both places it is dropped from the sidebar. External URLs are not affected. See [Menu Configuration](menu) for the full `menu:` syntax.

The "Edit" link in the bottom bar is controlled separately by `features.source-edit` (a non-empty URL prefix enables the link; an empty string disables it). It is only rendered inside the bar when the bar itself is visible (see below).

## 5. When the Bar Is Hidden

The entire bottom bar (including the Edit button) is hidden when `features.footer` is missing, set to an empty array, or contains no renderable items. The bar only appears when at least one link or separator is configured.

```yaml
features:
  footer: []   # bar is hidden
```

```yaml
features:
  footer:
    - about    # bar is visible with one link
```

While the renderer is loading the footer index on the client, the bar is also hidden. This avoids a brief flash of an empty bar before the JSON arrives.

---

> [!TIP]
> **Output**: When you set `features.footer` in `mdsite.yml` to a non-empty list, the bottom bar of every page lists each entry as a link (or a separator). With no entries (or no `features.footer` key) the bar is not rendered at all.
