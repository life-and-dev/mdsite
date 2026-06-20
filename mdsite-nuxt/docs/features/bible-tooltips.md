# Bible Tooltips

The Bible Tooltips feature automatically identifies Bible references in your Markdown content and wraps them in a special component. When a user hovers over these references, a tooltip with the verse text can be displayed (depending on the implementation of the tooltip component).

## How it Works

The site uses a set of regex patterns to match common Bible reference formats (e.g., "John 3:16", "Genesis 1:1-5"). This processing happens before the Markdown is parsed, ensuring that references aren't accidentally missed if they are part of other elements.

## Configuration

This feature is controlled by the `bibleTooltips` toggle in your `{domain}.config.yml` file:

```yaml
features:
  bibleTooltips: true # Set to true to enable, false to disable
```

## Supported Formats

Most standard Bible citation formats are supported, including:
- Single verses: `John 3:16`
- Verse ranges: `Psalm 23:1-6`
- Multiple chapters: `Genesis 1-2`
