import { defineTool } from "@grok/agent-sdk/tools";
import { handleDecisionsApi } from "../../demos/parallel-decisions/decisions.js";

type DecisionPayload = {
  ok?: boolean;
  code?: unknown;
  decision?: unknown;
};

export default defineTool({
  description:
    "Send a built Decisions body. Call only when the user says PARALLEL_API_KEY is set. Never include the key.",
  effect: "write",
  inputSchema: {
    type: "object",
    properties: {
      body: { type: "object" },
      keyConfigured: { type: "boolean" },
    },
    required: ["body", "keyConfigured"],
  },
  async execute(input, ctx) {
    if (input.keyConfigured !== true) {
      return {
        ok: false,
        code: "missing_api_key",
        status: 503,
        calledParallel: false,
      };
    }
    if (ctx.session.purpose === "eval") {
      return {
        ok: false,
        reason: "eval",
        status: 0,
        calledParallel: false,
      };
    }
    const request = new Request("https://bookmark-demos.local/api/parallel-decisions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input.body),
    });
    const response = await handleDecisionsApi(request, new URL(request.url), process.env);
    const payload = (await response.json()) as DecisionPayload;
    return {
      ok: payload.ok === true,
      status: response.status,
      code: typeof payload.code === "string" ? payload.code : null,
      calledParallel: response.status !== 503,
      decision: payload.decision ?? null,
    };
  },
});
