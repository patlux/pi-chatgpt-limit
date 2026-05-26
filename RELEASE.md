# Release Process

This project publishes `pi-chatgpt-limit` to npm from GitHub Releases.

The current workflow publishes every published GitHub release with:

```sh
npm publish --access public --provenance
```

Do not create a GitHub prerelease with the current workflow unless you also change the workflow to publish prereleases with a non-`latest` dist-tag.

## Release checklist

### 1. Prepare the version

Choose the intended semver version, then update `package.json` and `package-lock.json` without creating a git tag:

```sh
npm version X.Y.Z --no-git-tag-version
```

Update `README.md` for user-facing changes. If preview images change, upload them as GitHub release assets and point README image links at the hosted assets.

### 2. Run checks

```sh
npm run format:check
npm run typecheck
npm test
npm pack --dry-run
git diff --check
```

Aside from npm's required package metadata, the package should include only:

- `index.js`
- `README.md`
- `LICENSE`

### 3. Commit and tag

Only do this after explicit maintainer approval.

```sh
git add package.json package-lock.json README.md index.js test types .github CONTRIBUTING.md RELEASE.md AGENTS.md
git commit -m "Release vX.Y.Z"
git tag -a vX.Y.Z -m "Release vX.Y.Z"
```

Push after the release commit and tag are ready:

```sh
git push origin main
git push origin vX.Y.Z
```

### 4. Publish the GitHub Release

Create the release at:

```txt
https://github.com/patlux/pi-chatgpt-limit/releases
```

Include:

- concise release notes
- install/update command
- links to preview assets, if any

Install/update command:

```sh
pi install pi-chatgpt-limit
```

Publishing the GitHub Release triggers `.github/workflows/publish.yml`.

### 5. Verify publish

Verify GitHub Actions first:

```sh
gh run list --workflow publish.yml --limit 1
gh run watch <run-id>
```

Then verify npm:

```sh
npm view pi-chatgpt-limit version --json
npm view pi-chatgpt-limit@X.Y.Z version --json
```

Expected:

- GitHub Actions publish workflow succeeded.
- `npm view pi-chatgpt-limit version` returns `X.Y.Z`.
- The specific version exists on npm.

## Announcement checklist

Announce notable releases in these places.

### GitHub Releases

Use the release notes from the published GitHub Release:

```txt
https://github.com/patlux/pi-chatgpt-limit/releases/tag/vX.Y.Z
```

### Reddit launch/update thread

Use the existing r/PiCodingAgent post:

```txt
https://www.reddit.com/r/PiCodingAgent/comments/1t17kz8/i_made_a_pi_extension_that_shows_chatgpt_codex/
```

Post a new update comment for each notable release. If attaching screenshots, use Chrome MCP for Reddit actions. If Reddit cannot attach an image to an existing comment, reply to the update comment with the image.

Keep the announcement short: version, key changes, release notes link, and install/update command.

Suggested Reddit update format:

````md
Update: vX.Y.Z is out 🎉

New in this release:

- <change 1>
- <change 2>
- <change 3>

Release notes: https://github.com/patlux/pi-chatgpt-limit/releases/tag/vX.Y.Z

Install/update:

```sh
pi install pi-chatgpt-limit
```
````

## After release

Optional final checks:

```sh
npm view pi-chatgpt-limit version dist-tags --json
```

If release assets were updated, confirm README images render on GitHub and npm.
