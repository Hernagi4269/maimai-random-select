const COLORS = { weekly: 0x6de2c8, monthly: 0xffc857, manual: 0xb79cff };
const DEADLINE_DAYS = 21;

function deadlineDate(record) {
  if (record.deadlineAt) return new Date(record.deadlineAt);
  const deadline = new Date(record.drawnAt);
  deadline.setUTCDate(deadline.getUTCDate() + DEADLINE_DAYS);
  return deadline;
}

function formatDeadline(record) {
  const date = deadlineDate(record);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(date);
}

export function buildDiscordPayload(record, options = {}) {
  const labels = { weekly: "今週のmaimai課題曲", monthly: "今月のmaimai課題曲", manual: "maimai課題曲" };
  const chart = record.chart;
  const embed = {
    title: labels[record.source] ?? labels.manual,
    description: `**${chart.title}**\n${chart.artist || ""}`.trim(),
    color: COLORS[record.source] ?? COLORS.manual,
    fields: [
      { name: "譜面", value: chart.difficulty, inline: true },
      { name: "Lv", value: chart.displayLevel, inline: true },
      { name: "タイプ", value: chart.type, inline: true },
      { name: "目標", value: record.achievement, inline: true },
      { name: "期限", value: `${formatDeadline(record)}（抽選から3週間）`, inline: true },
      { name: "ジャンル", value: chart.genre || "—", inline: true },
      { name: "追加Ver.", value: chart.version || "—", inline: true },
    ],
    footer: { text: `課題ID: ${record.id}` },
    timestamp: record.drawnAt,
  };

  if (options.attachmentName) embed.thumbnail = { url: `attachment://${options.attachmentName}` };
  else if (chart.imageUrl) embed.thumbnail = { url: chart.imageUrl };

  return {
    username: "maimai 課題曲セレクター",
    allowed_mentions: { parse: [] },
    embeds: [embed],
  };
}

function jacketCandidates(chart) {
  const candidates = [];
  if (chart.imageUrl) candidates.push({ url: chart.imageUrl, referer: "https://maimai.sega.jp/", source: "SEGA/maimai DX NET" });

  const numericId = Number.parseInt(chart.sourceSongId, 10);
  if (Number.isFinite(numericId) && numericId > 0) {
    const divingFishId = numericId > 10000 && numericId <= 11000 ? numericId - 10000 : numericId;
    candidates.push({
      url: `https://www.diving-fish.com/covers/${String(divingFishId).padStart(5, "0")}.png`,
      referer: "https://maimai.diving-fish.com/",
      source: "Diving-Fish",
    });
    candidates.push({
      url: `https://assets2.lxns.net/maimai/jacket/${numericId}.png`,
      referer: "https://maimai.lxns.net/",
      source: "LXNS",
    });
  }
  return candidates;
}

async function fetchJacket(chart, fetchImpl) {
  for (const candidate of jacketCandidates(chart)) {
    try {
      const response = await fetchImpl(candidate.url, {
        headers: {
          "user-agent": "Mozilla/5.0 maimai-random-select/1.0",
          referer: candidate.referer,
        },
      });
      if (!response.ok) {
        console.warn(`Jacket fetch failed (${candidate.source}): HTTP ${response.status}`);
        continue;
      }
      const contentType = response.headers?.get?.("content-type") || "image/png";
      const bytes = await response.arrayBuffer();
      if (!bytes.byteLength) continue;
      console.log(`Jacket fetched from ${candidate.source}`);
      return { bytes, contentType, source: candidate.source };
    } catch (error) {
      console.warn(`Jacket fetch failed (${candidate.source}): ${error.message}`);
    }
  }
  return null;
}

function webhookMessageUrl(url, messageId) {
  return `${url.replace(/\/$/, "")}/messages/${encodeURIComponent(messageId)}`;
}

export async function postDiscordWebhook(url, record, fetchImpl = fetch) {
  if (!url) return { skipped: true, reason: "DISCORD_WEBHOOK_URL is not set" };

  const jacket = await fetchJacket(record.chart, fetchImpl);
  const targetUrl = `${url}${url.includes("?") ? "&" : "?"}wait=true`;
  let response;

  if (jacket) {
    const extension = jacket.contentType.includes("jpeg") ? "jpg" : jacket.contentType.includes("webp") ? "webp" : "png";
    const attachmentName = `jacket.${extension}`;
    const form = new FormData();
    form.append("payload_json", JSON.stringify(buildDiscordPayload(record, { attachmentName })));
    form.append("files[0]", new Blob([jacket.bytes], { type: jacket.contentType }), attachmentName);
    response = await fetchImpl(targetUrl, { method: "POST", body: form });
  } else {
    response = await fetchImpl(targetUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildDiscordPayload(record)),
    });
  }

  if (!response.ok) throw new Error(`Discord Webhook failed: HTTP ${response.status}`);
  const message = await response.json();
  if (!message?.id) throw new Error("Discord Webhook succeeded but returned no message ID.");
  return { skipped: false, jacketUploaded: Boolean(jacket), jacketSource: jacket?.source ?? null, messageId: String(message.id) };
}

export async function deleteDiscordWebhookMessage(url, messageId, fetchImpl = fetch) {
  if (!url) return { skipped: true, reason: "DISCORD_WEBHOOK_URL is not set" };
  if (!messageId) return { skipped: true, reason: "Discord message ID is not set" };
  const response = await fetchImpl(webhookMessageUrl(url, messageId), { method: "DELETE" });
  if (response.status === 404) return { skipped: false, alreadyDeleted: true };
  if (!response.ok) throw new Error(`Discord message delete failed: HTTP ${response.status}`);
  return { skipped: false, alreadyDeleted: false };
}

export function isChallengeExpired(record, now = new Date()) {
  const deadline = deadlineDate(record);
  return !Number.isNaN(deadline.getTime()) && now.getTime() >= deadline.getTime();
}
