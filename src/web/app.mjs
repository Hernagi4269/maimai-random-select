import { DISPLAY_LEVELS } from "./core/levels.mjs";
import { NoCandidatesError, createHistoryRecord, drawChallenge, filterCharts } from "./core/draw.mjs";
import { LOCAL_HISTORY_KEY, LOCAL_SETTINGS_KEY, mergeHistory, parseHistory, serializeHistory } from "./core/history.mjs";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const defaults = {
  exclusion: { unit: "song", recentCount: 20, days: 90, relaxWhenEmpty: true },
  filters: { difficulties: ["MASTER"], levelMin: "13", levelMax: "14+", types: ["STD", "DX"], genres: [], versions: [] },
  achievement: "AP",
};

let database = null;
let automatedHistory = [];
let localHistory = parseHistory(localStorage.getItem(LOCAL_HISTORY_KEY));
let currentResult = null;
let settings = loadSettings();

function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(LOCAL_SETTINGS_KEY));
    return {
      exclusion: { ...defaults.exclusion, ...stored?.exclusion },
      filters: { ...defaults.filters, ...stored?.filters },
      achievement: stored?.achievement ?? defaults.achievement,
    };
  } catch {
    return structuredClone(defaults);
  }
}

function saveSettings() {
  localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings));
}

function allHistory() {
  return mergeHistory(localHistory, automatedHistory);
}

function setOptions(select, values, selected) {
  select.replaceChildren(...values.map((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    option.selected = value === selected;
    return option;
  }));
}

function initializeControls() {
  setOptions($("#level-min"), DISPLAY_LEVELS, settings.filters.levelMin);
  setOptions($("#level-max"), DISPLAY_LEVELS, settings.filters.levelMax);
  $$("input[name='difficulty']").forEach((input) => { input.checked = settings.filters.difficulties.includes(input.value); });
  $$("input[name='type']").forEach((input) => { input.checked = settings.filters.types.includes(input.value); });
  $("#achievement").value = settings.achievement;
  applyExclusionToDialog();
}

function populateMetadataFilters() {
  const genres = [...new Set(database.songs.map((song) => song.genre))].filter(Boolean).sort((a, b) => a.localeCompare(b, "ja"));
  const versions = [...new Map(database.songs.map((song) => [song.versionCode, song.version])).entries()]
    .sort((a, b) => Number(b[0]) - Number(a[0])).map(([, name]) => name);
  for (const [selector, values, selected] of [["#genre", genres, settings.filters.genres[0]], ["#version", versions, settings.filters.versions[0]]]) {
    const select = $(selector);
    for (const value of values) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      option.selected = value === selected;
      select.append(option);
    }
  }
}

function filtersFromForm() {
  return {
    difficulties: $$("input[name='difficulty']:checked").map((input) => input.value),
    levelMin: $("#level-min").value,
    levelMax: $("#level-max").value,
    types: $$("input[name='type']:checked").map((input) => input.value),
    genres: $("#genre").value ? [$("#genre").value] : [],
    versions: $("#version").value ? [$("#version").value] : [],
  };
}

function validateFilters(filters) {
  if (filters.difficulties.length === 0) return "難易度を1つ以上選んでください。";
  if (filters.types.length === 0) return "譜面タイプを1つ以上選んでください。";
  return "";
}

function updateCandidateCount() {
  if (!database) return;
  const filters = filtersFromForm();
  const validation = validateFilters(filters);
  const count = validation ? 0 : filterCharts(database, filters).length;
  $("#candidate-count").textContent = `${count.toLocaleString("ja-JP")} 譜面`;
  $("#draw-button").disabled = Boolean(validation) || count === 0;
}

function showFormError(message) {
  const element = $("#form-error");
  element.textContent = message;
  element.hidden = !message;
}

function renderResult() {
  if (!currentResult) return;
  const { chart } = currentResult;
  $("#empty-result").hidden = true;
  $("#result-card").hidden = false;
  $("#result-actions").hidden = false;
  $("#result-genre").textContent = `${chart.genre} · ${chart.version}`;
  $("#result-song").textContent = chart.title;
  $("#result-artist").textContent = chart.artist;
  $("#result-difficulty").textContent = chart.difficulty;
  $("#result-level").textContent = `Lv ${chart.displayLevel}`;
  $("#result-type").textContent = chart.type;
  $("#result-goal").textContent = currentResult.achievement;
  $("#result-meta").textContent = `条件一致 ${currentResult.matchedCount}譜面 / 今回の抽選対象 ${currentResult.eligibleCount}譜面`;
  const warning = $("#result-warning");
  warning.textContent = currentResult.exclusionRelaxed ? "重複除外で候補が0件になったため、抽選条件は維持したまま重複除外だけ解除しました。" : "";
  warning.hidden = !currentResult.exclusionRelaxed;
  $("#result-section").classList.remove("is-empty");
  $("#result-section").scrollIntoView({ behavior: "smooth", block: "start" });
}

function draw() {
  const filters = filtersFromForm();
  const validation = validateFilters(filters);
  if (validation) return showFormError(validation);
  try {
    currentResult = drawChallenge({
      songDatabase: database,
      filters,
      history: allHistory(),
      exclusion: settings.exclusion,
      achievement: $("#achievement").value,
    });
    settings.filters = filters;
    settings.achievement = currentResult.achievement;
    saveSettings();
    showFormError("");
    renderResult();
  } catch (error) {
    showFormError(error instanceof NoCandidatesError ? error.message : "抽選中にエラーが発生しました。");
  }
}

