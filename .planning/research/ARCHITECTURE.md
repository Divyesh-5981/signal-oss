# Architecture Research

**Domain:** GitHub Action — Issue triage classifier with LLM gray-zone scoring + offline benchmark harness
**Researched:** 2026-05-08
**Confidence:** HIGH (component decomposition is dictated by the locked PROJECT.md decisions; only sub-internals are inference)

---

## TL;DR for the Roadmap

- **Single shared CORE library** (`src/core/`) is called by both the Action runtime and the benchmark harness. The Action wraps CORE with GitHub I/O. The benchmark wraps CORE with file I/O. **They MUST call the same `score()` entrypoint** — this is the accuracy story.
- **Pure functions everywhere except three side-effect zones**: GitHub API client, LLM client, filesystem. All three are injected into CORE via interfaces so CORE stays unit-testable with zero network.
- **Build order is heuristics-first by design**: every layer except the LLM scorer can be built, tested, and benchmarked standalone. LLM is the LAST component wired in. The benchmark works on day 1 against pure heuristics; LLM lifts the gray-zone numbers on day 2.
- **The 4-tier checklist fallback is a Strategy chain**, not a switch — each tier is a class with the same interface, tried in order. Adding a tier later (e.g., README parsing) is a drop-in.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ENTRY SURFACES                               │
├──────────────────────────────────┬──────────────────────────────────┤
│  Action Runtime (action.yml)     │  Benchmark Harness (CLI)         │
│  - reads GH event payload         │  - reads issues.jsonl fixture    │
│  - writes comment + label         │  - writes report.md + scores.csv │
└────────────────┬─────────────────┴────────────────┬─────────────────┘
                 │                                   │
                 │      both call the same:          │
                 ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CORE LIBRARY (pure, no I/O)                       │
│                                                                      │
│   score(issue, repoContext) → ScoredIssue                            │
│                                                                      │
│   ┌────────────────┐   ┌──────────────────┐   ┌───────────────────┐ │
│   │  Heuristics    │──▶│  IssueType       │──▶│  Checklist        │ │
│   │  Extractor     │   │  Classifier      │   │  Generator        │ │
│   │  (signals)     │   │  (bug/feat/q)    │   │  (4-tier strategy)│ │
│   └────────────────┘   └──────────────────┘   └─────────┬─────────┘ │
│            │                    │                        │           │
│            └────────────────────┴────────────────────────┘           │
│                                 │                                    │
│                                 ▼                                    │
│                       ┌──────────────────┐                          │
│                       │  Score Computer  │   gray zone? ──┐         │
│                       │  (heuristic)     │                │         │
│                       └────────┬─────────┘                │         │
│                                │                          ▼         │
│                                │            ┌──────────────────┐    │
│                                │            │  LLM Adjudicator │    │
│                                │            │  (port; injected)│    │
│                                │            └────────┬─────────┘    │
│                                │                     │              │
│                                ▼                     ▼              │
│                       ┌──────────────────────────────────────┐      │
│                       │   ScoredIssue (DTO, serializable)    │      │
│                       └──────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────┘
                 │                                   │
                 ▼                                   ▼
┌──────────────────────────────────┐  ┌──────────────────────────────┐
│     Output Formatter             │  │    Benchmark Aggregator       │
│  - markdown comment              │  │  - precision / recall / F1    │
│  - label list                    │  │  - confusion matrix           │
│  - score badge                   │  │  - per-repo breakdown         │
└──────────────────────────────────┘  └──────────────────────────────┘
                 │                                   │
                 ▼                                   ▼
