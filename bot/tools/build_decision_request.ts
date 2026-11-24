import { defineTool } from "@grok/agent-sdk/tools";
import { buildDecisionBody } from "../../demos/parallel-decisions/build-request.js";

export default defineTool({
  description:
    "Build a Parallel Decisions request body from the demo form fields. Does not call Parallel.",
  effect: "read",
  inputSchema: {
    type: "object",
    properties: {
      instructions: { type: "string" },
      type: { type: "string" },
      name: { type: "string" },
      state: {},
      trueCriteria: { type: "string" },
      falseCriteria: { type: "string" },
      criteria: {},
      afterDate: { type: "string" },
      location: { type: "string" },
      includeExcerpts: { type: "boolean" },
    },
    required: ["instructions"],
  },
  execute(input) {
    const body = buildDecisionBody(input);
    return { ok: true, body };
  },
});
