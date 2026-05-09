---
phase: 01-skeleton-heuristic-spine-first-comment
plan: "01"
subsystem: toolchain
tags: [scaffold, tooling, vitest, biome, rollup, typescript]
dependency_graph:
  requires: []
  provides: [package.json, tsconfig.json, rollup.config.ts, vitest.config.ts, biome.json, tests/smoke.test.ts]
  affects: [all subsequent plans in Phase 1]
tech_stack:
  added:
    - "Node 24.14.0 runtime"
    - "TypeScript 5.9.0 (devDep)"
    - "Rollup 4.x with @rollup/plugin-typescript, @rollup/plugin-commonjs, @rollup/plugin-node-resolve"
    - "Vitest 4.1.5 + @vitest/coverage-v8 4.1.5"
    - "Biome 2.4.14 (lint + format)"
    - "@actions/core ^3.0.1"
    - "@actions/github ^9.1.1"
    - "unified ^11.0.5 + remark-parse ^11.0.0 + remark-gfm ^4.0.1"
    - "unist-util-visit ^5.1.0 + mdast-util-to-string ^4.0.0"
    - "zod ^4.4.3"
  patterns:
    - "type:module ESM project"
    - "NodeNext module resolution"
    - "Rollup ESM bundle (format: es) to dist/index.js"
    - "Biome with --no-errors-on-unmatched for empty src/ phase"
key_files:
  created:
    - package.json
    - package-lock.json
    - tsconfig.json
    - rollup.config.ts
    - vitest.config.ts
    - biome.json
    - .gitignore
    - .env.example
    - README.md
    - tests/smoke.test.ts
    - src/.gitkeep
  modified: []
decisions:
  - "D-01 honored: bootstrapped directly (not git clone) mirroring actions/typescript-action template structure"
  - "D-02 honored: Jest/ESLint/Prettier absent from package.json; Vitest 4.1.5 + Biome 2.4.14 installed"
  - "D-03 honored: NodeNext module resolution in tsconfig.json"
  - "D-04 honored: dist/ NOT in .gitignore"
  - "Biome schema version pinned to 2.4.14 (not 2.0.0 as plan specified — 2.0.0 schema rejected by 2.4.14 binary)"
  - "lint/format scripts use --no-errors-on-unmatched so they exit 0 when src/ has no .ts files yet"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-09"
  tasks_completed: 2
  files_created: 11
---

# Phase 1 Plan 01: Scaffold Summary

Bootstrap the Signal-OSS toolchain — Node 24 / TypeScript ESM action with Rollup bundler, Vitest 4.1.5 test runner, and Biome 2.4.14 linter/formatter replacing Jest/ESLint/Prettier.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Bootstrap toolchain | 897e7c2 | package.json, tsconfig.json, rollup.config.ts, .gitignore, package-lock.json |
| 2 | Configure Vitest, Biome, env.example, smoke test, readme | 62b4006 | vitest.config.ts, biome.json, .env.example, tests/smoke.test.ts, README.md |

## Verification Results

- `npm install` — 182 packages added, 0 vulnerabilities
- `npm run test` — 2/2 smoke tests passing (Vitest 4.1.5)
- `npm run lint` — exit 0 (Biome 2.4.14, 0 files checked, no src/ .ts files yet)
- `npm run package` — NOT run (expected to fail; src/action/main.ts created in Plan 02)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Biome 2.0.0 schema URL rejected by installed 2.4.14 binary**
- **Found during:** Task 2
- **Issue:** Plan specified `"$schema": "https://biomejs.dev/schemas/2.0.0/schema.json"` but the resolved package is `@biomejs/biome@2.4.14`. Biome rejected the mismatched schema and failed with a deserialization error. Additionally, `organizeImports` was renamed to `assist.actions.source.organizeImports` in 2.x, and `files.include` was renamed to `files.includes` in 2.4.x.
- **Fix:** Updated schema URL to `2.4.14`, replaced `organizeImports` with `assist` block, and renamed `include` to `includes` in `files`.
- **Files modified:** biome.json
- **Commit:** 62b4006

**2. [Rule 3 - Blocking] Biome exits non-zero when no .ts files exist in src/**
- **Found during:** Task 2 verification
- **Issue:** `biome check src` exits 1 with "No files were processed" when `src/` is empty or missing — blocking `npm run lint` from passing.
- **Fix:** Added `--no-errors-on-unmatched` flag to both `lint` and `format` scripts in package.json. Created `src/.gitkeep` so the `src/` directory exists. This is the correct Biome 2.x approach for projects where source is added incrementally.
- **Files modified:** package.json, src/.gitkeep (created)
- **Commit:** 62b4006

## Actual Version Pins (vs Plan)

| Package | Plan specified | Actually installed | Notes |
|---------|---------------|-------------------|-------|
| vitest | ^4.1.5 | 4.1.5 | Exact match |
| @vitest/coverage-v8 | ^4.1.5 | 4.1.5 | Exact match |
| @biomejs/biome | ^2.4.14 | 2.4.14 | Exact match |
| typescript | ^5.9.0 | 5.9.0 | Exact match |
| rollup | ^4.60.3 | 4.60.3 | Exact match |

## npm Install Notes

- 182 packages installed, 0 vulnerabilities, 86 packages seeking funding
- No deprecation warnings of note
- package-lock.json generated and committed for reproducibility

## Known Stubs

None — this is a toolchain-only plan. No source code was written; subsequent plans fill in `src/`.

## Self-Check: PASSED

- package.json: EXISTS
- tsconfig.json: EXISTS, contains "NodeNext"
- rollup.config.ts: EXISTS, contains "format: 'es'"
- vitest.config.ts: EXISTS, contains "environment: 'node'"
- biome.json: EXISTS, contains schema 2.4.14
- .gitignore: EXISTS, contains node_modules/, does NOT contain dist/
- .env.example: EXISTS, contains GITHUB_TOKEN=, GITHUB_EVENT_PATH=
- tests/smoke.test.ts: EXISTS, 2/2 tests pass
- README.md: EXISTS, contains Signal-OSS
- Commits 897e7c2 and 62b4006: VERIFIED in git log
