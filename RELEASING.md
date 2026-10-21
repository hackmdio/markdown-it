# Releasing `@hackmd/markdown-it`

Releases are published from GitHub Actions with npm trusted publishing
(OIDC), so no npm token is needed. Don't run `npm publish` locally.

## Run the bump

In the Actions tab, run **Bump version and release** on `master`. Choose a
**release-type** (`patch`, `minor`, `major` or `prerelease` with **preid**),
or give an explicit **version**. Tick **dry-run** to stop before pushing.

The run tests, rebuilds `dist/`, commits `chore: release <version> [skip ci]`,
pushes the commit and tag `v<version>` to `master`, creates the GitHub Release
with auto-generated notes, and dispatches **Publish to npm** (`publish.yml`)
on the tag. Approve its deployment to the `npm` environment to publish.

## npm Trusted Publisher

On npmjs.com, under the package's **Settings > Trusted Publisher**, select
GitHub Actions and enter:

| Field                | Value                |
| -------------------- | -------------------- |
| Organization or user | `hackmdio`           |
| Repository           | `markdown-it`        |
| Workflow filename    | `publish.yml`        |
| Environment name     | `npm`                |
| Allowed actions      | tick **npm publish** |

## `npm` environment

Create an environment named `npm` under the repository's
**Settings > Environments**, ideally with required reviewers. The publish job
runs in it, and its name must match the one entered on npm.
