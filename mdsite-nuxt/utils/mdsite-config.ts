import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

export interface MdsiteConfig {
  favicon: string
  features: {
    bibleTooltips: boolean
    sourceEdit: boolean
  }
  menu: Array<string | null | Record<string, string | null | Array<any>>>
  server: {
    output: string
    path: string
    repo: string
  }
  site: {
    canonical: string
    name: string
  }
  themes: {
    light: {
      colors: Record<string, string>
    }
    dark: {
      colors: Record<string, string>
    }
  }
}

export interface LoadedMdsiteConfig {
  config: MdsiteConfig
  configPath?: string
  contentDir: string
}

const configFileName = '_mdsite.yml';

const defaultLightColors = {
  primary: '#0969da',
  secondary: '#656d76',
  selected: '#dbe3eb',
  error: '#d1242f',
  warning: '#bf8700',
  info: '#0969da',
  success: '#1a7f37',
  background: '#f6f8fa',
  surface: '#ffffff',
  'surface-rail': '#edf1f5',
  'surface-appbar': '#e4eaf0',
  'on-surface-rail': '#32302a',
  'on-surface-appbar': '#000000',
  'on-background': '#24292f',
  'on-surface': '#24292f',
  'on-primary': '#ffffff',
  'on-secondary': '#ffffff',
  'on-selectable': '#24292f',
  'on-selected': '#000000',
  'on-error': '#ffffff',
  'on-warning': '#ffffff',
  'on-info': '#ffffff',
  'on-success': '#ffffff',
  outline: '#d0d7de',
  'outline-bars': '#f3f4f6'
} satisfies Record<string, string>;

const defaultDarkColors = {
  primary: '#58a6ff',
  secondary: '#8b949e',
  selected: '#313943',
  error: '#f85149',
  warning: '#d29922',
  info: '#58a6ff',
  success: '#3fb950',
  background: '#161b22',
  surface: '#0d1117',
  'surface-rail': '#1f252d',
  'surface-appbar': '#282f38',
  'on-surface-rail': '#ced0d6',
  'on-surface-appbar': '#ffffff',
  'on-background': '#c9d1d9',
  'on-surface': '#c9d1d9',
  'on-primary': '#0d1117',
  'on-secondary': '#0d1117',
  'on-selectable': '#c9d1d9',
  'on-selected': '#ffffff',
  'on-error': '#ffffff',
  'on-warning': '#ffffff',
  'on-info': '#ffffff',
  'on-success': '#ffffff',
  outline: '#30363d',
  'outline-bars': '#161b22'
} satisfies Record<string, string>;

export function loadMdsiteConfigSync(options: {
  configPath?: string
  contentPath?: string
  searchFrom?: string
} = {}): LoadedMdsiteConfig {
  const configPath = resolveMdsiteConfigPath(options);
  const contentDir = resolveContentDir(options, configPath);

  if (!configPath) {
    return {
      config: createDefaultMdsiteConfig(path.basename(contentDir) || 'Site'),
      contentDir
    };
  }

  const rawText = fs.readFileSync(configPath, 'utf8');
  const parsed = YAML.parse(rawText) ?? {};

  return {
    config: normalizeMdsiteConfig(parsed, contentDir),
    configPath,
    contentDir
  };
}

export function resolveMdsiteConfigPath(options: {
  configPath?: string
  contentPath?: string
  searchFrom?: string
} = {}): string | undefined {
  const candidates = [
    options.configPath,
    process.env.MDSITE_CONFIG_PATH,
    options.contentPath ? path.join(options.contentPath, configFileName) : undefined,
    process.env.NUXT_CONTENT_PATH ? path.join(process.env.NUXT_CONTENT_PATH, configFileName) : undefined,
    options.searchFrom ? path.join(options.searchFrom, configFileName) : undefined,
    path.join(process.cwd(), configFileName)
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const resolvedPath = path.resolve(candidate);
    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
      return resolvedPath;
    }
  }

  return undefined;
}

export function resolveContentDir(options: {
  configPath?: string
  contentPath?: string
  searchFrom?: string
} = {}, resolvedConfigPath?: string): string {
  if (options.contentPath) {
    return path.resolve(options.contentPath);
  }

  if (process.env.NUXT_CONTENT_PATH) {
    return path.resolve(process.env.NUXT_CONTENT_PATH);
  }

  if (resolvedConfigPath) {
    return path.dirname(resolvedConfigPath);
  }

  if (options.searchFrom) {
    return path.resolve(options.searchFrom);
  }

  return process.cwd();
}

function createDefaultMdsiteConfig(siteName: string): MdsiteConfig {
  return {
    favicon: '',
    features: {
      bibleTooltips: true,
      sourceEdit: true
    },
    menu: [],
    server: {
      output: '.output',
      path: '.mdsite',
      repo: 'https://github.com/life-and-dev/mdsite'
    },
    site: {
      canonical: '',
      name: siteName
    },
    themes: {
      light: {
        colors: defaultLightColors
      },
      dark: {
        colors: defaultDarkColors
      }
    }
  };
}

function normalizeMdsiteConfig(rawConfig: Record<string, any>, contentDir: string): MdsiteConfig {
  const fallbackConfig = createDefaultMdsiteConfig(path.basename(contentDir) || 'Site');

  return {
    favicon: typeof rawConfig.favicon === 'string' ? rawConfig.favicon : fallbackConfig.favicon,
    features: {
      bibleTooltips: rawConfig.features?.bibleTooltips ?? fallbackConfig.features.bibleTooltips,
      sourceEdit: rawConfig.features?.sourceEdit ?? fallbackConfig.features.sourceEdit
    },
    menu: Array.isArray(rawConfig.menu) ? rawConfig.menu : fallbackConfig.menu,
    server: {
      output: typeof rawConfig.server?.output === 'string' ? rawConfig.server.output : fallbackConfig.server.output,
      path: typeof rawConfig.server?.path === 'string' ? rawConfig.server.path : fallbackConfig.server.path,
      repo: typeof rawConfig.server?.repo === 'string' ? rawConfig.server.repo : fallbackConfig.server.repo
    },
    site: {
      canonical: typeof rawConfig.site?.canonical === 'string' ? rawConfig.site.canonical : fallbackConfig.site.canonical,
      name: typeof rawConfig.site?.name === 'string' && rawConfig.site.name.trim() ? rawConfig.site.name : fallbackConfig.site.name
    },
    themes: {
      light: {
        colors: {
          ...fallbackConfig.themes.light.colors,
          ...(rawConfig.themes?.light?.colors ?? {})
        }
      },
      dark: {
        colors: {
          ...fallbackConfig.themes.dark.colors,
          ...(rawConfig.themes?.dark?.colors ?? {})
        }
      }
    }
  };
}
