# Karpathy tooling harness demo

Bookmark: https://x.com/akshay_pachaar/status/2070860837448040832

Single-page harness with Worker APIs under `/api/karpathy-tooling/*`:

1. **Spec** — edit `.agents-cli-spec.md` (persisted in localStorage)
2. **Scaffold** — POST `/scaffold` creates ADK-style file tree
3. **Grade** — generate + deterministic rubric scorecard
4. **Deploy** — local in-Worker registry (not GCP)
5. **Trace** — spans + regression diff + cost estimate

Run: `npm run dev` → `/demos/karpathy-tooling/`

Google Agents CLI / ADK / GCP are **not** invoked.
