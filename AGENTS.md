# AGENTS.md — bookmark-demos

## Non-negotiable bar (Hayden / CoS 2026-09-21)

1. **No mock playgrounds.** Do not ship fake rubrics, fixture "evals," or lookalike UIs for products that already exist. Integrate real APIs/SDKs or skip.
2. **Research first.** Read the full bookmark + every linked source. If it names a library, API, schema, or work structure — implement **that** exactly.
3. **Relevance gate.** Check https://github.com/groupthinking. Prefer work that advances Hayden's existing repos. If irrelevant, do not open a PR.
4. **Templates before inventing.** Use Hayden's approved stacks (Vercel/v0/Grok bot/Dokploy/Sitecore templates; PayloadCMS backend; Geist/Vercel labs patterns; comark for MD; lobehub/Blazity for agent org). Fallback: grok.x.ai use-cases.
5. **Jev required.** Use TypesafeAI Jev for structured pick/skip/pass decisions (https://docs.typesafe.ai/introduction , https://docs.typesafe.ai/primitives/jev). Never ship a pretend Jev UI.
6. **Skip beats shallow.** One real demo/day max. Closing a noisy PR is correct.

## Branch / PR
- Branch: `demo/YYYY-MM-DD-<slug>`
- Wait for real Cloudflare preview URL on the PR — never invent one.
- PR body must state: bookmark URL, why it matters to groupthinking, real integrations used, honest limits.