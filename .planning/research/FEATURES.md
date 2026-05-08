# Feature Research

**Domain:** GitHub Action for OSS issue triage / actionability scoring
**Researched:** 2026-05-08
**Confidence:** HIGH (tooling ecosystem is well-documented and stable; many direct competitors to survey)

## Existing Tools Surveyed

The "issue triage helper" space spans four eras of tooling: rule-based Probot apps, GitHub-native Actions, AI-powered SaaS bots, and (most recently) LLM-as-a-feature Actions. Signal-OSS sits in the fourth bucket but borrows install-friction conventions from the second.

| # | Tool | Class | What It Does | Relevance to Signal-OSS |
|---|------|-------|--------------|--------------------------|
| 1 | [Dosu / DosuBot](https://dosu.dev/) | AI SaaS GitHub App | Auto-labels, deduplicates, answers questions, generates intelligent first-replies from a knowledge base. Handled 66% of first-touch on 2,600 issues for one customer; median first-reply dropped from ~2 days to <5 min. | Closest functional competitor. Differs in: GitHub App (not Action), hosted infra (not BYOK), broad scope (not "actionability checklist"). |
| 2 | [GitHub Copilot Issue Triage / triage-action](https://github.com/marketplace/actions/triage-action) | Official AI Action | GitHub's own AI-powered issue intake — analyzes incoming issues, suggests labels, requests more info, marks actionable. Uses the Copilot SDK. | Direct competitor on the "AI triage" framing. Wins on integration, loses on repo-awareness (no CONTRIBUTING.md / template-form parsing). |
| 3 | [mattleibow/triage-assistant](https://github.com/mattleibow/triage-assistant) | OSS AI Action | Sub-action architecture: `apply-labels`, `engagement-score`. Configurable LLM endpoint, dry-run, weighted engagement scoring (comments, reactions, contributors, age, linked PRs). | Pattern-confirms: BYOK + sub-action architecture + scoring is mainstream. Their score is engagement-based, ours is *actionability*-based — meaningful differentiation. |
| 4 | [Logerfo/triage-action](https://github.com/Logerfo/triage-action) | OSS Action | Manages a "triage" label on new issues — adds it, removes it when other labels appear. No content analysis. | Floor of the market: dumb-but-installed. Confirms maintainers will tolerate a workflow file for label hygiene. |
| 5 | [Probot/triage-new-issues](https://probot.github.io/apps/triage-new-issues/) | Probot App | Adds `triage` label on new issues, removes when other labels added. | Same niche as #4 but as a Probot App. Established UX precedent for "tag + auto-untag" workflow. |
| 6 | [Probot/duplicate-issues](https://github.com/probot/duplicate-issues) + [simili-bot](https://github.com/similigh/simili-bot) + [AI Duplicate Detector](https://github.com/marketplace/actions/ai-powered-github-issue-duplicates-relations-detector) | Dedup tools | Semantic-similarity duplicate detection, often via OpenAI embeddings + a vector store. | Adjacent feature space — explicitly out of scope for v1, but worth flagging as a future companion. |
| 7 | [actions/stale](https://github.com/actions/stale) | Official Action | Marks/closes inactive issues + PRs. Configurable label-exempt lists. Industry-standard for backlog hygiene. | Cited by Jacob Tomlinson: ["Most stale bots are anti-user"](https://jacobtomlinson.dev/posts/2024/most-stale-bots-are-anti-user-and-anti-contributor-but-they-dont-have-to-be/) — only close when responsibility lies with user, never maintainer. Direct guidance for our `needs-info` semantics. |
| 8 | [actions/first-interaction](https://github.com/actions/first-interaction) | Official Action | Posts a configurable greeting comment on first-time contributors' issues/PRs. | Pattern-confirms: maintainers are OK with one well-placed bot comment. Sets a tone bar — friendly, short, action-oriented. |
| 9 | [github/issue-labeler](https://github.com/github/issue-labeler) + [advanced-issue-labeler](https://github.com/marketplace/actions/advanced-issue-labeler) + [srvaroa/labeler](https://github.com/srvaroa/labeler) | Official + community labelers | Regex-based body matching → labels. `.github/labeler.yml` config convention. | Sets the **config-file convention** we should follow if we ship one. They use `.github/labeler.yml`; we'd use `.github/signal-oss.yml`. |
| 10 | [Springboardretail/probot-validation](https://github.com/springboardretail/probot-validation) | Probot App | Validates issues + PRs against configurable rule sets. | Closest to a "checklist enforcer" precedent. Old, Probot-era — no LLM, no repo-awareness. Confirms the gap. |
| 11 | [Template Validator Action](https://github.com/marketplace/actions/template-validator) | OSS Action | Validates issue/PR body against headers in the issue template (sentences starting with `###` are headers, body must contain them). | Direct precedent for our "parse template, check body" heuristic. Brittle by design — we improve via the 4-tier fallback. |
| 12 | [peter-evans/create-or-update-comment](https://github.com/marketplace/actions/create-or-update-comment) + [thollander/comment-pull-request](https://github.com/marketplace/actions/comment-pull-request) + [edumserrano/find-create-or-update-comment](https://github.com/marketplace/actions/find-create-or-update-comment) + [meysam81/comment-pr](https://github.com/meysam81/comment-pr) | Comment infra Actions | The HTML-comment-marker idempotency pattern: `<!-- signal-oss:checklist -->` in the body, find-by-marker, update-or-create. | This is a **solved problem we should reuse, not reimplement**. Drop in `peter-evans/create-or-update-comment@v4`. |
| 13 | [Sentry Agent for Linear](https://docs.sentry.io/organization/integrations/issue-tracking/sentry-linear-agent/) + [Linear Triage Intelligence](https://linear.app/docs/triage) | Commercial issue routers | AI routes issues to teams/individuals, sets properties from context, supports rule-based + LLM-driven triage. | Confirms enterprise model: heuristic rules + LLM for ambiguous cases (same hybrid as Signal-OSS). |
| 14 | [Metabase Repro-Bot](https://www.metabase.com/blog/reprobot-github-issue-triage-agent) | Bespoke triage agent | Parses issue, extracts version/db/data-warehouse, classifies backend/frontend, runs Playwright-based reproduction, writes failing test. | High-end vision of where this space goes. Way beyond v1 scope — but proves the "structured info extraction from issue body" pattern works. |
| 15 | [PR Triage Action (Elifterminal)](https://github.com/Elifterminal/pr-triage) | OSS AI Action | AI-powered PR scoring against linked issue + repo patterns. BYOK. Posts confidence score + reasoning. | Sister product to ours but for PRs. Validates BYOK + score+reasoning comment as an accepted pattern. |
| 16 | [GitHub Models maintainer workflow](https://github.blog/open-source/maintainers/how-github-models-can-help-open-source-maintainers-focus-on-what-matters/) | DIY tutorial | GitHub's own blog post showing how to wire `actions/ai-inference` to triage issues. | Free LLM credits via GitHub Models = a possible alternative to BYOK, but hits org-level rate limits. BYOK remains safer default. |

**Gap confirmed:** No surveyed tool reads `CONTRIBUTING.md` or parses issue forms (`.yml`) to generate a *repo-tailored* checklist. Existing tools either (a) generate generic "please add more info" prompts (Dosu, GitHub Copilot Triage), (b) hard-match against a single template format (Template Validator), or (c) skip checklist generation entirely and just label/route (most others). Signal-OSS's 4-tier fallback is genuinely novel in this market.

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these = maintainers will uninstall within a week. These are the bar set by `actions/stale`, `actions/first-interaction`, `peter-evans/create-or-update-comment`, and the Probot ecosystem. *Maintainers don't praise tools for having these — they rage-uninstall tools that lack them.*

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Comment idempotency (one comment per issue, edit on update)** | The #1 cause of bot rage-uninstalls is duplicate notification spam ([poetry #9091](https://github.com/python-poetry/poetry/issues/9091), [community #5793](https://github.com/orgs/community/discussions/5793)). Use HTML-comment marker (`<!-- signal-oss:v1 -->`) → find-existing → update-or-create. | LOW | Wrap `peter-evans/create-or-update-comment@v4` or hand-roll with `octokit.issues.listComments` + filter by marker. ~30 lines. |
| **Workflow runs only on intended events** (`issues: opened, edited, reopened`) | Maintainers expect predictable triggers. Running on `comment` events would be invasive and noisy. | LOW | Standard `on.issues.types` config in workflow YAML. |
| **Permissions declared minimal + explicit** (`issues: write`, `contents: read`) | GitHub Actions security guidance; without `issues: write` the comment 403s, with too much it'll fail enterprise security review. | LOW | Documented `permissions:` block in the workflow snippet README. |
| **Single-file install (`.github/workflows/signal-oss.yml`)** | Convention set by `actions/stale`, `actions/first-interaction`, `actions/labeler`. Anything that requires a config file *and* a workflow file gets 30% fewer installs (anecdotal across surveyed READMEs). | LOW | Action inputs > config file for v1. Defaults baked in. |
| **Clear opt-out / disable mechanism** | Three accepted patterns: (1) skip-label (e.g., `signal-oss-ignore`), (2) repo-level disable via removing the workflow, (3) per-issue opt-out via PR title or magic comment. The skip-label pattern is the lowest-friction. | LOW | `if: !contains(github.event.issue.labels.*.name, 'signal-oss-ignore')` in workflow. Document in README. |
| **`needs-info` (or configurable) label management** | Universal triage convention. Tomlinson's stale-bot guidance explicitly: "if maintainer asks a question they should replace the label with a needs info label". Pre-existing labels must be handled (don't crash if label exists, do create if missing). | LOW | `octokit.issues.addLabels` is idempotent for the same label. Auto-create label with description on first run. |
| **Bot runs as `github-actions[bot]` (use `GITHUB_TOKEN`, not PAT)** | Required for the comment to be muteable by users via GitHub's bot-mute UI; required for the bot icon to appear next to comments. PAT-authored comments confuse maintainers. | LOW | Use default `${{ secrets.GITHUB_TOKEN }}`. |
| **Graceful degradation when `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` is missing** | If the secret isn't set, the Action must NOT crash the workflow. It should fall back to heuristics-only and log a warning. Non-negotiable per project's hero-output rule. | LOW | Try/catch around LLM call; flag `llm_available = bool(api_key)`. |
| **Action input parameters via `with:`** | Standard convention. Surveyed Actions consistently expose: `github-token`, `enable-labels` (boolean), `label-name` (string), `dry-run` (boolean), `model` (choice or string). | LOW | Define in `action.yml` with sensible defaults. |
| **`dry-run` mode** | Every triage Action surveyed (triage-assistant, Logerfo's, AI Duplicate Detector) ships this. Without it, maintainers can't safely test on a fork. | LOW | `if (dry_run) { console.log(commentBody); return; }` |
| **Edit-on-update** (re-run on `issues.edited`, recompute, edit existing comment) | Users edit issues to add the missing info — if the bot doesn't re-evaluate, it looks broken. Existing comment marker makes this trivial. | LOW | Trigger on `issues: [opened, edited, reopened]`. Idempotent comment infra handles the rest. |
| **Reasonable default behavior with zero configuration** | `actions/first-interaction` is the gold standard: paste 8 lines into a workflow file, it works. No config, no dotfiles, no setup. | LOW | All inputs optional. Defaults: comment=on, label=on, label-name=`needs-info`, dry-run=off. |
| **Tone: helpful, not gatekeeping** | The PROJECT.md explicitly calls this out as a "quality dimension, not just polish". A condescending bot comment is worse than no bot. Test with real maintainers if possible — fall back to "I noticed X is missing — could you add Y? It'll help maintainers triage faster" framing. | MEDIUM | Tonal prompt-engineering for LLM-generated checklists; for the static parts, manually write & review. |
| **Documented permissions, secrets, and scope in README** | Standard for any Action with marketplace ambition. Maintainers triage Action READMEs in <30 sec; if `permissions:` block is missing, they bounce. | LOW | Copy the structure from `actions/stale` README. |

### Differentiators (Competitive Advantage)

These align with the Innovation pillar (15%) and the Usefulness pillar (25%) from the rubric.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Repo-aware checklist generation (4-tier fallback)** | THE differentiator. No surveyed tool does this. Reads `.github/ISSUE_TEMPLATE/*.yml` → required fields; falls back to `.md` headers; falls back to LLM-extracted expectations from `CONTRIBUTING.md`; falls back to issue-type baseline. | HIGH | The hardest feature in the project. Tier 1 (YAML form parse) is straightforward; tier 3 (CONTRIBUTING.md → checklist via LLM) is the gnarly one. |
| **Heuristics-first scoring with LLM only on gray-zone** | Lower cost, higher determinism, easier to benchmark. Engagement-score Actions (mattleibow) use weighted-sum heuristics; AI triage Actions (Dosu, GitHub Copilot) burn an LLM call on every issue. We blend. | MEDIUM | The "gray zone" gating logic is real engineering — define score-confidence thresholds (e.g., heuristics produce 0–10; if 4 ≤ score ≤ 7, call LLM to refine). |
| **Issue-type classifier without LLM** (heuristics + label inference + title patterns) | Saves ~1 LLM call/issue. Title patterns (`[BUG]`, `[FEATURE]`, `?` in title) and existing labels are >85% reliable for type, per Probot patterns. | MEDIUM | Rule table + fallback to "general". Don't over-engineer. |
| **Meta-nudge: comment notes when repo lacks issue templates** | Reinforces the "anti-slop" thesis: better templates upstream = less slop downstream. Doubles as marketing — every comment becomes self-promotion of issue-template hygiene. | LOW | One sentence appended to checklist when no `.github/ISSUE_TEMPLATE/` is found. |
| **Score badge in comment** (e.g., "Actionability: 4/10") | Score saves no maintainer time on its own (per PROJECT.md), but it's the legible metric for the demo + the benchmark. Acts as a "TL;DR" for the comment. | LOW | Inline `**Actionability: 4/10**` in comment body; secondary to the checklist. |
| **Public precision/recall benchmark** | The Accuracy pillar (30% — highest weight). Turns "good vibes" into a defensible number. No surveyed competitor publishes one. | HIGH | Hardest *time-budget* risk per PROJECT.md (50/3 fallback already specified). |
| **BYOK with both OpenAI + Anthropic support** | Lowers cost-to-install to zero for maintainers; removes infra dependency for us. Standard for OSS LLM Actions (PR Triage, mattleibow's, etc.) but worth highlighting. | LOW | Detect which key is set; route accordingly. Treat the LLM as a thin abstraction. |
| **Heuristic detection signals** (repro steps, version, stack trace, code blocks, minimal example) | The "checklist items" themselves. These are the heuristics that drive both the score AND the missing-info checklist. | MEDIUM | Regex/markdown-AST detection: code fences, version-string patterns (`v\d+\.\d+`, `version: X`), traceback signatures, "Steps to reproduce" headers. |

### Anti-Features (Things to Deliberately NOT Build)

Most of these are pre-confirmed in PROJECT.md "Out of Scope". Below restates them with the **why** + adds new ones discovered through research.

| Feature | Why Tempting | Why Problematic | Alternative / Decision |
|---------|--------------|-----------------|------------------------|
| **Auto-close stale `needs-info` issues** | Stale-bot pattern; "if user doesn't respond, close." | Politically toxic; Tomlinson's [post](https://jacobtomlinson.dev/posts/2024/most-stale-bots-are-anti-user-and-anti-contributor-but-they-dont-have-to-be/) details the rage. | (Confirmed in PROJECT.md) Defer to v2; opt-in only. |
| **AI-authorship detection** | "Slop Scan" branding suggests it; many will assume this is the angle. | Hackathon explicitly devalues it; our thesis is the opposite. | (Confirmed in PROJECT.md) — explicit anti-positioning is part of the demo narrative. |
| **PR triage in v1** | "While we're here, why not?" | Different rubric (diff size, tests, linked issue). [Elifterminal/pr-triage](https://github.com/Elifterminal/pr-triage) already exists. Doing both = doing neither well in 48h. | (Confirmed in PROJECT.md) — explicit v2. |
| **Generic "AI auto-replies"** (Dosu-style answer-the-question) | Highest-perceived-value AI feature. | Requires a knowledge base, vector store, retrieval — multi-week project. Wrong scope for actionability framing. | Stay in our lane: surface what's missing, don't try to answer. |
| **Per-repo aggressiveness config** (.signal-oss.yml with thresholds, weights, custom checklist items) | Power-users always ask for it. | (Confirmed in PROJECT.md as out-of-scope for v1.) Adds install friction. Most maintainers won't tweak; defaults must be excellent. | v1 = action inputs only. v2 can add `.github/signal-oss.yml` if validated. |
| **Public Slop-Bench leaderboard** | Presentation magnet. | (Confirmed in PROJECT.md) Weak utility, divisive ("naming and shaming"). | Internal benchmark only — published as a section in the project README. |
| **Browser extension / pre-submit "Slop-Coach"** | "Stop slop at the source!" innovation hook. | (Confirmed in PROJECT.md) Different surface, different distribution (browser store), wrong scope for hackathon. | Defer to v2. |
| **Web dashboard / leaderboard** | Demo eye-candy. | (Confirmed in PROJECT.md) No UI surface in v1. Action logs + comments are the only surfaces. | Skip entirely. |
| **CLI for backlog scan** | "Maintainers will love retroactive scoring." | (Confirmed in PROJECT.md) Different surface; doubles surface area. | v2; benchmark uses internal scripts not exposed as CLI. |
| **Replacing or generating issue templates** | Adjacent problem ("if templates are missing, write them!"). | (Confirmed in PROJECT.md) Out of scope — we triage what comes in. Meta-nudge handles the awareness layer. | Meta-nudge only. |
| **NEW: Auto-assigning issues to maintainers** | Triage tools commonly do this (Linear Triage Intelligence, Sentry Agent). | Requires team-mapping config + ownership knowledge we don't have. Risky for solo demo. | Out of scope; document for v2. |
| **NEW: Duplicate detection** | Adjacent feature in space (multiple tools listed in survey). | Different problem; vector store + embeddings is its own architecture. Distracts from actionability framing. | Out of scope; recommend pairing with [simili-bot](https://github.com/similigh/simili-bot) in README "Related tools" section. |
| **NEW: First-comment greeting / welcome message** | `actions/first-interaction` pattern. | Doesn't tell maintainer anything; pure UX sugar; muddies the "actionability" framing. | Out of scope; users can install `actions/first-interaction` separately. |
| **NEW: Sentiment analysis / toxicity flagging** | Easy LLM win; "comprehensive triage." | Different problem. Misses are demoralizing (false-positive on a frustrated-but-legitimate report). | Out of scope. |
| **NEW: Automatic ChatOps / `/triage` slash commands** | Many bots support this. | Different surface (issue comments as triggers); doubles event types to handle. | Out of scope for v1. |
| **NEW: Multi-language LLM prompts / i18n** | "What about non-English repos?" | 2x prompt-engineering work for unclear demo value. | Out of scope; comment in English; v2 if there's demand. |
| **NEW: Assigning priorities / severity** | Linear Triage does this. | Severity is a maintainer judgment we shouldn't preempt. We score *actionability*, not *importance*. | Out of scope; explicit scope discipline. |

## Feature Dependencies

```
[GitHub Action skeleton (action.yml + index.js + workflow)]
    │
    ├──requires──> [GITHUB_TOKEN auth + octokit setup]
    │                  │
    │                  ├──requires──> [Comment idempotency (find-by-marker)]
    │                  │                  │
    │                  │                  └──requires──> [Hero output: post comment with checklist]
    │                  │
    │                  └──requires──> [Label management (add `needs-info`)]
    │
    ├──requires──> [Issue body fetch + parse (markdown AST)]
    │                  │
    │                  ├──requires──> [Heuristic signal detection (repro/version/trace/code/example)]
    │                  │                  │
    │                  │                  ├──requires──> [Issue-type classifier (heuristics + labels)]
    │                  │                  │
    │                  │                  └──requires──> [Score computation (0–10)]
    │                  │                                     │
    │                  │                                     └──enhances──> [LLM gray-zone refinement] (optional, BYOK)
    │                  │
    │                  └──requires──> [Repo file fetch (.github/ISSUE_TEMPLATE/*, CONTRIBUTING.md)]
    │                                     │
    │                                     └──requires──> [4-tier fallback checklist generator]
    │                                                       │
    │                                                       └──enhances──> [LLM CONTRIBUTING.md extraction] (tier 3 only, BYOK)
    │
    ├──enhances──> [Meta-nudge (when no templates found)]
    │
    └──parallel──> [Dry-run mode (gates the side-effects, not the analysis)]

[Precision/recall benchmark] ──validates──> [Score computation + heuristics]
        │
        └──parallel──> all features (independent of runtime; runs on historical data)
```

### Dependency Notes

- **Comment idempotency must land before any comment-emitting feature.** Otherwise every iteration during dev creates duplicate comments — the same trap maintainers will fall into. Build the marker-based find-update-or-create as the *first* infra piece.
- **Heuristic signal detection is the spine.** Every output (score, checklist, label decision) reads from the same heuristic results. Bad detection = bad everything. This is the highest-leverage place to invest debugging time.
- **4-tier fallback checklist is independent of scoring.** They share heuristic detection but produce orthogonal outputs. Build them in parallel; don't couple.
- **LLM features are *enhancers*, never *requirers*.** The graceful-degradation rule from PROJECT.md ("comment must still post") forces this. If the API key is missing or the LLM call fails, every dependent feature must produce a degraded-but-valid output.
- **Benchmark is decoupled from runtime.** The benchmark imports the same scoring module but runs offline against historical issues. This means score computation must be a pure function (no octokit calls inside) — important architecture consequence.
- **Dry-run gates side-effects only.** The analysis still runs in dry-run mode; what's gated is `octokit.issues.createComment` and `octokit.issues.addLabels`. This makes dry-run useful for development AND for cautious users testing on real repos.

## MVP Definition

### Launch With (v1) — Aligned with PROJECT.md "Active" Requirements

The non-negotiables for the hackathon demo. Every item below is required for the demo narrative to land.

- [ ] **Single-file workflow install** — paste `.github/workflows/signal-oss.yml` and it works
- [ ] **Comment idempotency via HTML marker** — one comment per issue, edits on `issues.edited` and `issues.reopened`
- [ ] **Heuristic signal detection** — repro steps, version, stack trace, code blocks, minimal example
- [ ] **Issue-type classifier** — bug / feature / question via heuristics + labels (no LLM)
- [ ] **4-tier repo-aware checklist generator** — issue forms YAML → templates `.md` → CONTRIBUTING.md (LLM) → universal baseline
- [ ] **Score computation (0–10)** — heuristics-first, LLM gray-zone refinement when API key present
- [ ] **Auto-comment with missing-info checklist + score badge + meta-nudge** — the hero output
- [ ] **Auto-apply `needs-info` label** when checklist has any items (configurable label name)
- [ ] **BYOK** — `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY` as repo secrets; graceful degradation if absent
- [ ] **Dry-run mode** — gates side-effects, prints planned outputs to logs
- [ ] **Reasonable defaults / zero-config install**
- [ ] **`needs-info`/skip-label opt-out**
- [ ] **Action inputs:** `github-token`, `label-name`, `enable-labels`, `enable-comments`, `dry-run`, `model` (or `llm-provider`)
- [ ] **Precision/recall benchmark** — 100–200 issues × 3–5 repos (50/3 fallback per PROJECT.md)
- [ ] **Demo screencast** running against real public repos

### Add After Validation (v1.x)

Triggered by maintainer feedback post-hackathon. Don't pre-build.

- [ ] `.github/signal-oss.yml` opt-in config file (custom thresholds, custom checklist items, label name overrides)
- [ ] Per-repo aggressiveness presets (`gentle` / `default` / `strict`)
- [ ] Skip-label customization (allow disabling on specific issues via `skip-signal-oss` label)
- [ ] Multi-language LLM prompts (i18n) — only if real demand surfaces
- [ ] Custom heuristic plugins for specific stacks (e.g., Python tracebacks, Rust panics, JS errors)

### Future Consideration (v2+)

- [ ] PR triage with diff/test/linked-issue rubric
- [ ] CLI for retroactive backlog scan
- [ ] Browser extension / pre-submit "Slop-Coach" coaching at issue-creation time
- [ ] Auto-close opt-in for stale `needs-info` issues (with `actions/stale` integration guide)
- [ ] Public Slop-Bench leaderboard
- [ ] Knowledge-base-backed answer suggestions (Dosu-style — stretch; might never make sense for us)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost (solo, 48h) | Priority |
|---------|------------|----------------------------------|----------|
| Hero output: comment with checklist | HIGH | LOW | **P1** |
| Comment idempotency (marker-based) | HIGH | LOW | **P1** |
| Heuristic signal detection | HIGH | MEDIUM | **P1** |
| 4-tier checklist generator (tiers 1+2+4) | HIGH | MEDIUM | **P1** |
| 4-tier checklist generator (tier 3 — CONTRIBUTING.md LLM) | HIGH | HIGH | **P1** (differentiator) |
| Score computation (heuristics-only) | MEDIUM | LOW | **P1** |
| LLM gray-zone refinement | MEDIUM | MEDIUM | **P1** (defer if hour 30 reality-check fails) |
| Issue-type classifier | MEDIUM | LOW | **P1** |
| `needs-info` label auto-apply | HIGH | LOW | **P1** |
| Meta-nudge when templates missing | MEDIUM | LOW | **P1** |
| BYOK + graceful degradation | HIGH | LOW | **P1** |
| Dry-run mode | MEDIUM | LOW | **P1** |
| Reasonable defaults / zero-config | HIGH | LOW | **P1** |
| Edit-on-update (re-run on `edited`/`reopened`) | MEDIUM | LOW | **P1** |
| Score badge in comment | LOW (legible, not actionable) | LOW | **P1** (cheap, demo-friendly) |
| Precision/recall benchmark | HIGH (judging — 30%) | HIGH | **P1** (50/3 fallback) |
| Demo screencast | HIGH (judging — 10%) | LOW | **P1** |
| Skip-label opt-out | MEDIUM | LOW | **P1** (~5 lines) |
| Custom label-name input | MEDIUM | LOW | **P2** |
| `.signal-oss.yml` config file | MEDIUM | MEDIUM | **P2** (post-hackathon) |
| Auto-close stale `needs-info` | LOW (politically risky) | LOW | **P3** (v2 opt-in) |
| Duplicate detection | HIGH (but different problem) | HIGH | **P3** (out of scope) |
| First-time-contributor greeting | LOW | LOW | **P3** (use `actions/first-interaction`) |

## Competitor Feature Analysis

| Feature | Dosu | GitHub Copilot Triage | mattleibow/triage-assistant | Probot/triage-new-issues | actions/stale | **Signal-OSS** |
|---------|------|------------------------|------------------------------|---------------------------|----------------|------------------|
| Surface | GitHub App | Action | Action | Probot App | Action | **Action** |
| Hosted infra | Yes (SaaS) | Hosted (Copilot) | BYOK | Yes (Probot host) | None | **BYOK** |
| Auto-comment on new issues | Yes (rich) | Yes | Optional | No | No | **Yes — checklist hero** |
| Repo-aware checklist (reads CONTRIBUTING.md / templates) | No (knowledge base instead) | No | No | No | No | **Yes (4-tier fallback) — UNIQUE** |
| Score / actionability metric | No | Implicit | Engagement-score | No | No | **Yes — actionability 0–10** |
| Auto-label | Yes | Yes | Yes | Yes (`triage` only) | Configurable | **Yes (`needs-info`)** |
| Auto-close stale | No | No | No | No | Yes (its purpose) | **No (anti-pattern in v1)** |
| Duplicate detection | Yes | No | No | No | No | **No (out of scope)** |
| Issue-type classifier | Yes | Yes | Yes (LLM) | No | No | **Yes (heuristics, no LLM)** |
| Meta-nudge for missing templates | No | No | No | No | No | **Yes — UNIQUE** |
| Public benchmark | No | No | No | No | No | **Yes — UNIQUE** |
| Dry-run | Some modes | No | Yes | N/A | Yes | **Yes** |
| Comment idempotency | Yes | Yes | Yes | N/A | Yes | **Yes** |
| Pricing | Paid (free for OSS at limits) | Free (with Copilot) | Free | Free | Free | **Free (BYOK costs)** |

**Three uniques per the matrix above:** repo-aware 4-tier checklist, meta-nudge for missing templates, public precision/recall benchmark. These are exactly the three differentiators called out in PROJECT.md as the Innovation pillar bets. Research confirms the bets.

## What Maintainers Will Rage-Uninstall Over (the Floor)

Confirmed across [poetry #9091](https://github.com/python-poetry/poetry/issues/9091), [community #5793 "Allow to mute bots"](https://github.com/orgs/community/discussions/5793), [issaacs/github #1924](https://github.com/isaacs/github/issues/1924), Tomlinson's [post on stale bots](https://jacobtomlinson.dev/posts/2024/most-stale-bots-are-anti-user-and-anti-contributor-but-they-dont-have-to-be/), and 12+ marketplace READMEs:

1. **Duplicate comment per run.** No idempotency = uninstall day 1. (Mitigation: HTML-comment marker — table-stakes feature above.)
2. **Notification spam to subscribers.** Lock/close-with-comment patterns spam every watcher. (Mitigation: edit-on-update, never re-comment.)
3. **Condescending tone.** "Please follow our contribution guidelines" reads as "you didn't do enough homework." (Mitigation: tonal review of every static string + LLM-tone-prompt; voice is a quality gate, not polish.)
4. **No opt-out per issue.** Maintainer manually triages an issue, bot keeps re-suggesting checklist items on every edit. (Mitigation: `signal-oss-ignore` skip-label.)
5. **Closes issues without consent.** (We don't auto-close — pre-mitigated by scope.)
6. **Adds 5+ labels in a flurry.** Some triagers go feature-crazy. (Mitigation: one label only, configurable.)
7. **Crashes the workflow when LLM API is down or unset.** Workflow run shows red ❌ even though the rest worked. (Mitigation: graceful degradation; LLM features always wrapped in try/catch with heuristic fallback.)
8. **Demands too many secrets / repo settings.** If install requires more than `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`), drop-off rate spikes. (Mitigation: `GITHUB_TOKEN` is auto-provided; only LLM key is user-required.)
9. **Misclassifies an obviously-good issue as low-quality.** False positives are demoralizing for legitimate reporters. (Mitigation: benchmark + heuristics-first; tune toward precision over recall — better to under-flag than over-flag.)
10. **Comments on issues that already have full info.** Pure noise. (Mitigation: if heuristic detection finds all signals present, skip comment entirely or post a minimal "Looks good — labeled `triage`" — TBD; default to silent for v1.)

## Sources

- [Dosu — Automating GitHub Issue Triage (blog)](https://dosu.dev/blog/automating-github-issue-triage) — competitor analysis
- [Dosu — How Preset Keeps Apache Superset Healthy](https://dosu.dev/blog/how-preset-keeps-apache-superset-healthy) — production-grade triage results
- [GitHub Docs — Triaging an issue with AI](https://docs.github.com/en/issues/tracking-your-work-with-issues/administering-issues/triaging-an-issue-with-ai) — official AI triage Action
- [The GitHub Blog — Building AI-powered GitHub issue triage with the Copilot SDK](https://github.blog/ai-and-ml/github-copilot/building-ai-powered-github-issue-triage-with-the-copilot-sdk/) — direct competitor architecture
- [The GitHub Blog — How GitHub Models can help open source maintainers focus on what matters](https://github.blog/open-source/maintainers/how-github-models-can-help-open-source-maintainers-focus-on-what-matters/) — alternative LLM access pattern
- [mattleibow/triage-assistant](https://github.com/mattleibow/triage-assistant) — sub-action architecture + engagement scoring patterns
- [Logerfo/triage-action](https://github.com/Logerfo/triage-action) — minimal label-flow Action
- [Probot triage-new-issues](https://probot.github.io/apps/triage-new-issues/) — Probot-era pattern
- [Probot duplicate-issues](https://github.com/probot/duplicate-issues) — adjacent dedup space
- [actions/stale](https://github.com/actions/stale) — official stale handling
- [Jacob Tomlinson — Most stale bots are anti-user and anti-contributor](https://jacobtomlinson.dev/posts/2024/most-stale-bots-are-anti-user-and-anti-contributor-but-they-dont-have-to-be/) — the canonical bot-tone post
- [actions/first-interaction](https://github.com/actions/first-interaction) — single-file UX precedent
- [github/issue-labeler](https://github.com/github/issue-labeler) — config-file convention (`.github/labeler.yml`)
- [srvaroa/labeler](https://github.com/srvaroa/labeler) — community labeler with conditions
- [springboardretail/probot-validation](https://github.com/springboardretail/probot-validation) — closest "rule-based issue validator" precedent
- [Template Validator Action](https://github.com/marketplace/actions/template-validator) — direct template-parsing precedent
- [peter-evans/create-or-update-comment](https://github.com/marketplace/actions/create-or-update-comment) — idempotency infra
- [thollander/comment-pull-request](https://github.com/marketplace/actions/comment-pull-request) — `comment-tag` upsert pattern
- [meysam81/comment-pr](https://github.com/meysam81/comment-pr) — built-in deduplication
- [Sentry Agent for Linear](https://docs.sentry.io/organization/integrations/issue-tracking/sentry-linear-agent/) — enterprise hybrid heuristic+LLM model
- [Linear Triage Intelligence](https://linear.app/docs/triage) — enterprise routing reference
- [Metabase — Meet Repro-Bot](https://www.metabase.com/blog/reprobot-github-issue-triage-agent) — bespoke high-end vision
- [Elifterminal/pr-triage](https://github.com/Elifterminal/pr-triage) — sister product (PR side); BYOK + score precedent
- [simili-bot](https://github.com/similigh/simili-bot) — duplicate detection (out of scope but relevant)
- [GitHub Discussion — Allow to mute bots (#5793)](https://github.com/orgs/community/discussions/5793) — maintainer rage canon
- [poetry #9091 — Please stop the bot spam](https://github.com/python-poetry/poetry/issues/9091) — case study in bot rage
- [GitHub Docs — Syntax for issue forms](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms) — reference for tier-1 fallback parser
- [GitHub Docs — Workflow syntax (events / inputs)](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions) — Action input parameter reference
- [GitHub Docs — Metadata syntax for actions](https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions) — `action.yml` schema
- [GitHub Docs — Using secrets in GitHub Actions](https://docs.github.com/actions/security-guides/using-secrets-in-github-actions) — BYOK pattern reference

---
*Feature research for: GitHub Action issue triage / actionability scoring*
*Researched: 2026-05-08*
