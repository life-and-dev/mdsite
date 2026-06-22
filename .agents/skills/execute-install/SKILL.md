---
name: execute-install
description: Use this skill to understand how to install, setup, run or deploy project in local or production environments.
---

# Local Installation

1. Install Node deps in repo root because root CLI build needs `typescript`, `vitest`, and `yaml`.
   ```bash
   npm install
   ```
   Expect: `node_modules/` in repo root.

2. Build CLI before local use because bin entry points to `dist/index.js`.
   ```bash
   npm run build
   ```
   Expect: `dist/index.js` from `tsc -p tsconfig.json`.

[Prerequisites]

1. Use Node.js with npm. Project uses ESM (`"type": "module"`) and TypeScript 5.9.
2. No extra root build tools beyond Node/npm.
3. Renderer may auto-run `npm install` in `mdsite-nuxt/` when `node_modules` missing.

[Local Setup Steps]

1. Work in content dir, not repo root, because CLI reads current dir as project dir.
   ```bash
   cd /path/to/content
   node /path/to/md-site/dist/index.js init
   ```
   Expect: `_mdsite.yml` created in current dir.

2. Edit `_mdsite.yml` for local config. `server.path` is relative to content dir.
   Example:
   ```yml
   server:
     path: ../mdsite-nuxt
     output: .output
   ```

3. Keep `server.output` under content dir. Default path is `.output`.

[Startup Steps]

1. Start local dev from content dir after init.
   ```bash
   node /path/to/md-site/dist/index.js start
   ```
   Expect: foreground renderer output in the terminal. Closing the terminal or interrupting the command stops the process.

   For a tracked background renderer, run:
   ```bash
   node /path/to/md-site/dist/index.js start -d
   ```
   Expect: background renderer log at `.mdsite-runtime/start.log`.

2. Generate static output for preview or deploy.
   ```bash
   node /path/to/md-site/dist/index.js generate
   ```
   Expect: site synced to `server.output` or `.output`.

3. Preview only after `generate`.
   ```bash
   node /path/to/md-site/dist/index.js preview
   ```
   Expect: preview URL `http://localhost:3000`.

4. Stop tracked background jobs from same content dir.
   ```bash
   node /path/to/md-site/dist/index.js stop
   ```
   Expect: stop `start -d` and `preview` processes.

[Common Project Commands/URLs]

1. CLI help.
   ```bash
   node /path/to/md-site/dist/index.js help
   ```

2. Root package commands.
   ```bash
   npm run build
   npm run typecheck
   npm test
   ```

3. Local URLs.
   - Dev/preview default: `http://localhost:3000`

[Production Deployment]

[Packaging Steps]

1. Build root CLI first.
   ```bash
   npm run build
   ```
2. Build renderer by running `generate` in content dir.
   ```bash
   node /path/to/md-site/dist/index.js generate
   ```

[Deployment Steps]

1. Copy generated `server.output` content to host that serves static files.
2. Use current `generate` output; docs do not claim npm publish or release hardening.

---

**IMPORTANT**: Update `.agents/skills/execute-install/SKILL.md` whenever project technology, dependencies, installation or deployment processes changes.
