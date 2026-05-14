---
phase: 02-action-hardening-repo-awareness
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - package-lock.json
  - src/core/types.ts
  - action.yml
autonomous: true
requirements: [ACT-07]
tags: [github-action, types, action-yml, yaml-parser]

must_haves:
  truths:
    - "The `yaml` package is installed and importable from `src/adapters/`"
    - "`ParsedTemplate` is an exported interface in `src/core/types.ts` with fields `filename: string`, `type: 'form' | 'md'`, `fields: string[]`"
    - "`RepoContext.templates` is typed `ParsedTemplate[]` (no longer `unknown[]`)"
    - "`ChecklistStrategy.generate` accepts an optional third parameter `ctx?: RepoContext`"
    - "`action.yml` declares all 8 ACT-07 inputs (`dry-run`, `enable-comments`, `enable-labels`, `label-name`, `model`, `gray-zone-low`, `gray-zone-high`, `max-body-bytes`) plus `github-token`, all with `required: false` and the documented defaults"
    - "`npm run build` succeeds (TypeScript still compiles after the type changes)"
    - "Existing test suite (96/96) still passes — additive changes only"
  artifacts:
    - path: "src/core/types.ts"
      provides: "ParsedTemplate interface; widened RepoContext.templates type; ctx?: RepoContext on ChecklistStrategy.generate"
      contains: "export interface ParsedTemplate"
    - path: "action.yml"
      provides: "ACT-07 inputs block"
      contains: "dry-run"
    - path: "package.json"
      provides: "yaml 2.x dependency"
      contains: "\"yaml\""
  key_links:
    - from: "src/core/types.ts"
      to: "src/core/checklist/strategies/baseline.ts"
      via: "ChecklistStrategy interface implementation"
      pattern: "implements ChecklistStrategy"
    - from: "package.json"
      to: "node_modules/yaml"
      via: "npm install"
      pattern: "yaml"
---

<objective>
Wave 1 foundations for Phase 2. Install the missing `yaml` dependency (CHECK-03 prerequisite), widen the type system so downstream strategies can consume parsed templates without unsafe casts, and declare every Action input in `action.yml` so consumers can configure the Action via `with:` blocks.

Purpose: Wave 2 plans (templates adapter, labels adapter, strategies) all depend on these shared contracts — adding `ParsedTemplate` and the `ctx?` parameter here lets Wave 2 plans run in parallel without file conflicts on `types.ts`. Installing `yaml` at the start of Wave 1 avoids a runtime crash when Plan 02 wires it up.

Output: Single file delta to `src/core/types.ts`, `action.yml`, and `package.json` + lockfile. No new runtime behavior; existing 96/96 tests stay green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/02-action-hardening-repo-awareness/02-CONTEXT.md
@.planning/phases/02-action-hardening-repo-awareness/02-RESEARCH.md
@.planning/phases/02-action-hardening-repo-awareness/02-PATTERNS.md
@src/core/types.ts
@action.yml
@package.json

<interfaces>
<!-- Current ChecklistStrategy contract (src/core/types.ts lines 47-51) -->
```typescript
export interface ChecklistStrategy {
  name: string
  applies(ctx: RepoContext): boolean
  generate(type: IssueType, signals: Signals): ChecklistItem[]
}
```

<!-- Target ChecklistStrategy contract after this plan -->
```typescript
export interface ChecklistStrategy {
  name: string
  applies(ctx: RepoContext): boolean
  generate(type: IssueType, signals: Signals, ctx?: RepoContext): ChecklistItem[]
}
```

<!-- New ParsedTemplate type to add -->
```typescript
export interface ParsedTemplate {
  filename: string
  type: 'form' | 'md'
  fields: string[]   // human-readable required field labels, in template order
}
```

