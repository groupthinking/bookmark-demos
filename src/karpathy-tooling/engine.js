/** Local demo harness — not Google Agents CLI or ADK. */

export const CORPUS = {
  "refund policy": "Refunds within 14 days if unused.",
  "support hours": "Human support Mon–Fri 9am–5pm UTC.",
};

export const DEFAULT_SPEC = `# agents-cli-spec (demo)

## Agent
name: corpus-helper
description: Answer from the in-demo corpus only.

## Tools
- search_corpus: lookup keyed snippets in the demo corpus

## Constraints
- Must not answer outside the corpus without refusing.
- Cite corpus text when answering in-scope questions.

## Success criteria
- 100% citation accuracy on in-corpus cases
- 100% refusal on out-of-corpus cases
`;

export function parseSpecFields(specText) {
  const nameMatch = specText.match(/^name:\s*(.+)$/m);
  const agentName = nameMatch ? nameMatch[1].trim() : "corpus-helper";
  return { agentName };
}

export function scaffoldFromSpec(specText) {
  const { agentName } = parseSpecFields(specText);
  const instruction =
    "Answer using search_corpus only. If you already know a simple answer, you may respond without tools.";
  const files = {
    ".agents-cli-spec.md": specText,
    "skills/injected-skills.md": `# Injected skills (demo static list)

1. google-agents-cli-workflow — lifecycle orchestration
2. google-agents-cli-scaffold — ADK project layout
3. google-agents-cli-adk-code — agent + tool patterns
4. google-agents-cli-eval — datasets and rubrics
5. google-agents-cli-deploy — local runtime registration
6. google-agents-cli-trace — span conventions
7. google-agents-cli-enterprise — discovery metadata (demo stub)
`,
    "app/agent.json": JSON.stringify(
      {
        name: agentName,
        model: "demo-deterministic",
        instruction,
        tools: ["search_corpus"],
      },
      null,
      2
    ),
    "app/tools/corpus.json": JSON.stringify(
      {
        name: "search_corpus",
        description: "Search the demo corpus by keyword",
        corpus: CORPUS,
      },
      null,
      2
    ),
    "tests/eval/eval_config.json": JSON.stringify(
      {
        rubric: {
          in_corpus: "Output must include matching corpus text.",
          out_of_corpus: "Output must refuse (no general knowledge).",
        },
        pass_threshold: 1,
      },
      null,
      2
    ),
    "tests/eval/dataset.json": JSON.stringify({ cases: [] }, null, 2),
  };
  return { files, skillsCount: 7 };
}

export function generateEvalCases(specText) {
  const cases = [
    {
      id: "in-corpus-refund",
      prompt: "What is the refund policy?",
      expect: "in_corpus",
      corpus_key: "refund policy",
    },
    {
      id: "in-corpus-support",
      prompt: "When is support open?",
      expect: "in_corpus",
      corpus_key: "support hours",
    },
    {
      id: "out-of-corpus-sports",
      prompt: "Who won the 1998 World Cup?",
      expect: "out_of_corpus",
    },
    {
      id: "out-of-corpus-geo",
      prompt: "What is the capital of Mongolia?",
      expect: "out_of_corpus",
    },
  ];
  return { cases, derivedFrom: parseSpecFields(specText).agentName };
}

export function getAgentConfig(files) {
  try {
    return JSON.parse(files["app/agent.json"] || "{}");
  } catch {
    return { instruction: "", tools: [] };
  }
}

export function runAgent(prompt, agentConfig) {
  const instruction = agentConfig.instruction || "";
  const lower = prompt.toLowerCase();
  for (const [key, val] of Object.entries(CORPUS)) {
    if (lower.includes(key) || lower.includes(key.split(" ")[0])) {
      return { output: val, used_tool: "search_corpus", cited: true };
    }
  }
  const allowsGeneral =
    instruction.toLowerCase().includes("already know") ||
    instruction.toLowerCase().includes("without tools");
  if (allowsGeneral) {
    return {
      output: "France won in 1998 (general knowledge — not in corpus).",
      used_tool: null,
      cited: false,
    };
  }
  return {
    output: "I do not have enough context in the corpus to answer that.",
    used_tool: null,
    cited: false,
  };
}

export function gradeCase(caseDef, result) {
  if (caseDef.expect === "in_corpus") {
    const expected = CORPUS[caseDef.corpus_key];
    const pass = result.output.includes(expected);
    return {
      pass,
      reason: pass
        ? "Corpus text present in output."
        : "Missing expected corpus citation.",
    };
  }
  const refused =
    result.output.toLowerCase().includes("do not have") ||
    result.output.toLowerCase().includes("don't have") ||
    result.output.toLowerCase().includes("not in the corpus");
  return {
    pass: refused,
    reason: refused
      ? "Refused out-of-corpus question."
      : "Leaked general knowledge outside corpus.",
  };
}

export function gradeEval(files, cases) {
  const agent = getAgentConfig(files);
  const rows = cases.map((c) => {
    const result = runAgent(c.prompt, agent);
    const { pass, reason } = gradeCase(c, result);
    return {
      id: c.id,
      prompt: c.prompt,
      output: result.output,
      used_tool: result.used_tool,
      pass,
      reason,
    };
  });
  const passed = rows.filter((r) => r.pass).length;
  const score = cases.length ? passed / cases.length : 0;
  return {
    score,
    passed,
    total: cases.length,
    rows,
    gradedAt: new Date().toISOString(),
  };
}

