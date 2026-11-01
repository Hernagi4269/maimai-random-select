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

test("Discord Embedに曲・譜面・Lv・タイプ・目標・期限・ジャケットを含める", () => {
  const payload = buildDiscordPayload(record);
  assert.equal(payload.embeds[0].title, "今週のmaimai課題曲");
  assert.match(payload.embeds[0].description, /Alpha/);
  assert.deepEqual(payload.embeds[0].fields.slice(0, 4).map((field) => field.value), ["MASTER", "14", "DX", "AP"]);
  assert.match(payload.embeds[0].fields.find((field) => field.name === "期限").value, /2026\/11\/23/);
  assert.equal(payload.embeds[0].thumbnail.url, record.chart.imageUrl);
  assert.deepEqual(payload.allowed_mentions, { parse: [] });
});

test("ジャケットを取得してDiscordへ添付し、メッセージIDを取得する", async () => {
  const requests = [];
  const result = await postDiscordWebhook("https://example.invalid/webhook", record, async (url, options = {}) => {
    requests.push({ url, options });
    if (url === record.chart.imageUrl) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => "image/png" },
        arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
      };
    }
    return { ok: true, status: 200, json: async () => ({ id: "123456789" }) };
  });
  assert.equal(result.skipped, false);
  assert.equal(result.jacketUploaded, true);
  assert.equal(result.messageId, "123456789");
  assert.match(requests[1].url, /wait=true/);
  assert.equal(requests[1].options.method, "POST");
  assert.ok(requests[1].options.body instanceof FormData);
  const payload = JSON.parse(requests[1].options.body.get("payload_json"));
  assert.equal(payload.embeds[0].thumbnail.url, "attachment://jacket.png");
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
