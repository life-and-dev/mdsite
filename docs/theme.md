# Theme Configuration

The Markdown CMS allows you to define custom themes for each configuration. Themes are configured in the `content.config.yml` or `{domain}.config.yml` file and leverage Vuetify's theme system under the hood.

## Structure

Themes are defined under the `themes` property in your configuration file. You can define multiple themes (e.g., `light`, `dark`), and the system will allow users to toggle between them.

```yaml
themes:
  light:
    colors:
      primary: '#0969da'
      background: '#f6f8fa'
      # ... other colors
  dark:
    colors:
      primary: '#58a6ff'
      background: '#161b22'
      # ... other colors
```

## Color Formats (HEX Codes)

Colors in the configuration are defined using **HEX codes** (e.g., **#<span style="color: red">09</span><span style="color: green">69</span><span style="color: blue">da</span>**). This is a standard way to represent colors in web development:
- The first two characters represent <span style="color: red">**Red**</span>.
- The middle two characters represent <span style="color: green">**Green**</span>.
- The last two characters represent <span style="color: blue">**Blue**</span>.

Each pair ranges from `00` (nothing) to `ff` (maximum intensity) in hexadecimal.

### Online Color Tools
If you need help finding the right colors or generating these codes, here are some excellent free tools:
- **[Google Color Picker](https://www.google.com/search?q=color+picker)**: A simple, quick tool built directly into Google Search.
- **[Coolors.co](https://coolors.co/)**: An extremely fast palette generator for finding colors that look great together.
- **[Adobe Color](https://color.adobe.com/)**: A professional tool for exploring color trends and creating harmonious schemes.
- **[Muzli Colors](https://colors.muz.li/)**: Provides great UI-centric color inspirations and palettes.

## Dark Mode Detection

The system automatically determines if a theme is "dark" or "light" based on its name. If the theme name is**"dark"**, it is treated as a dark theme. Otherwise, it defaults to light. 

## Color Tokens

The CMS uses a comprehensive set of color tokens to ensure consistent styling across the application.

### Core Colors
- `primary`: Main brand color (links, primary buttons).
- `secondary`: Secondary brand color.
- `background`: Page background color.
- `surface`: Background color for cards and elevated elements.
- `error`, `warning`, `info`, `success`: Status colors for alerts and feedback.

### Navigation & Rail
These colors are used by the sidebar navigation rail and the table of contents.
- `surface-rail`: Background color of the sidebars.
- `on-surface-rail`: Color for labels and non-interactive text in the sidebar.
- `on-selectable`: Text color for selectable navigation items.
- `selected`: Background highlight color for the currently active item.
- `on-selected`: Text/icon color for the currently active item.

### App Bar & UI
- `surface-appbar`: Background color for the top navigation bar and footer.
- `on-surface-appbar`: Text/icon color for the app bar and footer.
- `outline`: Standard border color.
- `outline-bars`: Border color specifically for bars or dividers.

### "On" Colors
Vuetify uses "on" colors to define the text color that should be used on top of a specific background.
- `on-primary`: Text on primary backgrounds.
- `on-background`: Main content text color.
- `on-surface`: Text on card backgrounds.

## Example Configuration

Here is a snippet showing how navigation colors are typically configured:

```yaml
themes:
  light:
    colors:
      surface-rail: '#edf1f5'
      on-surface-rail: '#32302a'
      on-selectable: '#24292f'
      selected: '#dbe3eb'
      on-selected: '#0969da'
```
