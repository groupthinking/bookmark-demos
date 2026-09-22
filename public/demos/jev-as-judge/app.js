const stateEditor = document.getElementById("state-editor");
const resultsEl = document.getElementById("results");
const answerGrid = document.getElementById("answer-grid");
const statusEl = document.getElementById("status");
const evaluateBtn = document.getElementById("evaluate-btn");
const loadSampleBtn = document.getElementById("load-sample");

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

async function loadSample() {
  setStatus("Loading sample trace…");
  const res = await fetch("/api/jev-as-judge/sample");
  const data = await res.json();
  stateEditor.value = JSON.stringify(data.sample, null, 2);
  setStatus("Sample loaded (text only — scores come from Evaluate → TypeSafe).");
}

function renderAnswerCards(answers) {
  answerGrid.innerHTML = "";
  if (!answers || typeof answers !== "object") {
    return;
  }
  for (const [id, answer] of Object.entries(answers)) {
    const card = document.createElement("div");
    card.className = "answer-card";
    const title = document.createElement("h3");
    title.textContent = id;
    card.appendChild(title);

    const metric = document.createElement("div");
    metric.className = "metric";

    if (answer.type === "noul") {
      metric.textContent = `noul: ${answer.noul}`;
    } else if (answer.type === "choice") {
      metric.textContent = `choice: ${answer.choice} · confidence: ${answer.confidence}`;
      if (answer.probabilities) {
        metric.textContent += `\nprobabilities: ${JSON.stringify(answer.probabilities)}`;
      }
    } else if (answer.type === "score") {
      metric.textContent = `score: ${answer.score} · confidence: ${answer.confidence}`;
      if (answer.probabilities) {
        metric.textContent += `\nprobabilities: ${JSON.stringify(answer.probabilities)}`;
      }
    } else {
      metric.textContent = JSON.stringify(answer, null, 2);
    }
    card.appendChild(metric);
    answerGrid.appendChild(card);
  }
}

async function evaluate() {
  let state;
  try {
    state = JSON.parse(stateEditor.value);
  } catch {
    state = stateEditor.value;
  }

  evaluateBtn.disabled = true;
  setStatus("Calling Worker → TypeSafe System One (jev-latest)…");
  resultsEl.textContent = "";
  answerGrid.innerHTML = "";

  try {
    const res = await fetch("/api/jev-as-judge/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });
    const data = await res.json();
    resultsEl.textContent = JSON.stringify(data, null, 2);

    if (!res.ok) {
      setStatus(data.message || data.error || `Request failed (${res.status})`, true);
      return;
    }

    renderAnswerCards(data.answers);
    const model = data.model || data.model_requested || "jev-latest";
    setStatus(`Live TypeSafe response · model: ${model}`);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Network error", true);
  } finally {
    evaluateBtn.disabled = false;
  }
}

loadSampleBtn.addEventListener("click", () => {
  loadSample().catch((e) => setStatus(e.message, true));
});
evaluateBtn.addEventListener("click", () => {
  evaluate();
});

loadSample().catch(() => {
  setStatus("Could not load sample; paste your own agent state JSON.");
});
