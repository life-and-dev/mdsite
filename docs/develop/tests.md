# Testing

This page covers how to run the MDsite test suites, how they are configured, and what to add when you change code. For the broader contributor picture, start at [Developing mdsite](../develop.md).

## 1. Two test suites

MDsite has two independent test suites:

| Suite | Location | Runner | Covers |
| --- | --- | --- | --- |
| **CLI tests** | `src/**/*.test.ts` | Vitest (root `vitest.config.ts`) | The TypeScript CLI: command dispatch, config parsing, renderer prep, process management. |
| **Renderer tests** | `mdsite-nuxt/**` | Vitest + Playwright (`mdsite-nuxt/vitest.config.ts`, `mdsite-nuxt/playwright.config.js`) | The Nuxt renderer: utility scripts, hooks, end-to-end flows. |

The CLI test suite is what `npm test` runs at the repo root. The renderer suite is run separately, inside `mdsite-nuxt/`. They do not share configuration or dependencies.

## 2. Running the CLI tests

From the repo root:

```bash
npm test
```

This invokes `vitest run` (see the `test` script in `package.json`). It runs every file matching `src/**/*.test.ts` exactly once and exits.

For iterative work, run Vitest in watch mode:

```bash
npx vitest
```

This re-runs affected tests on every file change.

### Useful flags

- `npx vitest run --reporter=verbose` — full per-test output.
- `npx vitest run src/config` — restrict to tests under `src/config/`.
- `npx vitest run -t "dispatches mdsite live"` — run only tests matching a name pattern.

## 3. CLI test configuration

The root [`vitest.config.ts`](https://github.com/life-and-dev/mdsite/blob/main/vitest.config.ts) is intentionally minimal:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**'],
  },
});
```

- **Include**: every `*.test.ts` next to its source under `src/`.
- **Exclude**: anything compiled into `dist/`.
- No environment is set (tests run in Node by default), because the CLI is pure Node.js code with no DOM dependency.

### Test file layout

Tests sit next to the module they cover:

```text
src/
├── index.ts                    # CLI entrypoint
├── index.test.ts               # tests for the entrypoint
├── commands/
│   ├── init.ts
│   ├── start.ts
│   ├── generate.ts
│   ├── preview.ts
│   ├── stop.ts
│   ├── prepare.ts
│   ├── commands.test.ts        # cross-command tests
│   ├── prepare.test.ts
│   └── workflows.test.ts       # GitHub workflow generation
├── config/
│   ├── mdsite-config.ts
│   ├── mdsite-config.test.ts
│   ├── default-mdsite-config.ts
│   ├── default-mdsite-config.test.ts
│   ├── menu.ts
│   └── menu.test.ts
├── process/
│   ├── child-process.ts
│   ├── child-process.test.ts
│   ├── runtime-state.ts
│   └── runtime-state.test.ts
└── renderer/
    ├── mdsite-nuxt.ts
    └── mdsite-nuxt.test.ts
```

### Conventions used in the tests

Looking at `src/index.test.ts` as a reference:

- **Mocks for sibling modules**: `vi.mock('./commands/init.js', () => ({ runInitCommand: vi.fn() }))` — every command handler is mocked so the entrypoint test only checks dispatch logic, not real command behaviour.
- **Argv manipulation**: tests set `process.argv` directly to simulate CLI invocations.
- **Console spies**: `vi.spyOn(console, 'log')` and `vi.spyOn(console, 'error')` assert output without polluting the terminal.
- **`beforeEach` / `afterEach`**: reset `process.argv`, `process.exitCode`, and restore mocks between cases.
- **Dynamic import**: `await import('./index.js')` re-imports the entrypoint after `vi.resetModules()` so the new `process.argv` takes effect.

Follow the same pattern when adding CLI tests.

## 4. Other verification scripts

The root `package.json` exposes three related scripts:

| Script | What it does |
| --- | --- |
| `npm test` | Runs the CLI Vitest suite (`vitest run`). |
| `npm run typecheck` | `tsc --noEmit` against both `tsconfig.json` (CLI) and `tsconfig.scripts.json` (repo scripts). Emits nothing. |
| `npm run verify:package` | Runs `scripts/verify-package-artifacts.ts` to confirm the published package layout matches `package.json`'s `files` field. |
| `npm run build` | `tsc -p tsconfig.json` — emits `dist/`. |

`prepublishOnly` runs all four (test, typecheck, build, verify) before any `npm publish`. The release workflow (see [Release](release)) relies on this hook to block bad publishes.

## 5. Running the renderer tests

The renderer has its own test setup inside `mdsite-nuxt/`. Run them from that directory:

```bash
cd mdsite-nuxt
npm test                # Vitest (unit tests for scripts/)
# npx playwright test   # Playwright (browser-based end-to-end tests)
```

Renderer test files live next to their source — for example `scripts/generate-indices.test.ts`, `scripts/renderer-hooks.test.ts`, `scripts/start.test.ts`, `utils/base-url.test.ts`. These tests are completely separate from the CLI suite and are not invoked by `npm test` at the repo root.

## 6. What to test

When adding or changing CLI code, add or update the matching `*.test.ts` file:

| Change | Where to test |
| --- | --- |
| New command in `src/commands/` | New `src/commands/<name>.test.ts` plus a dispatch case in `src/index.test.ts`. |
| New `mdsite.yml` field | `src/config/mdsite-config.test.ts` (parsing) and `src/config/default-mdsite-config.test.ts` (defaults). |
| New menu shape | `src/config/menu.test.ts`. |
| New runtime-state behaviour | `src/process/runtime-state.test.ts`. |
| New renderer preparation step | `src/renderer/mdsite-nuxt.test.ts`. |
| New GitHub workflow template | `src/commands/workflows.test.ts`. |

Aim for the same style as existing tests: mock sibling modules, drive behaviour via inputs (argv, config objects, temp dirs), and assert on outputs and side effects rather than internal state.

---

> [!TIP]
> `npm test` at the repo root only covers the CLI. If you change code under `mdsite-nuxt/`, remember to also run `npm test` inside that directory before pushing.