<!-- Current RepoContext (lines 23-28) — only the `templates` field changes -->
```typescript
export interface RepoContext {
  hasIssueForms: boolean
  hasMdTemplates: boolean
  hasContributing: boolean
  templates: ParsedTemplate[]   // was: unknown[]
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install the `yaml` package and commit the lockfile</name>
  <read_first>
    - package.json (current dependency list — confirm `yaml` is NOT already present)
    - .planning/phases/02-action-hardening-repo-awareness/02-RESEARCH.md (Environment Availability table — confirms 2.9.0 is the target version)
  </read_first>
  <action>
    From the repo root run `npm install yaml@^2.9.0` (PowerShell or Bash). This adds `yaml` to `dependencies` in `package.json` (NOT `devDependencies` — it ships in `dist/index.js`) and updates `package-lock.json`. Do not pass `--save-dev`. After the install, run `node -e "import('yaml').then(m => console.log(m.parse('a: 1')))"` to prove the package loads at runtime (expected stdout: `{ a: 1 }`). Do NOT run `npm run package` in this task — bundling happens in Plan 05.
  </action>
  <verify>
    <automated>npm ls yaml --depth=0 2>&amp;1 | grep -E "yaml@2\." &amp;&amp; node -e "import('yaml').then(m =&gt; { if (m.parse('a: 1').a !== 1) process.exit(1) })"</automated>
  </verify>
  <acceptance_criteria>
    - `grep '"yaml"' package.json` matches a line under the `"dependencies"` block (NOT `"devDependencies"`)
    - `package.json` line matches the pattern `"yaml": "\^2\.` (caret-pinned to 2.x)
    - `package-lock.json` contains `"node_modules/yaml"` entry (verifiable with `grep "node_modules/yaml" package-lock.json`)
    - `node_modules/yaml/package.json` exists (verifiable with `node -e "console.log(require('yaml/package.json').version)"` printing a 2.x version)
    - `node -e "import('yaml').then(m =&gt; console.log(typeof m.parse))"` prints `function`
  </acceptance_criteria>
  <done>
    `yaml` 2.x appears under `dependencies` in `package.json`, the lockfile is regenerated, and the package is importable as an ES module from a Node script.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Add ParsedTemplate type, widen RepoContext.templates, extend ChecklistStrategy.generate signature</name>
  <read_first>
    - src/core/types.ts (current shape — modify in place, preserve Phase 1 DTOs verbatim)
    - src/core/checklist/strategies/baseline.ts (confirms BaselineStrategy.generate uses the existing 2-arg signature; the `ctx?` param must be optional so this file stays unchanged)
    - tests/core/checklist.test.ts (confirms no test currently passes a 3rd arg to generate())
  </read_first>
  <behavior>
    - After change: `import { ParsedTemplate } from './core/types.js'` resolves and exports an interface with exactly the fields `filename: string`, `type: 'form' | 'md'`, `fields: string[]`
    - `RepoContext.templates` has type `ParsedTemplate[]` — assigning `unknown[]` to it now produces a TypeScript error
    - `ChecklistStrategy.generate(type, signals)` (2 args) still compiles (BaselineStrategy keeps its existing signature)
    - `ChecklistStrategy.generate(type, signals, ctx)` (3 args) compiles — `ctx` is typed `RepoContext | undefined`
    - `npm run build` exits 0
    - All 96 existing tests pass with no modifications
  </behavior>
  <action>
    Edit `src/core/types.ts`:

    1. Add the `ParsedTemplate` interface immediately after the `RepoContext` interface (after line 28). Exact text:
    ```typescript
    // Phase 2 (CHECK-03 / CHECK-04): typed output of the templates adapter.
    // Produced by src/adapters/github/templates.ts; consumed by Tier 1 / Tier 2 strategies in src/core/.
    export interface ParsedTemplate {
      filename: string
      type: 'form' | 'md'
      fields: string[]
    }
    ```

    2. Change `RepoContext.templates` field. Replace the line `templates: unknown[]` with `templates: ParsedTemplate[]`. The other three fields (`hasIssueForms`, `hasMdTemplates`, `hasContributing`) are unchanged.

    3. Extend `ChecklistStrategy.generate` signature. Replace the line `generate(type: IssueType, signals: Signals): ChecklistItem[]` with `generate(type: IssueType, signals: Signals, ctx?: RepoContext): ChecklistItem[]`. The `ctx?` MUST be optional (question mark) — `BaselineStrategy` does not implement the third parameter.

    4. Verify: run `npm run build` (TypeScript compile-check). Run `npm test` and confirm 96/96 tests still pass. The existing `tests/action/main.test.ts` uses `templates: []` which is a valid empty `ParsedTemplate[]` — no test changes needed.

    Do NOT modify `src/core/checklist/strategies/baseline.ts` or `src/core/checklist/generator.ts` in this task. Those files compile against the updated interface as-is (BaselineStrategy's 2-arg `generate` satisfies the contract because the 3rd arg is optional). Plan 04 will update generator.ts to pass `ctx` to all strategies.
  </action>
  <verify>
    <automated>npm run build &amp;&amp; npm test -- --run</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "export interface ParsedTemplate" src/core/types.ts` returns 1
    - `grep "filename: string" src/core/types.ts` matches at least once
    - `grep "type: 'form' | 'md'" src/core/types.ts` matches once
    - `grep "fields: string\[\]" src/core/types.ts` matches once
    - `grep "templates: ParsedTemplate\[\]" src/core/types.ts` matches once
    - `grep "templates: unknown\[\]" src/core/types.ts` returns no matches
    - `grep "generate(type: IssueType, signals: Signals, ctx?: RepoContext): ChecklistItem\[\]" src/core/types.ts` matches once
    - `npm run build` exits 0
    - `npm test -- --run` reports `96 passed` (or higher if Plan 01 added new tests — but this task adds none)
  </acceptance_criteria>
  <done>
    `src/core/types.ts` exports `ParsedTemplate`, `RepoContext.templates` is `ParsedTemplate[]`, `ChecklistStrategy.generate` accepts an optional `ctx?: RepoContext`, project type-checks, all existing tests pass.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Declare all ACT-07 Action inputs in action.yml</name>
  <read_first>
    - action.yml (current 13-line file — preserve `name`, `description`, `author`, `runs`, `branding`)
    - .planning/phases/02-action-hardening-repo-awareness/02-RESEARCH.md (Pattern 6: action.yml Inputs Definition — verbatim YAML to insert)
    - .planning/phases/02-action-hardening-repo-awareness/02-CONTEXT.md (Claude's Discretion section confirms the default values: max-body-bytes=10000, gray-zone-low=4, gray-zone-high=6)
  </read_first>
  <action>
    Edit `action.yml`. Insert the following `inputs:` block AFTER the `author: 'Signal-OSS'` line (line 3) and BEFORE the `runs:` block (line 7). Remove the placeholder comment `# Phase 1: no inputs (added in Phase 2: ...)`. Preserve all other lines verbatim.

    Exact YAML to insert (verbatim — 2-space indentation matters):
    ```yaml
    inputs:
      github-token:
        description: 'GitHub token (defaults to GITHUB_TOKEN)'
        required: false
        default: ${{ github.token }}
      dry-run:
        description: 'If true, skip posting comment and applying labels'
        required: false
        default: 'false'
      enable-comments:
        description: 'If false, skip posting the checklist comment'
        required: false
        default: 'true'
      enable-labels:
        description: 'If false, skip label management'
        required: false
        default: 'true'
      label-name:
        description: 'Name of the label to apply when checklist has items'
        required: false
        default: 'needs-info'
      model:
        description: 'LLM model identifier (used in Phase 4)'
        required: false
        default: ''
      gray-zone-low:
        description: 'Lower bound of gray zone (inclusive)'
        required: false
        default: '4'
      gray-zone-high:
        description: 'Upper bound of gray zone (inclusive)'
        required: false
        default: '6'
      max-body-bytes:
        description: 'Maximum issue body bytes to analyze (truncated before scoring)'
        required: false
        default: '10000'
    ```

    Do NOT touch `runs:` (must remain `using: 'node24'` and `main: 'dist/index.js'`) or `branding:`. Do NOT modify `src/action/main.ts` to consume these inputs — Plan 05 handles wiring.

    Validate the YAML parses by running `node -e "console.log(JSON.stringify(require('yaml').parse(require('fs').readFileSync('action.yml','utf8')).inputs &amp;&amp; Object.keys(require('yaml').parse(require('fs').readFileSync('action.yml','utf8')).inputs)))"`. Expected output is a JSON array containing exactly these 9 keys: `github-token`, `dry-run`, `enable-comments`, `enable-labels`, `label-name`, `model`, `gray-zone-low`, `gray-zone-high`, `max-body-bytes`.
  </action>
  <verify>
    <automated>node -e "const f=require('fs').readFileSync('action.yml','utf8');const y=require('yaml').parse(f);const k=Object.keys(y.inputs||{});const need=['github-token','dry-run','enable-comments','enable-labels','label-name','model','gray-zone-low','gray-zone-high','max-body-bytes'];const miss=need.filter(n=&gt;!k.includes(n));if(miss.length){console.error('MISSING:',miss);process.exit(1)}console.log('OK',k.length)"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "^inputs:" action.yml` returns 1 (top-level `inputs:` block exists)
    - `grep "dry-run:" action.yml` matches once
    - `grep "enable-comments:" action.yml` matches once
    - `grep "enable-labels:" action.yml` matches once
    - `grep "label-name:" action.yml` matches once
    - `grep "max-body-bytes:" action.yml` matches once
    - `grep "gray-zone-low:" action.yml` matches once
    - `grep "gray-zone-high:" action.yml` matches once
    - `grep "model:" action.yml` matches at least once (the input named `model`)
    - `grep "default: 'needs-info'" action.yml` matches once
    - `grep "default: '10000'" action.yml` matches once
    - `grep "using: 'node24'" action.yml` still matches (runs block intact)
    - `grep "main: 'dist/index.js'" action.yml` still matches
    - The validation node script (see action) exits 0 with stdout starting `OK 9`
  </acceptance_criteria>
  <done>
    `action.yml` declares all 9 inputs with the documented defaults, the `runs:` block is unchanged, and the YAML parses cleanly. The Action can now be invoked from a workflow with `with: dry-run: 'true'` etc., though consumption inside the Action runtime is Plan 05's job.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| consumer workflow → action.yml inputs | Workflow YAML `with:` values flow into `core.getInput()` at runtime (Plan 05). All inputs declared here are typed as strings by the GitHub Actions runner; consumption-side validation is Plan 05's responsibility. |
| npm registry → node_modules/yaml | Package supply-chain — depending on `yaml@^2.x` from the eemeli/yaml maintainer (CLAUDE.md locked stack). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-01 | Tampering | `yaml` npm dependency (supply chain) | accept | CLAUDE.md locks `yaml` 2.x as the standard parser; caret-pin to 2.x in `package.json` lets patch upgrades land but not 3.x breaking changes; `dist/index.js` is committed and reviewed before each release (existing Phase 1 workflow), so any compromised transitive dep would surface as a diff in `dist/`. |
| T-02-02 | Information Disclosure | `model` input value logged | accept | The `model` input is a non-sensitive string (e.g. `claude-haiku-4-5`). The actual API key lives in `secrets.ANTHROPIC_API_KEY` and never appears in `action.yml`. No mitigation needed in this plan; secret hardening is Phase 4 (LLM-06). |
| T-02-03 | Tampering | `max-body-bytes` consumer-supplied value | mitigate | Plan 05 enforces this via `parseInt(input, 10)` with a fallback of 10000; this plan only declares the input. The default `'10000'` is the safe lower bound — consumers can raise it but not below the parseInt fallback. Cross-reference: defense-in-depth covered in Plan 05 Task wiring. |
| T-02-04 | Denial of Service | `gray-zone-low` / `gray-zone-high` set to nonsense values | accept | Defaults `'4'` and `'6'` are safe; if a consumer passes non-numeric strings, `parseInt` returns `NaN` and Plan 05's fallback `|| '4'` kicks in. No injection vector — these are local numeric comparators only. |
</threat_model>

<verification>
- `npm ls yaml --depth=0` shows `yaml@2.x.x`
- `npm run build` exits 0 (TypeScript compiles with new types)
- `npm test -- --run` reports `96 passed` (no test regressions)
- `node -e "const y=require('yaml').parse(require('fs').readFileSync('action.yml','utf8'));console.log(Object.keys(y.inputs).length)"` prints `9`
</verification>

<success_criteria>
- `yaml` 2.x installed and resolvable from `import { parse } from 'yaml'`
- `ParsedTemplate` exported from `src/core/types.ts` with exactly the documented shape
- `RepoContext.templates` typed `ParsedTemplate[]` (replacing `unknown[]`)
- `ChecklistStrategy.generate` accepts optional `ctx?: RepoContext` third parameter
- `action.yml` declares all 9 inputs (github-token + 8 ACT-07 inputs) with documented defaults
- Phase 1's `runs:` and `branding:` blocks unchanged
- 96/96 existing tests still pass
</success_criteria>

<output>
After completion, create `.planning/phases/02-action-hardening-repo-awareness/02-01-foundations-SUMMARY.md`.
</output>
