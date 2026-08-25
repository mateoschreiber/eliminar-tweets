# Architecture and safety model

The single deployable snippet runs only in the current `x.com` tab. It uses no API, external JavaScript, network request, backend, analytics, or telemetry.

For each rendered timeline article it finds the article's timestamp-bearing canonical status URL and requires `/resolved-handle/status/numeric-id`. It rejects ambiguity. It then obtains only the direct Like control owned by that outer article; nested tweet articles are excluded. Unknown counts are skipped, not considered zero.

The loop is sequential. A live deletion opens one menu, identifies a localized Delete item, waits for the X confirmation control, confirms, and waits for DOM removal. Any ambiguous or unverifiable stage becomes an error and is never retried destructively. Mutation observation drives waits; speed profiles only tune timeouts and scrolling fallback.

Processed IDs are held in memory and may optionally be stored in local browser storage. No post text, credentials, cookies, or information leaves the page.
