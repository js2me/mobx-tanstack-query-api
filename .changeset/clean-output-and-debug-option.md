---
"mobx-tanstack-query-api": patch
---

Fix cleanOutput wiping files when swagger fetch fails, add debug option

- `cleanOutput` now runs after swagger fetch succeeds, preventing data loss when input URL is unreachable
- Add `debug` option to show full error details (stack trace, cause chain) for troubleshooting
- Error messages are now user-friendly and compact by default (no stack trace in output)
