# X Post Cleaner

A free, local, dependency-free JavaScript DevTools Snippet for reviewing and deleting your own X posts and replies according to configurable Like thresholds.

> Deletion is irreversible. The default is `DRY_RUN: true`: run a dry run first, inspect the console, and only then consider live deletion.

[Español](README.es.md) · [Troubleshooting](docs/TROUBLESHOOTING.md) · [Architecture](docs/ARCHITECTURE.md)

## What it does

On your X **Posts** or **Replies** timeline, the snippet examines posts authored by the selected account. With its default threshold of 20, it preserves posts with **20 or more** Likes and marks posts with **0–19** Likes as deletion candidates. In dry-run mode it only logs those decisions. In live mode, it deletes candidates one at a time through the X UI.

It never deletes or undoes reposts of another account, skips unknown Like counts, and rejects ambiguous status URLs and nested quoted-post controls.

## Privacy and design

- No X API, API key, OAuth app, password, cookie copying, access token, extension, backend, or external service.
- No telemetry, analytics, update checks, or third-party network calls.
- All processing occurs in the open `x.com` page using your existing browser session; the script neither requests nor stores credentials.
- Every action requires an owned canonical `/{handle}/status/{id}` URL. Destructive work remains sequential and is verified through the DOM.

## Install and run in Chrome / Chromium

1. Open `https://x.com/your_handle` for Posts, or `https://x.com/your_handle/with_replies` for Replies.
2. Open DevTools (`F12`), select **Sources**, then **Snippets**.
3. Create a new snippet.
4. Copy the complete contents of [`dist/x-post-cleaner.js`](dist/x-post-cleaner.js) into it.
5. Review the `CONFIG` block near the top. Keep `DRY_RUN: true` on the first run.
6. Run the snippet (right-click **Run**, or `Ctrl`/`Cmd` + `Enter`). Read its console output.

DevTools must remain open. Reloading or closing the tab stops the script.

## Configuration

```js
const CONFIG = {
  HANDLE: '',
  MIN_LIKES_TO_KEEP: 20,
  DRY_RUN: true,
  SPEED_MODE: 'fast',
  MAX_EMPTY_SCROLLS: 20,
  PERSIST_PROGRESS: false,
  LOG_LEVEL: 'normal',
};
```

`HANDLE` is optional and has no `@`. When empty, detection only succeeds on an unambiguous profile URL such as `/your_handle` or `/your_handle/with_replies`; otherwise the script stops rather than guessing. `MIN_LIKES_TO_KEEP: 20` means 0–19 are candidates and 20+ are kept. It must be a non-negative integer.

`DRY_RUN` prevents all deletion UI clicks. Set it to `false` only after a reviewed dry run; the browser will present a final irreversible-action confirmation. `SPEED_MODE` is `safe`, `fast` (default), or `turbo`. All modes keep the same safety checks; they only tune DOM wait and scroll fallback timing. `MAX_EMPTY_SCROLLS` limits consecutive scans without newly found owned posts. `PERSIST_PROGRESS` stores only processed post IDs in this browser's local storage. `LOG_LEVEL` is `minimal`, `normal`, or `verbose`.

## Dry run, then real deletion

First execute with `DRY_RUN: true`. Typical output is:

```text
[KEEP] ❤️ 42 | https://x.com/user/status/…
[DRY RUN] DELETE ❤️ 7 | https://x.com/user/status/…
[SKIPPED] Unable to determine Like count | https://x.com/user/status/…
```

Confirm the account and candidate URLs. To make real deletions, change only `DRY_RUN` to `false`, rerun the snippet, and accept the browser confirmation. The cleaner uses X's overflow menu, selects Delete/Borrar/Eliminar, waits for the confirmation sheet, confirms, and verifies removal before continuing. A failure is logged and never blindly retried.

## Stop

Run `stopXCleaner()` in the console. Escape requests a stop where no dialog is open. The current safe UI step may finish before the loop ends. `window.__xPostCleanerState` provides read-only-style debug visibility of run state and counters.

## Limitations and troubleshooting

X dynamically controls what historical content it renders, so this tool can only process posts it makes available while scrolling. X may change data-test IDs, menus, dialogs, localized text, or timeline behavior; selector updates may then be needed. The script cannot guarantee discovery of content X does not load. See [Troubleshooting](docs/TROUBLESHOOTING.md) for profile detection, unknown counts, and stop guidance.

Before a live run, test Posts and Replies with known 19/20-Like boundaries, quoted posts, reposts of others, and `stopXCleaner()`. Test actual deletion first on a disposable, low-value post.

## Development

There is no build step or runtime dependency; `src/` and `dist/` are deliberately identical. Run the dependency-free checks with:

```sh
node tests/run-tests.js
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for selector, language, and test expectations. Security or privacy issues should be reported privately as described in [SECURITY.md](SECURITY.md).

## License

Distributed under the [MIT License](LICENSE).
