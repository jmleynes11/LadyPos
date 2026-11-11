import { fileURLToPath } from "node:url";
import { createServer } from "vite";

if (process.env.GCASH_REVIEW_FIXTURE_ONLY !== "1") throw Error("Explicit disposable preview activation required");
const server = await createServer({ root: fileURLToPath(new URL("..", import.meta.url)), configFile: fileURLToPath(new URL("../vite.config.js", import.meta.url)), envDir: false,
  plugins: [{ name: "gcash-review-preview", configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url !== "/__gcash-review") return next();
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(await server.transformIndexHtml(req.url, '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Disposable GCash review preview</title></head><body><div id="root"></div><script type="module" src="/tests/gcashReviewFixture.jsx"></script></body></html>'));
    });
  } }], server: { host: "127.0.0.1", port: 5188, strictPort: true } });
await server.listen();
process.stdout.write("GCash review preview: http://127.0.0.1:5188/__gcash-review; no backend, accounts, orders or payments\n");
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, async () => { await server.close(); process.exit(0); });
