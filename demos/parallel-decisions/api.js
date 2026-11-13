import pageCss from "./styles.css";
import pageHtml from "./index.html";
import pageJs from "./app.js";
import { handleDecisionsApi } from "./decisions.js";

const PAGES = new Map([
  ["/demos/parallel-decisions", pageHtml],
  ["/demos/parallel-decisions/", pageHtml],
  ["/demos/parallel-decisions/index.html", pageHtml],
]);

export async function handleParallelDecisions(request, url, env) {
  if (request.method === "GET" && PAGES.has(url.pathname)) {
    return new Response(PAGES.get(url.pathname), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  if (request.method === "GET" && url.pathname === "/demos/parallel-decisions/styles.css") {
    return new Response(pageCss, { headers: { "content-type": "text/css; charset=utf-8" } });
  }
  if (request.method === "GET" && url.pathname === "/demos/parallel-decisions/app.js") {
    return new Response(pageJs, { headers: { "content-type": "text/javascript; charset=utf-8" } });
  }
  if (url.pathname.startsWith("/api/parallel-decisions")) {
    return handleDecisionsApi(request, url, env);
  }
  return new Response("Not found", { status: 404 });
}
