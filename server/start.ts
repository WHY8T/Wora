// Persistent-server entrypoint used for Docker / local "node dist/start.js".
// Not used on Vercel — Vercel invokes api/[...path].ts as a serverless
// function instead and serves dist/public as static output directly.
import app from "./app.js";
import { env } from "./lib/env.js";

const { serve } = await import("@hono/node-server");
const { serveStaticFiles } = await import("./lib/vite.js");
serveStaticFiles(app);

const port = parseInt(process.env.PORT || "3000");
serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running on http://localhost:${port}/`);
});

if (env.isProduction) {
  const warmUp = (url: string) =>
    fetch(url, { signal: AbortSignal.timeout(15000) }).catch(() => {});
  void warmUp("https://www.googleapis.com/books/v1/volumes?q=warmup&maxResults=1");
  void warmUp("https://gutendex.com/books?search=warmup");
}
