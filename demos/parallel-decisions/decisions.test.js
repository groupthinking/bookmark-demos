import assert from "node:assert/strict";
import test from "node:test";
import { DECISIONS_URL } from "./build-request.js";
import { handleDecisionsApi } from "./decisions.js";

const SECRET = "parallel-test-key-not-a-real-credential";

function post(body) {
  return new Request("https://bookmark-demos.local/api/parallel-decisions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("missing key does not call Parallel and invents no decision", async () => {
  let called = false;
  const response = await handleDecisionsApi(
    post({ instructions: "Has Parallel announced a Decisions API?" }),
    new URL("https://bookmark-demos.local/api/parallel-decisions"),
    {},
    () => {
      called = true;
      throw new Error("fetch should not run");
    }
  );
  assert.equal(response.status, 503);
  const payload = await response.json();
  assert.equal(payload.code, "missing_api_key");
  assert.equal(payload.decision, undefined);
  assert.equal(called, false);
  assert.equal(JSON.stringify(payload).includes("noul"), false);
});

test("status reports configuration without echoing the key", async () => {
  const response = await handleDecisionsApi(
    new Request("https://bookmark-demos.local/api/parallel-decisions/status"),
    new URL("https://bookmark-demos.local/api/parallel-decisions/status"),
    { PARALLEL_API_KEY: SECRET }
  );
  const payload = await response.json();
  assert.equal(payload.configured, true);
  assert.equal(payload.env, "PARALLEL_API_KEY");
  assert.equal(JSON.stringify(payload).includes(SECRET), false);
});

test("a configured call posts the Decisions body and returns the upstream JSON", async () => {
  const upstreamDecision = {
    mode: "fast",
    answers: { decision: { type: "noul", noul: 0.5 } },
    usage: { input_tokens: 10, output_tokens: 0 },
    citations: [{ url: "https://docs.parallel.ai/decisions/decisions-quickstart", title: "Quickstart", excerpts: ["sample excerpt"] }],
    decision_id: "decisions_abc",
  };
  let seen;
  const response = await handleDecisionsApi(
    post({ instructions: "Has Parallel announced a Decisions API?", state: { page: "https://parallel.ai/blog/decisions-api" } }),
    new URL("https://bookmark-demos.local/api/parallel-decisions"),
    { PARALLEL_API_KEY: `  ${SECRET}  ` },
    async (url, init) => {
      seen = { url, init };
      return new Response(JSON.stringify(upstreamDecision), { status: 200, headers: { "content-type": "application/json" } });
    }
  );
  assert.equal(seen.url, DECISIONS_URL);
  assert.equal(seen.init.method, "POST");
  assert.equal(seen.init.headers["x-api-key"], SECRET);
  assert.equal(JSON.stringify(seen.init.headers).includes("Bearer"), false);
  const sent = JSON.parse(seen.init.body);
  assert.equal(sent.questions.decision.type, "noul");
  assert.deepEqual(sent.state, { page: "https://parallel.ai/blog/decisions-api" });
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.decision, upstreamDecision);
  assert.equal(JSON.stringify(payload).includes(SECRET), false);
});

test("a dropped upstream body returns JSON instead of throwing", async () => {
  const response = await handleDecisionsApi(
    post({ instructions: "Has Parallel announced a Decisions API?" }),
    new URL("https://bookmark-demos.local/api/parallel-decisions"),
    { PARALLEL_API_KEY: SECRET },
    async () => ({
      ok: true,
      status: 200,
      text: async () => {
        const error = new Error("socket closed before the body finished");
        error.name = "AbortError";
        throw error;
      },
    })
  );
  assert.equal(response.status, 502);
  const payload = await response.json();
  assert.equal(payload.code, "upstream_timeout");
  assert.equal(payload.decision, undefined);
  assert.equal(JSON.stringify(payload).includes(SECRET), false);
});

test("an upstream body read failure that is not a timeout is unreachable", async () => {
  const response = await handleDecisionsApi(
    post({ instructions: "Has Parallel announced a Decisions API?" }),
    new URL("https://bookmark-demos.local/api/parallel-decisions"),
    { PARALLEL_API_KEY: SECRET },
    async () => ({
      ok: false,
      status: 200,
      text: async () => {
        throw new Error("connection reset");
      },
    })
  );
  assert.equal(response.status, 502);
  const payload = await response.json();
  assert.equal(payload.code, "upstream_unreachable");
  assert.equal(payload.decision, undefined);
});

test("upstream error bodies that repeat the key are redacted", async () => {
  const response = await handleDecisionsApi(
    post({ instructions: "Has Parallel announced a Decisions API?" }),
    new URL("https://bookmark-demos.local/api/parallel-decisions"),
    { PARALLEL_API_KEY: SECRET },
    async () =>
      new Response(JSON.stringify({ type: "error", error: { ref_id: "ref", message: `bad key ${SECRET}` } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
  );
  const text = await response.text();
  assert.equal(text.includes(SECRET), false);
  assert.equal(text.includes("[redacted]"), true);
  const payload = JSON.parse(text);
  assert.equal(payload.code, "upstream_error");
  assert.equal(payload.decision, undefined);
});