┌──────────────────────────────────┐  ┌──────────────────────────────┐
│    GitHub I/O Adapter (Octokit)  │  │  Filesystem I/O Adapter      │
│  - postComment, addLabel         │  │  - read fixtures, write csv  │
└──────────────────────────────────┘  └──────────────────────────────┘
```

**Key invariant:** the boxed `CORE LIBRARY` has zero `import` of `@octokit/*`, `fs`, `https`, or any LLM SDK. All side-effecting capabilities arrive as injected ports (interfaces). This is the property that lets the benchmark replay 200 issues offline against the same logic that runs in production.

---

## Component Catalog

| # | Component | Path | Purity | Owns | Inputs | Outputs |
|---|-----------|------|--------|------|--------|---------|
| 1 | **Action Entry** | `src/action/main.ts` | side-effecting | GH event parsing, orchestration | `GITHUB_EVENT_PATH`, env, secrets | comment + label via Octokit |
| 2 | **Heuristics Extractor** | `src/core/heuristics/` | **pure** | Regex/structural signal detection | `issue.title`, `issue.body` | `Signals` DTO (booleans + spans) |
| 3 | **IssueType Classifier** | `src/core/classifier/` | **pure** | bug vs feature vs question | `Signals`, `issue.labels`, `title` | `IssueType` enum + confidence |
| 4 | **Repo Context Loader** | `src/core/repo-context/` | side-effecting (fs/api) | Discovers templates, CONTRIBUTING.md | repo root path OR Octokit handle | `RepoContext` DTO |
| 5 | **Checklist Generator** | `src/core/checklist/` | **pure** | 4-tier fallback chain → checklist items | `Signals`, `IssueType`, `RepoContext` | `ChecklistItem[]` + `tierUsed` |
| 6 | **Score Computer** | `src/core/score/` | **pure** | Combines signal weights → 0–10 score, flags gray-zone | `Signals`, `IssueType`, `ChecklistItem[]` | `{score, isGrayZone, reasoning}` |
| 7 | **LLM Adjudicator (port)** | `src/core/llm/port.ts` | **interface** | Contract for gray-zone resolution | `LLMRequest` DTO | `LLMVerdict` DTO |
| 7a | **LLM Adapter (Anthropic/OpenAI)** | `src/adapters/llm/` | side-effecting | HTTP to LLM provider | `LLMRequest` | `LLMVerdict` |
| 8 | **Output Formatter** | `src/core/format/` | **pure** | Markdown comment + label list + meta-nudge | `ScoredIssue`, `tierUsed` | `{markdown, labels[]}` |
| 9 | **GitHub I/O Adapter** | `src/adapters/github/` | side-effecting | postComment, addLabel, fetch repo files | Octokit handle, repo coords | void (effects) |
| 10 | **Benchmark Harness** | `src/bench/` | side-effecting | Replays fixture issues through CORE | `fixtures/*.jsonl`, ground-truth csv | `report.md`, `scores.csv` |
| 11 | **Fixture Scraper** | `src/bench/scrape.ts` | side-effecting | One-shot: fetch historical issues | repo list, GH token | `fixtures/<repo>.jsonl` |

### Component Boundaries — What Talks to What

```
Action Entry ──▶ Repo Context Loader (with Octokit)
            ──▶ score() in CORE
            ──▶ Output Formatter (in CORE)
            ──▶ GitHub I/O Adapter (post comment, label)

Benchmark   ──▶ Fixture Loader (fs)
            ──▶ Repo Context Loader (with fs adapter, not Octokit)
            ──▶ score() in CORE
            ──▶ Aggregator (P/R math, also pure)

CORE        ──▶ never imports adapters
            ──▶ accepts ports as constructor args / function params
            ──▶ never reads env vars or filesystem directly
```

This is a **hexagonal / ports-and-adapters** layout. Necessary because the same scoring logic runs in two radically different I/O environments.

---

## Data Flow

### Production Flow (Action runtime)

```
GitHub webhook: issues.opened
        │
        ▼
┌─────────────────────────────┐
│ action/main.ts              │
│  - parse $GITHUB_EVENT_PATH │
│  - extract { repo, issue }  │
└──────────────┬──────────────┘
               │
               ▼   (one-time per run, cached on disk for re-runs)
┌─────────────────────────────┐
│ RepoContextLoader           │
│  Octokit.getContent()       │
│  for: .github/ISSUE_TEMPLATE/│
│       CONTRIBUTING.md        │
└──────────────┬──────────────┘
               │ RepoContext { templates, contributing, hasNothing }
               ▼
┌─────────────────────────────┐
│ score(issue, repoContext)   │  ← CORE entrypoint
│   1. extractSignals(issue)  │
│   2. classifyType(signals)  │
│   3. generateChecklist(...) │  ← 4-tier strategy chain
│   4. computeScore(...)      │
│   5. if grayZone:           │
│        adjudicate via LLM   │
│   6. return ScoredIssue     │
└──────────────┬──────────────┘
               │ ScoredIssue { score, items, type, tier, reasoning }
               ▼
┌─────────────────────────────┐
│ format(scoredIssue)         │
│  → markdown comment string  │
│  → labels: ['needs-info']   │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ GitHub I/O Adapter          │
│  postComment + addLabel     │
└─────────────────────────────┘
```

**Every arrow carries a serializable DTO.** No hidden state, no shared mutables. This is what makes `score()` callable from both surfaces.

### Benchmark Flow (offline)

```
fixtures/<repo>.jsonl  +  ground-truth/<repo>.csv
        │                          │
        ▼                          │
┌────────────────────┐             │
│ FixtureLoader      │             │
└────────┬───────────┘             │
         │ Issue[]                 │
         ▼                         │
┌────────────────────┐             │
│ RepoContextLoader  │             │
│ (fs adapter)       │             │
└────────┬───────────┘             │
         │                         │
         ▼                         │
┌────────────────────────────────┐ │
│ for each issue:                │ │
│   ScoredIssue = score(...)     │ │
│   (LLM adapter optional —      │ │
│    can run pure-heuristics)    │ │
└────────┬───────────────────────┘ │
         │ predictions             │
         └──────────┬──────────────┘
                    ▼
            ┌───────────────┐
            │ Aggregator    │
            │  (pure)       │
            │  P / R / F1   │
            │  per-repo + overall
            └───────┬───────┘
                    ▼
            report.md + scores.csv
```

### Checklist Strategy Chain (component 5 internals)

```
generateChecklist(signals, type, repoContext):

  ┌────────────────────────────┐
  │ Tier 1: IssueFormStrategy  │  if repoContext.hasIssueForms
  │   parse .yml `required: T` │
  └──────────┬─────────────────┘
             │ no
             ▼
  ┌────────────────────────────┐
  │ Tier 2: TemplateMdStrategy │  if repoContext.hasMdTemplates
  │   parse `## Headers`       │
  └──────────┬─────────────────┘
             │ no
             ▼
  ┌────────────────────────────┐
  │ Tier 3: ContributingStrat  │  if repoContext.hasContributing
  │   LLM extract expectations │  (cached per-repo to control cost)
  └──────────┬─────────────────┘
             │ no
             ▼
  ┌────────────────────────────┐
  │ Tier 4: BaselineStrategy   │  always succeeds
  │   universal by issue type  │
  └────────────────────────────┘

  Each strategy implements: { applies(): bool, generate(): ChecklistItem[] }
  Returned items are filtered by signals (don't ask for what's already there).
```

The chain is constructed once at startup; adding/removing tiers is editing one array.

---

## Build Order — 48-Hour Solo Plan

The order is dictated by **dependency depth + risk-front-loading + demo-readiness at every checkpoint**. After each phase, the project is demoable in some form.

### Phase 0 — Skeleton & DTOs (Hours 0–3)

1. Repo init, TS strict, vitest, ESLint
2. Define **all DTOs** in `src/core/types.ts` first: `Issue`, `Signals`, `IssueType`, `RepoContext`, `ChecklistItem`, `ScoredIssue`, `LLMRequest`, `LLMVerdict`
3. Define LLM port interface in `src/core/llm/port.ts`
4. Stub `score()` returning hardcoded ScoredIssue — proves the wiring

**Why first:** types lock interfaces between components. Everything else can be built in parallel against stable contracts. Solo dev avoids re-typing.

**Demoable?** Not yet.

### Phase 1 — Heuristics Extractor (Hours 3–7) — pure, testable

Build first because: zero dependencies, fully unit-testable, the spine of accuracy.

- Detectors: code-fenced blocks, stack-trace patterns, version mentions (`v?\d+\.\d+`), repro keywords ("steps to reproduce", "expected", "actual"), URL count, body length
- Test against 20 hand-picked real issue bodies (copy from popular repos) → known-good ground truth

**Demoable?** Yes — `signal-oss extract --body "..."` prints signals JSON.

### Phase 2 — IssueType Classifier (Hours 7–9) — pure

- Title regex patterns ("how do I", "feature request", "[BUG]")
- Existing label inference (any label matching `bug|feature|question|enhancement`)
- Body signal weighting (stack trace → bug; "would be nice" → feature)

**Demoable?** Yes — full classification offline.

### Phase 3 — Checklist Generator + Tier 4 baseline (Hours 9–13) — pure

- Implement Strategy interface
- **Tier 4 (baseline) FIRST** — one universal map of `IssueType → ChecklistItem[]`, filtered by missing signals
- Skip tiers 1–3 for now; chain returns Tier 4 always

**Demoable?** Yes — given an issue body, get a real checklist. **This alone is 60% of the demo's value.**

### Phase 4 — Heuristic Score + Output Formatter (Hours 13–16) — pure

- Score formula: weighted sum of signal presence + checklist length penalty (clamped 0–10)
- Gray-zone band: 4 ≤ score ≤ 6 (TUNE LATER from benchmark)
- Markdown formatter with score badge + checklist + meta-nudge stub

**Demoable?** Yes — `score()` end-to-end returns a polished comment string.

### Phase 5 — GitHub I/O Adapter + Action Wiring (Hours 16–22)

- `@actions/core`, `@actions/github`, `@octokit/rest`
- `action.yml` manifest
- Dist bundling with `@vercel/ncc`
- **Test against a personal sandbox repo** with a hand-fired test issue

**Demoable?** **Critical milestone — Action posts a real comment on a real issue.** This is the headline demo. If everything after this fails, we still have a shippable product.

### Phase 6 — Repo Context Loader + Tiers 1 & 2 (Hours 22–28)

- Octokit.getContent() for `.github/ISSUE_TEMPLATE/`
- YAML frontmatter parser for issue forms (`required: true` fields)
- Markdown header parser for .md templates
- Filesystem adapter version (for benchmark)

**Demoable?** Yes — checklist is now repo-aware. Innovation pillar earned.

### Phase 7 — Benchmark Harness (heuristics-only) (Hours 28–34)

- **Scrape script** runs ONCE: paginate `GET /repos/{repo}/issues?state=closed` for 3–5 repos, save jsonl
- Ground truth: `closed && (label includes 'invalid'|'needs-info' OR closed-without-resolution)`
- Replay loop calls same `score()` with **null LLM port** (pure heuristics)
- Aggregator computes precision/recall, writes `report.md`

**Demoable?** Yes — **a real number defends the Accuracy pillar.** Even without LLM, this is the differentiator.

### Phase 8 — LLM Adjudicator (Hours 34–40)

- Anthropic adapter (one provider; OpenAI is bonus)
- Single prompt: "Given this issue and these heuristic signals, is it actionable? Score 0-10, reason in one sentence."
- Inject repo context (CONTRIBUTING.md excerpt) into prompt
- Re-run benchmark **with LLM** → expect lift on gray-zone band
- **Implement Tier 3** (CONTRIBUTING.md → LLM extraction, cached per-repo)

**Demoable?** Yes — full system. Benchmark shows lift from heuristics→hybrid.

### Phase 9 — Demo Polish + Screencast (Hours 40–48)

- Tone pass on all comment templates
- Meta-nudge copy
- README with one-paste install
- Screencast: install → fire test issue → comment appears → benchmark report

**Critical fallback (per PROJECT.md constraint):** if at hour 30 the benchmark scope is at risk, cut to 50 issues × 3 repos. The harness shape doesn't change.

### Build Order Justification

| Property | How the order earns it |
|---|---|
| **Heroes ship early** | Checklist (the hero) is demoable by hour 13 |
| **Risk front-loaded** | Action wiring + secrets dance done by hour 22, not hour 47 |
| **LLM is last** | Heuristics + benchmark prove value WITHOUT LLM. LLM is upside, not critical path. |
| **Benchmark works on day 1** | Benchmark harness depends only on CORE, not on LLM or GitHub I/O. Can run pure-heuristics-only. |
| **Each phase ends demoable** | If hackathon ends at hour 30, we still ship a polished heuristics-only Action with a benchmark. |

---

## The Shared CORE Pattern (load-bearing for the accuracy story)

This is the single most important architectural decision. Stating it plainly:

```typescript
// src/core/index.ts — THE shared entrypoint
export function score(
  issue: Issue,
  repoContext: RepoContext,
  llm: LLMPort | null = null,   // null = heuristics only
): ScoredIssue {
  const signals    = extractSignals(issue);
  const issueType  = classifyType(issue, signals);
  const checklist  = generateChecklist(signals, issueType, repoContext);
  const heuristic  = computeScore(signals, issueType, checklist);

  if (heuristic.isGrayZone && llm) {
    const verdict = llm.adjudicate({ issue, signals, repoContext });
    return mergeWithLLM(heuristic, verdict, checklist, issueType);
  }
  return finalize(heuristic, checklist, issueType);
}
```

Both call sites:

```typescript
// src/action/main.ts
const result = score(issue, repoCtx, anthropicAdapter);
await github.postComment(format(result));

// src/bench/run.ts
for (const issue of fixture) {
  const result = score(issue, repoCtx, useLLM ? anthropicAdapter : null);
  predictions.push(result);
}
```

**Why this matters for judging:** when the demo claims "P=0.82, R=0.74 on 200 real issues", the judge must believe that the *same* code that ran on the benchmark is what runs in production. If the Action and benchmark have parallel implementations, that claim is unverifiable. The shared CORE is **the structural guarantee** behind the Accuracy pillar (30% weight).

---

## Recommended Project Structure

```
signal-oss/
├── action.yml                        # GH Action manifest
├── package.json
├── tsconfig.json
├── dist/                             # ncc-bundled output (committed for Action)
│   └── index.js
├── src/
│   ├── core/                         # PURE — no I/O, no env, no SDK imports
│   │   ├── types.ts                  # all DTOs in one place
│   │   ├── index.ts                  # the score() entrypoint
│   │   ├── heuristics/
│   │   │   ├── extractor.ts
│   │   │   └── detectors/
│   │   │       ├── code-block.ts
│   │   │       ├── stack-trace.ts
│   │   │       ├── version.ts
│   │   │       └── repro.ts
│   │   ├── classifier/
│   │   │   └── issue-type.ts
│   │   ├── repo-context/
│   │   │   ├── port.ts               # interface RepoContextSource
│   │   │   └── parser.ts             # parse YAML forms, MD headers
│   │   ├── checklist/
│   │   │   ├── generator.ts          # the strategy chain
│   │   │   ├── strategies/
│   │   │   │   ├── issue-form.ts     # tier 1
│   │   │   │   ├── template-md.ts    # tier 2
│   │   │   │   ├── contributing.ts   # tier 3 (uses LLMPort)
│   │   │   │   └── baseline.ts       # tier 4
│   │   │   └── baselines.ts          # universal items per IssueType
│   │   ├── score/
│   │   │   ├── compute.ts
│   │   │   └── weights.ts            # tunable from benchmark
│   │   ├── llm/
│   │   │   └── port.ts               # interface LLMPort
│   │   └── format/
│   │       └── markdown.ts
│   ├── adapters/                     # SIDE-EFFECTING — implement core ports
│   │   ├── github/
│   │   │   ├── repo-context.ts       # implements RepoContextSource via Octokit
│   │   │   └── io.ts                 # postComment, addLabel
│   │   ├── llm/
│   │   │   ├── anthropic.ts          # implements LLMPort
│   │   │   └── openai.ts             # implements LLMPort (stretch)
│   │   └── fs/
│   │       └── repo-context.ts       # implements RepoContextSource via fs
│   ├── action/
│   │   └── main.ts                   # GH Action entrypoint
│   └── bench/
│       ├── run.ts                    # replay loop
│       ├── scrape.ts                 # one-shot fixture scraper
│       ├── aggregate.ts              # P/R/F1 math (pure)
│       └── report.ts                 # markdown report writer
├── tests/
│   ├── core/                         # unit tests, no network
│   │   ├── heuristics.test.ts
│   │   ├── classifier.test.ts
│   │   ├── checklist.test.ts
│   │   └── score.test.ts
│   ├── fixtures/
│   │   ├── issues/                   # real-issue snippets for unit tests
│   │   └── repo-contexts/            # synthetic .yml/.md templates
│   └── adapters/
│       ├── github.test.ts            # uses recorded Octokit responses
│       └── llm.test.ts               # uses recorded LLM responses
├── bench-data/
│   ├── fixtures/                     # scraped issues (jsonl)
│   ├── ground-truth/                 # csv labels
│   └── reports/                      # generated reports
└── README.md
```

### Structure Rationale

- **`src/core/` vs `src/adapters/`** is the hexagonal split. Core is the testable diamond; adapters are the disposable shell.
- **`src/action/main.ts` and `src/bench/run.ts` are siblings** at the same level — both are entry surfaces, neither is "primary."
- **`tests/core/` runs in milliseconds** with no network — this is what makes 48h iteration feasible.
- **`bench-data/fixtures/` is committed** (or gitignored with a scrape script) — judges must be able to reproduce the benchmark number.
- **`dist/` is committed** — required for GitHub Actions to be installable without a build step on the consumer side.

---

## Architectural Patterns

### Pattern 1: Ports & Adapters (Hexagonal)

**What:** Core defines interfaces (`LLMPort`, `RepoContextSource`); adapters implement them.

**When to use:** Whenever the same logic must run in fundamentally different I/O environments. Here: GH Action runtime + offline benchmark + unit tests.

**Trade-offs:** One extra interface file per integration. Pays itself back the first time the benchmark runs without an LLM key.

```typescript
// src/core/llm/port.ts
export interface LLMPort {
  adjudicate(req: LLMRequest): Promise<LLMVerdict>;
}

// src/adapters/llm/anthropic.ts
export class AnthropicAdapter implements LLMPort {
  constructor(private apiKey: string) {}
  async adjudicate(req: LLMRequest): Promise<LLMVerdict> { /* HTTP */ }
}

