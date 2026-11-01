import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchOfficialSongs } from "./lib/official-data.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, "data"), { recursive: true });
await cp(resolve(root, "src", "web"), dist, { recursive: true });
await cp(resolve(root, "src", "core"), resolve(dist, "core"), { recursive: true });

let database;
try {
  database = JSON.parse(await readFile(resolve(root, ".cache", "songs.json"), "utf8"));
} catch {
  database = await fetchOfficialSongs();
}
await writeFile(resolve(dist, "data", "songs.json"), `${JSON.stringify(database)}\n`, "utf8");
await cp(resolve(root, "data", "automated-history.json"), resolve(dist, "data", "history.json"));
console.log(`Built dist with ${database.stats.songs} songs / ${database.stats.charts} charts`);

