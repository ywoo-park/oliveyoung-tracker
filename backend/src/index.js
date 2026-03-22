require("dotenv").config();
const express = require("express");
require("express-async-errors");
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

function isAllowedCorsOrigin(origin) {
  if (!origin) return true;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;
  if (/^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    if (host.endsWith(".vercel.app")) return true;
  } catch {
    return false;
  }
  if (FRONTEND_URL) {
    const list = FRONTEND_URL.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.includes(origin)) return true;
  }
  return false;
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedCorsOrigin(origin)) {
        callback(null, origin || true);
      } else {
        callback(null, false);
      }
    },
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

app.use("/api", adminRoutes);
app.use("/api", dashboardRoutes);
app.use("/api", reviewRoutes);

app.post("/api/crawl", async (req, res) => {
  res.json({ message: "크롤링을 시작합니다." });
  await crawlAll();
});

// DB 미연결 등으로 pool.query 실패 시 프로세스가 죽지 않도록
app.use((err, req, res, next) => {
  console.error("[API Error]", err.message);
  res.status(503).json({
    error: "데이터베이스에 연결할 수 없습니다. backend/.env 의 DATABASE_URL 을 확인하세요.",
  });
});

app.listen(PORT, async () => {
  let dbReady = false;
  try {
    await initDb();
    dbReady = true;
    console.log("[Server] DB 연결·초기화 완료");
  } catch (err) {
    console.error(
      "[Server] DB 초기화 실패 — `backend/.env`에 Railway 등 `DATABASE_URL`을 넣으세요.",
      err.message
    );
    console.error("[Server] DB 없이도 `/api/reviews/analyze` 등 리뷰 API는 동작합니다.");
  }
  console.log(`[Server] http://localhost:${PORT}`);
  if (dbReady) {
    startScheduler();
  } else {
    console.log("[Server] 스케줄러는 DB 미연결로 시작하지 않음");
  }
});
