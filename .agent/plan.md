This project should be turned into a npm CLI utility that can be used to generate static sites from markdown files.

# Phase 1 Architecture Clarification

The active stabilization target is a local-use CLI that orchestrates `mdsite-nuxt` via a single `_mdsite.yml` file.

## Active Phase 1 Scope

- Breaking changes are acceptable during Phase 1 stabilization.
- The required commands for current stability are `init`, `start`, and `generate`.
- `stop` and `preview` only need enough support to avoid broken local workflows during Phase 1.
- Legacy root workflows are deprecated and should be treated as reference-only.

## Deferred / Post-Stabilization

- Npm release hardening is deferred until local workflows are reliable.
- True git submodule conversion is deferred until local workflows are reliable.
- `prepare github` is deferred and is not part of active Phase 1 scope.
- Global npm distribution goals remain later-phase work, not the current stabilization target.

# Usage

Given a directories with multiple markdown files in sub-directories:

## init command

When the user type `mdsite init`, it should:

1. Create an `_mdsite.yml` in that same directory (if it does not exist) a file with these default values:

```yaml
favicon: # The path to the source favicon
features:
  bibleTooltips: true
  sourceEdit: true
menu:
server:
  output: .output # Path where generated static website files will be output
  path: .mdsite # Path where git mdsite content is cloned/checked out relative to this file
  repo: https://github.com/life-and-dev/mdsite # The Git repo to clone for the server
site:
  canonical: # For example 'https://life-and-dev.github.io/mdsite'
  name:
themes:
  light:
    colors:
      primary: '#0969da'
      secondary: '#656d76'
      selected: '#dbe3eb'
      error: '#d1242f'
      warning: '#bf8700'
      info: '#0969da'
      success: '#1a7f37'
      background: '#f6f8fa'
      surface: '#ffffff'
      surface-rail: '#edf1f5'
      surface-appbar: '#e4eaf0'
      on-surface-rail: '#32302a'
      on-surface-appbar: '#000000'
      on-background: '#24292f'
      on-surface: '#24292f'
      on-primary: '#ffffff'
      on-secondary: '#ffffff'
      on-selectable: '#24292f'
      on-selected: '#000000'
      on-error: '#ffffff'
      on-warning: '#ffffff'
      on-info: '#ffffff'
      on-success: '#ffffff'
      outline: '#d0d7de'
      outline-bars: '#f3f4f6'
  dark:
    colors:
      primary: '#58a6ff'
      secondary: '#8b949e'
      selected: '#313943'
      error: '#f85149'
      warning: '#d29922'
      info: '#58a6ff'
      success: '#3fb950'
      background: '#161b22'
      surface: '#0d1117'
      surface-rail: '#1f252d'
      surface-appbar: '#282f38'
      on-surface-rail: '#ced0d6'
      on-surface-appbar: '#ffffff'
      on-background: '#c9d1d9'
      on-surface: '#c9d1d9'
      on-primary: '#0d1117'
      on-secondary: '#0d1117'
      on-selectable: '#c9d1d9'
      on-selected: '#ffffff'
      on-error: '#ffffff'
      on-warning: '#ffffff'
      on-info: '#ffffff'
```
      
The property site.name should match the first markdown title in the `index.md` file or default to "MD Site".

Regarding the menu property:
- Same rules that currently applies to how _menu.yml files are processed will apply here. For example the /docs/_menu.yml should be migrated to:

```yaml
menu:
  - markdown
  - menu
  - favicon
  - theme
  - features:
    - bible-tooltips
    - source-edit
  - deploy
  - architecture
  - nuxt
  - tests
```

When you use left the menu property blank, it should automatically generate the menu property based on the markdown files in the content directory. The menu items should be the name of the markdown files with the extensions removed. The above example is the typical output of the current docs directory for comparison.

## start command

When the user type `mdsite start`, it should:

1. Clone/pull the repo defined in `_mdsite.yml` server.repo to server.path
2. Setup `.env` in the server.path directory to point back to this directory for the content, by settings a `NUXT_CONTENT_PATH` environment variable.
3. Run `npm install` in the server.path directory
4. Run `npm run favicon` in the server.path directory which should regenerate the favicon based on the favicon property in `_mdsite.yml` (only if the favicon property is set and if the favicons is not already generated in {server.path}/public ). See scripts/generate-favicons.ts for implementation details. Favicons should be generated in {server.path}/public/
5. Run `npm run indices` in the server.path directory which should regenerate the indices based on the menu property in `_mdsite.yml`. See scripts/generate-indices.ts for implementation details. Indices should be generated in {server.path}/public/
6. Run `npm run dev` in the server.path directory which should start the Nuxt development server and use `NUXT_CONTENT_PATH` to find the markdown content and the _mdsite.yml file for additional configuration, like theme colors, menu, etc. Base the implementation on the current scripts/start.ts file.
7. Run the sync-content.ts script that should keep the users md content in sync with the content in the started development server so that if the user modifies an md files, it should be reflected in the development server automatically.

