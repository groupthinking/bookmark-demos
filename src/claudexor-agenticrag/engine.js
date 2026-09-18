/** Deterministic mock orchestrator + AgenticRAG fixtures (no live LLM). */

export const INITIAL_TOOL_RUNS = [
  { id: "run-1", tool: "plan", label: "Plan refactor scope", status: "completed", startedAt: 0, durationMs: 420 },
  { id: "run-2", tool: "search", label: "Search codebase for RAG hooks", status: "completed", startedAt: 420, durationMs: 890 },
  { id: "run-3", tool: "read", label: "Read orchestrator module", status: "running", startedAt: 1310, durationMs: null },
  { id: "run-4", tool: "patch", label: "Apply evidence-lane UI patch", status: "queued", startedAt: null, durationMs: null },
  { id: "run-5", tool: "verify", label: "Run smoke + citation checks", status: "queued", startedAt: null, durationMs: null },
];

const EVIDENCE_POOL = [
  {
    snippet:
      "AgenticRAG routes retrieval through tool runs so each evidence card ties to a concrete search/read span.",
    sourceLabel: "internal/design-notes.md",
    citationId: "cite-7f2a",
    confidence: 0.91,
  },
  {
    snippet:
      "The orchestrator panel mirrors Claude Code-style tool status: plan → search → read → patch → verify.",
    sourceLabel: "@beamnxw / X thread",
    citationId: "cite-3b19",
    confidence: 0.88,
  },
  {
    snippet:
      "Retries re-queue the search tool with the same citation id until confidence crosses the demo threshold (0.85).",
    sourceLabel: "fixtures/agenticrag-spec.json",
    citationId: "cite-9c44",
    confidence: 0.76,
  },
  {
    snippet:
      "Unified control UI: one surface for coding agents plus evidence-hunting workflow with citations.",
    sourceLabel: "bookmark: Claudexor theme",
    citationId: "cite-1d0e",
    confidence: 0.94,
  },
];

function hashSeed(input) {
  let h = 2166136261;
  const s = String(input || "default");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function runEvidenceHunt({ query = "", retryCitationId = null, attempt = 1 } = {}) {
  const seed = hashSeed(`${query}|${retryCitationId}|${attempt}`);
  const picks = [...EVIDENCE_POOL];
  for (let i = picks.length - 1; i > 0; i--) {
    const j = (seed + i * 17) % (i + 1);
    [picks[i], picks[j]] = [picks[j], picks[i]];
  }

  let cards = picks.slice(0, 3).map((c, idx) => ({
    ...c,
    id: `ev-${seed.toString(16).slice(0, 6)}-${idx}`,
    confidence: Math.min(0.99, c.confidence + ((seed >> (idx * 3)) % 7) * 0.01),
  }));

  if (retryCitationId) {
    cards = cards.map((c) =>
      c.citationId === retryCitationId
        ? { ...c, confidence: Math.min(0.97, c.confidence + 0.12), retried: true }
        : c
    );
  }

  const toolRuns = INITIAL_TOOL_RUNS.map((r) => {
    if (r.tool === "read") return { ...r, status: "completed", durationMs: 640 };
    if (r.tool === "search") return { ...r, status: "completed", durationMs: 720 };
    if (r.tool === "patch") return { ...r, status: attempt > 1 ? "completed" : "running", durationMs: attempt > 1 ? 510 : null };
    if (r.tool === "verify") return { ...r, status: attempt > 1 ? "running" : "queued" };
    return r;
  });

  return {
    ok: true,
    mode: "mock",
    query: query || "Claudexor orchestrator + AgenticRAG evidence lane",
    attempt,
    toolRuns,
    evidence: cards,
    meta: {
      bookmark: "https://x.com/beamnxw/status/2080237028264857802",
      author: "@beamnxw",
      llm: false,
    },
  };
}
