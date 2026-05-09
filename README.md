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
