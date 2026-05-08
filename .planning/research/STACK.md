# Stack Research — Signal-OSS

**Domain:** GitHub Action — issue triage bot (Node.js / TypeScript)
**Researched:** 2026-05-08
**Lens:** Solo developer, 48-hour hackathon (Slop Scan 2026), heuristics-first + LLM-on-gray-zone, BYO-key
**Overall confidence:** HIGH

---

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

> Bottom line: clone `actions/typescript-action`, swap Jest→Vitest and ESLint+Prettier→Biome, then layer the libraries above. Everything else (build, bundling, release, CodeQL) ships in the template — do not reinvent it during the hackathon.

---

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

---

## Installation

```bash
# Bootstrap from template (do this, don't write from scratch)
gh repo create signal-oss --template actions/typescript-action --public --clone
cd signal-oss

# Core (already in template, but pin/upgrade)
npm i @actions/core@^3 @actions/github@^9

# LLM
npm i @anthropic-ai/sdk@^0.95 openai@^6

# Parsing
npm i yaml@^2 unified@^11 remark-parse@^11 remark-gfm@^4 mdast-util-to-string@^4 globby@^14 zod@^4

# Benchmark harness
npm i -D tsx@^4 p-limit@^6 @octokit/plugin-throttling@^9

# Replace template's Jest + ESLint + Prettier
npm uninstall jest ts-jest @types/jest eslint prettier eslint-plugin-jest @typescript-eslint/eslint-plugin @typescript-eslint/parser
npm i -D vitest@^3 @vitest/coverage-v8 @biomejs/biome@^2 @github/local-action

# Bundler (template ships this — confirm)
npm i -D @vercel/ncc@^0.38
```

Then in `action.yml`:

```yaml
runs:
  using: 'node24'
  main: 'dist/index.js'
```

---

## Rationale Per Layer

### (a) Action runtime / template — **Node 24 JavaScript Action from `actions/typescript-action`**

**Why JavaScript over Docker over Composite:**
- **JavaScript Actions** start in <1s on the runner (no image pull) — critical for an issue-triage bot where every minute matters to the maintainer waiting on the comment. GitHub explicitly recommends them for "simple tasks" running on existing runner binaries (per Actions docs).
- **Docker Actions** have 10–30s cold-start from container pull, can't run on Windows/macOS runners (we don't need them, but the constraint signals friction), and require a Dockerfile to babysit. Reject for v1.
- **Composite Actions** are for stitching shell steps. We have logic (heuristics, LLM call, AST walks) — composite is the wrong primitive.

**Why the template:** The official `actions/typescript-action` template ships with: `action.yml`, ncc bundling, GitHub workflow for build/test/release, version-tagging guidance, CodeQL, license tracking. Each of those is 30–60min of yak-shaving you'd otherwise lose.

**Why Node 24 over Node 20:** Per GitHub's Sep 2025 changelog and the Apr 2026 Node 20 EOL, new Actions should declare `using: 'node24'`. Submitting a hackathon project in May 2026 with a deprecated runtime is a self-inflicted demerit. Node 24 is fully supported; the only reason to pick 20 would be if a dep didn't support 24 — none of ours have that issue.

**Why TypeScript over plain JavaScript:** GitHub issue payloads are deeply nested and easy to mis-key (`issue.user.login` vs `sender.login` etc.). TS catches this at compile time. The template handles tsconfig + ncc transpile already.

### (b) HTTP / Octokit usage — **`@actions/github` (not `@octokit/action` directly)**

`@actions/github` is a thin convenience wrapper over `@octokit/rest` that pre-fills auth from `GITHUB_TOKEN`, sets the GHES base URL, respects proxy env vars, and exposes `github.context` (the parsed webhook payload). For a v1 issues-triage Action, we use ~5 endpoints:

```
context.payload.issue        // the new issue
octokit.rest.issues.createComment
octokit.rest.issues.addLabels
octokit.rest.repos.getContent  // CONTRIBUTING.md, .github/ISSUE_TEMPLATE/*
octokit.rest.issues.listForRepo // benchmark harness only
```

`@octokit/action` is the "newer" plugin-architecture client, but its only advantage is plugin extensibility, which we don't need. Stick with `@actions/github`. (Note the deprecation discussion at actions/toolkit#334 has been open for years with no action — `@actions/github` is the de-facto standard and isn't going anywhere.)