## stop command

When the user type `mdsite stop`, it should:

1. Stop the Nuxt development server or preview server.
2. Stop the sync-content.ts script (if it was running).

For Phase 1 stabilization, this command only needs enough support to avoid broken local workflows.

## generate command

When the user type `mdsite generate`, it should:

1. Clone/pull the repo defined in `_mdsite.yml` server.repo to server.path
2. Setup `.env` in the server.path directory to point back to this directory for the content, by settings a `NUXT_CONTENT_PATH` environment variable.
3. Run `npm install` in the server.path directory
4. Run `npm run favicon` in the server.path directory which should regenerate the favicon based on the favicon property in `_mdsite.yml` (only if the favicon property is set and if the favicons is not already generated in {server.path}/public ). See scripts/generate-favicons.ts for implementation details. Favicons should be generated in {server.path}/public/
5. Run `npm run indices` in the server.path directory which should regenerate the indices based on the menu property in `_mdsite.yml`. See scripts/generate-indices.ts for implementation details. Indices should be generated in {server.path}/public/
6. Run `npm run generate` in the server.path directory which should generate the static files for the Nuxt application and use `NUXT_CONTENT_PATH` to find the markdown content and the _mdsite.yml file for additional configuration, like theme colors, menu, etc. Base the implementation on the current scripts/start.ts file.
7. The generate script should honor the server.output property and generate the static files in that directory.

## preview command

When the user type `mdsite preview`, it should:

1. Run `npm run preview` in the server.path directory which should start the Nuxt preview server and server.output to find the static files to serve.

For Phase 1 stabilization, this command only needs enough support to avoid broken local workflows.

## prepare github command

Deferred / post-stabilization only. This is not part of the active Phase 1 architecture scope.

Use the current .github/workflows/deploy.yml file as an example to generate a deploy.yml template file which accept variables. This should enable the user to generate github pages workflows.

When the user type `mdsite prepare github`, it should:

1. Run `npm run prepare github` in the server.path directory which should prepare the github pages deployment.
2. This should generate .github/workflows/deploy.yml file in the _mdsite.yml directory based on the above mentioned template.
3. The correct variables should be substituted in the deploy.yml file so that the user should be able to push his content repo to github and it should deploy the expected github pages based on the md content using the mdsite util and nuxt system.

# Project structure

This section describes the intended target layout. Items tied to true submodule conversion or npm release hardening are deferred unless they are required to support active Phase 1 local workflows.

You need to reorganize the directories such that:

## Active Phase 1 target layout

The root directory target for Phase 1 contains:
- README.md Briefly explain to humans how to setup and use this project
- AGENTS.md Briefly explain to AI agents how to setup and use this project, where components are located, including the purpose of this project
- src: Source code of the local-use CLI
- package.json: Root package for the CLI utility
- mdsite-nuxt: Nuxt renderer used by the CLI
- .gitignore (needs to be updated)

## Active Phase 1 structure work

- Create the npm cli utility that will be used to run the above mentioned `mdsite` commands.
- Place the source code of the cli utility in `src` directory.
- The new package.json file should in the root directory of this project should be used to run the cli utility rather than the legacy root Nuxt website.

## Deferred / post-stabilization structure work

- Move the old root project fully into `mdsite-nuxt` as part of true git submodule conversion.
- Finalize the root/package split implied by full submodule conversion.
- Allow the new package.json to deploy the bundled (minified version) of the mdsite cli util to npmjs.com.

This publish/release hardening work is deferred until after Phase 1 local workflows are reliable.

# Expected outcome

## Active Phase 1 expected outcome

As a user, I should be able:
2. In the directory that contain mdfiles:
   1. When the user type `mdsite init`, it should create a `_mdsite.yml` file with the default values.
   2. When the user type `mdsite start`, it should start the development server serving the md files of the same directory and sub-directories.
   3. When the user type `mdsite stop`, it should stop the development server.
   4. When the user type `mdsite generate`, it should generate the static files of the md files of the same directory and sub-directories in the .output directory.
   5. When the user type `mdsite preview`, it should start the preview server and serve the static files from the .output directory.
   6. When the user type `mdsite stop`, it should stop the preview server.
3. In any directory I should be able to run `mdsite help` which explain the possible commands and their usage.

For Phase 1, treat the local workflows above as the active stabilization target, with npm publication and true submodule conversion deferred.

## Deferred / post-stabilization expected outcome

- `npm install -g mdsite` global distribution
- `mdsite prepare github`
- True git submodule conversion as part of the final repository structure