export function compileCheck(files) {
  const results = [];
  for (const [path, content] of Object.entries(files)) {
    if (path.endsWith(".json")) {
      try {
        JSON.parse(content);
        results.push({ path, ok: true });
      } catch (e) {
        results.push({ path, ok: false, error: String(e.message) });
      }
    }
  }
  results.push({
    path: "app/agent.py",
    ok: null,
    error: "Python compile untested in this demo (JSON agent config used instead).",
  });
  return results;
}

export function applyBookmarkFix(files) {
  const agent = getAgentConfig(files);
  agent.instruction =
    "Answer using search_corpus only. If the question is not covered by the corpus, say you do not have enough context.";
  const next = { ...files, "app/agent.json": JSON.stringify(agent, null, 2) };
  return { files: next, fix: "Removed general-knowledge loophole in instruction." };
}

export function diffScorecards(prev, next) {
  if (!prev) return { regressions: [], improvements: [] };
  const regressions = [];
  const improvements = [];
  for (const row of next.rows) {
    const old = prev.rows.find((r) => r.id === row.id);
    if (!old) continue;
    if (old.pass && !row.pass) regressions.push({ id: row.id, reason: row.reason });
    if (!old.pass && row.pass) improvements.push({ id: row.id, reason: row.reason });
  }
  return { regressions, improvements };
}

export function estimateCost(spans) {
  const steps = spans.length;
  const tokens = spans.reduce((n, s) => n + (s.attributes?.tokens || 120), 0);
  return {
    label: "estimate",
    steps,
    tokens,
    note: "Token count is a deterministic estimate for demo spans, not billing data.",
  };
}

let registrySeq = 0;
const runtimeRegistry = new Map();

export function deployToLocalRuntime(files, scorecard) {
  registrySeq += 1;
  const agent = getAgentConfig(files);
  const id = `agent-${registrySeq}`;
  const entry = {
    id,
    name: agent.name || "corpus-helper",
    registeredAt: new Date().toISOString(),
    runtime: "bookmark-demos-local",
    endpoint: `/api/karpathy-tooling/runtime/${id}/invoke`,
    lastScore: scorecard?.score ?? null,
    discoverable: true,
  };
  runtimeRegistry.set(id, { entry, files: structuredClone(files) });
  return entry;
}

export function listRegistry() {
  return [...runtimeRegistry.values()].map((v) => v.entry);
}

export function invokeRuntime(id, prompt) {
  const rec = runtimeRegistry.get(id);
  if (!rec) return { error: "Agent not found in local registry." };
  const agent = getAgentConfig(rec.files);
  return runAgent(prompt, agent);
}

export function autonomousLoop(state, options = {}) {
  const maxIter = options.maxIter ?? 4;
  const spans = [];
  let files = { ...state.files };
  let cases =
    state.cases?.length > 0
      ? state.cases
      : generateEvalCases(state.spec || DEFAULT_SPEC).cases;
  let scorecard = gradeEval(files, cases);
  let prevScorecard = scorecard;
  const traceId = `trace-${Date.now()}`;
  const log = [];

  function span(name, attrs = {}) {
    const s = {
      id: `${spans.length + 1}`,
      traceId,
      name,
      startMs: Date.now(),
      durationMs: 40 + spans.length * 15,
      attributes: { ...attrs, tokens: 80 + spans.length * 40 },
    };
    spans.push(s);
    return s;
  }

  span("agent.loop.start", { iteration: 0, score: scorecard.score });

  for (let i = 0; i < maxIter && scorecard.score < 1; i++) {
    span("plan", {
      phase: "plan",
      failures: scorecard.rows.filter((r) => !r.pass).map((r) => r.id),
    });
    log.push(`Plan: ${scorecard.rows.filter((r) => !r.pass).length} failing case(s).`);

    const compile = compileCheck(files);
    span("dispatch.compile_check", { results: compile.filter((c) => c.ok === false).length });

    span("dispatch", { phase: "dispatch", action: "patch_instruction" });
    const fix = applyBookmarkFix(files);
    files = fix.files;
    log.push(`Fix: ${fix.fix}`);

    span("measure", { phase: "measure", action: "eval_grade" });
    prevScorecard = scorecard;
    scorecard = gradeEval(files, cases);
    const diff = diffScorecards(prevScorecard, scorecard);
    span("learn", {
      phase: "learn",
      score: scorecard.score,
      regressions: diff.regressions.length,
      improvements: diff.improvements.length,
    });
    log.push(
      `Learn: score ${(scorecard.score * 100).toFixed(0)}% (${scorecard.passed}/${scorecard.total}).`
    );

    if (scorecard.score >= 1) {
      log.push("Continue: threshold met, stopping loop.");
      break;
    }
    log.push("Continue: re-run if needed.");
  }

  span("agent.loop.end", { score: scorecard.score });
  const cost = estimateCost(spans);
  const regression = diffScorecards(state.lastScorecard || null, scorecard);

  return {
    files,
    cases,
    scorecard,
    spans,
    log,
    cost,
    regression,
    traceId,
  };
}
