import assert from "node:assert/strict";
import test from "node:test";
import { DecisionInputError, buildDecisionBody } from "./build-request.js";

test("predicate question sends state and a noul question", () => {
  const body = buildDecisionBody({
    instructions: "Does Clay offer an official CLI?",
    state: { company: "Clay", website: "https://www.clay.com" },
  });
  assert.deepEqual(body, {
    state: { company: "Clay", website: "https://www.clay.com" },
    questions: {
      decision: {
        type: "noul",
        instructions: "Does Clay offer an official CLI?",
      },
    },
  });
});

test("plain-text state is wrapped and optional noul criteria require both sides", () => {
  const body = buildDecisionBody({
    type: "noul",
    instructions: "Has Parallel announced data residency in Europe?",
    state: "Check the current Parallel docs.",
    trueCriteria: "A Parallel page states EU data residency is available.",
    falseCriteria: "Parallel states that EU data residency is not available.",
  });
  assert.deepEqual(body.state, { context: "Check the current Parallel docs." });
  assert.deepEqual(body.questions.decision.criteria, {
    true: "A Parallel page states EU data residency is available.",
    false: "Parallel states that EU data residency is not available.",
  });
});

test("one-sided predicate criteria is rejected", () => {
  assert.throws(
    () => buildDecisionBody({ instructions: "Is this true?", trueCriteria: "yes case" }),
    DecisionInputError
  );
});

test("choice options and score levels match the documented limits", () => {
  const choice = buildDecisionBody({
    type: "choice",
    name: "employee_band",
    instructions: "Which employee band is documented?",
    criteria: "band_11_100 | 11 to 100 employees.\nband_101_500 | 101 to 500 employees.",
    afterDate: "2026-10-01",
    location: "US",
  });
  assert.equal(choice.questions.employee_band.type, "choice");
  assert.equal(Object.keys(choice.questions.employee_band.criteria).length, 2);
  assert.deepEqual(choice.advanced_settings, { after_date: "2026-10-01", location: "us" });

  const score = buildDecisionBody({
    type: "score",
    instructions: "How complete is the public CLI documentation?",
    criteria: "No CLI docs.\nPartial CLI docs.\nCLI docs cover search and enrichment.",
    includeExcerpts: false,
  });
  assert.equal(score.questions.decision.criteria.length, 3);
  assert.deepEqual(score.advanced_settings, { include_excerpts: false });
});

test("empty advanced settings are omitted and invalid shapes fail", () => {
  const body = buildDecisionBody({ instructions: "Is the docs page public?" });
  assert.equal(Object.hasOwn(body, "advanced_settings"), false);
  assert.deepEqual(body.state, {});
  assert.throws(() => buildDecisionBody({ type: "choice", instructions: "Pick", criteria: "only | one" }), DecisionInputError);
  assert.throws(() => buildDecisionBody({ type: "score", instructions: "Rate", criteria: "only one" }), DecisionInputError);
  assert.throws(() => buildDecisionBody({ instructions: "Q", name: "has space" }), DecisionInputError);
  assert.throws(() => buildDecisionBody({ instructions: "Q", afterDate: "10/01/2026" }), DecisionInputError);
  assert.throws(() => buildDecisionBody({ instructions: "Q", state: "{not json" }), DecisionInputError);
});