For the benchmark harness only, layer `@octokit/plugin-throttling` onto a fresh Octokit instance (use a PAT, not `GITHUB_TOKEN`, to avoid hitting the same 5000/hr budget the runtime Action uses). This is a separate process — no action.yml impact.

### (c) LLM SDK — **`@anthropic-ai/sdk` primary, `openai` secondary, with a thin internal adapter**

```ts
// src/llm/provider.ts
export interface LLMProvider {
  classifyGrayZone(input: GrayZoneInput): Promise<GrayZoneVerdict>;
}

// src/llm/anthropic.ts — uses @anthropic-ai/sdk Messages API + tool_use for structured output
// src/llm/openai.ts    — uses openai responses API + response_format: { type: 'json_schema', schema: zodToJsonSchema(...) }
```

**Why Anthropic primary:**
- Better tool-use / structured-output adherence on classification rubrics in 2026 benchmarks
- Native prompt caching cuts cost ~10x when the system prompt (the rubric) is reused across issues — directly relevant to BYO-key cost concerns
- Sonnet 4.5 / Haiku 4.5 are both cheap enough at typical OSS issue volume

**Why OpenAI as a real (not token) secondary:**
- The PROJECT.md explicitly lists both `OPENAI_API_KEY` and `ANTHROPIC_API_KEY`. Maintainers will plug in whatever they already have. Don't break their flow.
- Implement OpenAI via the same provider interface; the scorer code never branches on provider.

**Why use `zod` schemas for LLM output:**
- Both providers accept JSON Schema for structured output. Convert your zod schema → JSON Schema with `z.toJSONSchema()` (zod 4 native, no `zod-to-json-schema` dep needed).
- Validate the response with the *same* zod schema. This double-binds the prompt and the parser, eliminating the "LLM returned ’maybe’ instead of one of the enum values" class of bug.

**Anti-recommendation: do NOT use Vercel AI SDK (`ai` / `@ai-sdk/anthropic`).** It's great for streaming chat UIs but adds 2-3 layers of abstraction (model registries, providers, tools) that buy nothing in a one-shot classification call. Direct SDKs are simpler and more debuggable.

### (d) Markdown / YAML parsing

**YAML — `yaml` (eemeli/yaml) over js-yaml:**
- Modern (YAML 1.2), better TS types, comment-preserving (useful for issue-form `# Required` comments)
- 2.x is pure-ES with default export; works clean with TS 5+ moduleResolution: bundler
- js-yaml still works fine; the gain is small but free

**Markdown — `unified` + `remark-parse` over `markdown-it` or `marked`:**
- Heuristics aren't "render to HTML" — they're "ask structural questions of the document": *Does the body have a fenced code block? Does it have a heading containing "reproduce"? Does it have ≥3 list items? Does it have an image?*
- That's the AST use-case. `unified`/`remark` give you mdast (mdast-util-to-string for text extraction, `unist-util-visit` for traversal).
- `markdown-it` is faster but renderer-based; you'd reach for the AST plugin and end up paying complexity tax for no gain.
- `marked` is for "render to HTML quickly" — wrong tool here.

**Concrete flow:**
```ts
// 1. Parse issue body to mdast
const tree = unified().use(remarkParse).use(remarkGfm).parse(issue.body);
// 2. Walk for signal features
visit(tree, 'code', () => signals.hasCodeBlock = true);
visit(tree, 'heading', (n) => {
  const text = toString(n).toLowerCase();
  if (/reproduc|steps?\s+to/.test(text)) signals.hasRepro = true;
});
// 3. Score
```

### (e) Benchmark harness — **TypeScript Node script run via `tsx`, lives in same repo**

```
scripts/
  benchmark.ts          # entry: scrape + score + compute precision/recall
  fixtures/             # cached JSON of fetched issues (for reruns w/o GitHub API)
  ground-truth.csv      # issue URL, ground-truth label, notes
results/
  2026-05-09-run-1.json # scored output
```

**Why a Node/TS script in the same repo, not Python or a separate package:**
- **Same TS code** — the benchmark exercises the *exact* scorer the Action runs. A Python script would force a second implementation or shelling out, both of which introduce drift.
- **`tsx scripts/benchmark.ts`** runs the file with no compile step — no `tsconfig.bench.json`, no build target. Fastest path to results.
- **Vitest data-driven (`it.each`)** is a viable alternative *for the unit-style "given issue X, score is Y" check*, but the benchmark needs aggregate metrics (precision, recall, F1) and CSV output — that's a script, not a test suite. Use both: unit tests in `tests/`, harness in `scripts/`.

