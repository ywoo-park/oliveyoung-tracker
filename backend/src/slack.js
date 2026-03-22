const axios = require("axios");

const WEBHOOK_OPS = process.env.SLACK_WEBHOOK_OPS;
const WEBHOOK_RANKING = process.env.SLACK_WEBHOOK_RANKING;

async function notify(webhookUrl, text) {
  if (!webhookUrl) return;
  await axios.post(webhookUrl, { text }).catch((err) => {
    console.error("[Slack] 알림 전송 실패:", err.message);
  });
}

function notifyOps(text) {
  return notify(WEBHOOK_OPS, text);
}

function notifyRanking(text) {
  return notify(WEBHOOK_RANKING, text);
}

module.exports = { notifyOps, notifyRanking };
