# Release

This page explains how to cut a new release of `@life-and-dev/mdsite`. For the contributor overview, start at [Developing MDsite](../develop).

Releases are **tag-driven**: a local script bumps the version, builds, verifies, commits, and tags. Pushing the tag triggers a GitHub Actions workflow that publishes to npm with provenance and creates the GitHub Release. You never run `npm publish` manually.

## 1. Prerequisites

Before cutting a release, confirm:

- You have push access to [`life-and-dev/mdsite`](https://github.com/life-and-dev/mdsite) on the `main` branch.
- The working tree is clean on `main` and up to date with `origin/main`.
- The `mdsite-nuxt` submodule pointer is at the commit you want to ship.
- npm **Trusted Publisher** is configured for `@life-and-dev/mdsite` (see section 5 below).
- `npm publish --provenance` will work from GitHub Actions — the workflow needs `id-token: write` permission (already set in `.github/workflows/npm-publish.yml`).

## 2. Cut the release locally

From the repository root, choose a semantic-version bump:

```bash
npm run release:version -- patch    # 0.0.x bugfix
npm run release:version -- minor    # 0.x.0 feature
npm run release:version -- major    # x.0.0 breaking
npm run release:version -- 1.2.3    # exact version
```

[The `release:version` script](https://github.com/life-and-dev/mdsite/blob/main/scripts/release-version.ts) automates the boring parts:

1. **Bumps the version** in `package.json` and `package-lock.json` via `npm version --no-git-tag-version`.
2. **Type-checks** the CLI (`npm run typecheck`).
3. **Builds** `dist/` (`npm run build`).
4. **Verifies the package layout** (`npm run verify:package`). This catches missing files, wrong bin path, wrong package name, and missing `files` entries before publish.
5. **Commits** as `chore: release v<version>`.
6. **Tags** the commit as `v<version>` (annotated).

The script prints the next manual commands and exits. It does **not** push anything.

### What gets published

The published package contains only the paths listed in `package.json`'s `files` field:

```json
"files": [
  "bin/",
  "dist/",
  "mdsite-nuxt/",
  "README.md"
]
```

`scripts/verify-package-artifacts.ts` enforces this — release will fail if `bin/`, `dist/`, or `mdsite-nuxt/` are missing or misconfigured.

### The `prepublishOnly` safety net

`package.json` defines:

```json
"prepublishOnly": "npm test && npm run typecheck && npm run build && npm run verify:package"
```

Even if you bypass the release script, `npm publish` locally would still run the full verification pipeline first. In CI, the publish workflow runs `npm ci` and `npm publish --provenance --access public` directly — `prepublishOnly` is what enforces quality at publish time.

## 3. Review the local commit and tag

Before pushing, inspect what the script created:

```bash
git log -1 --stat                    # the chore: release v<version> commit
git show v<version>                  # the annotated tag
git tag --list 'v*' | tail           # recent tags
```

If anything looks wrong, reset and re-run:

```bash
git tag -d v<version>
git reset --hard HEAD~1
# fix the issue, then re-run npm run release:version -- <bump>
```

## 4. Push and let CI publish

When the local commit and tag look correct:

```bash
git push origin main
git push origin v<version>
```

> [!WARNING]
> Pushing the `v<version>` tag triggers the GitHub Actions `npm publish` workflow. The workflow checks out the tag (with submodules), runs `npm ci`, and publishes to the npm registry with `--provenance --access public`. It also creates a GitHub Release using `softprops/action-gh-release@v3` with auto-generated notes.

Watch the workflow run:

```
https://github.com/life-and-dev/mdsite/actions/workflows/npm-publish.yml
```

A successful run publishes `<version>` to [npmjs.com/package/@life-and-dev/mdsite](https://www.npmjs.com/package/@life-and-dev/mdsite) within a minute or two.

## 5. One-time setup: npm Trusted Publisher

The publish workflow uses [npm provenance](https://docs.npmjs.com/generating-provenance-statements) and Trusted Publisher instead of a long-lived `NPM_TOKEN`. To (re)configure it:

1. Sign in to [npmjs.com](https://www.npmjs.com/) as an owner of `@life-and-dev`.
2. Open the package settings for `@life-and-dev/mdsite`.
3. Add a Trusted Publisher linking to `life-and-dev/mdsite` and the workflow file `.github/workflows/npm-publish.yml`.
4. Confirm the workflow's `id-token: write` and `contents: write` permissions match what's in the repo.

Once configured, no secrets are needed — GitHub Actions obtains a short-lived OIDC token signed by GitHub, and npm verifies it against the Trusted Publisher config.

## 6. What if the publish workflow fails?

If CI fails after you pushed the tag:

1. **Do not re-tag the same version.** A failed publish does not consume the version on npm if the workflow errored before `npm publish`.
2. Read the failed step's logs. Common causes:
   - Trusted Publisher not configured → fix on npmjs.com and re-run the workflow from the Actions UI (`workflow_dispatch`).
   - `verify:package` failed → a required file is missing from the tag. Fix the issue, delete the tag locally and remotely, then cut a new release with a corrected version.
3. To re-run without cutting a new version, use the workflow's `workflow_dispatch` input and pass the existing tag name.

## 7. Release checklist

A quick summary you can paste into a PR description:

- [ ] All tests pass (`npm test`).
- [ ] `mdsite-nuxt` submodule is at the desired commit.
- [ ] `npm run release:version -- <bump>` succeeded locally.
- [ ] Local `chore: release v<version>` commit and `v<version>` tag look correct.
- [ ] `git push origin main` succeeded.
- [ ] `git push origin v<version>` succeeded.
- [ ] GitHub Actions `npm publish` workflow went green.
- [ ] New version is visible on [npmjs.com](https://www.npmjs.com/package/@life-and-dev/mdsite).

---

> [!TIP]
> Releases are immutable on npm. Once a version is published it cannot be overwritten — only deprecated or bumped. That is why the release script verifies everything locally before tagging, and why CI re-verifies before publishing.
