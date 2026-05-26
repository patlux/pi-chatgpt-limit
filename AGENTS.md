# pi-chatgpt-limit Agent Notes

## Project

`pi-chatgpt-limit` is a pi extension package. It shows ChatGPT Codex usage limits in pi's footer and exposes the `/chatgpt-limit` command.

## Project docs

- Follow [CONTRIBUTING.md](CONTRIBUTING.md) before changing code, tests, docs, or commit messages.
- Use [RELEASE.md](RELEASE.md) for versioning, npm package, GitHub release, and announcement work.
- Keep changes focused and reviewable; avoid unrelated refactors.
- Run the relevant checks before reporting work as done.
- Do not commit, tag, push, or publish unless explicitly asked in the current conversation.

## Commands

- Test: `npm test`
- Type check: `npm run typecheck`
- Format: `npm run format`
- Format check: `npm run format:check`

## Package/release basics

- Package entry is declared in `package.json` under `pi.extensions`.
- Published npm package should include only `index.js`, `src`, `README.md`, and `LICENSE` via `package.json#files`.
- CI runs on pushes to `main` and pull requests via `.github/workflows/ci.yml`.
- CI verifies formatting, JS type checking, e2e tests, and `npm pack --dry-run`.
- GitHub release publishing triggers `.github/workflows/publish.yml`, which runs `npm publish --access public --provenance`.
- After creating a release, verify:
  1. GitHub Actions publish workflow succeeded.
  2. `npm view pi-chatgpt-limit version` shows the released version.

## Screenshot/asset policy

- Do not commit screenshots or generated image artifacts to the repository.
- Use GitHub release assets for README and announcement images.
- README image links should point at hosted release assets, for example `https://github.com/patlux/pi-chatgpt-limit/releases/download/<asset-tag>/<file>.png`.

## Announcing a new release

Announce releases in these places:

1. **GitHub Releases**
   - Publish the release at `https://github.com/patlux/pi-chatgpt-limit/releases`.
   - Include concise release notes, install/update command, and any preview asset links.

2. **Reddit launch/update thread**
   - Use the existing r/PiCodingAgent post:
     `https://www.reddit.com/r/PiCodingAgent/comments/1t17kz8/i_made_a_pi_extension_that_shows_chatgpt_codex/`
   - Post a new update comment for each notable release.
   - If attaching screenshots, use Chrome MCP for Reddit actions. If Reddit cannot attach an image to an existing comment, reply to the update comment with the image.
   - Keep the announcement short: version, key changes, release notes link, and install/update command.

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

## Current v0.2.0 announcement references

- Release: `https://github.com/patlux/pi-chatgpt-limit/releases/tag/v0.2.0`
- Reddit update comment: `https://www.reddit.com/r/PiCodingAgent/comments/1t17kz8/comment/oksq06u/`
- Reddit screenshot reply: `https://www.reddit.com/r/PiCodingAgent/comments/1t17kz8/comment/oksqdwa/`
