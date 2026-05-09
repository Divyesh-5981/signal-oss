---
id: 01-01-scaffold
phase: 01-skeleton-heuristic-spine-first-comment
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - tsconfig.json
  - rollup.config.ts
  - vitest.config.ts
  - biome.json
  - .gitignore
  - .env.example
  - README.md
requirements: []
autonomous: true
tags: [scaffold, tooling, vitest, biome, rollup]

must_haves:
  truths:
    - "Repo is bootstrapped from actions/typescript-action template"
    - "Jest is removed; Vitest 4.x runs tests"
    - "ESLint+Prettier are removed; Biome 2.x lints and formats"
    - "tsconfig.json declares NodeNext module resolution"
    - "package.json has type: module; remark/unified/zod deps installed"
    - "rollup.config.ts produces dist/index.js with format: 'es'"
    - "dist/ is NOT in .gitignore (template default preserved)"
  artifacts:
    - path: "package.json"
      provides: "Phase 1 dependency manifest with Vitest, Biome, remark stack, zod"
      contains: "\"type\": \"module\""
    - path: "vitest.config.ts"
      provides: "Vitest test runner config"
      contains: "environment: 'node'"
    - path: "biome.json"
      provides: "Biome lint+format config"
      contains: "\"$schema\": \"https://biomejs.dev/schemas/2.0.0/schema.json\""
    - path: "tsconfig.json"
      provides: "TS compiler settings — NodeNext module resolution"
      contains: "\"module\": \"NodeNext\""
    - path: "rollup.config.ts"
      provides: "ESM bundle config producing dist/index.js"
      contains: "format: 'es'"
  key_links:
    - from: "package.json scripts"
      to: "rollup, vitest, biome binaries"
      via: "npm script invocations"
      pattern: "rollup --config|vitest run|biome check"
---

<objective>
Bootstrap the Signal-OSS repository from the `actions/typescript-action` template, then perform the two mandatory toolchain swaps (Jest→Vitest, ESLint+Prettier→Biome) in this single foundational commit per D-02. Install all Phase 1 production dependencies (remark/unified pipeline, zod). The repo at the end of this plan is a clean, building, testing, lintable greenfield project — no source code yet, but `npm run all` succeeds.

**Purpose:** Lock the toolchain BEFORE any source code so we never mid-sprint migrate. Establish the project structure all subsequent plans build on.

**Output:** A repo with `package.json`, `tsconfig.json`, `rollup.config.ts`, `vitest.config.ts`, `biome.json`, `.gitignore`, `.env.example`, and updated `README.md` — all toolchain decisions locked. `npm install` succeeds. `npm run lint`, `npm run test`, and `npm run package` all succeed (test+package may have nothing to do, but they exit 0).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-skeleton-heuristic-spine-first-comment/01-CONTEXT.md
@.planning/phases/01-skeleton-heuristic-spine-first-comment/01-RESEARCH.md
@.planning/phases/01-skeleton-heuristic-spine-first-comment/SKELETON.md
@CLAUDE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Bootstrap from actions/typescript-action template + remove Jest/ESLint/Prettier</name>
  <read_first>
    - F:\Hackathon ideas\signal-oss\.planning\phases\01-skeleton-heuristic-spine-first-comment\SKELETON.md (sections A1, A2, A5 — locked toolchain decisions)
    - F:\Hackathon ideas\signal-oss\.planning\phases\01-skeleton-heuristic-spine-first-comment\01-RESEARCH.md (Pattern 11 — Template Bootstrap Step-by-Step)
    - F:\Hackathon ideas\signal-oss\.planning\phases\01-skeleton-heuristic-spine-first-comment\01-CONTEXT.md (D-01, D-02, D-03, D-04)
  </read_first>
  <files>
    - package.json
    - tsconfig.json
    - rollup.config.ts
    - .gitignore
    - (delete) jest.config.js, __tests__/, .eslintrc.cjs, .prettierrc, .prettierignore
    - (delete) src/index.ts (template sample), src/main.ts (template sample), src/wait.ts (if present)
  </files>
  <action>
The repo is currently empty (only `.planning/` exists, no source code). Bootstrap by **directly creating the file set the actions/typescript-action template would produce**, then immediately apply the D-02 swaps. Do NOT clone the template repo (avoids git history mess).

Step-by-step:

