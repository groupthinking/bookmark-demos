const API = "/api/claudexor-agenticrag";

const state = {
  toolRuns: [],
  evidence: [],
  attempt: 1,
  loading: false,
};

function statusClass(status) {
  if (status === "completed") return "status-completed";
  if (status === "running") return "status-running";
  return "status-queued";
}

function renderToolRuns() {
  const el = document.getElementById("tool-runs");
  el.innerHTML = "";
  for (const run of state.toolRuns) {
    const row = document.createElement("div");
    row.className = "tool-run";
    row.innerHTML = `
      <span class="tool-badge">${run.tool}</span>
      <span>${run.label}</span>
      <span class="status ${statusClass(run.status)}">${run.status}</span>
    `;
    el.appendChild(row);
  }
}

function renderEvidence() {
  const el = document.getElementById("evidence-lane");
  el.innerHTML = "";
  if (!state.evidence.length) {
    el.innerHTML = '<p class="sub">No evidence yet — run an evidence hunt.</p>';
    return;
  }
  for (const card of state.evidence) {
    const article = document.createElement("article");
    article.className = "evidence-card";
    article.innerHTML = `
      <header>
        <span class="citation">${card.citationId}</span>
        <span class="confidence">${Math.round(card.confidence * 100)}% confidence</span>
        <span class="sub">${card.sourceLabel}</span>
        ${card.retried ? '<span class="status status-completed">retried</span>' : ""}
      </header>
      <p>${card.snippet}</p>
      <button type="button" class="retry" data-cite="${card.citationId}">Retry hunt for this citation</button>
    `;
    el.appendChild(article);
  }
  el.querySelectorAll("button.retry").forEach((btn) => {
    btn.addEventListener("click", () => runHunt({ retryCitationId: btn.dataset.cite }));
  });
}

async function api(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

async function loadInitialRuns() {
  const data = await api("/runs");
  state.toolRuns = data.toolRuns || [];
  renderToolRuns();
}

async function runHunt({ retryCitationId = null } = {}) {
  const status = document.getElementById("hunt-status");
  const btn = document.getElementById("run-hunt");
  state.loading = true;
  btn.disabled = true;
  status.textContent = retryCitationId
    ? `Retrying evidence for ${retryCitationId}…`
    : "Running evidence hunt (mock Worker API)…";

  try {
    if (retryCitationId) state.attempt += 1;
    const data = await api("/evidence-hunt", {
      query: document.getElementById("hunt-query").value,
      retryCitationId,
      attempt: state.attempt,
    });
    state.toolRuns = data.toolRuns || state.toolRuns;
    state.evidence = data.evidence || [];
    renderToolRuns();
    renderEvidence();
    status.textContent = data.mode === "mock"
      ? "Done — deterministic mock (no LLM). See limits banner above."
      : "Done.";
  } catch (e) {
    status.textContent = `Error: ${e.message}`;
  } finally {
    state.loading = false;
    btn.disabled = false;
  }
}

document.getElementById("run-hunt").addEventListener("click", () => runHunt());
loadInitialRuns().catch((e) => {
  document.getElementById("hunt-status").textContent = `Failed to load runs: ${e.message}`;
});
