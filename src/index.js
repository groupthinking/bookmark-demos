import { handleParallelDecisions } from "../demos/parallel-decisions/api.js";
import { handleKarpathyApi } from "./karpathy-tooling/api.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") {
      return Response.json({
        ok: true,
        service: "bookmark-demos",
        pattern: "x-bookmarks → cursor-agent → cloudflare-preview",
      });
    }
    if (url.pathname.startsWith("/api/karpathy-tooling")) {
      return handleKarpathyApi(request, url);
    }
    if (
      url.pathname.startsWith("/api/parallel-decisions") ||
      url.pathname === "/demos/parallel-decisions" ||
      url.pathname.startsWith("/demos/parallel-decisions/")
    ) {
      return handleParallelDecisions(request, url, env);
    }
    return env.ASSETS.fetch(request);
  },
};
