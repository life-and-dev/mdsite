# Source Edit

The Source Edit feature provides a direct link for users to edit the current page's source content on the hosted repository (currently supporting GitHub).

## How it Works

When enabled, an "Edit" button appears in the application bar (as a pencil icon) and in the footer. Clicking this button redirects the user to the specific file on GitHub that corresponds to the current page.

## Configuration

This feature is controlled by the `sourceEdit` toggle in `mdsite.yml`:

```yaml
features:
  sourceEdit: true # Set to true to enable, false to disable
```

### Requirements

For the "Edit" link to be generated and rendered:
1.  `sourceEdit` must be set to `true`.
2.  Source repository metadata must be present in the generated renderer configuration.
