# pi-chatgpt-limit

A [pi](https://github.com/badlogic/pi-mono) extension that shows your ChatGPT Codex subscription usage inline in the footer.

It displays configurable ChatGPT Pro/Codex usage next to the active Codex model, and provides a command for detailed 5-hour and weekly usage windows.

## Preview

![Footer preview](https://github.com/patlux/pi-chatgpt-limit/releases/download/preview-assets/footer-preview.png)

Footer display variants and color thresholds:

![Footer display variants and color thresholds](https://github.com/patlux/pi-chatgpt-limit/releases/download/preview-assets/footer-variants-readable.png)

## Install

```sh
pi install npm:pi-chatgpt-limit
```

Or shorthand:

```sh
pi install pi-chatgpt-limit
```

Then reload pi:

```txt
/reload
```

## Usage

The footer percentage appears only while using an `openai-codex` model authenticated via pi's `/login` flow.

For details, run:

```txt
/chatgpt-limit
```

This shows:

- plan
- account email when available
- 5-hour usage window
- weekly usage window
- reset times

### Footer configuration

The `/chatgpt-limit` menu also configures the footer display:

- show weekly usage (default), 5-hour usage, both, or hide usage
- show used percent, used percent with reset, remaining percent, or remaining percent with reset
- reset footer settings to defaults

Examples:

- `W 42%`
- `W 42% · ~2d`
- `W 58% left`
- `W 58% left · ~2d`
- `5h 25% / W 42%`

Settings persist globally in `~/.pi/agent/chatgpt-limit.json`, so the same footer preference applies across pi sessions.

## Notes

This extension calls ChatGPT's usage endpoint:

```txt
GET https://chatgpt.com/backend-api/wham/usage
```

It uses the OAuth token already stored by pi for the active `openai-codex` provider.

Extensions run with local user permissions and can access pi auth storage. Review extensions before installing them.

## Contributing

See [CONTRIBUTING.md](https://github.com/patlux/pi-chatgpt-limit/blob/main/CONTRIBUTING.md) for development setup, PR expectations, and commit message guidance.

## Release

See [RELEASE.md](https://github.com/patlux/pi-chatgpt-limit/blob/main/RELEASE.md) for the release checklist, GitHub release publishing, npm verification, and announcement steps.

## License

MIT
