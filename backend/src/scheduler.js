const cron = require("node-cron");
const { crawlAll } = require("./crawler");

// 매시 정각 실행
function startScheduler() {
  cron.schedule("0 * * * *", async () => {
    await crawlAll();
  }, { timezone: "Asia/Seoul" });

  console.log("[Scheduler] 스케줄러 시작 (매시 정각)");
}

module.exports = { startScheduler };
