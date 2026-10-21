# Releasing `@hackmd/markdown-it`

Releases are published to npm by GitHub Actions using
[npm trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC).
No npm token is involved, and every version is published with
[provenance](https://docs.npmjs.com/generating-provenance-statements).
Don't run `npm publish` locally.

Two workflows are involved:

- [`bump-version.yml`](.github/workflows/bump-version.yml) bumps the version,
  rebuilds `dist/`, commits and tags on `master`, creates the GitHub Release
  and starts the publish.
- [`publish.yml`](.github/workflows/publish.yml) tests, builds and publishes
  to npm. It's the workflow registered as the trusted publisher.

## Steps

1. Make sure `master` is green and `CHANGELOG.md` has a section for the new
   version, e.g. `## [14.2.0] - Unreleased`.
2. In the Actions tab, run **Bump version and release** on `master`:
   - **release-type**: `patch`, `minor`, `major` or `prerelease`
     (`prerelease` uses **preid**, default `beta`: `14.1.2` → `14.1.3-beta.0`).
   - **version**: optional explicit version (`14.2.0`, `14.2.0-rc.0`), which
     overrides **release-type**.
   - **dry-run**: tick to stop before pushing anything.
3. The run:
   1. bumps `package.json` and `package-lock.json`, and replaces
      "Unreleased" with today's date in the version's `CHANGELOG.md`
      heading;
   2. refuses if tag `v<version>` exists or the version is already on npm;
   3. runs `npm test` and `npm run build`;
   4. commits `chore: release <version> [skip ci]` with the rebuilt `dist/`,
      and tags it `v<version>`;
   5. pushes the commit and tag to `master` in one atomic push;
   6. creates the GitHub Release `v<version>` with that version's changelog
      section as notes (marked pre-release for `-beta.0` etc.);
   7. dispatches `publish.yml` on the tag.
4. Approve the `publish.yml` run's deployment to the `npm` environment.
5. Check that the new version on npmjs.com shows a provenance badge.

This commit replaces the manual "chore: build" commit: `dist/` is still kept
out of pull requests, and the release commit is where it gets refreshed.

## Why it's wired this way

- **Release events from the bot don't fire.** Pushes, tags and releases
  created with `GITHUB_TOKEN` start no workflows. `workflow_dispatch` is the
  exception, so `bump-version.yml` dispatches `publish.yml` explicitly with
  `gh workflow run publish.yml --ref v<version>` (it has `actions: write` for
  that).
- **`[skip ci]` only affects CI.** Skip instructions apply only to `push` and
  `pull_request` events. `publish.yml` runs on `release` and
  `workflow_dispatch`, never on a push, so the skip can't reach it. A bot push
  wouldn't start CI anyway; the marker matters if the bump commit is ever
  pushed with another token. Since CI doesn't test the release commit,
  `bump-version.yml` runs `npm test` itself, and `publish.yml` runs it again.
- **No `workflow_call`.** npm's trusted publisher check uses the top-level
  workflow's filename. If `bump-version.yml` called `publish.yml` as a
  reusable workflow, npm would see `bump-version.yml`. A dispatched run of
  `publish.yml` is its own top-level run, so the registered filename stays
  `publish.yml`.

## What `publish.yml` checks

- The tag, with or without a leading `v`, must equal `package.json`'s
  `version`. A manual run must come from a tag or `master`.
- That version must not already be on npm.
- `npm ci` and `npm test` must pass.
- `dist/` is rebuilt before publishing, so the tarball never ships a stale
  build. It logs a warning if the committed `dist/` was out of date.
- Versions with a pre-release suffix are published under the `next`
  dist-tag; all others go to `latest`.

## Other ways to publish

- **Releasing by hand:** bump, rebuild `dist/` and commit as the workflow
  does, then create and publish a GitHub Release with tag `v<version>` in the
  UI. A release published by a person fires `publish.yml` directly. Releases
  created by `bump-version.yml` don't, which is why it dispatches instead.
- **Re-running a publish:** if a dispatched publish failed (for example the
  approval was rejected), run **Publish to npm** from the Actions tab and
  pick the tag `v<version>` as the ref. Tick **dry-run** to run every step
  with `npm publish --dry-run`. A dry run also fails while `package.json`
  holds a version that's already on npm.

## Repository settings

- **Environment:** create `npm` under **Settings > Environments**, ideally
  with required reviewers.
- **Pushes to `master`:** `bump-version.yml` pushes to `master` as
  `github-actions[bot]`. Right now `master` has no classic branch protection
  and only an organization ruleset for Copilot code review, which doesn't
  block pushes. If `master` later requires pull requests or status checks,
  the bot push will be rejected. Classic branch protection has no way to let
  `GITHUB_TOKEN` bypass those rules. Instead, create a GitHub App, add it to
  the ruleset's bypass list, and use its token
  ([`actions/create-github-app-token`](https://github.com/actions/create-github-app-token))
  for the checkout and push. Note that pushes made with an App token do
  start workflows, so `[skip ci]` then keeps CI off the bump commit. The same
  applies to tag rulesets matching `v*`.
- **Actions permissions:** the workflows request their own `permissions`.
  If the organization restricts which actions may run, `actions/checkout` and
  `actions/setup-node` must be allowed.

## Trusted publisher settings on npmjs.com

Under the package's **Settings > Trusted Publisher**, select GitHub Actions
and enter:

| Field                    | Value                         |
| ------------------------ | ----------------------------- |
| Organization or user     | `hackmdio`                    |
| Repository               | `markdown-it`                 |
| Workflow filename        | `publish.yml`                 |
| Environment name         | `npm`                         |
| Allowed actions          | tick **npm publish**          |

New configurations only allow `npm stage publish` unless **npm publish** is
ticked, and `publish.yml` uses `npm publish`. A new configuration expires if
it doesn't complete a publish within 2 days, so set it up shortly before the
first release.

After the first successful publish, set **Settings > Publishing access** to
"Require two-factor authentication and disallow tokens", and revoke any
automation tokens that are no longer needed.
