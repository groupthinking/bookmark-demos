import { DECISIONS_URL, DecisionInputError, buildDecisionBody } from "./build-request.js";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

export function readApiKey(env) {
  const key = env?.PARALLEL_API_KEY;
  if (typeof key !== "string") return "";
  return key.trim();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

export function redactSecrets(value, secret) {
  if (!secret || typeof value !== "string") return value;
  return value.split(secret).join("[redacted]");
}

function redactDeep(value, secret) {
  if (!secret) return value;
  if (typeof value === "string") return redactSecrets(value, secret);
  if (Array.isArray(value)) return value.map((item) => redactDeep(item, secret));
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = redactDeep(item, secret);
    return out;
  }
  return value;
}

async function readJson(request) {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function statusPayload(env) {
  return {
    ok: true,
    configured: readApiKey(env).length > 0,
    env: "PARALLEL_API_KEY",
    endpoint: DECISIONS_URL,
    mode: "fast",
  };
}

function missingKeyPayload() {
  return {
    ok: false,
    code: "missing_api_key",
    error: "PARALLEL_API_KEY is not set. No decision was requested.",
    endpoint: DECISIONS_URL,
  };
}

export async function handleDecisionsApi(request, url, env, fetchImpl = fetch) {
  const path = url.pathname.replace(/^\/api\/parallel-decisions/, "") || "/";

  if (request.method === "GET" && (path === "/" || path === "/status")) {
    return json(statusPayload(env));
  }

  if (request.method === "POST" && (path === "/" || path === "/decide")) {
    const key = readApiKey(env);
    if (!key) return json(missingKeyPayload(), 503);

    const input = await readJson(request);
    if (input == null) return json({ ok: false, code: "invalid_input", error: "Request body must be JSON." }, 400);

    let decisionBody;
    try {
      decisionBody = buildDecisionBody(input);
    } catch (error) {
      if (error instanceof DecisionInputError) {
        return json({ ok: false, code: "invalid_input", error: error.message }, 400);
      }
      throw error;
    }

    const upstreamFailure = (error) => {
      const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
      return json(
        {
          ok: false,
          code: timedOut ? "upstream_timeout" : "upstream_unreachable",
          error: timedOut
            ? "Parallel did not respond within 30 seconds."
            : "The Decisions request could not be completed.",
          endpoint: DECISIONS_URL,
          request: decisionBody,
        },
        502
      );
    };

    let upstream;
    try {
      upstream = await fetchImpl(DECISIONS_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
        },
        body: JSON.stringify(decisionBody),
        signal: AbortSignal.timeout(30000),
      });
    } catch (error) {
      return upstreamFailure(error);
    }

    let raw;
    try {
      raw = await upstream.text();
    } catch (error) {
      return upstreamFailure(error);
    }
    const safeRaw = redactSecrets(raw, key);
    let parsed = null;
    try {
      parsed = JSON.parse(safeRaw);
    } catch {
      parsed = null;
    }

    if (!upstream.ok) {
      const message =
        parsed && typeof parsed === "object" && parsed.error && typeof parsed.error.message === "string"
          ? parsed.error.message
          : `Parallel returned HTTP ${upstream.status}.`;
      return json(
        {
          ok: false,
          code: "upstream_error",
          status: upstream.status,
          error: redactSecrets(message, key),
          endpoint: DECISIONS_URL,
          request: decisionBody,
          upstream: parsed ?? safeRaw,
        },
        upstream.status >= 400 && upstream.status <= 599 ? upstream.status : 502
      );
    }

    if (!parsed || typeof parsed !== "object") {
      return json(
        {
          ok: false,
          code: "upstream_error",
          status: upstream.status,
          error: "Parallel returned a non-JSON success body.",
          endpoint: DECISIONS_URL,
          request: decisionBody,
          upstream: safeRaw,
        },
        502
      );
    }

    return json({
      ok: true,
      endpoint: DECISIONS_URL,
      request: decisionBody,
      decision: redactDeep(parsed, key),
    });
  }

  return json({ ok: false, code: "not_found", error: "Not found.", path }, 404);
}