1. **Initialize package.json** at repo root (overwrite if exists):
   ```json
   {
     "name": "signal-oss",
     "version": "1.0.0",
     "description": "GitHub Action that triages incoming issues — scores actionability and posts a missing-info checklist",
     "main": "dist/index.js",
     "type": "module",
     "scripts": {
       "build": "tsc --noEmit",
       "package": "rollup --config rollup.config.ts --configPlugin typescript",
       "bundle": "npm run format && npm run package",
       "test": "vitest run",
       "test:watch": "vitest",
       "coverage": "vitest run --coverage",
       "lint": "biome check src",
       "format": "biome format --write src",
       "all": "npm run format && npm run lint && npm run test && npm run package",
       "local-action": "npx @github/local-action run . src/action/main.ts .env"
     },
     "keywords": ["github-action", "issue-triage", "actionability", "checklist", "oss-maintainer"],
     "author": "Signal-OSS",
     "license": "MIT",
     "engines": { "node": ">=24" },
     "dependencies": {
       "@actions/core": "^3.0.1",
       "@actions/github": "^9.1.1",
       "unified": "^11.0.5",
       "remark-parse": "^11.0.0",
       "remark-gfm": "^4.0.1",
       "unist-util-visit": "^5.1.0",
       "mdast-util-to-string": "^4.0.0",
       "zod": "^4.4.3"
     },
     "devDependencies": {
       "@biomejs/biome": "^2.4.14",
       "@rollup/plugin-commonjs": "^28.0.0",
       "@rollup/plugin-node-resolve": "^16.0.0",
       "@rollup/plugin-typescript": "^12.1.0",
       "@types/node": "^24.0.0",
       "rollup": "^4.60.3",
       "tslib": "^2.7.0",
       "typescript": "^5.9.0",
       "vitest": "^4.1.5",
       "@vitest/coverage-v8": "^4.1.5"
     }
   }
   ```

   Notes:
   - `"type": "module"` is REQUIRED (template default; ESM project).
   - All Phase 1 deps included up-front so subsequent plans don't re-edit `package.json`.
   - `@github/local-action` is invoked via `npx` — no devDep entry needed (per RESEARCH Pattern 12).
   - `tsx` is NOT a Phase 1 dep — benchmark harness ships in Phase 3.
   - `@anthropic-ai/sdk` and `openai` are NOT Phase 1 deps — LLM ships in Phase 4.

