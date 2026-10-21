# Releasing `@hackmd/markdown-it`

Releases are published to npm by the
[`Publish to npm`](.github/workflows/publish.yml) workflow using
[npm trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC).
No npm token is involved, and every version is published with
[provenance](https://docs.npmjs.com/generating-provenance-statements).
Don't run `npm publish` locally.

## Steps

1. On `master`, update `CHANGELOG.md` (replace "Unreleased" with the date).
2. Bump the version without creating a tag:

   ```sh
   npm version <patch|minor|major> --no-git-tag-version
   ```

3. Rebuild `dist/` and commit it together with the version bump. `dist/` is
   kept out of pull requests but committed for each release:

   ```sh
   npm run build
   git add -f dist/ package.json package-lock.json CHANGELOG.md
   git commit -m "chore: build <version>"
   git push origin master
   ```

4. Wait for CI to pass on that commit.
5. Create a GitHub Release with a new tag `v<version>` (for example `v14.2.0`)
   targeting that commit, and publish it. Mark it as a pre-release for
   versions like `14.2.0-beta.0`.
6. Publishing the release starts the workflow. Approve the deployment to the
   `npm` environment when it asks for approval.
7. Check that the new version on npmjs.com shows a provenance badge.

## What the workflow checks

- The release tag, with or without a leading `v`, must equal the `version`
  in `package.json`.
- That version must not already be on npm.
- `npm ci` and `npm test` must pass.
- `dist/` is rebuilt before publishing, so the tarball never ships a stale
  build. The workflow logs a warning if the committed `dist/` was out of date.
- Versions with a pre-release suffix (`-beta.0` etc.) are published under the
  `next` dist-tag; all others go to `latest`.

## Manual runs

The workflow can also be started from the Actions tab (**Run workflow**),
from `master` or from a release tag. Tick **dry-run** to run every step
with `npm publish --dry-run`. Manual runs use the same checks and approval,
so a dry run also fails while `package.json` still holds a published version.

## Trusted publisher settings on npmjs.com

Under the package's **Settings > Trusted Publisher**, select GitHub Actions
and enter:

| Field                    | Value          |
| ------------------------ | -------------- |
| Organization or user     | `hackmdio`     |
| Repository               | `markdown-it`  |
| Workflow filename        | `publish.yml`  |
| Environment name         | `npm`          |

The `npm` environment must also exist in the GitHub repository settings
(**Settings > Environments**), ideally with required reviewers.
