## Summary

Describe the focused change and any X DOM assumption.

## Safety checklist

- [ ] `DRY_RUN: true` remains the default.
- [ ] Ownership, canonical URL, quoted-post, and unknown-like fail-closed behavior remain intact.
- [ ] No telemetry, analytics, external requests, credentials, or dependencies were added.
- [ ] `node tests/run-tests.js` passes.
- [ ] I performed relevant manual validation with `DRY_RUN=true`.
- [ ] Documentation and translations are updated where necessary.
