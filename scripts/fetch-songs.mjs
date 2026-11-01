import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchOfficialSongs } from "./lib/official-data.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argumentIndex = process.argv.indexOf("--output");
const output = argumentIndex >= 0 ? resolve(process.argv[argumentIndex + 1]) : resolve(root, ".cache", "songs.json");
const database = await fetchOfficialSongs();
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(database)}\n`, "utf8");
console.log(`Updated ${database.stats.songs} songs / ${database.stats.charts} charts -> ${output}`);

