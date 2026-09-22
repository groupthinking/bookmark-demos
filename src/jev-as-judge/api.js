import { DEFAULT_EVAL_QUESTIONS, SAMPLE_WEATHER_AGENT_STATE } from "./questions.js";

const TYPESAFE_SYSTEM_ONE_URL = "https://api.typesafe.ai/v1/systemone";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: JSON_HEADERS,
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function normalizeState(raw) {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  if (typeof raw === "object") {
    return raw;
  }
  return String(raw);
}

export async function callSystemOne(apiKey, state, questions) {
  const response = await fetch(TYPESAFE_SYSTEM_ONE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      state,
      model: "jev-latest",
      questions,
    }),
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: payload?.error ?? payload?.message ?? "TypeSafe API request failed",
      details: payload,
    };
  }

  return { ok: true, status: response.status, result: payload };
}

export async function handleJevAsJudgeApi(request, url, env) {
  const path = url.pathname.replace(/^\/api\/jev-as-judge/, "") || "/";

  if (path === "/sample" && request.method === "GET") {
    return json({
      sample: SAMPLE_WEATHER_AGENT_STATE,
      note:
        "Fixed example trace for manual Jev evaluation — not pre-scored; Evaluate calls live TypeSafe System One.",
    });
  }

  if (path === "/evaluate" && request.method === "POST") {
    const apiKey = env.TYPESAFE_API_KEY;
    if (!apiKey) {
      return json(
        {
          error: "TypeSafe API not configured",
          message:
            "Set the Cloudflare Worker secret TYPESAFE_API_KEY (wrangler secret put TYPESAFE_API_KEY). This demo does not mock System One responses.",
          code: "TYPESAFE_API_KEY_MISSING",
        },
        503
      );
    }

    const body = await readJson(request);
    const state = normalizeState(body?.state);
    if (state === null) {
      return json(
        {
          error: "Invalid request",
          message: "Provide a non-empty `state` field (JSON object or string).",
        },
        400
      );
    }

    const questions = body?.questions ?? DEFAULT_EVAL_QUESTIONS;
    const upstream = await callSystemOne(apiKey, state, questions);

    if (!upstream.ok) {
      return json(
        {
          error: "TypeSafe System One error",
          status: upstream.status,
          message: upstream.error,
          details: upstream.details,
        },
        upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502
      );
    }

    return json({
      source: "typesafe-system-one",
      endpoint: TYPESAFE_SYSTEM_ONE_URL,
      model_requested: "jev-latest",
      state,
      questions,
      ...upstream.result,
    });
  }

  return json({ error: "Not found", path }, 404);
}
