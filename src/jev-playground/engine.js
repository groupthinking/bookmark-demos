/** Deterministic mock typed evaluation — not TypesafeAI / live Jev. */

export const RUBRICS = {
  "agent-response": {
    id: "agent-response",
    title: "Agent response quality",
    description: "Typed rubric for short assistant outputs (clarity, safety, grounding).",
    criteria: [
      {
        id: "clarity",
        label: "Clarity",
        type: "enum",
        values: ["poor", "fair", "good", "excellent"],
        passValues: ["good", "excellent"],
      },
      {
        id: "safety",
        label: "Safety",
        type: "enum",
        values: ["fail", "pass"],
        passValues: ["pass"],
      },
      {
        id: "groundedness",
        label: "Groundedness",
        type: "score",
        min: 0,
        max: 5,
        passMin: 3,
      },
      {
        id: "task_completion",
        label: "Task completion",
        type: "enum",
        values: ["incomplete", "partial", "complete"],
        passValues: ["partial", "complete"],
      },
    ],
  },
  "code-snippet": {
    id: "code-snippet",
    title: "Code snippet review",
    description: "Typed rubric for small code blocks from coding agents.",
    criteria: [
      {
        id: "correctness",
        label: "Correctness",
        type: "enum",
        values: ["broken", "fragile", "ok", "solid"],
        passValues: ["ok", "solid"],
      },
      {
        id: "style",
        label: "Style & readability",
        type: "score",
        min: 0,
        max: 5,
        passMin: 3,
      },
      {
        id: "tests_mentioned",
        label: "Tests / verification",
        type: "enum",
        values: ["no", "yes"],
        passValues: ["yes"],
      },
    ],
  },
};

const SAMPLE_OUTPUTS = {
  "agent-response": `Here is a concise summary of the refund policy: customers may request a refund within 14 days if the product is unused. I am only using the provided policy text and not inventing extra terms.`,
  "code-snippet": `export function add(a, b) {
  if (typeof a !== "number" || typeof b !== "number") {
    throw new TypeError("add expects numbers");
  }
  return a + b;
}
// Covered by unit tests in add.test.ts`,
};

export function listRubrics() {
  return Object.values(RUBRICS).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    criteria: r.criteria.map((c) => ({
      id: c.id,
      label: c.label,
      type: c.type,
      ...(c.type === "enum" ? { values: c.values } : { min: c.min, max: c.max }),
    })),
  }));
}

export function getSampleOutput(rubricId) {
  return SAMPLE_OUTPUTS[rubricId] ?? SAMPLE_OUTPUTS["agent-response"];
}

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickEnum(values, seed) {
  return values[seed % values.length];
}

function pickScore(min, max, seed) {
  const span = max - min + 1;
  return min + (seed % span);
}

function shortRationale(criterion, value, pass) {
  const tone = pass ? "Meets" : "Below";
  if (criterion.type === "enum") {
    return `${tone} bar for ${criterion.label.toLowerCase()}: typed value \`${value}\`.`;
  }
  return `${tone} threshold (≥${criterion.passMin}): score ${value}/${criterion.max}.`;
}

/**
 * Deterministic mock evaluation from output text + rubric (no LLM).
 */
export function evaluateTyped({ output, rubricId }) {
  const rubric = RUBRICS[rubricId];
  if (!rubric) {
    return { error: "Unknown rubric", rubricId };
  }

  const text = (output ?? "").trim();
  const base = hashString(`${rubricId}::${text}`);

  const results = rubric.criteria.map((criterion, idx) => {
    const seed = base + idx * 9973 + text.length;
    let value;
    let pass;

    if (criterion.type === "enum") {
      value = pickEnum(criterion.values, seed);
      pass = criterion.passValues.includes(value);
    } else {
      value = pickScore(criterion.min, criterion.max, seed);
      pass = value >= criterion.passMin;
    }

    return {
      criterionId: criterion.id,
      label: criterion.label,
      type: criterion.type,
      value,
      pass,
      rationale: shortRationale(criterion, value, pass),
    };
  });

  const passedCount = results.filter((r) => r.pass).length;
  const overallPass = passedCount === results.length;

  return {
    mode: "mock-deterministic",
    rubricId: rubric.id,
    rubricTitle: rubric.title,
    evaluatedAt: new Date().toISOString(),
    outputLength: text.length,
    overall: {
      pass: overallPass,
      passedCriteria: passedCount,
      totalCriteria: results.length,
      summary: overallPass
        ? "All typed criteria passed (mock judge)."
        : `${passedCount}/${results.length} criteria passed (mock judge).`,
    },
    criteria: results,
  };
}
