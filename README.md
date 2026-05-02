# pi-chatgpt-limit

A [pi](https://github.com/badlogic/pi-mono) extension that shows your ChatGPT Codex subscription usage inline in the footer.

It displays the weekly ChatGPT Pro/Codex usage percentage next to the active Codex model, and provides a command for detailed 5-hour and weekly usage windows.

## Preview

Footer:

![Footer preview](https://github.com/patlux/pi-chatgpt-limit/releases/download/preview-assets/footer-preview.png)

Detailed usage command:

![Command preview](https://github.com/patlux/pi-chatgpt-limit/releases/download/preview-assets/command-preview.png)

The screenshots are also referenced from [issue #1](https://github.com/patlux/pi-chatgpt-limit/issues/1) and are kept out of git history so they are not downloaded when installing this pi package.

## Install

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

## Notes

This extension calls ChatGPT's usage endpoint:

```txt
GET https://chatgpt.com/backend-api/wham/usage
```

It uses the OAuth token already stored by pi for the active `openai-codex` provider.

Extensions run with local user permissions and can access pi auth storage. Review extensions before installing them.

## Publish

```sh
npm login
npm publish --access public
```

## License

MIT
