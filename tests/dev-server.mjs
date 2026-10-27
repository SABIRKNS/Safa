// Tiny local server for testing: serves /public and runs the same API code, with in-memory storage.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createApi } from "../netlify/server/core.mjs";

const mem = new Map();
const store = {
  get: async (k) => (mem.has(k) ? structuredClone(mem.get(k)) : null),
  set: async (k, v) => void mem.set(k, structuredClone(v)),
  list: async (p) => [...mem.keys()].filter((k) => k.startsWith(p))
};
const api = createApi({ store, env: { TEACHER_CODE: "SCHOOL-123" } });
const root = path.resolve("public");
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".pdf": "application/pdf" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/api/")) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = await api(new Request(url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) }));
    res.writeHead(r.status, Object.fromEntries(r.headers)); return res.end(await r.text());
  }
  let p = path.join(root, url.pathname === "/" ? "index.html" : url.pathname);
  if (!p.startsWith(root) || !fs.existsSync(p)) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(8888, () => console.log("dev server on http://localhost:8888"));
