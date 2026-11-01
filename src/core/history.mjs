export const LOCAL_HISTORY_KEY = "maimai-random-select:history:v1";
export const LOCAL_SETTINGS_KEY = "maimai-random-select:settings:v1";

export function parseHistory(value) {
  if (!value) return [];
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    const records = Array.isArray(parsed) ? parsed : parsed?.records;
    return Array.isArray(records) ? records.filter((record) => record?.id && record?.chart?.chartId) : [];
  } catch {
    return [];
  }
}

export function mergeHistory(...groups) {
  const merged = new Map();
  for (const record of groups.flatMap((group) => parseHistory(group))) merged.set(record.id, record);
  return [...merged.values()].sort((left, right) => new Date(right.drawnAt) - new Date(left.drawnAt));
}

export function serializeHistory(records) {
  return JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), records }, null, 2);
}

