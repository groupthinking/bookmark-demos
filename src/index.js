import { handleKarpathyApi } from "./karpathy-tooling/api.js";
import { handleJevAsJudgeApi } from "./jev-as-judge/api.js";

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
    if (url.pathname.startsWith("/api/jev-as-judge")) {
      return handleJevAsJudgeApi(request, url, env);
    }
    return env.ASSETS.fetch(request);
  },
};
