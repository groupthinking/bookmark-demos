import { evaluateTyped, getSampleOutput, listRubrics } from "./engine.js";

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

export async function handleJevPlaygroundApi(request, url) {
  const path = url.pathname.replace(/^\/api\/jev-playground/, "") || "/";

  if (path === "/rubrics" && request.method === "GET") {
    return json({ rubrics: listRubrics(), mode: "mock" });
  }

  if (path === "/sample" && request.method === "GET") {
    const rubricId = url.searchParams.get("rubricId") || "agent-response";
    return json({ rubricId, output: getSampleOutput(rubricId) });
  }

  if (path === "/evaluate" && request.method === "POST") {
    const body = await readJson(request);
    if (!body?.output || typeof body.output !== "string") {
      return json({ error: "Missing or invalid `output` string" }, 400);
    }
    const rubricId = body.rubricId || "agent-response";
    const result = evaluateTyped({ output: body.output, rubricId });
    if (result.error) {
      return json(result, 400);
    }
    return json(result);
  }

  return json({ error: "Not found", path }, 404);
}
