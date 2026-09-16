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
    return env.ASSETS.fetch(request);
  },
};
