import test from "node:test";
import assert from "node:assert/strict";
import { normalizeOfficialSongs, versionName } from "../scripts/lib/official-data.mjs";

const source = [{
  sort: "100",
  title: "テスト曲",
  title_kana: "テストキヨク",
  artist: "テスト作曲者",
  catcode: "maimai",
  version: "25000",
  release: "260101",
  lev_bas: "4",
  lev_adv: "8",
  lev_exp: "11+",
  lev_mas: "13+",
  dx_lev_bas: "3",
  dx_lev_adv: "7",
  dx_lev_exp: "10+",
  dx_lev_mas: "13",
  dx_lev_remas: "14",
}];

test("公式データを曲・譜面の統一形式へ正規化する", () => {
  const database = normalizeOfficialSongs(source, { fetchedAt: "2026-11-01T00:00:00.000Z" });
  assert.equal(database.songs.length, 1);
  assert.equal(database.songs[0].version, "PRiSM");
  assert.equal(database.songs[0].charts.length, 9);
  assert.equal(database.songs[0].charts.find((chart) => chart.type === "DX" && chart.difficulty === "Re:MASTER").displayLevel, "14");
  assert.equal(database.songs[0].charts[0].internalLevel, null);
  assert.equal(database.stats.charts, 9);
});

test("画像URLや未使用の公式フィールドは正規化データへ転載しない", () => {
  const database = normalizeOfficialSongs([{ ...source[0], image_url: "copyrighted.png", secret: "unused" }]);
  assert.equal("image_url" in database.songs[0], false);
  assert.equal("secret" in database.songs[0], false);
});

test("バージョン枝番を対応するメジャーバージョンへまとめる", () => {
  assert.equal(versionName("11007"), "maimai PLUS");
  assert.equal(versionName("26599"), "CiRCLE PLUS");
  assert.equal(versionName("27000"), "MAGiCAL");
});