function formatDate(value, includeTime = false) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric", month: "2-digit", day: "2-digit",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

function renderHistory() {
  const filter = $("#history-filter").value;
  const records = allHistory().filter((record) => filter === "all" || record.source === filter);
  const list = $("#history-list");
  list.replaceChildren(...records.map((record) => {
    const item = document.createElement("li");
    item.className = "history-item";
    const type = document.createElement("span");
    type.className = `history-type ${record.source}`;
    type.textContent = { manual: "手動", weekly: "週", monthly: "月" }[record.source] ?? "他";
    const main = document.createElement("span");
    main.className = "history-main";
    const title = document.createElement("strong");
    title.textContent = record.chart.title;
    const detail = document.createElement("small");
    detail.textContent = `${record.chart.difficulty} · Lv ${record.chart.displayLevel} · ${record.chart.type} · ${record.achievement}`;
    main.append(title, detail);
    const date = document.createElement("time");
    date.className = "history-date";
    date.dateTime = record.drawnAt;
    date.textContent = formatDate(record.drawnAt);
    item.append(type, main, date);
    return item;
  }));
  $("#history-empty").hidden = records.length > 0;
}

function confirmCurrent() {
  if (!currentResult) return;
  const record = createHistoryRecord({
    source: "manual",
    result: currentResult,
    filters: filtersFromForm(),
    exclusion: settings.exclusion,
  });
  localHistory = mergeHistory([record], localHistory);
  localStorage.setItem(LOCAL_HISTORY_KEY, serializeHistory(localHistory));
  renderHistory();
  updateCandidateCount();
  toast("課題として履歴に保存しました");
  $("#confirm-button").disabled = true;
  $("#confirm-button").textContent = "保存済み";
}

function applyExclusionToDialog() {
  $("#exclude-unit").value = settings.exclusion.unit;
  $("#exclude-count").value = settings.exclusion.recentCount;
  $("#exclude-days").value = settings.exclusion.days;
  $("#relax-empty").checked = settings.exclusion.relaxWhenEmpty;
}

function saveExclusion() {
  settings.exclusion = {
    unit: $("#exclude-unit").value,
    recentCount: Math.max(0, Number($("#exclude-count").value) || 0),
    days: Math.max(0, Number($("#exclude-days").value) || 0),
    relaxWhenEmpty: $("#relax-empty").checked,
  };
  saveSettings();
  updateCandidateCount();
  toast("重複除外設定を保存しました");
}

let toastTimer;
function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("show"), 2600);
}

function downloadHistory() {
  const blob = new Blob([serializeHistory(localHistory)], { type: "application/json" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `maimai-challenge-history-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

async function importHistory(file) {
  const imported = parseHistory(await file.text());
  if (imported.length === 0) return toast("読み込める履歴がありませんでした");
  localHistory = mergeHistory(imported, localHistory);
  localStorage.setItem(LOCAL_HISTORY_KEY, serializeHistory(localHistory));
  renderHistory();
  toast(`${imported.length}件の履歴を読み込みました`);
}

function attachEvents() {
  $("#draw-form").addEventListener("submit", (event) => { event.preventDefault(); draw(); });
  $("#draw-form").addEventListener("input", updateCandidateCount);
  $("#reroll-button").addEventListener("click", () => { $("#confirm-button").disabled = false; $("#confirm-button").textContent = "この課題に決定"; draw(); });
  $("#confirm-button").addEventListener("click", confirmCurrent);
  $("#history-filter").addEventListener("change", renderHistory);
  $("#open-settings").addEventListener("click", () => { applyExclusionToDialog(); $("#settings-dialog").showModal(); });
  $("#save-settings").addEventListener("click", saveExclusion);
  $("#export-history").addEventListener("click", downloadHistory);
  $("#import-history").addEventListener("change", (event) => { if (event.target.files[0]) importHistory(event.target.files[0]); event.target.value = ""; });
  $("#clear-history").addEventListener("click", () => {
    if (!confirm("この端末に保存した手動履歴をすべて消去しますか？")) return;
    localHistory = localHistory.filter((record) => record.source !== "manual");
    localStorage.setItem(LOCAL_HISTORY_KEY, serializeHistory(localHistory));
    renderHistory();
    toast("手動履歴を消去しました");
  });
}

async function start() {
  initializeControls();
  attachEvents();
  try {
    const [songResponse, historyResponse] = await Promise.all([fetch("./data/songs.json"), fetch("./data/history.json")]);
    if (!songResponse.ok) throw new Error(`HTTP ${songResponse.status}`);
    database = await songResponse.json();
    automatedHistory = historyResponse.ok ? parseHistory(await historyResponse.json()) : [];
    populateMetadataFilters();
    updateCandidateCount();
    renderHistory();
    $("#data-dot").classList.add("ready");
    $("#data-status").textContent = `${database.stats.songs.toLocaleString("ja-JP")}曲・${database.stats.charts.toLocaleString("ja-JP")}譜面 / ${formatDate(database.source.fetchedAt, true)} 更新`;
  } catch (error) {
    $("#data-dot").classList.add("error");
    $("#data-status").textContent = "楽曲データを読み込めませんでした。再読み込みしてください。";
    showFormError(`データ読込エラー: ${error.message}`);
  }
}

start();

