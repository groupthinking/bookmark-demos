# Parallel Decisions demo

Bookmark: https://x.com/Sumanth_077/status/2115446285205651494

Sumanth's post describes Parallel's Decisions API: send state and typed questions, and get a web-grounded answer with probability and sources in one call, instead of search then a separate decision model such as [Typesafe Jev](https://docs.typesafe.ai/introduction). Hayden approved this demo on 2026-11-13.

This page does not call Jev. Jev answers from the state you send and does not retrieve the web. A pretend Jev panel is not included. There is no `TYPESAFE_API_KEY` in this demo.

## Endpoint

`POST https://api.parallel.ai/v1/decisions`

Authentication is the `x-api-key` header. The Worker reads it from the `PARALLEL_API_KEY` environment variable. The key is not hardcoded, logged, or returned to the browser.

The route is `POST /api/parallel-decisions`. `GET /api/parallel-decisions/status` reports only whether the variable is non-empty.

Question types follow the [Decisions API reference](https://docs.parallel.ai/api-reference/decisions/decisions):

| `type` | You send | Parallel returns |
| --- | --- | --- |
| `noul` | `instructions`, optional `criteria.true` and `criteria.false` | `noul` probability from 0 to 1 |
| `choice` | `instructions` and 2–255 `criteria` options | `choice`, `probabilities`, and `confidence` when present |
| `score` | `instructions` and 2–10 ordered levels | `score`, `legend`, `probabilities`, and `confidence` when present |

Any question can come back as `{ "type": "refusal" }`. Citations (`url`, optional `title`, `excerpts`) apply to the whole request. The published response schema has no reasoning string. The page shows the citation excerpts as the grounding text Parallel returned.

`mode` is left unset so Parallel uses the documented default, `fast`.

## Run locally

From the repo root, with a key:

```bash
export PARALLEL_API_KEY="your platform key"
bash demos/parallel-decisions/run-live.sh
```

Or:

```bash
export PARALLEL_API_KEY="your platform key"
npm run demo:parallel-decisions
```

Open http://127.0.0.1:8787/demos/parallel-decisions/

`run-live.sh` copies `PARALLEL_API_KEY` into `.dev.vars` for the Wrangler process and deletes or restores that file on exit. `.dev.vars` is gitignored. Wrangler does not pass the shell variable into the Worker on its own.

Without the variable, the same command still serves the page. The banner and a submit both say the key is missing. No decision object is returned.

```bash
unset PARALLEL_API_KEY
bash demos/parallel-decisions/run-live.sh
```

Create a key at https://platform.parallel.ai. For a deployed Worker, set the secret with `npx wrangler secret put PARALLEL_API_KEY`. Do not put the key in `wrangler.toml`.

Request-shape tests, which do not call Parallel:

```bash
npm test
```

## Limits

- One question per submit. The API allows 1–100 related questions that share one retrieval. This demo does not batch.
- `fast` is the only Decisions mode. Published timing is about 200 ms–1 s. The Worker aborts after 30 seconds.
- Price published for `fast`: $1 per 1,000 requests. Up to 100 questions are included in one request.
- Default rate limit: 600 `POST /v1/decisions` per minute.
- State plus the largest question: 32,000 estimated input tokens. Rendered question: 5,000 characters. This form rejects instructions over 4,000 characters.
- Choice: 2–255 options. Score: 2–10 levels.
- `advanced_settings` may include `after_date` (`YYYY-MM-DD`), `location` (ISO 3166-1 alpha-2; `gb`, not `uk`), and `include_excerpts`. An empty settings object is invalid.
- Citations are not mapped to individual answers. `noul` has no confidence field in the schema. Choice and score confidence can be null.
- A refusal is a successful question outcome, not an HTTP error.
- This environment did not have `PARALLEL_API_KEY`. Live-call validation against Parallel is left for the maintainer who has a key. The unit test that mentions a key uses a local fetch stand-in to check the outbound URL, header, and body. It is not a Parallel response.
- Cloudflare Workers Builds publishes a branch preview. The preview does not have `PARALLEL_API_KEY`, so it shows the same missing-key state as a local run without the variable. The URL for this branch is https://demo-2026-11-13-parallel-decisions-bookmark-demos.garveyht.workers.dev/demos/parallel-decisions/
