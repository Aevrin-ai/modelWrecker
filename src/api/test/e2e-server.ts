// TEST ONLY. Serves the real API app over local HTTP with the in-memory database, so the Python
// engine's `modelwrecker login` and `modelwrecker sync` can be exercised end to end without Supabase.
// It accepts exactly one fake user token. Never deployed (the Worker entry point is src/index.ts).
//
//   npx vite-node test/e2e-server.ts        # listens on 127.0.0.1:8787
import { createServer } from "node:http";
import { createApp } from "../src/app";
import { MemoryDb } from "../src/db/memory";

const PORT = Number(process.env.PORT ?? 8787);
const USER_TOKEN = "e2e-user-token";
const db = new MemoryDb();
const app = createApp({
  serviceDb: db,
  userDb: () => db,
  verifyUser: async (t) => (t === USER_TOKEN ? { id: "e2e-user", email: "e2e@example.com", name: "E2E" } : null),
  appOrigin: "http://127.0.0.1:5174",
  now: () => new Date(),
});

createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
  const response = await app.fetch(
    new Request(`http://127.0.0.1:${PORT}${req.url}`, { method: req.method, headers, body: body && body.length ? body : undefined }),
  );
  res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(PORT, "127.0.0.1", () => console.log(`e2e api on http://127.0.0.1:${PORT}/api/v1`));
