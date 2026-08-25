# Troubleshooting

## The cleaner will not detect my handle

Open exactly `https://x.com/your_handle` or `https://x.com/your_handle/with_replies`, or set `HANDLE` without `@`. It intentionally stops on ambiguous URLs.

## It skips posts or says the Like count is unknown

Keep the first run dry. X may have changed its DOM or may not have rendered enough post metadata. Capture the browser version, X UI language, script version, and console error for a bug report. Never include cookies, tokens, or credentials.

## No more posts are found

X only exposes content it loads into the timeline. The script stops after `MAX_EMPTY_SCROLLS` empty cycles; increase it cautiously if X is still loading historical content.

## I need to stop it

Run `stopXCleaner()` in the console. Escape also requests a stop when no dialog is open. Reloading or closing the tab interrupts the snippet.
