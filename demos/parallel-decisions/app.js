const form = document.getElementById("decision-form");
const typeSelect = document.getElementById("type");
const banner = document.getElementById("key-banner");
const formStatus = document.getElementById("form-status");
const resultEmpty = document.getElementById("result-empty");
const resultBody = document.getElementById("result-body");
const submitButton = document.getElementById("submit");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "not a number";
}

function showCriteria(type) {
  document.getElementById("criteria-noul").hidden = type !== "noul";
  document.getElementById("criteria-choice").hidden = type !== "choice";
  document.getElementById("criteria-score").hidden = type !== "score";
}

typeSelect.addEventListener("change", () => showCriteria(typeSelect.value));
showCriteria(typeSelect.value);

function setBanner(payload, failed) {
  banner.className = "banner";
  if (failed) {
    banner.classList.add("error");
    banner.textContent = "The status route did not respond. The form will still report a missing key if the server has no PARALLEL_API_KEY.";
    return;
  }
  if (payload.configured) {
    banner.classList.add("ready");
    banner.textContent = "PARALLEL_API_KEY is set on the server. Ask Parallel will call POST https://api.parallel.ai/v1/decisions. The key is not shown.";
    return;
  }
  banner.classList.add("missing");
  banner.textContent = "PARALLEL_API_KEY is not set. The server will not call Parallel and will not show a sample decision.";
}

async function loadStatus() {
  try {
    const response = await fetch("/api/parallel-decisions/status");
    const payload = await response.json();
    setBanner(payload, false);
  } catch {
    setBanner(null, true);
  }
}

function probabilityRows(probabilities) {
  if (!probabilities || typeof probabilities !== "object") return "";
  const rows = Object.entries(probabilities)
    .map(([key, value]) => `<tr><td><code>${escapeHtml(key)}</code></td><td>${escapeHtml(formatNumber(value))}</td></tr>`)
    .join("");
  return `<table class="prob"><thead><tr><th>Option</th><th>Probability</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function confidenceLine(answer) {
  if (!Object.hasOwn(answer, "confidence")) return "<p>No confidence field on this answer.</p>";
  if (answer.confidence == null) return "<p>Confidence: null.</p>";
  return `<p>Confidence: ${escapeHtml(formatNumber(answer.confidence))}. Parallel documents this as separate from the selected option's probability.</p>`;
}

function summarize(name, answer) {
  if (!answer || typeof answer !== "object") {
    return `<h3><code>${escapeHtml(name)}</code></h3><p>The answer was not an object.</p>`;
  }
  switch (answer.type) {
    case "noul":
      return `<h3><code>${escapeHtml(name)}</code> · predicate</h3><p>Estimated probability the condition is true: <strong>${escapeHtml(formatNumber(answer.noul))}</strong>. This is not a boolean.</p>`;
    case "choice":
      return `<h3><code>${escapeHtml(name)}</code> · choice</h3><p>Selected <code>${escapeHtml(answer.choice ?? "")}</code>.</p>${confidenceLine(answer)}${probabilityRows(answer.probabilities)}`;
    case "score": {
      const legend = answer.legend && typeof answer.legend === "object"
        ? `<ul>${Object.entries(answer.legend).map(([index, label]) => `<li><code>${escapeHtml(index)}</code> ${escapeHtml(label)}</li>`).join("")}</ul>`
        : "";
      return `<h3><code>${escapeHtml(name)}</code> · score</h3><p>Score <strong>${escapeHtml(formatNumber(answer.score))}</strong>, the probability-weighted mean of the zero-based level indexes.</p>${confidenceLine(answer)}${legend}${probabilityRows(answer.probabilities)}`;
    }
    case "refusal":
      return `<h3><code>${escapeHtml(name)}</code> · refusal</h3><p>Parallel returned a refusal. No value and no probabilities came back for this question.</p>`;
    default:
      return `<h3><code>${escapeHtml(name)}</code></h3><p>Unrecognized answer type ${escapeHtml(JSON.stringify(answer.type))}. The raw answer is below.</p>`;
  }
}

