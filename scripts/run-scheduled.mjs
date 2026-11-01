import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomInt } from "node:crypto";
import { fetchOfficialSongs } from "./lib/official-data.mjs";
import { createHistoryRecord, drawChallenge } from "../src/core/draw.mjs";
import { dueScheduleTypes, periodKey } from "../src/core/schedule.mjs";
import { deleteDiscordWebhookMessage, isChallengeExpired, postDiscordWebhook } from "../src/core/discord.mjs";

const root = resolve(import.meta.dirname, "..");
const config = JSON.parse(await readFile(resolve(root, "config", "schedules.json"), "utf8"));
const historyPath = resolve(root, "data", "automated-history.json");
const historyDocument = JSON.parse(await readFile(historyPath, "utf8"));
const history = historyDocument.records ?? [];
const modeArg = process.argv.find((argument) => argument.startsWith("--mode="))?.split("=")[1] ?? process.env.CHALLENGE_TYPE ?? "auto";
const notify = process.argv.includes("--notify") || process.env.SEND_DISCORD === "true";
const dryRun = process.argv.includes("--dry-run");
const manualRun = Boolean(process.env.CHALLENGE_TYPE);
const now = process.env.NOW ? new Date(process.env.NOW) : new Date();
const modes = dueScheduleTypes(config, now, modeArg);

if (notify && !process.env.DISCORD_WEBHOOK_URL) {
  throw new Error("Discord notification was requested, but DISCORD_WEBHOOK_URL is not set.");
}

let historyChanged = false;
if (notify && !dryRun) {
  for (const record of history) {
    if (!record.discordMessageId || record.discordDeletedAt || !isChallengeExpired(record, now)) continue;
    const result = await deleteDiscordWebhookMessage(process.env.DISCORD_WEBHOOK_URL, record.discordMessageId);
    if (result.skipped) throw new Error(`Discord delete skipped unexpectedly: ${result.reason}`);
    record.discordDeletedAt = now.toISOString();
    historyChanged = true;
    console.log(`Discord expired message deleted: ${record.id}`);
  }
}

if (modes.length === 0) {
  if (historyChanged) {
    await writeFile(historyPath, `${JSON.stringify({ schemaVersion: 1, records: history }, null, 2)}\n`, "utf8");
  }
  console.log("No challenge is due today.");
  process.exit(0);
}

const database = await fetchOfficialSongs();
const songById = new Map(database.songs.map((song) => [song.songId, song]));
const withCurrentSongMetadata = (record) => {
  const song = songById.get(record?.chart?.songId);
  if (!song) return record;
  return { ...record, chart: { ...record.chart, imageUrl: song.imageUrl ?? record.chart.imageUrl ?? null } };
};
const created = [];
const toNotify = [];
for (const source of modes) {
  const schedule = config[source];
  const key = periodKey(source, now, config.timeZone);
  const id = `${source}:${key}`;
  const existing = history.find((record) => record.id === id);
  if (existing) {
    console.log(`Already exists: ${id}`);
    if (manualRun && notify) {
      toNotify.push({ storedRecord: existing, sendRecord: withCurrentSongMetadata(existing) });
      console.log(`Manual run: existing challenge will be resent to Discord: ${id}`);
    }
    continue;
  }
  const result = drawChallenge({
    songDatabase: database,
    filters: schedule.filters,
    history,
    exclusion: schedule.exclusion,
    achievement: schedule.achievement,
    now,
    random: () => randomInt(0, 1_000_000) / 1_000_000,
  });
  const record = createHistoryRecord({
    source,
    result,
    filters: schedule.filters,
    exclusion: schedule.exclusion,
    now,
    periodKey: key,
  });
  history.unshift(record);
  created.push(record);
  toNotify.push({ storedRecord: record, sendRecord: record });
  historyChanged = true;
  console.log(`${source}: ${record.chart.title} / ${record.chart.difficulty} ${record.chart.displayLevel} ${record.chart.type}`);
}

if (dryRun) {
  console.log("Dry run: history and Discord were not changed.");
  process.exit(0);
}

if (notify) {
  for (const { storedRecord, sendRecord } of toNotify) {
    if (storedRecord.discordMessageId && !storedRecord.discordDeletedAt) {
      const oldResult = await deleteDiscordWebhookMessage(process.env.DISCORD_WEBHOOK_URL, storedRecord.discordMessageId);
      if (oldResult.skipped) throw new Error(`Discord replacement delete skipped unexpectedly: ${oldResult.reason}`);
      console.log(`Discord previous message deleted before resend: ${storedRecord.id}`);
    }
    const result = await postDiscordWebhook(process.env.DISCORD_WEBHOOK_URL, sendRecord);
    if (result.skipped) throw new Error(`Discord skipped unexpectedly: ${result.reason}`);
    storedRecord.discordMessageId = result.messageId;
    storedRecord.discordDeletedAt = null;
    historyChanged = true;
    console.log(`Discord sent: ${storedRecord.id} / message ${result.messageId}`);
  }
}

if (historyChanged) {
  await writeFile(historyPath, `${JSON.stringify({ schemaVersion: 1, records: history }, null, 2)}\n`, "utf8");
}
