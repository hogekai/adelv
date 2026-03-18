Release new versions of adelv packages. Follow these steps exactly:

## 1. Check current state

Run `pnpm changeset status` to see pending changesets.

If no changesets exist, inform the user they need to run `pnpm changeset` first to create one, and stop.

## 2. Run checks

Run these commands sequentially and stop if any fail:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If lint fails, try `pnpm lint:fix` first, then re-run lint.
If any step fails after attempting fixes, report the error and stop.

## 3. Version packages

Run `pnpm changeset version`.

This will:
- Bump versions in package.json files based on changesets
- Update CHANGELOG.md in each affected package
- Remove consumed changeset files

Then run `pnpm lint:fix` to fix any formatting changes introduced by changeset.

Review the changes:
```bash
git diff --stat
git diff packages/*/package.json
git diff packages/*/CHANGELOG.md
```

Present the version bumps and changelog entries to the user. Wait for confirmation before proceeding.

## 4. Commit and push

```bash
git add .
git commit -m "release: version packages"
git push
```

This push to main will trigger the Release workflow, which will:
- Create a Release PR (if changesets remain) or publish to npm (if versions are bumped)

Report what was done.

## Notes

- To add a changeset before release: `pnpm changeset`
- Changesets follow semver: patch (fixes), minor (features), major (breaking)
- The GitHub Actions release workflow handles npm publish automatically
- NPM_TOKEN must be configured in repository secrets for publish to work
