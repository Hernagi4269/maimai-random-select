import test from "node:test";
import assert from "node:assert/strict";
import { mergeHistory, parseHistory, serializeHistory } from "../src/core/history.mjs";

const one = { id: "manual:1", drawnAt: "2026-11-01T00:00:00Z", chart: { chartId: "a" } };
const two = { id: "weekly:1", drawnAt: "2026-11-02T00:00:00Z", chart: { chartId: "b" } };

test("履歴をJSONで保存・復元できる", () => {
  assert.deepEqual(parseHistory(serializeHistory([one])), [one]);
});

test("ローカル履歴と自動履歴をID重複なしで新しい順に統合する", () => {
  assert.deepEqual(mergeHistory([one], { records: [two, one] }).map((record) => record.id), ["weekly:1", "manual:1"]);
});

test("壊れた履歴データは空配列として安全に扱う", () => {
  assert.deepEqual(parseHistory("not json"), []);
});

