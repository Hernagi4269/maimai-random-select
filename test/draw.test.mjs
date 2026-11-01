import test from "node:test";
import assert from "node:assert/strict";
import { NoCandidatesError, createHistoryRecord, drawChallenge, excludeRecent, filterCharts } from "../src/core/draw.mjs";

const songs = {
  songs: [
    {
      songId: "a", title: "Alpha", artist: "A", genre: "maimai", version: "PRiSM", versionCode: "25000", available: true,
      charts: [
        { chartId: "a:STD:MASTER", difficulty: "MASTER", displayLevel: "13+", internalLevel: 13.8, type: "STD", available: true },
        { chartId: "a:DX:MASTER", difficulty: "MASTER", displayLevel: "14", internalLevel: 14.1, type: "DX", available: true },
      ],
    },
    {
      songId: "b", title: "Beta", artist: "B", genre: "POPS＆アニメ", version: "CiRCLE", versionCode: "26000", available: true,
      charts: [
        { chartId: "b:DX:EXPERT", difficulty: "EXPERT", displayLevel: "12+", internalLevel: 12.9, type: "DX", available: true },
        { chartId: "b:DX:Re:MASTER", difficulty: "Re:MASTER", displayLevel: "14+", internalLevel: null, type: "DX", available: true },
      ],
    },
    {
      songId: "removed", title: "Removed", artist: "R", genre: "maimai", version: "PRiSM", available: false,
      charts: [{ chartId: "removed:DX:MASTER", difficulty: "MASTER", displayLevel: "14", type: "DX", available: true }],
    },
  ],
};

const baseFilters = { difficulties: ["MASTER"], levelMin: "13+", levelMax: "14+", types: ["STD", "DX"], genres: [], versions: [] };

test("難易度・表示Lv・STD/DXの組み合わせで譜面単位に絞る", () => {
  const result = filterCharts(songs, { ...baseFilters, types: ["DX"] });
  assert.deepEqual(result.map((chart) => chart.chartId), ["a:DX:MASTER"]);
});

test("ジャンルと追加バージョンで絞り込む", () => {
  const result = filterCharts(songs, { ...baseFilters, genres: ["maimai"], versions: ["PRiSM"] });
  assert.equal(result.length, 2);
});

test("内部Lv指定時は内部Lv不明の譜面を含めない", () => {
  const result = filterCharts(songs, { ...baseFilters, internalLevelMin: 14, internalLevelMax: 14.2 });
  assert.deepEqual(result.map((chart) => chart.chartId), ["a:DX:MASTER"]);
});

test("現在収録中でない曲を候補に含めない", () => {
  assert.equal(filterCharts(songs, baseFilters).some((chart) => chart.songId === "removed"), false);
});

test("同じ曲の別譜面を独立した候補として扱う", () => {
  assert.equal(filterCharts(songs, baseFilters).filter((chart) => chart.songId === "a").length, 2);
});

test("候補0件では分かりやすい例外を返す", () => {
  assert.throws(() => drawChallenge({ songDatabase: songs, filters: { ...baseFilters, levelMin: "15", levelMax: "15" }, achievement: "AP" }), NoCandidatesError);
});

test("直近N回と日数による同曲除外が働く", () => {
  const candidates = filterCharts(songs, baseFilters);
  const history = [{ id: "old-a", drawnAt: "2026-10-31T00:00:00.000Z", chart: candidates[0] }];
  const result = excludeRecent(candidates, history, { unit: "song", recentCount: 1, days: 0 }, new Date("2026-11-01T00:00:00Z"));
  assert.equal(result.some((chart) => chart.songId === "a"), false);
});

test("譜面単位除外なら同曲の別譜面を残す", () => {
  const candidates = filterCharts(songs, baseFilters);
  const history = [{ id: "old-a", drawnAt: "2026-10-31T00:00:00.000Z", chart: candidates[0] }];
  const result = excludeRecent(candidates, history, { unit: "chart", recentCount: 1, days: 0 }, new Date("2026-11-01T00:00:00Z"));
  assert.equal(result.filter((chart) => chart.songId === "a").length, 1);
});

test("除外で0件になった場合は抽選条件を変えず重複除外だけ緩和する", () => {
  const only = { ...baseFilters, types: ["STD"] };
  const chart = filterCharts(songs, only)[0];
  const result = drawChallenge({
    songDatabase: songs, filters: only, achievement: "AP", random: () => 0,
    history: [{ id: "old-a", drawnAt: "2026-10-31T00:00:00.000Z", chart }],
    exclusion: { unit: "song", recentCount: 1, days: 90, relaxWhenEmpty: true },
    now: new Date("2026-11-01T00:00:00Z"),
  });
  assert.equal(result.chart.chartId, chart.chartId);
  assert.equal(result.exclusionRelaxed, true);
});

test("抽選履歴に条件・目標・抽選元を保存する", () => {
  const result = drawChallenge({ songDatabase: songs, filters: baseFilters, achievement: "SSS+", random: () => 0 });
  const record = createHistoryRecord({ source: "weekly", result, filters: baseFilters, exclusion: {}, now: new Date("2026-11-01T00:00:00Z"), periodKey: "2026-W44" });
  assert.equal(record.id, "weekly:2026-W44");
  assert.equal(record.achievement, "SSS+");
  assert.equal(record.filters.levelMin, "13+");
});

