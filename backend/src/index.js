const express = require("express");
const cors = require("cors");
const { startScheduler } = require("./scheduler");
const { crawlAll } = require("./crawler");
const adminRoutes = require("./routes/admin");
const dashboardRoutes = require("./routes/dashboard");
const reviewRoutes = require("./routes/reviews");
const { initDb } = require("./db");

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL;

app.use(cors({
  origin: FRONTEND_URL
    ? [FRONTEND_URL, /^http:\/\/localhost:\d+$/]
    : /^http:\/\/localhost:\d+$/,
}));
app.use(express.json());

app.use("/api", adminRoutes);
app.use("/api", dashboardRoutes);
app.use("/api", reviewRoutes);

app.post("/api/crawl", async (req, res) => {
  res.json({ message: "크롤링을 시작합니다." });
  await crawlAll();
});

app.listen(PORT, async () => {
  await initDb();
  console.log(`[Server] http://localhost:${PORT}`);
  startScheduler();
});
