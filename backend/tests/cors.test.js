import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../app.js";

test("CORS supports fallback origins, environment configuration and preflight", async t => {
  const previous = process.env.CORS_ALLOWED_ORIGINS;
  t.after(() => {
    if (previous === undefined) delete process.env.CORS_ALLOWED_ORIGINS;
    else process.env.CORS_ALLOWED_ORIGINS = previous;
  });

  async function start(value) {
    if (value === undefined) delete process.env.CORS_ALLOWED_ORIGINS;
    else process.env.CORS_ALLOWED_ORIGINS = value;
    const server = createApp().listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    return `http://127.0.0.1:${server.address().port}/`;
  }

  for (const value of [undefined, " , "]) {
    const url = await start(value);
    for (const origin of ["https://uphsd-pos.netlify.app", "http://localhost:5173"]) {
      const response = await fetch(url, { method: "OPTIONS", headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type",
      } });
      assert.equal(response.status, 204);
      assert.equal(response.headers.get("access-control-allow-origin"), origin);
      assert.equal(response.headers.get("access-control-allow-credentials"), "true");
      assert.match(response.headers.get("access-control-allow-headers"), /authorization/);
    }
    const rejected = await fetch(url, { headers: { Origin: "https://unlisted.example" } });
    assert.equal(rejected.status, 403);
    assert.equal(rejected.headers.get("access-control-allow-origin"), null);
    assert.equal((await fetch(url)).status, 200);
  }

  const url = await start(" https://custom.example/, http://localhost:5173/ ");
  const response = await fetch(url, { headers: { Origin: "https://custom.example" } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://custom.example");
  assert.equal((await fetch(url, { headers: { Origin: "https://uphsd-pos.netlify.app" } })).status, 403);
});
