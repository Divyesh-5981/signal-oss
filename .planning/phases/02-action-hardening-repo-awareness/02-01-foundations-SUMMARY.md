---
phase: 02-action-hardening-repo-awareness
plan: "01"
subsystem: types
tags: [typescript, yaml, action-yml, types, ParsedTemplate, ChecklistStrategy]

# Dependency graph
requires:
  - phase: 01-scaffold-and-core
    provides: src/core/types.ts with Phase 1 DTOs (RepoContext with unknown[] templates, ChecklistStrategy interface)

provides:
  - yaml 2.x installed as runtime dependency
  - ParsedTemplate interface exported from src/core/types.ts
  - RepoContext.templates typed as ParsedTemplate[] (was unknown[])
  - ChecklistStrategy.generate accepts optional ctx?: RepoContext third parameter
  - action.yml declares all 9 ACT-07 inputs with documented defaults

affects:
  - 02-02-templates-adapter
  - 02-03-labels-adapter
  - 02-04-strategies
  - 02-05-wiring

# Tech tracking
tech-stack:
  added:
    - yaml@^2.9.0 (runtime dependency for parsing issue form YAML and markdown templates)
  patterns:
    - Optional context parameter on strategy interface (ctx?: RepoContext) lets Wave 2 strategies consume templates without breaking Wave 1 BaselineStrategy

key-files:
  created: []
  modified:
    - package.json (yaml 2.x added to dependencies)
    - package-lock.json (lockfile regenerated)
    - src/core/types.ts (ParsedTemplate interface; RepoContext.templates widened; ChecklistStrategy.generate extended)
    - action.yml (9 ACT-07 inputs declared with defaults)

key-decisions:
  - "yaml installed in dependencies (not devDependencies) because it ships in dist/index.js at runtime"
  - "ParsedTemplate placed immediately after RepoContext to co-locate related types"
  - "ChecklistStrategy.generate third param ctx? is optional (not required) so BaselineStrategy needs no changes"

patterns-established:
  - "Strategy interface extension: optional parameters let new strategies use context without breaking existing implementations"
  - "action.yml inputs: all required: false with safe defaults; consumption wired in Plan 05"

requirements-completed: [ACT-07]

# Metrics
duration: 8min
completed: 2026-05-14
---

# Phase 2 Plan 01: Foundations Summary

**yaml 2.x installed, ParsedTemplate type added, RepoContext.templates narrowed from unknown[] to ParsedTemplate[], ChecklistStrategy.generate extended with optional ctx?: RepoContext, and action.yml declares all 9 ACT-07 inputs with safe defaults**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-14T17:12:00Z
- **Completed:** 2026-05-14T17:20:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Installed `yaml@2.9.0` as a runtime dependency (needed by Wave 2 templates adapter)
- Added `ParsedTemplate` interface to `src/core/types.ts` with `filename`, `type`, and `fields`
- Widened `RepoContext.templates` from `unknown[]` to `ParsedTemplate[]` — downstream strategies now get typed template data
- Extended `ChecklistStrategy.generate` with optional `ctx?: RepoContext` so Wave 2 strategies can consume parsed templates without modifying `BaselineStrategy`
- Declared all 9 inputs in `action.yml` (`github-token`, `dry-run`, `enable-comments`, `enable-labels`, `label-name`, `model`, `gray-zone-low`, `gray-zone-high`, `max-body-bytes`) with safe defaults

## Task Commits

Each task was committed atomically:

1. **Task 1: Install the yaml package and commit the lockfile** - `dc51910` (chore)
2. **Task 2: Add ParsedTemplate type, widen RepoContext.templates, extend ChecklistStrategy.generate** - `e5f46af` (feat)
3. **Task 3: Declare all ACT-07 Action inputs in action.yml** - `0dfd1a4` (feat)

**Plan metadata:** (docs commit — created after this summary)

## Files Created/Modified

- `package.json` - Added `yaml: "^2.9.0"` under `dependencies` (not devDependencies)
- `package-lock.json` - Regenerated after yaml install
- `src/core/types.ts` - Added ParsedTemplate interface; changed RepoContext.templates to ParsedTemplate[]; extended ChecklistStrategy.generate with ctx?: RepoContext
- `action.yml` - Added 9-input block (github-token + 8 ACT-07 inputs) before runs: block; removed Phase 1 placeholder comment

## Decisions Made

- `yaml` in `dependencies` not `devDependencies`: it's imported by the templates adapter which ships in `dist/index.js`
- `ctx?` parameter is optional: `BaselineStrategy` stays unchanged — the third param is for Wave 2 strategies that consume template data
- `ParsedTemplate` placed after `RepoContext` in `types.ts`: co-locates the type with its consumer field

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Wave 2 plans (02-02 templates adapter, 02-03 labels adapter, 02-04 strategies) can now run in parallel:
- `yaml` package is importable at `src/adapters/`
- `ParsedTemplate` is the typed contract between adapter output and strategy input
- `ChecklistStrategy.generate(type, signals, ctx?)` is ready for Tier 1/2 strategies
- `action.yml` inputs are declared; Plan 05 will wire `core.getInput()` calls

## Self-Check

- `src/core/types.ts`: export interface ParsedTemplate present, templates: ParsedTemplate[], generate ctx? param present
- `action.yml`: 9 inputs declared, runs: node24 preserved
- `package.json`: yaml ^2.9.0 in dependencies
- All 96 tests pass, build exits 0

---
*Phase: 02-action-hardening-repo-awareness*
*Completed: 2026-05-14*
