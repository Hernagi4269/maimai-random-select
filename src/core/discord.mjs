const COLORS = { weekly: 0x6de2c8, monthly: 0xffc857, manual: 0xb79cff };

export function buildDiscordPayload(record) {
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
  if (chart.imageUrl) embed.thumbnail = { url: chart.imageUrl };

  return {
    username: "maimai 課題曲セレクター",
    allowed_mentions: { parse: [] },
    embeds: [embed],
  };
}

export async function postDiscordWebhook(url, record, fetchImpl = fetch) {
  if (!url) return { skipped: true, reason: "DISCORD_WEBHOOK_URL is not set" };
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(buildDiscordPayload(record)),
  });
  if (!response.ok) throw new Error(`Discord Webhook failed: HTTP ${response.status}`);
  return { skipped: false };
}
