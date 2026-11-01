import { isLevelInRange } from "./levels.mjs";

export const DIFFICULTIES = ["BASIC", "ADVANCED", "EXPERT", "MASTER", "Re:MASTER"];
export const CHART_TYPES = ["STD", "DX"];

export class NoCandidatesError extends Error {
  constructor(message = "条件に一致する譜面がありません。") {
    super(message);
    this.name = "NoCandidatesError";
  }
}

export function flattenCharts(songDatabase) {
  const songs = Array.isArray(songDatabase) ? songDatabase : songDatabase?.songs;
  if (!Array.isArray(songs)) return [];

  return songs
    .filter((song) => song.available !== false)
    .flatMap((song) => (song.charts ?? []).map((chart) => ({
      songId: song.songId,
      title: song.title,
      artist: song.artist,
      genre: song.genre,
      version: song.version,
      versionCode: song.versionCode,
      imageUrl: song.imageUrl ?? null,
      available: song.available !== false,
      ...chart,
    })))
    .filter((chart) => chart.available !== false);
}

export function filterCharts(songDatabase, filters) {
  const difficulties = new Set(filters.difficulties ?? DIFFICULTIES);
  const types = new Set(filters.types ?? CHART_TYPES);
  const genres = new Set(filters.genres ?? []);
  const versions = new Set(filters.versions ?? []);
  const hasInternalMinimum = filters.internalLevelMin !== undefined && filters.internalLevelMin !== null && filters.internalLevelMin !== "";
  const hasInternalMaximum = filters.internalLevelMax !== undefined && filters.internalLevelMax !== null && filters.internalLevelMax !== "";

  return flattenCharts(songDatabase).filter((chart) => {
    if (!difficulties.has(chart.difficulty) || !types.has(chart.type)) return false;
    if (!isLevelInRange(chart.displayLevel, filters.levelMin, filters.levelMax)) return false;
    if (genres.size > 0 && !genres.has(chart.genre)) return false;
    if (versions.size > 0 && !versions.has(chart.version)) return false;
    if ((hasInternalMinimum || hasInternalMaximum) && !Number.isFinite(chart.internalLevel)) return false;
    if (hasInternalMinimum && chart.internalLevel < Number(filters.internalLevelMin)) return false;
    if (hasInternalMaximum && chart.internalLevel > Number(filters.internalLevelMax)) return false;
    return true;
  });
}

function relevantHistory(history, exclusion, now) {
  const records = [...(history ?? [])]
    .filter((record) => record?.chart?.chartId && record.drawnAt)
    .sort((left, right) => new Date(right.drawnAt) - new Date(left.drawnAt));
  const byCount = Number(exclusion.recentCount) > 0
    ? records.slice(0, Number(exclusion.recentCount))
    : [];
  const cutoff = Number(exclusion.days) > 0
    ? now.getTime() - Number(exclusion.days) * 86_400_000
    : Number.NEGATIVE_INFINITY;
  const byDate = records.filter((record) => new Date(record.drawnAt).getTime() >= cutoff);
  return [...new Map([...byCount, ...byDate].map((record) => [record.id, record])).values()];
}

export function excludeRecent(candidates, history, exclusion = {}, now = new Date()) {
  const unit = exclusion.unit === "chart" ? "chart" : "song";
  const blocked = new Set(relevantHistory(history, exclusion, now).map((record) => (
    unit === "chart" ? record.chart.chartId : record.chart.songId
  )));
  return candidates.filter((chart) => !blocked.has(unit === "chart" ? chart.chartId : chart.songId));
}

export function randomIndex(length, random = Math.random) {
  if (!Number.isInteger(length) || length <= 0) throw new NoCandidatesError();
  return Math.min(length - 1, Math.floor(random() * length));
}

export function drawChallenge({ songDatabase, filters, history = [], exclusion = {}, achievement, now = new Date(), random = Math.random }) {
  const matched = filterCharts(songDatabase, filters);
  if (matched.length === 0) throw new NoCandidatesError();

  const afterExclusion = excludeRecent(matched, history, exclusion, now);
  let pool = afterExclusion;
  let exclusionRelaxed = false;
  if (pool.length === 0) {
    if (!exclusion.relaxWhenEmpty) {
      throw new NoCandidatesError("条件には一致しますが、重複除外後の候補がありません。除外設定を緩めてください。");
    }
    pool = matched;
    exclusionRelaxed = true;
  }

  return {
    chart: pool[randomIndex(pool.length, random)],
    achievement,
    matchedCount: matched.length,
    eligibleCount: pool.length,
    excludedCount: matched.length - afterExclusion.length,
    exclusionRelaxed,
  };
}

export function createHistoryRecord({ source, result, filters, exclusion, now = new Date(), periodKey = null }) {
  const drawnAt = now.toISOString();
  return {
    id: periodKey ? `${source}:${periodKey}` : `manual:${drawnAt}:${result.chart.chartId}`,
    source,
    periodKey,
    drawnAt,
    chart: { ...result.chart },
    achievement: result.achievement,
    filters: structuredClone(filters),
    exclusion: structuredClone(exclusion),
    exclusionRelaxed: result.exclusionRelaxed,
  };
}
