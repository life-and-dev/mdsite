# Source Edit

The Source Edit feature provides a direct link for users to edit the current page's source content on the hosted repository (currently supporting GitHub).

## How it Works

`features.source-edit` is a **URL prefix**. When it is a non-empty string, an "Edit" button appears in the application bar (as a pencil icon) and in the footer. Clicking the button opens `<source-edit><page>.md` in a new tab, so the reader lands directly on the source file in your repository.

## Configuration

`mdsite init` auto-detects this prefix from your `origin` git remote and current branch (`https://github.com/<owner>/<repo>/blob/<branch>/`). You can also set it by hand to the URL prefix that points at the directory holding your Markdown files:

```yaml
features:
  source-edit: https://github.com/life-and-dev/mdsite/blob/main/
```

The renderer appends `<page>.md` to this prefix to build the Edit link, so the prefix must include the trailing path segment that leads to the file.
### Requirements

For the "Edit" link to be generated and rendered:

1.  `source-edit` must be a non-empty string.
2.  The URL prefix must include the trailing path segment to the file (e.g. `.../blob/main/` for GitHub).
3.  For Markdown that lives in a subdirectory of the repository, include that subdir in the prefix (e.g. `.../blob/main/docs/`).

Setting `source-edit: ''` or omitting it entirely (also the outcome when init finds no GitHub remote) disables the Edit button.
