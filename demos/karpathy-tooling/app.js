const STORAGE_KEY = "karpathy-tooling-workspace-v2";
const API = "/api/karpathy-tooling";

const state = {
  step: 1,
  spec: "",
  files: {},
  cases: [],
  scorecard: null,
  lastScorecard: null,
  registry: [],
  spans: [],
  cost: null,
  regression: null,
  selectedFile: ".agents-cli-spec.md",
  stepsDone: new Set(),
};

function loadWorkspace() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    Object.assign(state, data);
    state.stepsDone = new Set(data.stepsDone || []);
  } catch {
    /* ignore */
  }
}

function saveWorkspace() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      spec: state.spec,
      files: state.files,
      cases: state.cases,
      scorecard: state.scorecard,
      lastScorecard: state.lastScorecard,
      registry: state.registry,
      spans: state.spans,
      cost: state.cost,
      regression: state.regression,
      stepsDone: [...state.stepsDone],
    })
  );
}

async function api(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

function renderFileTree() {
  const el = document.getElementById("file-tree");
  el.innerHTML = "";
  const paths = Object.keys(state.files).sort();
  for (const p of paths) {
    const div = document.createElement("div");
    div.className = "file-item" + (p === state.selectedFile ? " active" : "");
    div.textContent = p;
    div.onclick = () => {
      state.selectedFile = p;
      renderFileTree();
      document.getElementById("file-editor").value = state.files[p] || "";
    };
    el.appendChild(div);
  }
}

function renderSteps() {
  document.querySelectorAll(".step-btn").forEach((btn) => {
    const n = Number(btn.dataset.step);
    btn.classList.toggle("active", n === state.step);
    btn.classList.toggle("done", state.stepsDone.has(n));
  });
  document.querySelectorAll("[data-panel]").forEach((p) => {
    p.classList.toggle("hidden", Number(p.dataset.panel) !== state.step);
  });
}

function renderScorecard() {
  const tbody = document.querySelector("#scorecard tbody");
  tbody.innerHTML = "";
  if (!state.scorecard) {
    document.getElementById("score-summary").textContent = "No scorecard yet.";
    return;
  }
  for (const row of state.scorecard.rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${row.id}</td><td>${escapeHtml(row.output)}</td><td class="${row.pass ? "pass" : "fail"}">${row.pass ? "pass" : "fail"}</td><td>${escapeHtml(row.reason)}</td>`;
    tbody.appendChild(tr);
  }
  document.getElementById("score-summary").textContent =
    `Score: ${(state.scorecard.score * 100).toFixed(0)}% (${state.scorecard.passed}/${state.scorecard.total}) — deterministic local rubric, not LLM-as-judge.`;
}

function renderRegistry() {
  const tbody = document.querySelector("#registry tbody");
  tbody.innerHTML = "";
  for (const e of state.registry) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${e.name}</td><td><code>${e.id}</code></td><td>${e.runtime}</td><td><code>${e.endpoint}</code></td>`;
    tbody.appendChild(tr);
  }
}

function estimateCostClient(spans) {
  const tokens = spans.reduce((n, s) => n + (s.attributes?.tokens || 120), 0);
  return {
    label: "estimate",
    steps: spans.length,
    tokens,
    note: "Token count is a deterministic estimate for demo spans, not billing data.",
  };
}

function renderTrace() {
  const ul = document.getElementById("trace-spans");
  ul.innerHTML = "";
  for (const s of state.spans) {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${s.name}</strong> <span class="badge">${s.durationMs}ms</span> ${JSON.stringify(s.attributes || {})}`;
    ul.appendChild(li);
  }
  const reg = document.getElementById("regression-box");
  if (state.regression) {
    reg.textContent = `Regressions: ${state.regression.regressions?.length || 0}, improvements: ${state.regression.improvements?.length || 0}`;
  }
  const cost = document.getElementById("cost-box");
  if (state.cost) {
    cost.textContent = `Cost (${state.cost.label}): ~${state.cost.tokens} tokens across ${state.cost.steps} spans. ${state.cost.note}`;
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function syncSpecFromEditor() {
  state.spec = document.getElementById("spec-editor").value;
  state.files[".agents-cli-spec.md"] = state.spec;
}

function syncFileEditor() {
  if (state.selectedFile && state.files[state.selectedFile] !== undefined) {
    state.files[state.selectedFile] = document.getElementById("file-editor").value;
  }
}

async function init() {
  loadWorkspace();
  if (!state.spec) {
    const def = await api("/spec/default");
    state.spec = def.spec;
  }
  document.getElementById("spec-editor").value = state.spec;
  if (Object.keys(state.files).length) {
    document.getElementById("file-editor").value = state.files[state.selectedFile] || "";
  }
  renderSteps();
  renderFileTree();
  renderScorecard();
  renderRegistry();
  renderTrace();

  document.querySelectorAll(".step-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.step = Number(btn.dataset.step);
      renderSteps();
    });
  });

  document.getElementById("save-spec").addEventListener("click", () => {
    syncSpecFromEditor();
    state.stepsDone.add(1);
    saveWorkspace();
    renderSteps();
    document.getElementById("spec-status").textContent = "Saved to browser localStorage + workspace files.";
  });

  document.getElementById("run-scaffold").addEventListener("click", async () => {
    syncSpecFromEditor();
    const data = await api("/scaffold", { spec: state.spec });
    state.files = data.files;
    if (data.spans) state.spans.push(...data.spans);
    state.selectedFile = "app/agent.json";
    state.stepsDone.add(2);
    saveWorkspace();
    renderFileTree();
    document.getElementById("file-editor").value = state.files[state.selectedFile];
    document.getElementById("scaffold-status").textContent =
      `Scaffolded ${Object.keys(state.files).length} files (${data.skillsCount} skills doc). ADK/Python compile untested.`;
    renderTrace();
    state.cost = estimateCostClient(state.spans);
    renderSteps();
  });

  document.getElementById("run-generate").addEventListener("click", async () => {
    syncFileEditor();
    const data = await api("/eval/generate", { spec: state.spec, files: state.files });
    state.cases = data.cases;
    state.files = data.files;
    if (data.spans) state.spans.push(...data.spans);
    saveWorkspace();
    renderFileTree();
    document.getElementById("gen-status").textContent = `Generated ${data.cases.length} cases into tests/eval/dataset.json`;
  });

  document.getElementById("run-grade").addEventListener("click", async () => {
    syncFileEditor();
    state.lastScorecard = state.scorecard;
    const data = await api("/eval/grade", { files: state.files, cases: state.cases });
    state.scorecard = data.scorecard;
    state.cases = data.cases;
    if (data.spans) state.spans.push(...data.spans);
    state.stepsDone.add(3);
    saveWorkspace();
    renderScorecard();
    renderTrace();
    state.cost = estimateCostClient(state.spans);
    renderSteps();
  });

  document.getElementById("run-deploy").addEventListener("click", async () => {
    syncFileEditor();
    const data = await api("/deploy", { files: state.files, scorecard: state.scorecard });
    state.registry = data.registry;
    if (data.spans) state.spans.push(...data.spans);
    state.stepsDone.add(4);
    saveWorkspace();
    renderRegistry();
    renderTrace();
    state.cost = estimateCostClient(state.spans);
    renderSteps();
    document.getElementById("deploy-status").textContent =
      `Registered on local demo runtime only (not Google Agent Runtime). Endpoint: ${data.entry.endpoint}`;
  });

  document.getElementById("test-invoke").addEventListener("click", async () => {
    const id = state.registry[state.registry.length - 1]?.id;
    if (!id) return;
    const prompt = document.getElementById("invoke-prompt").value;
    const res = await api(`/runtime/${id}/invoke`, { prompt });
    document.getElementById("invoke-result").textContent = JSON.stringify(res, null, 2);
  });

  document.getElementById("open-trace").addEventListener("click", () => {
    state.step = 5;
    state.stepsDone.add(5);
    renderSteps();
    renderTrace();
    saveWorkspace();
  });

  document.getElementById("run-agent-loop").addEventListener("click", async () => {
    syncSpecFromEditor();
    syncFileEditor();
    document.getElementById("loop-log").textContent = "Running…";
    const data = await api("/agent/run", {
      files: state.files,
      spec: state.spec,
      cases: state.cases,
      lastScorecard: state.lastScorecard,
    });
    state.files = data.files;
    state.cases = data.cases;
    state.scorecard = data.scorecard;
    state.spans = [...state.spans, ...data.spans];
    state.cost = data.cost;
    state.regression = data.regression;
    state.stepsDone.add(3);
    document.getElementById("loop-log").textContent = data.log.join("\n");
    saveWorkspace();
    renderFileTree();
    renderScorecard();
    renderTrace();
    document.getElementById("file-editor").value = state.files[state.selectedFile] || "";
  });

  document.getElementById("file-editor").addEventListener("change", () => {
    syncFileEditor();
    saveWorkspace();
  });
  document.getElementById("file-editor").addEventListener("blur", () => {
    syncFileEditor();
    saveWorkspace();
  });
}

init();