**Harness design:**
1. Read `ground-truth.csv` (manually labeled: actionable / needs-info / spam).
2. For each row: cache-or-fetch the issue JSON from GitHub via Octokit + throttling plugin.
3. Run scorer (heuristics + LLM if gray-zone). Use `p-limit(5)` to cap concurrency.
4. Write predictions to JSON; compute confusion matrix; print precision/recall/F1.
5. Diff against previous run for regression detection.

**Cache fetched issues to disk** so re-runs don't burn API budget — this is the single most important detail in the harness for a 48h sprint.

### (f) Testing approach for a GH Action — **Vitest with mocked toolkit**

**Three test layers:**

1. **Unit tests (Vitest, mocked toolkit)** — one test file per heuristic + scorer module. Mock `@actions/core` (`vi.mock('@actions/core')`) and `@actions/github` to feed deterministic payloads. Fast (<1s), 80% of coverage.
2. **Local-Action integration test** — one e2e: `@github/local-action run dist/index.js` against a saved `event.json` that mimics `issues.opened`. Verifies the bundled action.yml + dist/index.js wiring works. Run as a CI step.
3. **Benchmark = behavioral regression test** — the benchmark script's precision/recall is itself a test ("if recall on the cached set drops below 0.7, fail CI"). Catches model drift if you tune prompts.

**Why Vitest over Jest:**
- Native TS, no ts-jest setup
- 3-5x faster startup; matters when you run `vitest --watch` continuously during a hackathon
- Same `expect`/`describe`/`it` API as Jest — no learning curve
- Works with the Biome+Vitest toolchain in `int128/typescript-action` if you want a reference repo

**Skip:** Don't try to unit-test the LLM call itself — mock it. Test the scorer logic given a fake LLM response. The benchmark covers real-LLM behavior.

---

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

---

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

---

## Stack Patterns by Variant

**If we want fastest possible cold start:**
- Skip dynamic `import()` in the bundled action. ncc handles all deps; static imports keep `dist/index.js` warm.
- Avoid heavy tree-shake-resistant deps. `unified`+`remark-parse`+`remark-gfm` is ~150KB bundled — fine. `langchain` would be 5MB+ — avoid.

**If LLM cost becomes a concern:**
- Switch primary to Anthropic's Haiku 4.5 (or the cheapest current tier) and use prompt caching on the rubric system prompt.
- Tighten the gray-zone band (e.g., score 4–6 only goes to LLM, not 3–7) to drop call volume.

**If benchmark scope blows up:**
- Pre-approved fallback in PROJECT.md: 50 issues × 3 repos. The harness should accept `--repos` and `--limit` flags so we can dial it down without code changes.

**If the demo screencast has slow Action runs:**
- Pre-bake fixture issues for the demo repo. Show the Action running on `issues.opened` for a fixture issue, not a freshly-typed one.

---

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

**Watch out for:** `unified`/`remark` ecosystem is **ESM-only** (no CJS export since v10). With `@vercel/ncc` this is fine — ncc bundles everything to one file regardless of module type. But if you ever try to `require('unified')` from a non-bundled script, it'll fail. Use `import` everywhere; run benchmark scripts via `tsx`.

---

## Open Questions (for downstream phases)

1. **Which Anthropic model tier?** Sonnet 4.5 vs Haiku 4.5 — depends on benchmark precision/recall trade-off. Decide in the LLM-integration phase after one round of benchmark.
2. **GHES support — in or out?** `@actions/github` supports it for free, but our benchmark fixtures are github.com only. Default: support GHES (no extra work), don't test it.
3. **Issue body length cap before LLM?** Long issues (e.g., 50KB stack traces) explode token cost. Likely cap at 8KB and truncate with marker. Decide in scorer phase.
4. **Comment idempotency strategy.** If the workflow re-runs (manual re-run, edited issue), do we update the existing Signal-OSS comment or post a new one? Recommended: mark our comment with an HTML-comment sentinel `<!-- signal-oss:v1 -->` and update-in-place via `octokit.rest.issues.updateComment`. Defer to comment-rendering phase.
5. **Dotenv for benchmark script?** Yes — local benchmark needs `ANTHROPIC_API_KEY` from `.env`. Add `dotenv` or use Node 20.6+ native `--env-file=.env`. Trivial; defer.

---

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

---

*Stack research for: GitHub Action — issue-triage bot (Signal-OSS, Slop Scan 2026)*
*Researched: 2026-05-08*