function renderCitations(citations) {
  if (!Array.isArray(citations) || citations.length === 0) {
    return "<h3>Citations</h3><p>The citations array is empty. Parallel applies citations to the whole request, not to one answer.</p>";
  }
  const items = citations.map((citation) => {
    const title = citation?.title ? escapeHtml(citation.title) : "Untitled source";
    const url = typeof citation?.url === "string" ? citation.url : "";
    const excerpts = Array.isArray(citation?.excerpts) ? citation.excerpts : [];
    const excerptHtml = excerpts.length
      ? excerpts.map((excerpt) => `<p class="excerpt">${escapeHtml(excerpt)}</p>`).join("")
      : "<p class=\"excerpt\">No excerpts on this citation.</p>";
    const link = url ? `<a href="${escapeHtml(url)}" rel="noopener noreferrer">${title}</a>` : title;
    return `<article class="citation">${link}${excerptHtml}</article>`;
  }).join("");
  return `<h3>Citations</h3><p class="sub">Sources for the whole call. Excerpts are the passages Parallel included in the decision context. The response has no separate reasoning string.</p>${items}`;
}

function renderDecision(payload) {
  resultEmpty.hidden = true;
  const decision = payload.decision;
  if (!decision || typeof decision !== "object") {
    resultBody.innerHTML = `<p class="banner error">The route returned no decision object.</p><pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre>`;
    return;
  }
  const answers = decision.answers && typeof decision.answers === "object" ? decision.answers : {};
  const answerHtml = Object.entries(answers).map(([name, answer]) => `<article class="answer">${summarize(name, answer)}</article>`).join("");
  const usage = decision.usage && typeof decision.usage === "object"
    ? `<p>Usage: input_tokens ${escapeHtml(formatNumber(decision.usage.input_tokens))}, output_tokens ${escapeHtml(formatNumber(decision.usage.output_tokens))}.</p>`
    : "<p>No usage object.</p>";
  resultBody.innerHTML = `
    <p>decision_id <code>${escapeHtml(decision.decision_id ?? "")}</code> · mode <code>${escapeHtml(decision.mode ?? "")}</code></p>
    ${usage}
    ${answerHtml || "<p>No answers object.</p>"}
    ${renderCitations(decision.citations)}
    <h3>Response JSON</h3>
    <pre>${escapeHtml(JSON.stringify(decision, null, 2))}</pre>
  `;
}

function renderFailure(payload) {
  resultEmpty.hidden = true;
  const code = payload?.code || "error";
  resultBody.innerHTML = `
    <p class="banner ${code === "missing_api_key" ? "missing" : "error"}">${escapeHtml(payload?.error || "The request failed.")}</p>
    <pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
  `;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const type = typeSelect.value;
  const body = {
    type,
    instructions: document.getElementById("instructions").value,
    name: document.getElementById("name").value,
    state: document.getElementById("state").value,
    afterDate: document.getElementById("after-date").value,
    location: document.getElementById("location").value,
    includeExcerpts: document.getElementById("include-excerpts").checked,
  };
  if (type === "noul") {
    body.trueCriteria = document.getElementById("true-criteria").value;
    body.falseCriteria = document.getElementById("false-criteria").value;
  } else if (type === "choice") {
    body.criteria = document.getElementById("choice-criteria").value;
  } else if (type === "score") {
    body.criteria = document.getElementById("score-criteria").value;
  } else {
    formStatus.textContent = "Unknown question type.";
    return;
  }

  submitButton.disabled = true;
  formStatus.textContent = "Sending…";
  try {
    const response = await fetch("/api/parallel-decisions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (payload.ok && payload.decision) renderDecision(payload);
    else renderFailure(payload);
    formStatus.textContent = payload.ok ? "Parallel responded." : "The server returned an error. Nothing was filled in as a decision.";
  } catch {
    formStatus.textContent = "The browser could not read the Worker response.";
  } finally {
    submitButton.disabled = false;
    loadStatus();
  }
});

loadStatus();
