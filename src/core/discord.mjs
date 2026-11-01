const COLORS = { weekly: 0x6de2c8, monthly: 0xffc857, manual: 0xb79cff };

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

async function fetchJacket(imageUrl, fetchImpl) {
  if (!imageUrl) return null;
  try {
    const response = await fetchImpl(imageUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 maimai-random-select/1.0",
        referer: "https://maimai.sega.jp/",
      },
    });
    if (!response.ok) {
      console.warn(`Jacket fetch failed: HTTP ${response.status}`);
      return null;
    }
    const contentType = response.headers?.get?.("content-type") || "image/png";
    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength) return null;
    return { bytes, contentType };
  } catch (error) {
    console.warn(`Jacket fetch failed: ${error.message}`);
    return null;
  }
}

export async function postDiscordWebhook(url, record, fetchImpl = fetch) {
  if (!url) return { skipped: true, reason: "DISCORD_WEBHOOK_URL is not set" };

  const jacket = await fetchJacket(record.chart.imageUrl, fetchImpl);
  let response;

  if (jacket) {
    const extension = jacket.contentType.includes("jpeg") ? "jpg" : jacket.contentType.includes("webp") ? "webp" : "png";
    const attachmentName = `jacket.${extension}`;
    const form = new FormData();
    form.append("payload_json", JSON.stringify(buildDiscordPayload(record, { attachmentName })));
    form.append("files[0]", new Blob([jacket.bytes], { type: jacket.contentType }), attachmentName);
    response = await fetchImpl(url, { method: "POST", body: form });
  } else {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildDiscordPayload(record)),
    });
  }

  if (!response.ok) throw new Error(`Discord Webhook failed: HTTP ${response.status}`);
  return { skipped: false, jacketUploaded: Boolean(jacket) };
}
