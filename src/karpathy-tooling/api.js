import {
  DEFAULT_SPEC,
  autonomousLoop,
  compileCheck,
  deployToLocalRuntime,
  generateEvalCases,
  gradeEval,
  invokeRuntime,
  listRegistry,
  scaffoldFromSpec,
} from "./engine.js";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function mkSpan(name, attributes = {}) {
  return {
    id: `span-${Math.random().toString(36).slice(2, 9)}`,
    name,
    startMs: Date.now(),
    durationMs: 20 + Math.floor(Math.random() * 30),
    attributes: { tokens: 100, ...attributes },
  };
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function handleKarpathyApi(request, url) {
  const path = url.pathname.replace(/^\/api\/karpathy-tooling/, "") || "/";

  if (path === "/spec/default" && request.method === "GET") {
    return json({ spec: DEFAULT_SPEC });
  }

  if (path === "/scaffold" && request.method === "POST") {
    const body = await readJson(request);
    const spec = body?.spec || DEFAULT_SPEC;
    const result = scaffoldFromSpec(spec);
    return json({
      ...result,
      spans: [mkSpan("scaffold.create", { files: Object.keys(result.files).length })],
    });
  }

  if (path === "/compile" && request.method === "POST") {
    const body = await readJson(request);
    return json({ results: compileCheck(body?.files || {}) });
  }

  if (path === "/eval/generate" && request.method === "POST") {
    const body = await readJson(request);
    const generated = generateEvalCases(body?.spec || DEFAULT_SPEC);
    const files = { ...(body?.files || {}) };
    files["tests/eval/dataset.json"] = JSON.stringify(
      { cases: generated.cases },
      null,
      2
    );
    return json({
      ...generated,
      files,
      spans: [mkSpan("eval.generate", { cases: generated.cases.length })],
    });
  }

  if (path === "/eval/grade" && request.method === "POST") {
    const body = await readJson(request);
    const cases =
      body?.cases ||
      JSON.parse(body?.files?.["tests/eval/dataset.json"] || '{"cases":[]}').cases;
    const scorecard = gradeEval(body?.files || {}, cases);
    return json({
      scorecard,
      cases,
      spans: [
        mkSpan("eval.grade", {
          score: scorecard.score,
          passed: scorecard.passed,
          total: scorecard.total,
        }),
      ],
    });
  }

  if (path === "/deploy" && request.method === "POST") {
    const body = await readJson(request);
    const entry = deployToLocalRuntime(body?.files || {}, body?.scorecard);
    return json({
      entry,
      registry: listRegistry(),
      spans: [mkSpan("deploy.register", { agentId: entry.id, runtime: entry.runtime })],
    });
  }

  if (path === "/registry" && request.method === "GET") {
    return json({ registry: listRegistry() });
  }

  const invokeMatch = path.match(/^\/runtime\/([^/]+)\/invoke$/);
  if (invokeMatch && request.method === "POST") {
    const body = await readJson(request);
    const result = invokeRuntime(invokeMatch[1], body?.prompt || "");
    return json(result);
  }

  if (path === "/agent/run" && request.method === "POST") {
    const body = await readJson(request);
    const result = autonomousLoop({
      files: body?.files || {},
      spec: body?.spec || DEFAULT_SPEC,
      cases: body?.cases,
      lastScorecard: body?.lastScorecard,
    });
    return json(result);
  }

  return json({ error: "Not found", path }, 404);
}
