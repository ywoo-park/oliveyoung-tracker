const cron = require("node-cron");
const { crawlAll } = require("./crawler");

// 10분마다 실행
function startScheduler() {
  cron.schedule("*/10 * * * *", async () => {
    await crawlAll();
  }, { timezone: "Asia/Seoul" });

  console.log("[Scheduler] 스케줄러 시작 (10분 간격)");
}

module.exports = { startScheduler };
