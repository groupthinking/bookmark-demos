const rubricEl = document.getElementById("rubric");
const rubricSchemaEl = document.getElementById("rubric-schema");
const outputEl = document.getElementById("output");
const resultsEl = document.getElementById("results");
const statusEl = document.getElementById("status");
const evaluateBtn = document.getElementById("evaluate");
const loadSampleBtn = document.getElementById("load-sample");

let rubrics = [];

function renderRubricSchema(rubric) {
  if (!rubric) {
    rubricSchemaEl.textContent = "";
    return;
  }
  const parts = rubric.criteria.map((c) => {
    if (c.type === "enum") {
      return `${c.label}: enum [${c.values.join(" | ")}]`;
    }
    return `${c.label}: score ${c.min}–${c.max}`;
  });
  rubricSchemaEl.innerHTML = parts.map((p) => `<code>${p}</code>`).join(" · ");
}

function fillRubricSelect() {
  rubricEl.innerHTML = "";
  for (const r of rubrics) {
    const opt = document.createElement("option");
    opt.value = r.id;
    opt.textContent = r.title;
    rubricEl.appendChild(opt);
  }
  const current = rubrics.find((r) => r.id === rubricEl.value) ?? rubrics[0];
  if (current) {
    rubricEl.value = current.id;
    renderRubricSchema(current);
  }
}

async function loadRubrics() {
  const res = await fetch("/api/jev-playground/rubrics");
  const data = await res.json();
  rubrics = data.rubrics ?? [];
  fillRubricSelect();
}

async function loadSample() {
  const rubricId = rubricEl.value;
  statusEl.textContent = "Loading sample…";
  const res = await fetch(`/api/jev-playground/sample?rubricId=${encodeURIComponent(rubricId)}`);
  const data = await res.json();
  outputEl.value = data.output ?? "";
  statusEl.textContent = "Sample loaded.";
}

function renderResults(data) {
  if (!data?.criteria) {
    resultsEl.innerHTML = `<p class="empty-hint">No results.</p>`;
    return;
  }

  const overallClass = data.overall.pass ? "pass" : "fail";
  const cards = data.criteria
    .map((c) => {
      const badgeClass = c.pass ? "pass" : "fail";
      const badgeLabel = c.pass ? "pass" : "fail";
      const valueLabel = c.type === "score" ? `${c.value}` : c.value;
      return `
        <article class="card" data-criterion="${c.criterionId}">
          <div class="card-header">
            <span class="card-title">${c.label}</span>
            <span class="badge ${badgeClass}">${badgeLabel}</span>
          </div>
          <div><span class="typed-value">${valueLabel}</span> <span class="sub">(${c.type})</span></div>
          <p class="card-rationale">${c.rationale}</p>
        </article>`;
    })
    .join("");

  resultsEl.innerHTML = `
    <div class="overall-banner ${overallClass}" role="status">
      ${data.overall.summary}
    </div>
    <div class="cards">${cards}</div>
    <p class="sub" style="margin-top:0.75rem">Mode: <code>${data.mode}</code> · ${data.evaluatedAt}</p>
  `;
}

async function runEvaluate() {
  const output = outputEl.value.trim();
  if (!output) {
    statusEl.textContent = "Paste output or load a sample first.";
    return;
  }
  evaluateBtn.disabled = true;
  statusEl.textContent = "Evaluating (mock)…";
  try {
    const res = await fetch("/api/jev-playground/evaluate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ output, rubricId: rubricEl.value }),
    });
    const data = await res.json();
    if (!res.ok) {
      statusEl.textContent = data.error ?? "Request failed";
      return;
    }
    renderResults(data);
    statusEl.textContent = "Done.";
  } catch (err) {
    statusEl.textContent = String(err);
  } finally {
    evaluateBtn.disabled = false;
  }
}

rubricEl.addEventListener("change", () => {
  const r = rubrics.find((x) => x.id === rubricEl.value);
  renderRubricSchema(r);
});

evaluateBtn.addEventListener("click", () => void runEvaluate());
loadSampleBtn.addEventListener("click", () => void loadSample());

await loadRubrics();
void loadSample();
