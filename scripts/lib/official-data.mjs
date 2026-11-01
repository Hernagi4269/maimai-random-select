const SOURCE_URL = "https://maimai.sega.jp/data/maimai_songs.json";
const IMAGE_BASE_URL = "https://maimaidx.jp/maimai-mobile/img/Music/";
const DIFFICULTY_FIELDS = [
  ["bas", "BASIC"],
  ["adv", "ADVANCED"],
  ["exp", "EXPERT"],
  ["mas", "MASTER"],
  ["remas", "Re:MASTER"],
];

const VERSION_NAMES = [
  [10000, "maimai"], [11000, "maimai PLUS"], [12000, "GreeN"], [13000, "GreeN PLUS"],
  [14000, "ORANGE"], [15000, "ORANGE PLUS"], [16000, "PiNK"], [17000, "PiNK PLUS"],
  [18000, "MURASAKi"], [18500, "MURASAKi PLUS"], [19000, "MiLK"], [19500, "MiLK PLUS"],
  [19900, "FiNALE"], [20000, "でらっくす"], [20500, "でらっくす PLUS"], [21000, "Splash"],
  [21500, "Splash PLUS"], [22000, "UNiVERSE"], [22500, "UNiVERSE PLUS"], [23000, "FESTiVAL"],
  [23500, "FESTiVAL PLUS"], [24000, "BUDDiES"], [24500, "BUDDiES PLUS"], [25000, "PRiSM"],
  [25500, "PRiSM PLUS"], [26000, "CiRCLE"], [26500, "CiRCLE PLUS"], [27000, "MAGiCAL"],
];

function hash(value) {
  let result = 0x811c9dc5;
  for (const character of value) {
    result ^= character.codePointAt(0);
    result = Math.imul(result, 0x01000193);
  }
  return (result >>> 0).toString(36);
}

function versionName(rawCode) {
  const code = Number(rawCode);
  let selected = `不明 (${rawCode})`;
  for (const [minimum, label] of VERSION_NAMES) {
    if (code >= minimum) selected = label;
    else break;
  }
  return selected;
}

function normalizeCharts(raw, songId) {
  const charts = [];
  for (const [type, prefix] of [["STD", "lev_"], ["DX", "dx_lev_"]]) {
    for (const [suffix, difficulty] of DIFFICULTY_FIELDS) {
      const displayLevel = raw[`${prefix}${suffix}`];
      if (!displayLevel) continue;
      charts.push({
        chartId: `${songId}:${type}:${difficulty}`,
        difficulty,
        displayLevel: String(displayLevel),
        internalLevel: null,
        type,
        available: true,
      });
    }
  }
  return charts;
}

export function normalizeOfficialSongs(rawSongs, metadata = {}) {
  if (!Array.isArray(rawSongs)) throw new TypeError("Official song data must be an array");
  const songs = rawSongs.map((raw) => {
    const stableSourceKey = `${raw.sort ?? ""}|${raw.title ?? ""}|${raw.artist ?? ""}`;
    const songId = `sega-${raw.sort ?? "x"}-${hash(stableSourceKey)}`;
    const imageFile = String(raw.image_url ?? "").trim();
    return {
      songId,
      sourceSongId: raw.sort ? String(raw.sort) : null,
      title: String(raw.title ?? "").trim(),
      titleKana: String(raw.title_kana ?? "").trim() || null,
      artist: String(raw.artist ?? "").trim(),
      genre: String(raw.catcode ?? "").trim(),
      versionCode: String(raw.version ?? ""),
      version: versionName(raw.version),
      release: String(raw.release ?? "") || null,
      imageUrl: imageFile ? new URL(imageFile, IMAGE_BASE_URL).toString() : null,
      available: true,
      charts: normalizeCharts(raw, songId),
    };
  }).filter((song) => song.title && song.charts.length > 0);

  const chartIds = songs.flatMap((song) => song.charts.map((chart) => chart.chartId));
  if (new Set(chartIds).size !== chartIds.length) throw new Error("Duplicate chart IDs detected");

  return {
    schemaVersion: 1,
    source: {
      name: "maimai でらっくす公式 楽曲リスト",
      url: SOURCE_URL,
      fetchedAt: metadata.fetchedAt ?? new Date().toISOString(),
      lastModified: metadata.lastModified ?? null,
      note: "公式楽曲リストのimage_urlからジャケット画像URLを参照し、画像ファイル自体は保存しません。",
    },
    songs,
    stats: { songs: songs.length, charts: chartIds.length },
  };
}

export async function fetchOfficialSongs(fetchImpl = fetch) {
  const response = await fetchImpl(SOURCE_URL, {
    headers: { "user-agent": "maimai-random-select/1.0 (+https://github.com/Hernagi4269/maimai-random-select)" },
  });
  if (!response.ok) throw new Error(`Official data fetch failed: HTTP ${response.status}`);
  const raw = await response.json();
  return normalizeOfficialSongs(raw, {
    fetchedAt: new Date().toISOString(),
    lastModified: response.headers.get("last-modified"),
  });
}

export { SOURCE_URL, IMAGE_BASE_URL, versionName };