// tests/core/score.test.ts
class FakeLLM implements LLMPort {
  async adjudicate() { return { score: 7, reason: 'stubbed' }; }
}
```

### Pattern 2: Strategy Chain with Graceful Degradation

**What:** The 4-tier checklist generator is an array of strategies tried in order until one applies.

**When to use:** Any "try this, then this, then fallback" decision tree where each tier is independent.

**Trade-offs:** Slightly more boilerplate than a switch, but each tier is independently unit-testable, the order is data not control flow, and adding tiers is non-invasive.

```typescript
const strategies: ChecklistStrategy[] = [
  new IssueFormStrategy(),
  new TemplateMdStrategy(),
  new ContributingStrategy(llm),
  new BaselineStrategy(),  // always applies
];

for (const s of strategies) {
  if (s.applies(repoContext)) return { items: s.generate(...), tier: s.name };
}
```

### Pattern 3: Heuristics-First with LLM Gating

**What:** Compute a deterministic score; only call LLM if the score lands in the gray-zone band.

**When to use:** Any classifier where (a) the easy cases are easy, (b) LLM cost or latency matters, (c) determinism for the easy cases is desirable.

**Trade-offs:** The gray-zone band must be tuned (use the benchmark). Risk: a bad threshold sends too much/little to LLM. Mitigation: the band is a single tunable constant.

```typescript
const heuristic = computeScore(signals, type, checklist);
if (heuristic.score >= 4 && heuristic.score <= 6 && llm) {
  return mergeWithLLM(heuristic, await llm.adjudicate(...));
}
return heuristic;
```

### Pattern 4: DTO-First Wiring

**What:** Define every cross-component data shape in `src/core/types.ts` before writing any logic.

**When to use:** Solo time-boxed work where re-typing is the enemy.

**Trade-offs:** Feels over-engineered at hour 1; pays off by hour 20 when refactoring is forbidden.

---

## Testability Strategy (per component)

| Component | Test Type | What's Stubbed | Speed |
|-----------|-----------|----------------|-------|
| Heuristics Extractor | Pure unit | nothing | <1ms |
| IssueType Classifier | Pure unit | nothing | <1ms |
| Checklist Generator | Pure unit | LLMPort (for tier 3) with FakeLLM | <1ms |
| Score Computer | Pure unit | nothing | <1ms |
| Output Formatter | Snapshot test | nothing | <1ms |
| Repo Context Loader (fs adapter) | Integration | filesystem with `tmp/` fixtures | ~10ms |
| Repo Context Loader (gh adapter) | Recorded | Octokit responses recorded with nock or msw | ~50ms |
| LLM Adapter | Recorded | LLM responses recorded as JSON fixtures | ~5ms |
| Action Entry | Integration | `GITHUB_EVENT_PATH` fixture file + recorded Octokit | ~100ms |
| Benchmark Harness | E2E | filesystem fixtures, optionally null LLM | seconds |

**Recording strategy:** Use [nock](https://github.com/nock/nock) or static JSON fixtures. Record once against real APIs during development, replay forever in CI. **Never hit live APIs in tests.**

**Coverage target:** 90%+ on `src/core/`, anything for adapters. The accuracy story leans on core being correct; adapter bugs are caught at the demo.

---

## Anti-Patterns

### Anti-Pattern 1: Letting the Action and Benchmark Diverge

**What people do:** Quick-n-dirty Action handler with inlined logic; separate "research" benchmark script that re-implements scoring "for clarity."
**Why it's wrong:** The benchmark P/R number is then meaningless — judges can (and will) ask "is that the same code that ran in your demo?"
**Do this instead:** Both call `score()` from `src/core/`. Make it physically impossible to diverge by deleting any helper that isn't in core.

### Anti-Pattern 2: Octokit / fs Imports in Core

**What people do:** `import { Octokit } from '@octokit/rest'` in `src/core/repo-context/loader.ts` "because it's simpler."
**Why it's wrong:** Benchmark can't run offline. Unit tests need network. Refactor cost ≫ original write cost.
**Do this instead:** Define the port in core, implement adapters outside.

### Anti-Pattern 3: LLM Call on the Critical Path

**What people do:** Always call LLM "for accuracy."
**Why it's wrong:** Slow, expensive, non-deterministic, breaks demo when API rate-limits, breaks benchmark cost.
**Do this instead:** Heuristics handle 70%+ of issues confidently. LLM only adjudicates the gray zone.

### Anti-Pattern 4: One Huge `index.ts` Action File

**What people do:** Tutorials show single-file Actions; tempting under time pressure.
**Why it's wrong:** Makes the shared-CORE pattern impossible. Untestable. Refactor at hour 35 = death.
**Do this instead:** `action/main.ts` is a 30-line orchestrator that calls into core. Treat it like `main()` in a CLI.

### Anti-Pattern 5: Building the Benchmark Last

**What people do:** "I'll add the benchmark after the Action works."
**Why it's wrong:** By hour 40, scoring weights are frozen. The benchmark is supposed to *tune* them. Last-minute benchmarks produce numbers, not insights.
**Do this instead:** Benchmark by hour 34 (in heuristics-only mode) so weight-tuning happens before LLM is wired.

### Anti-Pattern 6: Live LLM Calls in Tests / Benchmark Re-Runs

**What people do:** Benchmark calls Anthropic 200 times every run.
**Why it's wrong:** Burns budget, slows iteration, makes tests flaky.
**Do this instead:** Cache LLM responses keyed by `hash(issue.body + repoContextDigest)`. Re-runs are free.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| GitHub REST API | `@actions/github` (Octokit wrapper) | `GITHUB_TOKEN` is auto-provided by Action runner; needs `issues: write` permission |
| Anthropic Messages API | direct `fetch` (no SDK if size-conscious for `dist/`) | `ANTHROPIC_API_KEY` from repo secrets; cache responses on disk for benchmark |
| OpenAI Chat Completions | direct `fetch` | Stretch — only if Anthropic adapter ships early |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `core/` ↔ `adapters/` | Ports (TS interfaces) | One-way dependency: adapters import core types, core never imports adapters |
| `action/main.ts` ↔ `core/` | Direct function call to `score()` | Single entrypoint; all I/O happens before/after the call |
| `bench/run.ts` ↔ `core/` | Same `score()` entrypoint, looped | Identical contract — this is the load-bearing property |
| `core/checklist/` ↔ `core/llm/` | LLMPort dependency injection | Tier 3 strategy receives LLMPort in constructor; testable with FakeLLM |

---

## Scaling Considerations

The "scaling" axis here is **issue volume per repo per day**, not concurrent users.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| <50 issues/day/repo | No changes; default Action behavior is fine |
| 50–500 issues/day/repo | Cache `RepoContext` per workflow run (already free in Actions ephemeral fs); cache LLM verdicts keyed by issue digest |
| 500+ issues/day/repo | Out of v1 scope per PROJECT.md (target band is 1k–50k stars, where this volume is rare); v2 would benefit from a hosted backend with shared LLM cache |

### Scaling Priorities

1. **First bottleneck:** LLM cost on high-volume repos. Mitigation: cache + tighten gray-zone band based on benchmark.
2. **Second bottleneck:** Octokit rate limits when fetching repo templates on every run. Mitigation: cache `RepoContext` to a workflow artifact for the day.
3. **Non-bottleneck (ignore):** CPU/memory of the heuristics layer — regex over a few KB body is free.

---

## Confidence Notes

- **HIGH** — Component decomposition. Directly maps to PROJECT.md locked decisions; no ambiguity.
- **HIGH** — Hexagonal/ports-and-adapters fit. The shared-CORE requirement (Action + benchmark identical) makes this not optional.
- **HIGH** — Build order. Constrained by 48h solo + heuristics-first invariant.
- **MEDIUM** — Specific gray-zone band (4–6). Needs benchmark tuning; document as tunable.
- **MEDIUM** — Tier 3 (CONTRIBUTING.md → LLM extraction). Highest implementation risk in checklist chain; could be cut to "use baseline" if hour 38 is squeezed.

## Sources

- PROJECT.md (locked decisions, 4-tier fallback hierarchy, judging rubric)
- Hexagonal Architecture pattern (Alistair Cockburn) — applied to bridge Action runtime + offline benchmark
- GitHub Actions toolkit conventions (`@actions/core`, `@actions/github`, `ncc` bundling)
- Common GitHub bot patterns: Probot architecture (read-only reference for what NOT to build — we're an Action, not an App)

---
*Architecture research for: GitHub Action issue triage with shared scorer for production + benchmark*
*Researched: 2026-05-08*
