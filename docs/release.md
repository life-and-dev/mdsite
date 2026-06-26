# Release Guide

This guide explains how to bump the `@life-and-dev/mdsite` package version and trigger the tag-based npm publish workflow.

## 1. Choose the version bump

From the repository root, run one of these commands:

```bash
npm run release:version -- patch
npm run release:version -- minor
npm run release:version -- major
npm run release:version -- x.y.z
```

Use `patch`, `minor`, or `major` for standard semantic version bumps, or replace `x.y.z` with an exact version.

## 2. Review what the script does

The release version script:

1. Updates `package.json` and `package-lock.json` using `npm version`.
2. Runs typecheck, build, and package verification.
3. Commits the version change as `chore: release v<version>`.
4. Creates a local annotated tag named `v<version>`.

The script does not push changes or publish to npm.

## 3. Push the release commit and tag

After reviewing the local commit and tag, push them manually:

```bash
git push origin main
git push origin v<version>
```

> [!WARNING]
> Pushing the `v<version>` tag triggers the GitHub Actions npm publish workflow with provenance.

## 4. Confirm npm publishing setup

The `npm-publish.yml` workflow requires npm Trusted Publisher configuration for `@life-and-dev/mdsite`. Confirm that Trusted Publisher is configured before pushing a release tag.
