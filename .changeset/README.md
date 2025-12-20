# Changesets

This folder is used by [Changesets](https://github.com/changesets/changesets) to manage versioning and changelogs.

## Adding a Changeset

When making changes that should be included in a release, run:

```bash
pnpm changeset
```

This will prompt you to:
1. Select the type of change (major, minor, patch)
2. Write a summary of the change

The changeset file will be created in this folder and should be committed with your changes.

## Version Types

- **major**: Breaking changes (1.0.0 → 2.0.0)
- **minor**: New features, backwards compatible (1.0.0 → 1.1.0)
- **patch**: Bug fixes, backwards compatible (1.0.0 → 1.0.1)

## Release Process

When PRs with changesets are merged to `master`, the GitHub Action will:
1. Collect all changesets
2. Calculate the new version
3. Update CHANGELOG.md
4. Create a GitHub Release with a zip of the codebase

