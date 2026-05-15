---
phase: 02-action-hardening-repo-awareness
plan: 03
type: execute
wave: 2
depends_on: ["02-01"]
files_modified:
  - src/adapters/github/labels.ts
  - tests/adapters/labels.test.ts
autonomous: true
requirements: [ACT-06]
tags: [adapter, octokit, labels, github-action]

must_haves:
  truths:
    - "`ensureLabel(octokit, owner, repo, name, color, description)` is idempotent: if the label exists, it succeeds without overwriting (D-13); if missing, it creates the label with the supplied color/description"
    - "`applyLabel(octokit, owner, repo, issueNumber, name)` returns `'applied'` on success and `'skipped'` on any Octokit error (does NOT throw)"
    - "`removeLabel(octokit, owner, repo, issueNumber, name)` returns `'removed'` on success and `'skipped'` on Octokit error; treats HTTP 404 as silent success (Pitfall 7) — calls `core.warning` only when status ≠ 404"
    - "The `LabelAction` type is exported as `'applied' | 'removed' | 'skipped' | 'disabled' | 'dry-run'`"
    - "All three functions strip a leading `#` from the color before calling `createLabel` (GitHub API expects hex without `#`)"
    - "None of the three functions throw — every Octokit error is caught and surfaced via `core.warning()`"
  artifacts:
    - path: "src/adapters/github/labels.ts"
      provides: "ensureLabel(), applyLabel(), removeLabel(), LabelAction type"
      exports: ["ensureLabel", "applyLabel", "removeLabel", "LabelAction"]
      min_lines: 60
    - path: "tests/adapters/labels.test.ts"
      provides: "Unit tests covering the 8 documented branches"
      min_lines: 100
  key_links:
    - from: "src/adapters/github/labels.ts"
      to: "octokit.rest.repos.getLabel / createLabel"
      via: "ensureLabel try-get-first → catch 404 → create"
      pattern: "octokit\\.rest\\.repos\\.(get|create)Label"
    - from: "src/adapters/github/labels.ts"
      to: "octokit.rest.issues.addLabels / removeLabel"
      via: "applyLabel / removeLabel"
      pattern: "octokit\\.rest\\.issues\\.(add|remove)Label"
---

<objective>
Build the label adapter — three small idempotent functions that wrap the four Octokit label endpoints needed for ACT-06. Each function catches every Octokit error and converts it to a typed status (`'applied' | 'removed' | 'skipped'`) plus a `core.warning` log line, so label management can never block the hero comment.

Purpose: ACT-06 has three responsibilities (auto-create label if missing, apply when checklist has items, remove when checklist is empty). Each must respect existing maintainer customization (D-13 — never overwrite) and treat the "label already in desired state" case as success (Pitfall 7 — 404 on remove). Encapsulating those rules in this adapter means Plan 05's wiring becomes three readable function calls instead of three nested try/catch blocks.

Output: `src/adapters/github/labels.ts` (~60 lines) and `tests/adapters/labels.test.ts` (~120 lines covering 8 distinct mock scenarios).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-action-hardening-repo-awareness/02-CONTEXT.md
@.planning/phases/02-action-hardening-repo-awareness/02-RESEARCH.md
@.planning/phases/02-action-hardening-repo-awareness/02-PATTERNS.md
@.planning/phases/02-action-hardening-repo-awareness/02-01-foundations-SUMMARY.md
@src/adapters/github/io.ts
@tests/adapters/github.test.ts

<interfaces>
<!-- Contract this plan produces -->
```typescript
// src/adapters/github/labels.ts (new file)
export type LabelAction = 'applied' | 'removed' | 'skipped' | 'disabled' | 'dry-run'

export async function ensureLabel(
  octokit: OctokitInstance,
  owner: string,
  repo: string,
  name: string,
  color: string,        // e.g. '#e4e669' OR 'e4e669' — function strips leading '#'
  description: string,
): Promise<void>

export async function applyLabel(
  octokit: OctokitInstance,
  owner: string,
  repo: string,
  issueNumber: number,
  name: string,
): Promise<'applied' | 'skipped'>

export async function removeLabel(
  octokit: OctokitInstance,
  owner: string,
  repo: string,
  issueNumber: number,
  name: string,
): Promise<'removed' | 'skipped'>
```

