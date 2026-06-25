# Features

This site includes several optional features that can be toggled on or off depending on your needs.

## Global Feature Toggles

Features are managed in the `features` section of `mdsite.yml` in your content directory. Each feature can be enabled by setting its value to `true`.

```yaml
features:
  bibleTooltips: true  # Automatic Bible reference detection
  sourceEdit: true     # "Edit on GitHub" links
```

## Available Features

- **[Bible Tooltips](./features/bible-tooltips.md)**: Automatically detects and highlights Bible references in your content.
- **[Source Edit](./features/source-edit.md)**: Adds links to allow users to edit the current page directly on the source repository.

## How to Enable/Disable

To change the status of a feature:
1.  Open `mdsite.yml` in your content directory.
2.  Locate the `features` section.
3.  Set the desired feature to `true` or `false`.
4.  Restart `mdsite start` or rerun `mdsite generate` to see the changes.
