require("dotenv").config();
const express = require("express");
require("express-async-errors");
const cors = require("cors");
const { startScheduler } = require("./scheduler");
const { crawlAll } = require("./crawler");
const adminRoutes = require("./routes/admin");
const dashboardRoutes = require("./routes/dashboard");
const reviewRoutes = require("./routes/reviews");
const sessionRoutes = require("./routes/sessions");
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
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

app.use("/api", adminRoutes);
app.use("/api", dashboardRoutes);
app.use("/api", reviewRoutes);
app.use("/api", sessionRoutes);

app.post("/api/crawl", async (req, res) => {
  res.json({ message: "크롤링을 시작합니다." });
  await crawlAll();
});

// 비동기 라우트 오류 처리 (DB 외 일반 오류와 구분)
app.use((err, req, res, next) => {
  console.error("[API Error]", err);
  const code = err.code;
  const isDb =
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "57P01" ||
    (typeof code === "string" && code.startsWith("08"));
  if (isDb) {
    return res.status(503).json({
      error: "데이터베이스에 연결할 수 없습니다. backend/.env 의 DATABASE_URL 을 확인하세요.",
    });
  }
  const status = Number(err.status || err.statusCode) || 500;
  res.status(status >= 400 && status < 600 ? status : 500).json({
    error: err.message || "서버 오류가 발생했습니다.",
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
    console.error("[Server] 히스토리 영구 저장(`/api/review-sessions`)은 DATABASE_URL 연결 후에만 사용할 수 있습니다.");
  }
  console.log(`[Server] http://localhost:${PORT}`);
  if (dbReady) {
    startScheduler();
  } else {
    console.log("[Server] 스케줄러는 DB 미연결로 시작하지 않음");
  }
});
