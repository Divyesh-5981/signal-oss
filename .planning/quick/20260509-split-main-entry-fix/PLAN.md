---
slug: split-main-entry-fix
date: 2026-05-09
status: completed
---

# Fix: double-invocation from combined entry + logic in main.ts

## Problem

`src/action/main.ts` both exported `run()` AND self-invoked it at module level.
`@github/local-action` imports the module (triggering the self-invocation) AND calls
the exported `run()` — causing two concurrent `createComment` calls that both raced
past an empty `listComments`, posting duplicate comments simultaneously.

## Tasks

1. ✅ Create `src/action/index.ts` — thin entry point, calls `run().catch(setFailed)`
2. ✅ Remove `run().catch(...)` self-invocation from `src/action/main.ts`
3. ✅ Update `rollup.config.ts` input → `src/action/index.ts` (real runner bundle)
4. ✅ ~~Update `local-action` script in `package.json` → `src/action/index.ts`~~ **CORRECTED:**
   Update `local-action` script in `package.json` → `src/action/main.ts`
   Reason: `index.ts` does not export `run()` — it only calls it. `@github/local-action`
   requires the entrypoint to export `run()`. Pointing at `index.ts` caused a second crash:
   "Entrypoint does not export a run() function". The correct entrypoint for `local-action`
   is `main.ts` (exports `run()`, no self-call). `index.ts` is only for the rollup bundle.
5. ✅ Rebuilt `dist/index.js` via `npm run package`
6. ⬜ Commit pending

## Final wiring

| Consumer               | File                                    | Why                             |
| ---------------------- | --------------------------------------- | ------------------------------- |
| GitHub Actions runner  | `dist/index.js` (built from `index.ts`) | Self-calls `run()` on startup   |
| `@github/local-action` | `src/action/main.ts`                    | Exports `run()`, no self-call   |
| Vitest tests           | `src/action/main.ts`                    | Same — imports `run()` directly |

## Acceptance

- ✅ `main.ts` exports `run()` with no self-invocation
- ✅ `index.ts` is the sole self-caller, used only by rollup → `dist/index.js`
- ✅ `local-action` script points to `main.ts` (not `index.ts`)
- ✅ `npm run local-action` runs without crash and posts exactly one comment
- ✅ Duplicate comment confirmed resolved — single comment on sandbox issue
- ⬜ `npm run bundle` final rebuild before commit
