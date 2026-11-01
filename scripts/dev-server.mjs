import { createReadStream, existsSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { createServer } from "node:http";
import { spawn } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const build = spawn(process.execPath, [join(root, "scripts", "build.mjs")], { stdio: "inherit" });
await new Promise((resolveBuild, rejectBuild) => {
  build.on("exit", (code) => code === 0 ? resolveBuild() : rejectBuild(new Error(`Build failed: ${code}`)));
});

const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml" };
const dist = join(root, "dist");
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const candidate = normalize(join(dist, pathname === "/" ? "index.html" : pathname));
  const file = candidate.startsWith(dist) && existsSync(candidate) ? candidate : join(dist, "index.html");
  response.setHeader("content-type", mime[extname(file)] ?? "application/octet-stream");
  createReadStream(file).pipe(response);
});
const port = Number(process.env.PORT || 4173);
server.listen(port, "127.0.0.1", () => console.log(`Local preview: http://127.0.0.1:${port}`));

