import test from "node:test";
import assert from "node:assert/strict";
import { dueScheduleTypes, isoWeekKey, periodKey } from "../src/core/schedule.mjs";
import { buildDiscordPayload, deleteDiscordWebhookMessage, isChallengeExpired, postDiscordWebhook } from "../src/core/discord.mjs";

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
  chart: { title: "Alpha", artist: "Artist", difficulty: "MASTER", displayLevel: "14", type: "DX", genre: "maimai", version: "CiRCLE", imageUrl: "https://maimaidx.jp/maimai-mobile/img/Music/test.png" },
};

test("Discord Embedに曲・譜面・Lv・タイプ・目標・期限を含み、ジャケットは表示しない", () => {
  const payload = buildDiscordPayload(record);
  assert.equal(payload.embeds[0].title, "今週のmaimai課題曲");
  assert.match(payload.embeds[0].description, /Alpha/);
  assert.deepEqual(payload.embeds[0].fields.slice(0, 4).map((field) => field.value), ["MASTER", "14", "DX", "AP"]);
  assert.match(payload.embeds[0].fields.find((field) => field.name === "期限").value, /2026\/11\/23/);
  assert.equal(payload.embeds[0].thumbnail, undefined);
  assert.deepEqual(payload.allowed_mentions, { parse: [] });
});

test("ジャケットなしでDiscordへ投稿し、メッセージIDを取得する", async () => {
  const requests = [];
  const result = await postDiscordWebhook("https://example.invalid/webhook", record, async (url, options = {}) => {
    requests.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ id: "123456789" }) };
  });
  assert.equal(result.skipped, false);
  assert.equal(result.jacketUploaded, false);
  assert.equal(result.messageId, "123456789");
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /wait=true/);
  assert.equal(requests[0].options.method, "POST");
  assert.equal(requests[0].options.headers["content-type"], "application/json");
  const payload = JSON.parse(requests[0].options.body);
  assert.equal(payload.embeds[0].thumbnail, undefined);
});

test("抽選から3週間で期限切れになる", () => {
  assert.equal(isChallengeExpired(record, new Date("2026-11-22T23:59:59.999Z")), false);
  assert.equal(isChallengeExpired(record, new Date("2026-11-23T00:00:00.000Z")), true);
});

test("WebhookメッセージをID指定で削除できる", async () => {
  let request;
  const result = await deleteDiscordWebhookMessage("https://example.invalid/webhook", "123456789", async (url, options) => {
    request = { url, options };
    return { ok: true, status: 204 };
  });
  assert.equal(result.skipped, false);
  assert.equal(request.url, "https://example.invalid/webhook/messages/123456789");
  assert.equal(request.options.method, "DELETE");
});
