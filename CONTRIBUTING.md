# Contributing

Thanks for your interest in improving X Mass Unfollower.

## Reporting bugs

Open an issue with:

- your browser and version,
- what you did and what you expected,
- the relevant lines from the panel's **Activity log** (remove your handle if you prefer).

Never paste cookies, `ct0` / `auth_token` values, request headers or HAR files from your account in an issue.

## Making changes

- **Extension** (`extension/`): plain JavaScript, no build step. Edit, then press reload on the extension card in `chrome://extensions` and refresh x.com.
- **Website** (`site/`): `bun install`, then `bun run dev`. Run `bun run build` before opening a pull request.

Keep changes small and focused, match the existing style (see `.editorconfig`), and describe how you tested them. Pull requests that make the extension faster at the expense of account safety (shorter default delays, disabling verification) won't be merged.
