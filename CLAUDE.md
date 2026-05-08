<!-- GSD:project-start source:PROJECT.md -->
## Project

**Signal-OSS**

A GitHub Action that triages incoming GitHub Issues for open-source maintainers. For every new issue, Signal-OSS computes an actionability score (0–10) and posts a repo-aware checklist of what's missing — repro steps, version, stack trace, minimal example — so maintainers don't have to type "can you share your version?" ever again. Built for OSS maintainers of repos in the 1k–50k-star range who drown in low-effort, value-void reports ("slop").

**Core Value:** **The hero output is a tailored missing-info checklist on every new issue.** If the score, the labeling, the dashboards, and every other feature fail, the comment with a useful checklist must still post — because that's what saves the maintainer time.

### Constraints

- **Time/Team**: Solo developer, 48-hour hackathon window — every feature must defend its place against the demo
- **Surface**: GitHub Action only for v1 — no CLI, no GitHub App, no web UI; all output lives in PR/issue comments and Action logs
- **LLM cost model**: Bring-your-own-key (no hosted backend); heuristics-first design keeps LLM calls to gray-zone cases only — must work plausibly with a single Anthropic/OpenAI API key under typical OSS issue volume
- **Voice & tone**: The auto-comment must read as helpful, not gatekeeping; tone is a quality dimension, not just polish
- **Benchmark scope risk**: 100–200 issues × 5 repos × LLM calls is the highest-risk feature for the time budget. Pre-approved fallback: cut to 50 issues × 3 repos if needed by hour 30
- **Public repo data only**: Benchmark uses historical public issues, no private data, no scraping that violates ToS
- **Demo plausibility**: Demo must run against real, recognizable OSS repos (not toy fixtures) — judges discount synthetic demos
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Executive Recommendation (TL;DR)
| Decision | Pick | Confidence |
|---|---|---|
| Action runtime | **JavaScript (Node 24) Action** built from `actions/typescript-action` template | HIGH |
| Language | **TypeScript 5.x** compiled + bundled to a single `dist/index.js` via `@vercel/ncc` | HIGH |
| Bundler | **`@vercel/ncc`** (the template default; one-file output, zero config) | HIGH |
| HTTP / GitHub API | **`@actions/github` 9.x** (wraps Octokit, pre-authenticated, GHES-aware) | HIGH |
| Inputs/outputs/logging | **`@actions/core` 3.x** | HIGH |
| LLM SDK | **`@anthropic-ai/sdk` 0.95.x** as primary; **`openai` 6.x** as a thin secondary adapter | HIGH |
| YAML parsing (issue forms) | **`yaml` 2.x** (eemeli/yaml) | HIGH |
| Markdown parsing (templates / CONTRIBUTING.md / issue body) | **`unified` 11 + `remark-parse` 11 + `mdast-util-to-string`** | HIGH |
| Schema validation (issue-form fields, LLM JSON output) | **`zod` 4.x** | HIGH |
| Benchmark harness | **Node script run with `tsx`** in the same repo (`scripts/benchmark.ts`) | HIGH |
| Test runner | **Vitest 3.x** (replace template's Jest) | HIGH |
| Lint + format | **Biome 2.x** (replace template's ESLint + Prettier) | MEDIUM |
| Local Action testing | **`@github/local-action`** | HIGH |
## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|---|---|---|---|
| Node.js | **24 LTS** | Action runtime | Per GitHub's Sep 2025 changelog: Node 20 hits EOL April 2026; setup-node bumped to Node 24; new actions should declare `using: 'node24'` in `action.yml`. Node 20 will require `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION=true` in mid-2026. Pick the future-proof default. |
| TypeScript | **5.6+** | Language | Required by `openai` SDK (>=4.9) and `zod` 4 (5.9 recommended). Strong types matter when parsing the GitHub issue payload, which is large and easy to mis-key. |
| `@actions/core` | **3.0.x** | Inputs, outputs, masking, logging, summary, annotations | Standard, ships with template. Use `core.summary` for a per-run report (handy for demo screencast). |
| `@actions/github` | **9.1.x** | Octokit client + workflow context (`context.payload.issue`, `context.repo`) | It pre-injects `GITHUB_TOKEN` and proxy/GHES settings. Saves writing 20 lines of Octokit auth code. |
| `@vercel/ncc` | **0.38.x** | Bundle TS + node_modules → single `dist/index.js` | Required for JS Actions (consumers can't run `npm install`). Template-default; no Webpack/Rollup config to babysit. |
| `@anthropic-ai/sdk` | **0.95.x** | Claude API for gray-zone classification | Anthropic is the better tool-use / structured-output model for classification rubrics in 2026; mature TS types; prompt-caching support cuts BYO-key cost meaningfully. Primary path. |
| `openai` | **6.36.x** | OpenAI fallback (BYOK with `OPENAI_API_KEY`) | Both keys are explicit project requirements. Use a thin adapter so the scorer doesn't care which provider is configured. |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `yaml` (eemeli) | **2.6.x** | Parse `.github/ISSUE_TEMPLATE/*.yml` (issue forms) | Use for issue forms — better TypeScript types, comment preservation, and faster than js-yaml. The form schema (`name`/`description`/`body[]`) is simple, so even simple `parse()` is fine. |
| `unified` + `remark-parse` + `remark-gfm` | **11.x / 11.x / 4.x** | AST parse of `.md` issue templates, CONTRIBUTING.md, and the issue body itself | Heuristics need to walk the AST: count fenced code blocks, find `## Steps to Reproduce` headings, detect tables, detect images. AST parsing is the reason heuristics will be reliable. |
| `mdast-util-to-string` | **4.x** | Flatten an mdast node to plain text | Pulls heading text out of an AST node without re-implementing it. |
| `zod` | **4.x** | Validate parsed issue-form YAML and LLM JSON output | Issue-form YAML is structured but user-authored — validate before walking it. LLM JSON outputs MUST be validated; zod 4 is 7-14x faster than v3 and has real JSON Schema export, which Anthropic's structured-output / OpenAI's `response_format: json_schema` consume directly. |
| `globby` | **14.x** | Glob `.github/ISSUE_TEMPLATE/*.{yml,yaml,md}` from local checkout | Cleaner than fs+regex. Tiny dep. |
| `p-limit` | **6.x** | Cap concurrency in benchmark harness (e.g., 5 concurrent LLM calls) | Benchmarks scrape 100–200 issues; without concurrency limits you'll hit Anthropic's per-minute quota and GitHub's 5000/hr REST budget. |
| `@octokit/plugin-throttling` | **9.x** | Auto-back-off on GitHub rate limits in benchmark harness | Critical: scraping 5 repos × 200 issues → 1000+ requests; without throttling you'll get 403s mid-run and lose progress. |
### Development Tools
| Tool | Purpose | Notes |
|---|---|---|
| **Vitest** 3.x | Unit + integration tests | Native TS, no ts-jest, watch mode is sub-second. Replaces the template's Jest. Critical for fast iteration in 48h. Mock `@actions/core` and `@actions/github` per-test. |
| **Biome** 2.x | Linter + formatter (single binary) | Replaces template's ESLint + Prettier. 10–25x faster, one config file (`biome.json`). For a 48h project, the second-saved on every CI run and every save matters. |
| **`tsx`** 4.x | Run benchmark scripts directly: `tsx scripts/benchmark.ts` | No ts-node config dance, no separate `tsconfig.bench.json`. Fastest path from "I have a script" to "I have a result". |
| **`@github/local-action`** | Run the Action locally with a fake event payload | Save an `event.json` (an `issues.opened` webhook payload) and run `npx @github/local-action run dist/index.js`. No need to push commits to test. |
| **`act`** (nektos/act) | Optional: full workflow simulation in Docker | Heavier than `local-action`. Use only if you need to test the workflow YAML itself, not the Action code. Skip for v1. |
| **GitHub Actions Toolkit `core.summary`** | Markdown report appended to the workflow run UI | Free demo material — use it to render the same checklist that's posted as a comment, so the screencast can show both surfaces. |
## Installation
# Bootstrap from template (do this, don't write from scratch)
# Core (already in template, but pin/upgrade)
# LLM
# Parsing
# Benchmark harness
# Replace template's Jest + ESLint + Prettier
# Bundler (template ships this — confirm)
## Rationale Per Layer
### (a) Action runtime / template — **Node 24 JavaScript Action from `actions/typescript-action`**
- **JavaScript Actions** start in <1s on the runner (no image pull) — critical for an issue-triage bot where every minute matters to the maintainer waiting on the comment. GitHub explicitly recommends them for "simple tasks" running on existing runner binaries (per Actions docs).
- **Docker Actions** have 10–30s cold-start from container pull, can't run on Windows/macOS runners (we don't need them, but the constraint signals friction), and require a Dockerfile to babysit. Reject for v1.
- **Composite Actions** are for stitching shell steps. We have logic (heuristics, LLM call, AST walks) — composite is the wrong primitive.
### (b) HTTP / Octokit usage — **`@actions/github` (not `@octokit/action` directly)**
### (c) LLM SDK — **`@anthropic-ai/sdk` primary, `openai` secondary, with a thin internal adapter**
- Better tool-use / structured-output adherence on classification rubrics in 2026 benchmarks
- Native prompt caching cuts cost ~10x when the system prompt (the rubric) is reused across issues — directly relevant to BYO-key cost concerns
- Sonnet 4.5 / Haiku 4.5 are both cheap enough at typical OSS issue volume
- The PROJECT.md explicitly lists both `OPENAI_API_KEY` and `ANTHROPIC_API_KEY`. Maintainers will plug in whatever they already have. Don't break their flow.
- Implement OpenAI via the same provider interface; the scorer code never branches on provider.
- Both providers accept JSON Schema for structured output. Convert your zod schema → JSON Schema with `z.toJSONSchema()` (zod 4 native, no `zod-to-json-schema` dep needed).
- Validate the response with the *same* zod schema. This double-binds the prompt and the parser, eliminating the "LLM returned ’maybe’ instead of one of the enum values" class of bug.
### (d) Markdown / YAML parsing
- Modern (YAML 1.2), better TS types, comment-preserving (useful for issue-form `# Required` comments)
- 2.x is pure-ES with default export; works clean with TS 5+ moduleResolution: bundler
- js-yaml still works fine; the gain is small but free
- Heuristics aren't "render to HTML" — they're "ask structural questions of the document": *Does the body have a fenced code block? Does it have a heading containing "reproduce"? Does it have ≥3 list items? Does it have an image?*
- That's the AST use-case. `unified`/`remark` give you mdast (mdast-util-to-string for text extraction, `unist-util-visit` for traversal).
- `markdown-it` is faster but renderer-based; you'd reach for the AST plugin and end up paying complexity tax for no gain.
- `marked` is for "render to HTML quickly" — wrong tool here.
### (e) Benchmark harness — **TypeScript Node script run via `tsx`, lives in same repo**
- **Same TS code** — the benchmark exercises the *exact* scorer the Action runs. A Python script would force a second implementation or shelling out, both of which introduce drift.
- **`tsx scripts/benchmark.ts`** runs the file with no compile step — no `tsconfig.bench.json`, no build target. Fastest path to results.
- **Vitest data-driven (`it.each`)** is a viable alternative *for the unit-style "given issue X, score is Y" check*, but the benchmark needs aggregate metrics (precision, recall, F1) and CSV output — that's a script, not a test suite. Use both: unit tests in `tests/`, harness in `scripts/`.
### (f) Testing approach for a GH Action — **Vitest with mocked toolkit**
- Native TS, no ts-jest setup
- 3-5x faster startup; matters when you run `vitest --watch` continuously during a hackathon
- Same `expect`/`describe`/`it` API as Jest — no learning curve
- Works with the Biome+Vitest toolchain in `int128/typescript-action` if you want a reference repo
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|---|---|---|
| Node 24 JS Action | Docker Action | If your scorer needed a Python ML model or a binary tool (e.g., `tree-sitter` CLI). We don't — pure JS path. |
| `actions/typescript-action` template | `int128/typescript-action` template (Biome + Vitest pre-wired) | If you'd rather not do the Jest→Vitest swap. Trade-off: less battle-tested, but saves ~30min of refactor. **Acceptable alternative.** |
| `@actions/github` | `@octokit/action` + `@octokit/plugin-*` | If you outgrow the wrapper (custom auth, advanced retries) — not in v1. |
| `@anthropic-ai/sdk` direct | Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) | If you need streaming UI (we don't — Action runs headless). |
| `unified`/`remark-parse` | `markdown-it` | If you only need to *render* markdown to HTML (we don't — we read structure). |
| `yaml` (eemeli) | `js-yaml` | If you're matching an existing project's choice. Performance/feature parity is fine for our small files. |
| Vitest | Jest | If a dependency requires Jest's specific module-mocking semantics. None of ours do. |
| Biome | ESLint + Prettier | If you want a specific ESLint plugin (e.g., `eslint-plugin-github`'s recommended preset for Actions). Mild gain; cost is config sprawl. |
| `tsx` script + Vitest unit tests | All-in-one Vitest data-driven benchmark | If your "benchmark" is just "given input, expect output" pairs (no aggregate metrics). Ours computes precision/recall — needs a script. |
## What NOT to Use
| Avoid | Why | Use Instead |
|---|---|---|
| **Node 16 / Node 18 Actions** | EOL; deprecated by GitHub; new Actions can't be published with `using: 'node16'`. | `using: 'node24'`. |
| **Node 20 Actions for new projects in mid-2026** | Becoming default-blocked; requires `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION` env var. | Node 24. |
| **Docker container Action for this project** | 10–30s cold start; container pull on every run; users hate slow Actions on issue events. | Node 24 JS Action. |
| **`actions/setup-node@v3` / `@v2`** | Old; doesn't know about Node 24. | `actions/setup-node@v4` (or v5 if available). |
| **`@octokit/rest` standalone** (without `@actions/github`) | You'd reimplement auth + GHES + proxy handling. | `@actions/github` for the Action; standalone Octokit only for the benchmark script. |
| **`request` / `node-fetch` / `axios` for GitHub API** | Reinvents Octokit; loses typed responses, pagination helpers, throttling plugin. | Octokit (via `@actions/github`). |
| **`langchain` / `llamaindex`** | Massive deps, abstraction tax, not suited for a single classification call. | Direct provider SDK + zod schema. |
| **Vercel AI SDK (`ai`) for our use** | Designed for streaming chat UIs in Next.js; over-abstracts a single classify call. | `@anthropic-ai/sdk` directly. |
| **`zod-to-json-schema` package** | Redundant in zod 4 — use `z.toJSONSchema()` natively. | zod 4's built-in. |
| **`yargs` / `commander`** | We don't have a CLI in v1. The Action takes inputs via `with:` (handled by `@actions/core`). The benchmark script can use plain `process.argv` or `node:util.parseArgs` (Node 24 stdlib). | Skip CLI parsing libs. |
| **`markdown-it` + AST plugin** | You're paying for the renderer you don't use. | `unified` + `remark-parse`. |
| **`marked`** | Renderer-only; no AST walk path. | `unified` + `remark-parse`. |
| **`js-yaml` for new code in 2026** | Not bad — just slightly older API and types lag. | `yaml` (eemeli/yaml) v2. |
| **Jest 29 / ts-jest** for a new TS Action | Slower start, ts-jest config friction, ESM headaches. | Vitest 3. |
| **`act` (nektos/act) for v1 testing** | Heavyweight (Docker), overlaps with `@github/local-action` for our use case. | `@github/local-action`. |
| **`probot`** | Probot is the GitHub *App* framework, not the Action framework. Wrong surface — using Probot would force a hosted backend, which violates the "no hosted backend" constraint. | `@actions/core` + `@actions/github` (the Action toolkit). |
| **A JS-only `package.json` (no TS)** | Lose compile-time issue-payload typing; hard to refactor in a 48h sprint when the schema bites. | TypeScript. |
| **Ground-truth labeling via LLM-only** | Self-fulfilling prophecy on the benchmark; LLM judges its own output. | Manually label benchmark fixtures (ground-truth = "closed-as-invalid / locked / `needs-info` label without further activity" per PROJECT.md). |
## Stack Patterns by Variant
- Skip dynamic `import()` in the bundled action. ncc handles all deps; static imports keep `dist/index.js` warm.
- Avoid heavy tree-shake-resistant deps. `unified`+`remark-parse`+`remark-gfm` is ~150KB bundled — fine. `langchain` would be 5MB+ — avoid.
- Switch primary to Anthropic's Haiku 4.5 (or the cheapest current tier) and use prompt caching on the rubric system prompt.
- Tighten the gray-zone band (e.g., score 4–6 only goes to LLM, not 3–7) to drop call volume.
- Pre-approved fallback in PROJECT.md: 50 issues × 3 repos. The harness should accept `--repos` and `--limit` flags so we can dial it down without code changes.
- Pre-bake fixture issues for the demo repo. Show the Action running on `issues.opened` for a fixture issue, not a freshly-typed one.
## Version Compatibility
| Package | Compatible With | Notes |
|---|---|---|
| `@actions/core` 3.x | Node 20+ | Node 24 fully supported |
| `@actions/github` 9.x | `@actions/core` 3.x, Node 20+ | Wraps `@octokit/rest` v20+ |
| `@anthropic-ai/sdk` 0.95.x | Node 18+, TS 4.9+ | Use prompt caching via `cache_control: { type: 'ephemeral' }` on system block |
| `openai` 6.x | Node 20+, TS 4.9+ | Use `client.responses.create({ response_format: { type: 'json_schema', ... } })` |
| `zod` 4.x | TS 5.5+ recommended (5.9 ideal) | Native `z.toJSONSchema()` — no extra dep |
| `unified` 11 + `remark-parse` 11 + `remark-gfm` 4 | ESM only | If `tsconfig` is CommonJS, set `"module": "node16"` or `"nodenext"` and use TS 5+ |
| Vitest 3 | Node 18+, TS 5+ | Native ESM; works with ncc-bundled output for integration tests |
| Biome 2 | Node 18+ | Single binary; no peer deps |
| `@vercel/ncc` 0.38 | Node 18+ | Caveat: emits CJS by default — fine for `using: 'node24'`. For ESM-only deps (unified/remark), ncc handles transpile transparently. |
| `tsx` 4 | Node 18.19+ | Loader-based; no separate config |
## Open Questions (for downstream phases)
## Sources
- [actions/typescript-action template](https://github.com/actions/typescript-action) — official template, Jest+ESLint+Prettier+ncc, Rollup mention applies to alt template (this one uses ncc) — HIGH
- [int128/typescript-action template](https://github.com/int128/typescript-action) — Biome + Vitest reference template — HIGH
- [GitHub Changelog: Deprecation of Node 20 on GitHub Actions runners (2025-09-19)](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/) — runtime version policy — HIGH
- [GitHub Actions: Early February 2026 updates](https://github.blog/changelog/2026-02-05-github-actions-early-february-2026-updates/) — current state of toolkit — HIGH
- [About custom actions — GitHub Docs](https://docs.github.com/en/actions/sharing-automations/creating-actions/about-custom-actions) — JS vs Docker vs Composite trade-offs — HIGH
- [@actions/core — npm](https://www.npmjs.com/package/@actions/core) — version 3.0.1 — HIGH
- [@actions/github — npm](https://www.npmjs.com/package/@actions/github) — version 9.1.0 — HIGH
- [actions/toolkit#334 — deprecate @actions/github?](https://github.com/actions/toolkit/issues/334) — confirms `@actions/github` is here to stay — MEDIUM
- [@anthropic-ai/sdk — npm](https://www.npmjs.com/package/@anthropic-ai/sdk) — version 0.95.1 — HIGH
- [openai — npm](https://www.npmjs.com/package/openai) — version 6.36.0 — HIGH
- [vercel/ncc](https://github.com/vercel/ncc) — bundler usage and TS support — HIGH
- [Syntax for GitHub's form schema — GitHub Docs](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-githubs-form-schema) — issue-form YAML structure — HIGH
- [eemeli/yaml](https://github.com/eemeli/yaml) — recommended YAML parser — HIGH
- [npm-compare: marked vs unified vs remark vs markdown-it](https://npm-compare.com/markdown-it,marked,remark,remark-parse,unified) — parser comparison — MEDIUM
- [Zod v4 release notes](https://zod.dev/v4) — performance + native JSON Schema — HIGH
- [Vitest vs Jest 2026 — Sitepoint](https://www.sitepoint.com/vitest-vs-jest-2026-migration-benchmark/) — migration data — MEDIUM
- [Biome v2 release](https://biomejs.dev/blog/biome-v2/) — linter + formatter — MEDIUM
- [tsx documentation](https://tsx.is/) — TypeScript script runner — HIGH
- [@octokit/plugin-throttling](https://www.npmjs.com/package/@octokit/plugin-throttling) — rate-limit handling for benchmark — HIGH
- [@github/local-action](https://github.com/github/local-action) — local Action testing — HIGH
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
