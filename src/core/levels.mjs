export const DISPLAY_LEVELS = [
  "1", "2", "3", "4", "5", "6", "7", "7+", "8", "8+", "9", "9+",
  "10", "10+", "11", "11+", "12", "12+", "13", "13+", "14", "14+", "15",
];

export function levelRank(level) {
  const rank = DISPLAY_LEVELS.indexOf(String(level));
  return rank === -1 ? Number.NaN : rank;
}

export function isLevelInRange(level, minimum, maximum) {
  const current = levelRank(level);
  const min = levelRank(minimum);
  const max = levelRank(maximum);
  return Number.isFinite(current) && Number.isFinite(min) && Number.isFinite(max)
    && current >= Math.min(min, max)
    && current <= Math.max(min, max);
}

