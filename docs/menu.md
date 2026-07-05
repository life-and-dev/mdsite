
# Menu Configuration

This is a reference for the `menu` section in `mdsite.yml`. You will learn common ways to define items in your navigation sidebar.

> [!IMPORTANT]
> Edit the `menu` section in `mdsite.yml` when changing your site's navigation. The renderer reads it directly from `mdsite.yml`.

## 1. Basic Structure

The `menu` section is a YAML list. Each item in the list becomes an item in the sidebar.

```yaml
- Introduction: intro.md
- installation.md
- Advanced Topics:
  - Configuration: config.md
```

## 2. Item Types

### A. Simple Link (String)
If you just provide a filename, the system will look up that file's `h1` title and use it as the link text.

```yaml
- my-page.md
```
*   **Link Text**: (Title from `my-page.md`)
*   **href**: `/my-page`

### B. Custom Label (Key-Value)
Use this if you want to override the title shown in the menu.

```yaml
- "Getting Started": start.md
```
*   **Link Text**: "Getting Started"
*   **href**: `/start`

### C. Submenus (Nested Lists)
Indent a list under a key to create a collapsible group.

```yaml
- "Documentation":
  - "Setup": setup.md
  - "Usage": usage.md
```

### D. Headers & Separators

*   **Header**: Use `===` as the value.
    ```yaml
    - "User Guide": ===
    ```
    (This creates a non-clickable section label "User Guide")

*   **Separator**: Use `===` as the value.
    ```yaml
    - ===
    ```
    (This draws a horizontal line)

### E. External Links
Just paste the URL as the value.

```yaml
- "My Blog": https://example.com
```

## 3. Path Resolution

*   **Relative Paths**: `intro.md` looks for the file in the current directory.
*   **Absolute Paths**: `/folder/file.md` looks for the file starting from the content root.

## 4. Excluding Items from the Menu

Entries listed in `features.footer` are removed from the `menu:` output. This lets you move a page from the sidebar to the bottom bar without leaving a duplicate in the sidebar.

```yaml
menu:
  - about
  - contacts
  - help
features:
  footer:
    - contacts
```

In this example, the sidebar shows `about` and `help`; `contacts` is dropped because it appears in the bottom bar.

See [Footer Configuration](footer) for how to move links to the bottom bar.

---

> [!TIP]
> **Output**: If you configure `menu` in `mdsite.yml` correctly, you will see a sidebar navigation that matches your content structure.
