import { INITIAL_TOOL_RUNS, runEvidenceHunt } from "./engine.js";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function handleClaudexorApi(request, url) {
  const path = url.pathname.replace(/^\/api\/claudexor-agenticrag/, "") || "/";

  if (path === "/runs" && request.method === "GET") {
    return json({ toolRuns: INITIAL_TOOL_RUNS, mode: "mock" });
  }

  if (path === "/evidence-hunt" && request.method === "POST") {
    const body = await readJson(request);
    const result = runEvidenceHunt({
      query: body?.query,
      retryCitationId: body?.retryCitationId ?? null,
      attempt: Number(body?.attempt) || 1,
    });
    return json(result);
  }

  return json({ error: "Not found", path }, 404);
}
