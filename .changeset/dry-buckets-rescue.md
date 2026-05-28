---
"mobx-tanstack-query-api": patch
---

Fix data-contracts exclusion for externally-aliased types referenced from shared contracts

Types with external prefixes (e.g. `Openapi*DC`) that are referenced by other shared contracts were incorrectly excluded from `data-contracts.ts`, causing import errors. The exclusion logic now iteratively checks cross-references and keeps such types in data-contracts. The logic was also extracted into a dedicated `data-contract-exclusion` utility with support for both string and array content types.
