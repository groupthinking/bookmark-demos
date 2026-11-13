# TASK: Parallel Decisions API demo

## 1. Goal & Scope
* **Objective:** Add a real Parallel Decisions demo that posts to `https://api.parallel.ai/v1/decisions` with `PARALLEL_API_KEY`, and that shows a missing-key state with no fabricated decision when the key is absent.
* **Context:** Bookmark https://x.com/Sumanth_077/status/2115446285205651494. Hayden approved this demo on 2026-11-13. The post describes grounding Jev-shaped questions (state + typed questions) in the live web.
* **Scope:** `demos/parallel-decisions/` plus the existing demo index (`public/index.html`) and Worker router (`src/index.js`). Static pages are served by the Worker from this folder so they are not copied into `public/demos/`.

## 2. Execution Plan
- [x] Build the request body from the published OpenAPI schemas (`noul`, `choice`, `score`).
- [x] Add a Worker route that reads `env.PARALLEL_API_KEY` and calls the real endpoint.
- [x] UI: question, optional state, optional criteria; render the Parallel JSON, including citations/excerpts.
- [x] Missing key: route and UI say the key is unset and return no decision.
- [x] `run-live.sh` plus README with the env var, port, and limits.
- [x] Run unit tests, boot the Worker without a key, and capture a screenshot and a short video.

## 3. Definition of Done (Success Verification)
* **Expected Outcome:** `http://127.0.0.1:8787/demos/parallel-decisions/` loads. Status and POST both report `missing_api_key` when the env var is unset. With the var set, POST sends `x-api-key` to `https://api.parallel.ai/v1/decisions`.
* **Verification Method:** `node --test demos/parallel-decisions/*.test.js`, then `bash demos/parallel-decisions/run-live.sh` and curl the status and decision routes.
* **Proof Artifact:** `npm test` (9 passed). No-key Worker on port 8787. Screenshots and video under `/opt/cursor/artifacts/`. Live Parallel call was not executed (no key).

## 4. Post-Task Reflection
* **What was done:** Added `demos/parallel-decisions/` with a Worker route that POSTs `GroundedDecisionRequest` to `https://api.parallel.ai/v1/decisions` using `x-api-key` from `PARALLEL_API_KEY`. The page collects one `noul`, `choice`, or `score` question and renders the returned answers, citation excerpts, and raw JSON. Missing key returns HTTP 503 `missing_api_key` and the UI shows that error with no sample decision.
* **Why it was needed:** Hayden approved this bookmark on 2026-11-13. Parallel grounds the same question types Jev uses in the live web. This demo does not call Jev and does not invent a Jev panel.
* **How it was tested:** `npm test` — 9 passed, 0 failed. The decisions tests use a local fetch stand-in; they are not a live Parallel response. With `PARALLEL_API_KEY` unset, `bash demos/parallel-decisions/run-live.sh` served `http://127.0.0.1:8787/demos/parallel-decisions/`. `GET /api/parallel-decisions/status` returned `{"ok":true,"configured":false,"env":"PARALLEL_API_KEY","endpoint":"https://api.parallel.ai/v1/decisions","mode":"fast"}`. `POST /api/parallel-decisions` with instructions "Has Parallel announced a Decisions API?" returned HTTP 503 `{"ok":false,"code":"missing_api_key","error":"PARALLEL_API_KEY is not set. No decision was requested.","endpoint":"https://api.parallel.ai/v1/decisions"}`. Chrome on the same URL showed the banner, the choice-criteria fields, and that 503 body. Artifacts: `parallel-decisions-missing-key.png`, `parallel-decisions-submit-missing-key.png`, `parallel-decisions-choice-criteria.png`, `parallel-decisions-no-key-flow.mp4` (34.5s). Workers Builds then published https://c9b147d7-bookmark-demos.garveyht.workers.dev and the branch alias https://demo-2026-11-13-parallel-decisions-bookmark-demos.garveyht.workers.dev. Both returned the same missing-key status and 503. No live Parallel call.
