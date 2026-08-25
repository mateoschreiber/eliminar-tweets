# Contributing

Thank you for improving X Post Cleaner. This repository intentionally has no runtime dependencies or build step.

1. Create a focused branch and keep changes small.
2. Preserve `DRY_RUN: true` as the source default and retain every fail-closed ownership and Like-count check.
3. Run `node tests/run-tests.js`, then manually run a dry run on an X profile when changing DOM behavior.
4. In your pull request, explain selector assumptions and update both READMEs when behavior changes.

## Selector updates

X can change its UI at any time. Prefer stable `data-testid` attributes, canonical timestamp links, and semantic roles. Never use generated CSS class names or coordinate clicks. A selector that cannot unambiguously identify the outer owned post must skip it, not delete it.

## Languages

Add delete-menu labels to `DELETE_LABELS` and document the language. Stable semantic selectors take priority over translated text.

## Testing expectations

Add a fixture for pure parsing/ownership logic when practical. For UI changes, test first with `DRY_RUN=true`, including a quoted post, another user's post, 19/20-like boundaries, replies, Escape, and a disposable post before testing live deletion.
