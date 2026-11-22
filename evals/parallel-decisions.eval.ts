import { defineEval, includes } from "@grok/agent-sdk/evals";

const CLAY_BODY = {
  state: { company: "Clay", website: "https://www.clay.com" },
  questions: {
    decision: {
      type: "noul",
      instructions: "Does Clay offer an official CLI?",
    },
  },
};

export default defineEval({
  tags: ["smoke", "parallel-decisions"],
  timeoutMs: 120_000,
  cases: [
    {
      id: "missing-key",
      description: "An unset key builds the request and does not send it.",
      async test(t) {
        await t.send(
          "PARALLEL_API_KEY is unset. Question type noul. Instructions: Has Parallel announced a Decisions API? Build the request. Do not send it. Do not invent a probability.",
        );
        t.succeeded();
        t.calledTool("build_decision_request");
        t.notCalledTool("decide");
        t.check(t.reply, includes(/missing_api_key/));
      },
    },
    {
      id: "noul-send",
      description: "A set key builds the Clay noul body and chooses to send it.",
      async test(t) {
        await t.send(
          'PARALLEL_API_KEY is set. Build and send one noul question. instructions: Does Clay offer an official CLI? state: {"company":"Clay","website":"https://www.clay.com"}. name: decision.',
        );
        t.succeeded();
        t.calledTool("build_decision_request", { output: { ok: true, body: CLAY_BODY } });
        t.calledTool("decide", {
          input: { keyConfigured: true },
          output: { calledParallel: false, reason: "eval" },
        });
      },
    },
    {
      id: "one-sided",
      description: "One-sided predicate criteria fail the builder and are not sent.",
      async test(t) {
        await t.send(
          "PARALLEL_API_KEY is set. Predicate instructions: Is this true? trueCriteria: yes case. No false criteria. Build the request. If the builder rejects it, do not send it and do not invent an answer.",
        );
        t.succeeded();
        t.calledTool("build_decision_request", { status: "failed" });
        t.notCalledTool("decide");
      },
    },
  ],
});
