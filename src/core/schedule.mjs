const WEEKDAY_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function zonedDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    weekDay: WEEKDAY_MAP[values.weekday],
  };
}

export function isoWeekKey(date, timeZone) {
  const { year, month, day } = zonedDateParts(date, timeZone);
  const local = new Date(Date.UTC(year, month - 1, day));
  const weekDay = local.getUTCDay() || 7;
  local.setUTCDate(local.getUTCDate() + 4 - weekDay);
  const weekYear = local.getUTCFullYear();
  const first = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil((((local - first) / 86_400_000) + 1) / 7);
  return `${weekYear}-W${String(week).padStart(2, "0")}`;
}

export function dueScheduleTypes(config, now = new Date(), requested = "auto") {
  if (["weekly", "monthly"].includes(requested)) return [requested];
  const parts = zonedDateParts(now, config.timeZone);
  const due = [];
  if (config.weekly?.enabled && parts.weekDay === Number(config.weekly.weekDay)) due.push("weekly");
  if (config.monthly?.enabled && parts.day === Number(config.monthly.dayOfMonth)) due.push("monthly");
  return due;
}

export function periodKey(type, now, timeZone) {
  const parts = zonedDateParts(now, timeZone);
  return type === "weekly"
    ? isoWeekKey(now, timeZone)
    : `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

