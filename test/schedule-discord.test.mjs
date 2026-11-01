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
  chart: { title: "Alpha", artist: "Artist", difficulty: "MASTER", displayLevel: "14", type: "DX", genre: "maimai", version: "CiRCLE", imageUrl: "https://maimaidx.jp/maimai-mobile/img/Music/test.png" },
};

test("Discord Embedに曲・譜面・Lv・タイプ・目標・ジャケットを含める", () => {
  const payload = buildDiscordPayload(record);
  assert.equal(payload.embeds[0].title, "今週のmaimai課題曲");
  assert.match(payload.embeds[0].description, /Alpha/);
  assert.deepEqual(payload.embeds[0].fields.slice(0, 4).map((field) => field.value), ["MASTER", "14", "DX", "AP"]);
  assert.equal(payload.embeds[0].thumbnail.url, record.chart.imageUrl);
  assert.deepEqual(payload.allowed_mentions, { parse: [] });
});

test("ジャケットを取得してDiscordへ添付画像として送信する", async () => {
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
    return { ok: true, status: 204 };
  });
  assert.equal(result.skipped, false);
  assert.equal(result.jacketUploaded, true);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].options.method, "POST");
  assert.ok(requests[1].options.body instanceof FormData);
  const payload = JSON.parse(requests[1].options.body.get("payload_json"));
  assert.equal(payload.embeds[0].thumbnail.url, "attachment://jacket.png");
  assert.equal(payload.embeds[0].footer.text, "課題ID: weekly:2026-W45");
});
