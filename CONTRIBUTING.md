# Contributing

Thanks for helping improve `pi-chatgpt-limit`.

This is an unofficial pi extension that shows ChatGPT Codex usage limits in pi's footer. Keep changes small, tested, and easy to review.

## Development setup

```sh
npm install
npm test
```

Useful commands:

```sh
npm run format:check
npm run typecheck
npm test
npm run format
npm pack --dry-run
```

Before opening a PR, run:

```sh
npm run format:check
npm run typecheck
npm test
npm pack --dry-run
git diff --check
```

For release steps, npm verification, and announcement checklists, see [RELEASE.md](RELEASE.md).

## Pull request guidelines

- Keep PRs focused on one problem or feature.
- Add or update e2e coverage for behavior changes, especially footer formatting, usage parsing, config persistence, and `/chatgpt-limit` menu behavior.
- Update `README.md` when user-facing behavior, install steps, screenshots, or package metadata change.
- Update `RELEASE.md` when release, packaging, or announcement steps change.
- Avoid broad refactors unless the PR is specifically about refactoring.
- Do not include API keys, OAuth tokens, real auth files, `.env` files, generated screenshots, recordings, or other secrets/artifacts.
- Keep generated screenshots and preview images as GitHub release assets, not committed files.
- Make sure npm package contents still match the package policy when `package.json#files` changes.

## Testing pi integration changes

CI runs the real pi TUI against a local mock ChatGPT usage endpoint. For extension, footer, command, or config changes, prefer tests in `test/e2e/chatgpt-weekly-limit.test.js`.

Manual local smoke test:

```sh
pi --no-extensions \
  --no-skills \
  --no-prompt-templates \
  --no-themes \
  --no-context-files \
  --extension ./index.js \
  --provider openai-codex \
  --model gpt-5.5
```

Use isolated `PI_CODING_AGENT_DIR` and `PI_CODING_AGENT_SESSION_DIR` values when testing config persistence or auth side effects. Do not print or commit real auth files.

## Package contents

Aside from npm's required package metadata, the published package should include only:

- `index.js`
- `README.md`
- `LICENSE`

Verify before releases or packaging changes:

```sh
npm pack --dry-run
```

## Commit message rules

Prefer Angular-style Conventional Commits for feature and fix work.

Format:

```txt
<type>(<scope>): <subject>
```

Examples:

```txt
feat(footer): add pace display mode
fix(config): persist selected display mode
test(e2e): cover hidden footer setting
docs(release): document announcement steps
```

Use one of these types when practical:

- `feat`: a new user-facing feature
- `fix`: a bug fix
- `docs`: documentation-only changes
- `style`: formatting-only changes, no behavior change
- `refactor`: code restructuring without behavior change
- `perf`: performance improvement
- `test`: adding or changing tests
- `build`: package, dependency, or build-system changes
- `ci`: CI workflow changes
- `chore`: maintenance that does not fit another type
- `revert`: revert a previous commit

Subject line guidelines:

- Use imperative mood: `fix(config): save footer setting`, not `fixed` or `fixes`.
- Keep it concise.
- Start lowercase after the colon.
- Do not end with a period.

Release commits may use the existing project style:

```txt
Release vX.Y.Z
```