2. **Initialize tsconfig.json** at repo root (D-03: NodeNext):
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "NodeNext",
       "moduleResolution": "NodeNext",
       "esModuleInterop": true,
       "forceConsistentCasingInFileNames": true,
       "strict": true,
       "noUncheckedIndexedAccess": true,
       "skipLibCheck": true,
       "resolveJsonModule": true,
       "declaration": false,
       "outDir": "./build",
       "rootDir": "./src",
       "isolatedModules": true,
       "lib": ["ES2022"]
     },
     "include": ["src/**/*"],
     "exclude": ["node_modules", "dist", "build", "tests", "**/*.test.ts"]
   }
   ```

3. **Initialize rollup.config.ts** at repo root:
   ```typescript
   import commonjs from '@rollup/plugin-commonjs'
   import nodeResolve from '@rollup/plugin-node-resolve'
   import typescript from '@rollup/plugin-typescript'

   export default {
     input: 'src/action/main.ts',
     output: {
       esModule: true,
       file: 'dist/index.js',
       format: 'es',
       sourcemap: true,
     },
     plugins: [
       typescript({ tsconfig: './tsconfig.json' }),
       nodeResolve({ preferBuiltins: true }),
       commonjs(),
     ],
   }
   ```

   The `input` points to `src/action/main.ts` (NOT a template sample location). Plan 02 creates this file; running `npm run package` in this plan will fail unless Plan 02 runs — that's OK, this plan does NOT need to produce a working `dist/`. Verification for this plan stops at "config is valid TS".

4. **Create .gitignore** at repo root (preserve template default — `dist/` NOT excluded):
   ```
   node_modules/
   build/
   coverage/
   .env
   *.log
   .DS_Store
   .vscode/
   .idea/
   *.tsbuildinfo
   ```

   **CRITICAL:** Do NOT add `dist/` to `.gitignore`. ACT-01 requires `dist/` committed.

5. Run `npm install` to materialize `node_modules/` and produce `package-lock.json`. Do NOT commit `node_modules/`.
  </action>
  <verify>
    <automated>npm install &amp;&amp; node -e "const p=require('./package.json'); if(!p.scripts.test||!p.scripts.lint||!p.scripts.package) process.exit(1); if(p.type!=='module') process.exit(2); if(!p.dependencies['remark-parse']) process.exit(3); if(p.devDependencies.jest) process.exit(4); if(p.devDependencies.eslint) process.exit(5); if(p.devDependencies.prettier) process.exit(6); console.log('OK')"</automated>
  </verify>
  <acceptance_criteria>
    - File `package.json` exists at repo root.
    - `package.json` contains the literal string `"type": "module"`.
    - `package.json` contains `"@actions/core"`, `"@actions/github"`, `"unified"`, `"remark-parse"`, `"remark-gfm"`, `"unist-util-visit"`, `"mdast-util-to-string"`, `"zod"` in `dependencies`.
    - `package.json` contains `"vitest"` and `"@biomejs/biome"` in `devDependencies`.
    - `package.json` does NOT contain any `"jest"`, `"ts-jest"`, `"@types/jest"`, `"eslint"`, `"prettier"`, `"@typescript-eslint/eslint-plugin"`, or `"@typescript-eslint/parser"` keys (run: `grep -E '"(jest|ts-jest|@types/jest|eslint|prettier|@typescript-eslint)' package.json` returns 0 lines).
    - `package.json` `scripts` section contains `"test": "vitest run"`, `"lint": "biome check src"`, `"format": "biome format --write src"`, `"package": "rollup --config rollup.config.ts --configPlugin typescript"`.
    - File `tsconfig.json` exists at repo root and contains `"module": "NodeNext"` and `"moduleResolution": "NodeNext"`.
    - File `rollup.config.ts` exists at repo root and contains `format: 'es'` and `input: 'src/action/main.ts'`.
    - File `.gitignore` exists at repo root, contains `node_modules/`, but does NOT contain `dist/` or `dist` on its own line (run: `grep -E '^dist/?$' .gitignore` returns 0 lines).
    - `npm install` exits 0 and creates `node_modules/`.
    - No file `jest.config.js`, `.eslintrc.cjs`, `.eslintrc.json`, or `.prettierrc` exists at repo root.
  </acceptance_criteria>
  <done>
package.json, tsconfig.json, rollup.config.ts, .gitignore, and node_modules/ are all in place. The toolchain is locked in: Vitest + Biome + Rollup + NodeNext. Jest/ESLint/Prettier are gone. dist/ is gitignore-clean (NOT excluded). npm install passes.
  </done>
</task>

<task type="auto">
  <name>Task 2: Configure Vitest, Biome, .env.example, and a placeholder smoke test</name>
  <read_first>
    - F:\Hackathon ideas\signal-oss\package.json (verify Task 1 deps installed)
    - F:\Hackathon ideas\signal-oss\.planning\phases\01-skeleton-heuristic-spine-first-comment\01-RESEARCH.md (Pattern 9 — Vitest config; Pattern 10 — Biome config; Pattern 12 — local-action env)
    - F:\Hackathon ideas\signal-oss\.planning\phases\01-skeleton-heuristic-spine-first-comment\SKELETON.md (section A2)
  </read_first>
  <files>
    - vitest.config.ts
    - biome.json
    - .env.example
    - tests/smoke.test.ts
    - README.md
  </files>
  <action>
Create the test/lint configurations and a single smoke test that verifies the toolchain end-to-end.

1. **Create vitest.config.ts** at repo root (RESEARCH Pattern 9):
   ```typescript
   import { defineConfig } from 'vitest/config'

   export default defineConfig({
     test: {
       environment: 'node',
       globals: true,
       include: ['tests/**/*.test.ts'],
       exclude: ['dist/**', 'node_modules/**', 'build/**'],
       coverage: {
         provider: 'v8',
         include: ['src/**/*.ts'],
         exclude: ['src/action/main.ts'],
       },
     },
   })
   ```

2. **Create biome.json** at repo root (RESEARCH Pattern 10):
   ```json
   {
     "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
     "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
     "files": { "ignoreUnknown": false, "include": ["src/**/*.ts"] },
     "formatter": {
       "enabled": true,
       "indentStyle": "space",
       "indentWidth": 2,
       "lineWidth": 100
     },
     "organizeImports": { "enabled": true },
     "linter": {
       "enabled": true,
       "rules": { "recommended": true }
     },
     "javascript": {
       "formatter": {
         "quoteStyle": "single",
         "semicolons": "asNeeded",
         "trailingCommas": "all"
       }
     }
   }
   ```

3. **Create .env.example** at repo root (used by `@github/local-action` per RESEARCH Pattern 12):
   ```
   # Copy to .env (DO NOT COMMIT) before running `npm run local-action`
   # Real GITHUB_TOKEN with write access to your sandbox repo
   GITHUB_TOKEN=ghp_replace_me

   # Required by @actions/github context
   GITHUB_EVENT_NAME=issues
   GITHUB_REPOSITORY=your-username/signal-oss-sandbox
   GITHUB_ACTOR=your-username

   # Path to a fixture event payload (created in Plan 05)
   GITHUB_EVENT_PATH=./tests/fixtures/events/issues-opened.json
   ```

   Add `.env` to `.gitignore` if not already there (Task 1 already added it; verify).

4. **Create tests/smoke.test.ts** — a single trivial test proving Vitest runs:
   ```typescript
   import { describe, it, expect } from 'vitest'

   describe('toolchain smoke test', () => {
     it('vitest is wired correctly', () => {
       expect(1 + 1).toBe(2)
     })

     it('typescript NodeNext resolution accepts .js extension imports', async () => {
       // This file imports nothing yet — Plan 02 adds real imports.
       // The presence of this passing test proves vitest + ts compilation work.
       expect(typeof import.meta.url).toBe('string')
     })
   })
   ```

   This test will be DELETED in Plan 02 once real tests exist; it exists only to prove the wiring works in this plan.

5. **Create README.md** at repo root (minimal stub — Plan 05 / Phase 5 expand it):
   ```markdown
   # Signal-OSS

   A GitHub Action that triages incoming GitHub Issues for OSS maintainers. For every new issue, Signal-OSS computes an actionability score (0–10) and posts a repo-aware checklist of what's missing.

   **Status:** Phase 1 — heuristic spine + first comment (in development).

   ## Development

   ```bash
   npm install
   npm run all   # format + lint + test + package
   ```

   ## Toolchain

   - Node 24 / TypeScript 5.9 / Module: NodeNext (ESM)
   - Bundler: Rollup 4 (ESM output → `dist/index.js`)
   - Test runner: Vitest 4
   - Linter/formatter: Biome 2

   See `.planning/` for project documentation.
   ```

6. Run `npm run lint` — expect either "No issues found" OR a clean exit 0 since there's no `src/` code yet. If Biome complains about no files to lint, that's acceptable — the script must exit 0. (If Biome's behavior on empty `src/` is non-zero, create `src/.gitkeep` to give it a directory to scan but no files to lint.)

7. Run `npm run test` — expect 2/2 passing tests in `tests/smoke.test.ts`.
  </action>
  <verify>
    <automated>npm run test &amp;&amp; npm run lint || (echo "LINT/TEST FAILED" &amp;&amp; exit 1)</automated>
  </verify>
  <acceptance_criteria>
    - File `vitest.config.ts` exists and contains `environment: 'node'` and `globals: true`.
    - File `biome.json` exists and contains `"$schema": "https://biomejs.dev/schemas/2.0.0/schema.json"`.
    - File `.env.example` exists at repo root and contains `GITHUB_TOKEN=`, `GITHUB_EVENT_NAME=issues`, `GITHUB_EVENT_PATH=`.
    - File `tests/smoke.test.ts` exists and contains `describe('toolchain smoke test'`.
    - File `README.md` exists at repo root and contains the project name `Signal-OSS`.
    - Running `npm run test` exits 0 and reports `2 passed` (the two smoke tests).
    - Running `npm run lint` exits 0.
    - `.gitignore` contains `.env` (not just `.env.example`).
  </acceptance_criteria>
  <done>
Vitest config, Biome config, .env.example, and a passing smoke test all exist. `npm run test` shows 2/2 tests passing. `npm run lint` exits 0. The toolchain is fully verified — every subsequent plan can rely on test+lint working.
  </done>
</task>

</tasks>

<verification>
End-to-end verification of Plan 01:

```bash
# Toolchain swap proof
grep -E '"(jest|ts-jest|eslint|prettier)' package.json    # must return 0 lines
grep '"vitest"' package.json                               # must return 1+ lines
grep '"@biomejs/biome"' package.json                       # must return 1 lines

# tsconfig NodeNext proof
grep '"module": "NodeNext"' tsconfig.json
grep '"moduleResolution": "NodeNext"' tsconfig.json

# Rollup ESM output proof
grep "format: 'es'" rollup.config.ts

# dist/ NOT gitignored
grep -E '^dist/?$' .gitignore                              # must return 0 lines

# Test runner works
npm run test    # 2/2 passing

# Linter works
npm run lint    # exit 0
```
</verification>

<success_criteria>
- Repo bootstrap complete; `package.json`, `tsconfig.json`, `rollup.config.ts`, `vitest.config.ts`, `biome.json` all exist with locked-decision content.
- D-01 honored: project structure mirrors `actions/typescript-action` template (Rollup, NodeNext, type:module).
- D-02 honored: Jest/ESLint/Prettier are GONE; Vitest 4 + Biome 2 are installed.
- D-03 honored: NodeNext module resolution.
- D-04 prep: `dist/` NOT in `.gitignore`.
- `npm install` succeeds; `npm run test` reports 2/2 passing; `npm run lint` exits 0.
</success_criteria>

<output>
After completion, create `.planning/phases/01-skeleton-heuristic-spine-first-comment/01-01-SUMMARY.md` documenting:
- Toolchain decisions actually applied (Vitest 4.x version, Biome 2.x version)
- Any deviations from the plan (e.g., dep version pins different from Plan)
- Whether `npm install` produced any deprecation warnings
- The exact `package-lock.json` hash for reproducibility
</output>