<!-- Octokit endpoints used (all verified in node_modules per RESEARCH.md) -->
- `octokit.rest.repos.getLabel({ owner, repo, name })` — throws 404 when missing
- `octokit.rest.repos.createLabel({ owner, repo, name, color, description })` — color WITHOUT `#`
- `octokit.rest.issues.addLabels({ owner, repo, issue_number, labels: [name] })`
- `octokit.rest.issues.removeLabel({ owner, repo, issue_number, name })` — 404 when label not on issue
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Write failing test suite for label adapter (8 branches)</name>
  <read_first>
    - tests/adapters/github.test.ts (mock factory + describe/it style)
    - .planning/phases/02-action-hardening-repo-awareness/02-PATTERNS.md (labels.ts section — mock factory shape)
    - .planning/phases/02-action-hardening-repo-awareness/02-RESEARCH.md (Pattern 5: full label adapter code; Pitfall 7: 404-on-remove)
  </read_first>
  <behavior>
    RED phase. Tests fail because `src/adapters/github/labels.ts` does not exist. The 8 branches to cover:

    - Test 1 (`ensureLabel — label exists → no createLabel call, no warning`): mock `getLabel` resolves with `{ data: {} }`. After `ensureLabel(octokit, 'o', 'r', 'needs-info', '#e4e669', 'desc')`, `createLabel` is NOT called and `core.warning` is NOT called.
    - Test 2 (`ensureLabel — label missing (404) → createLabel called with stripped color`): mock `getLabel` rejects with `Object.assign(new Error('not found'), { status: 404 })`; mock `createLabel` resolves. After `ensureLabel(..., '#e4e669', 'Waiting for more info')`, `createLabel` is called exactly once with `{ owner: 'o', repo: 'r', name: 'needs-info', color: 'e4e669' /* no # */, description: 'Waiting for more info' }`.
    - Test 3 (`ensureLabel — getLabel non-404 error → core.warning + no create`): mock `getLabel` rejects with `{ status: 500, message: 'server error' }`. `createLabel` NOT called; `core.warning` called with a message containing `'needs-info'`.
    - Test 4 (`ensureLabel — getLabel 404 then createLabel rejects → core.warning, no throw`): get rejects 404, create rejects with arbitrary error. `core.warning` called with a message containing `'needs-info'`; the promise resolves (no rejection).
    - Test 5 (`applyLabel — success returns 'applied'`): `addLabels` resolves. `applyLabel(..., 42, 'needs-info')` returns `'applied'`. `addLabels` called with `{ owner, repo, issue_number: 42, labels: ['needs-info'] }`.
    - Test 6 (`applyLabel — error returns 'skipped' + warning`): `addLabels` rejects. Returns `'skipped'`. `core.warning` called.
    - Test 7 (`removeLabel — success returns 'removed'`): `removeLabel` (Octokit) resolves. Function returns `'removed'`. `core.warning` NOT called.
    - Test 8 (`removeLabel — 404 returns 'skipped' silently`): Octokit `removeLabel` rejects with `{ status: 404 }`. Function returns `'skipped'`. `core.warning` NOT called (404 = label wasn't on issue = desired state).
    - Test 9 (`removeLabel — non-404 error returns 'skipped' + warning`): Octokit `removeLabel` rejects with `{ status: 500 }`. Function returns `'skipped'`. `core.warning` called.
    - Test 10 (`color without # also works`): `ensureLabel(..., 'e4e669', ...)` (no leading `#`). `createLabel` called with `color: 'e4e669'` — the `.replace('#', '')` is a no-op here.
  </behavior>
  <action>
    Create `tests/adapters/labels.test.ts`. Vitest 3.x, same style as `tests/adapters/github.test.ts`.

    ```typescript
    import { describe, it, expect, vi, beforeEach } from 'vitest'
    import * as core from '@actions/core'
    import {
      ensureLabel,
      applyLabel,
      removeLabel,
      type LabelAction,
    } from '../../src/adapters/github/labels.js'

    vi.mock('@actions/core', () => ({
      warning: vi.fn(),
      info: vi.fn(),
    }))

    type Fn = ReturnType<typeof vi.fn>
    function makeOctokit(overrides: {
      getLabel?: Fn
      createLabel?: Fn
      addLabels?: Fn
      removeLabel?: Fn
    }) {
      const getLabel = overrides.getLabel ?? vi.fn().mockResolvedValue({ data: {} })
      const createLabel = overrides.createLabel ?? vi.fn().mockResolvedValue({ data: {} })
      const addLabels = overrides.addLabels ?? vi.fn().mockResolvedValue({ data: {} })
      const remove = overrides.removeLabel ?? vi.fn().mockResolvedValue({ data: {} })
      const octokit = {
        rest: {
          repos: { getLabel, createLabel },
          issues: { addLabels, removeLabel: remove },
        },
      } as unknown as Parameters<typeof ensureLabel>[0]
      return { octokit, getLabel, createLabel, addLabels, removeLabel: remove }
    }

    function httpError(status: number, message = 'err'): Error & { status: number } {
      return Object.assign(new Error(message), { status })
    }

    beforeEach(() => {
      vi.clearAllMocks()
    })

    // Implement Test 1..Test 10 from <behavior> using `expect(...).toHaveBeenCalledWith(...)`,
    // `expect(...).not.toHaveBeenCalled()`, `expect(returnValue).toBe('applied')`, etc.
    // Also include a compile-only check that `LabelAction` is the exact union:
    //   const _typecheck: LabelAction = 'applied'   // and try each variant in turn
    ```

    Implement all 10 test cases. Run `npm test -- --run tests/adapters/labels.test.ts`; expect failure with "Cannot find module" or equivalent.
  </action>
  <verify>
    <automated>npm test -- --run tests/adapters/labels.test.ts 2&gt;&amp;1 | grep -E "(Cannot find module|FAIL|failed)" &amp;&amp; echo "RED-OK"</automated>
  </verify>
  <acceptance_criteria>
    - `tests/adapters/labels.test.ts` exists
    - `grep -c "it(" tests/adapters/labels.test.ts` ≥ 10
    - File references all four function names: `ensureLabel`, `applyLabel`, `removeLabel`, `LabelAction` (each found by grep)
    - At least one test mocks `getLabel` with a 404 error and asserts `createLabel` is called
    - At least one test mocks `removeLabel` with a 404 and asserts `core.warning` is NOT called
    - At least one test mocks `getLabel` resolving, then asserts `createLabel` is NOT called (D-13 preservation)
    - `npm test -- --run tests/adapters/labels.test.ts` exits non-zero (RED)
    - Existing 96+ tests still pass when this file is excluded
  </acceptance_criteria>
  <done>
    `tests/adapters/labels.test.ts` exists with 10 failing tests covering ensureLabel (4 branches), applyLabel (2 branches), removeLabel (3 branches), and one type-checks `LabelAction`. RED phase complete.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement `src/adapters/github/labels.ts`</name>
  <read_first>
    - src/adapters/github/io.ts (OctokitInstance alias + import pattern)
    - tests/adapters/labels.test.ts (the spec — implementation must make every test pass)
    - .planning/phases/02-action-hardening-repo-awareness/02-RESEARCH.md (Pattern 5: full code template)
    - .planning/phases/02-action-hardening-repo-awareness/02-CONTEXT.md (D-12: color #e4e669; D-13: silent succeed if exists; D-14: always re-apply on re-run)
  </read_first>
  <behavior>
    GREEN phase. After implementation:
    - All 10 tests from Task 1 pass
    - All other tests (96 existing + ~10 from Plan 02 templates if landed first) still pass
    - `npm run build` and `npm run lint` exit 0
    - Functions never throw under any tested input
  </behavior>
  <action>
    Create `src/adapters/github/labels.ts` with exactly these contents (verbatim — adjust only to match Biome formatting if it complains):

    ```typescript
    // src/adapters/github/labels.ts
    // ACT-06: label management adapter. Three idempotent operations:
    //   ensureLabel  — D-13: create if missing, silent succeed if exists (no overwrite)
    //   applyLabel   — D-14: add label to issue (unconditional re-apply allowed)
    //   removeLabel  — Pitfall 7: 404 is silent success
    // All errors caught + surfaced via core.warning; label failure NEVER blocks the hero comment.

    import * as core from '@actions/core'
    import type * as github from '@actions/github'

    type OctokitInstance = ReturnType<typeof github.getOctokit>

    export type LabelAction = 'applied' | 'removed' | 'skipped' | 'disabled' | 'dry-run'

    export async function ensureLabel(
      octokit: OctokitInstance,
      owner: string,
      repo: string,
      name: string,
      color: string,
      description: string,
    ): Promise<void> {
      try {
        await octokit.rest.repos.getLabel({ owner, repo, name })
        // D-13: exists → silent succeed, do NOT overwrite color/description
        return
      } catch (err: unknown) {
        const status = (err as { status?: number }).status
        if (status !== 404) {
          core.warning(`Could not check label "${name}": ${(err as Error).message}`)
          return
        }
      }
      try {
        await octokit.rest.repos.createLabel({
          owner,
          repo,
          name,
          color: color.replace(/^#/, ''),
          description,
        })
      } catch (createErr: unknown) {
        core.warning(`Could not create label "${name}": ${(createErr as Error).message}`)
      }
    }

    export async function applyLabel(
      octokit: OctokitInstance,
      owner: string,
      repo: string,
      issueNumber: number,
      name: string,
    ): Promise<'applied' | 'skipped'> {
      try {
        await octokit.rest.issues.addLabels({
          owner,
          repo,
          issue_number: issueNumber,
          labels: [name],
        })
        return 'applied'
      } catch (err: unknown) {
        core.warning(`Could not apply label "${name}": ${(err as Error).message}`)
        return 'skipped'
      }
    }

    export async function removeLabel(
      octokit: OctokitInstance,
      owner: string,
      repo: string,
      issueNumber: number,
      name: string,
    ): Promise<'removed' | 'skipped'> {
      try {
        await octokit.rest.issues.removeLabel({
          owner,
          repo,
          issue_number: issueNumber,
          name,
        })
        return 'removed'
      } catch (err: unknown) {
        const status = (err as { status?: number }).status
        // Pitfall 7: 404 means label wasn't on the issue — desired state already achieved
        if (status !== 404) {
          core.warning(`Could not remove label "${name}": ${(err as Error).message}`)
        }
        return 'skipped'
      }
    }
    ```

    After saving the file:
    1. `npm test -- --run tests/adapters/labels.test.ts` — must pass (GREEN)
    2. `npm test -- --run` — total tests pass count goes up by 10 (or 20 if Plan 02 has landed)
    3. `npm run build` — clean compile
    4. `npm run lint` — clean
    5. `npm run format` — formats the new file in place (no diff after second run)
  </action>
  <verify>
    <automated>npm test -- --run tests/adapters/labels.test.ts &amp;&amp; npm run build &amp;&amp; npm run lint</automated>
  </verify>
  <acceptance_criteria>
    - `src/adapters/github/labels.ts` exists
    - `grep -c "export async function ensureLabel" src/adapters/github/labels.ts` returns 1
    - `grep -c "export async function applyLabel" src/adapters/github/labels.ts` returns 1
    - `grep -c "export async function removeLabel" src/adapters/github/labels.ts` returns 1
    - `grep -c "export type LabelAction" src/adapters/github/labels.ts` returns 1
    - `grep "color.replace(/\\^#/" src/adapters/github/labels.ts` matches once (color sanitization for createLabel) — alternatively `color.replace('#', '')` also acceptable; either pattern must appear
    - `grep "status !== 404" src/adapters/github/labels.ts` matches at least twice (used in both ensureLabel and removeLabel)
    - `grep -v "^//" src/adapters/github/labels.ts | grep -c "throw " | tr -d '[:space:]'` returns `0` (no `throw` statements outside comments)
    - `grep "core.warning" src/adapters/github/labels.ts` matches at least 4 times (one per error path)
    - `npm test -- --run tests/adapters/labels.test.ts` exits 0
    - `npm run build` exits 0
    - `npm run lint` exits 0
  </acceptance_criteria>
  <done>
    `src/adapters/github/labels.ts` implements all three idempotent label operations. Every Octokit error is caught and converted to a `core.warning` + typed return value. All 10 tests pass. Plan 05 can now wire these into `main.ts`.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Action runtime → GitHub Labels API | Authenticated via `GITHUB_TOKEN` with `issues: write` permission (Phase 1 declared this). |
| consumer-supplied `label-name` input → adapter | The string passed to `applyLabel` / `removeLabel` / `ensureLabel`. Octokit serializes it as a JSON value, not interpolated into URLs. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-11 | Tampering | Label-name injection (e.g., `'needs-info","admin'`) attempting to add a second label | mitigate | Octokit sends `labels: [name]` as a typed array, not string concatenation into a URL or JSON body. The Octokit client base64-encodes/serializes values; arbitrary punctuation inside a label name does not break out of the array. Octokit type signature for `addLabels` enforces `labels: string[]`. |
| T-02-12 | Information Disclosure | Octokit error message logged via `core.warning` contains repo path | accept | Repo owner/name are already visible to the consumer who installed the Action (it's running in their workflow). No secrets are passed to label endpoints. The `GITHUB_TOKEN` value is never in an error message because Octokit logs the request, not the token. |
| T-02-13 | Repudiation | Race condition: two parallel runs both attempt `createLabel` | mitigate | GitHub returns HTTP 422 ("name already exists") on duplicate `createLabel`. Our `ensureLabel` catches the create error in `core.warning` and continues — both runs proceed to `applyLabel` cleanly. Even with `getLabel`'s TOCTOU, the duplicate-create path is graceful. |
| T-02-14 | Denial of Service | Many label operations triggered by rapid issue events | accept | Each Action run does at most 3 label API calls (`getLabel` + `createLabel` OR `addLabels` OR `removeLabel`). With `GITHUB_TOKEN`'s 1000/hour limit, that's >300 issues/hour before throttling. Phase 2 corpus is 10 repos × ~1 issue/day in soak — well within budget. If rate-limited, all three functions return `'skipped'` via the existing try/catch + warning. |
| T-02-15 | Tampering | Maintainer renamed the configured label name to something different (D-13: don't overwrite) | mitigate | `ensureLabel` calls `getLabel` first and returns immediately on success — never touches an existing label's color or description. Test 1 in Task 1 explicitly asserts `createLabel` is NOT invoked when `getLabel` resolves. |
</threat_model>

<verification>
- All 10 tests in `tests/adapters/labels.test.ts` pass
- `npm test -- --run` total pass count = (Phase 1 baseline 96) + (Plan 02 templates tests, if landed) + 10 from this plan
- `npm run build`, `npm run lint` clean
- No `throw` statements in `src/adapters/github/labels.ts`
- No silent failures: every error path either returns `'skipped'` or invokes `core.warning`
</verification>

<success_criteria>
- `src/adapters/github/labels.ts` exports `ensureLabel`, `applyLabel`, `removeLabel`, `LabelAction`
- D-13 honored: existing labels are NEVER overwritten (no `updateLabel` call anywhere in the file)
- Pitfall 7 honored: `removeLabel` returning 404 is treated as silent success (no `core.warning` call)
- D-12 color default flows through correctly: `'#e4e669'` becomes `'e4e669'` when passed to `createLabel`
- All three functions return rather than throw on any tested error
- 10 unit tests cover the documented branches
</success_criteria>

<output>
After completion, create `.planning/phases/02-action-hardening-repo-awareness/02-03-labels-adapter-SUMMARY.md`.
</output>
