# agy-paperclip-adapter

External `agy_local` adapter plugin for [Paperclip](https://github.com/paperclipai/paperclip) integrating the Google Antigravity CLI (`agy`).

## Features

- Implements Paperclip's external adapter plugin contract (`registerAdapterPlugin`) so `paperclip` core stays unmodified.
- Provides a standalone CommonJS UI stdout parser (`./ui-parser` -> `ui-parser.cjs`) matching Paperclip's `adapterUiParser` `1.0.0` contract, including `DONE` / `ERROR` step updates and final response rendering.
- Provides agent configuration schema metadata via `getAgyConfigSchema()`.
- Hardened `agy` headless CLI invocation:
  - Preserves multi-line Markdown comments/summaries without `firstLine()` truncation or raw NDJSON fallback dumps.
  - Emits `resultJson.finalResponse` cleanly and isolates recovered mid-run `TOOL_ERROR` events so successful runs are not falsely marked failed.
  - Defaults `sandbox` to `false` (configurable per agent), resolves realpath targets of agent skill symlinks and instruction directories into `--add-dir`, and passes valid `--settings` overrides (`enableTerminalSandbox`, `allowNonWorkspaceAccess`, `toolPermission`).
  - Uses `--print-timeout` (default `24h`, or aligned to `timeoutSec`) and `--disable-slash-commands` (default `true`) for reliable headless execution.

## Credits & License

Licensed under the [MIT License](LICENSE).

Core `agy_local` adapter execution, stream parsing, model discovery, and UI helpers were originally adapted from `paperclipai/paperclip` PR `#12503` (authored by Joshua Edward McLaughlin Cox), extracted into a standalone external plugin package with UI parser support, schema helpers, and runtime hardening.

## Installation & Usage in Paperclip

Build the package (requires `@paperclipai/adapter-utils` available from your Paperclip host or `node_modules`):

```bash
npm run build
npm test
```

Install/register the adapter package directory in Paperclip via the adapters API (`POST /api/adapters`), or reload after updating:

```bash
POST /api/adapters/agy_local/reload
```
