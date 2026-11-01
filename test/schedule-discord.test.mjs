import test from "node:test";
import assert from "node:assert/strict";
import { dueScheduleTypes, isoWeekKey, periodKey } from "../src/core/schedule.mjs";
import { buildDiscordPayload, postDiscordWebhook } from "../src/core/discord.mjs";

const config = {
  timeZone: "Asia/Tokyo",
  weekly: { enabled: true, weekDay: 1 },
  monthly: { enabled: true, dayOfMonth: 1 },
};

test("週課題と月課題を日本時間で別々に判定する", () => {
  assert.deepEqual(dueScheduleTypes(config, new Date("2026-11-02T00:00:00Z")), ["weekly"]);
  assert.deepEqual(dueScheduleTypes(config, new Date("2026-11-01T00:00:00Z")), ["monthly"]);
});

test("workflow_dispatch指定時は日付に関係なく対象種別だけ実行する", () => {
  assert.deepEqual(dueScheduleTypes(config, new Date("2026-11-03T00:00:00Z"), "monthly"), ["monthly"]);
});

test("期間キーが週・月で安定する", () => {
  const now = new Date("2026-11-02T00:00:00Z");
  assert.equal(isoWeekKey(now, "Asia/Tokyo"), "2026-W45");
  assert.equal(periodKey("monthly", now, "Asia/Tokyo"), "2026-11");
});

const record = {
  id: "weekly:2026-W45", source: "weekly", drawnAt: "2026-11-02T00:00:00.000Z", achievement: "AP",
  chart: { title: "Alpha", artist: "Artist", difficulty: "MASTER", displayLevel: "14", type: "DX", genre: "maimai", version: "CiRCLE" },
};

test("Discord Embedに曲・譜面・Lv・タイプ・目標を含める", () => {
  const payload = buildDiscordPayload(record);
  assert.equal(payload.embeds[0].title, "今週のmaimai課題曲");
  assert.match(payload.embeds[0].description, /Alpha/);
  assert.deepEqual(payload.embeds[0].fields.slice(0, 4).map((field) => field.value), ["MASTER", "14", "DX", "AP"]);
  assert.deepEqual(payload.allowed_mentions, { parse: [] });
});

test("Discord送信処理を外部送信なしでモック検証できる", async () => {
  let request;
  const result = await postDiscordWebhook("https://example.invalid/webhook", record, async (url, options) => {
    request = { url, options };
    return { ok: true, status: 204 };
  });
  assert.equal(result.skipped, false);
  assert.equal(request.options.method, "POST");
  assert.equal(JSON.parse(request.options.body).embeds[0].footer.text, "課題ID: weekly:2026-W45");
});

