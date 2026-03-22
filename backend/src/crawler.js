const puppeteer = require("puppeteer");
const { pool } = require("./db");
const { notifyOps, notifyRanking } = require("./slack");

const CATEGORIES = {
  전체: "https://www.oliveyoung.co.kr/store/main/getBestList.do?dispCatNo=900000100100001&fltDispCatNo=&pageIdx=1&rowsPerPage=100",
  메이크업: "https://www.oliveyoung.co.kr/store/main/getBestList.do?dispCatNo=900000100100001&fltDispCatNo=10000010002&pageIdx=1&rowsPerPage=100",
};

async function newBrowser() {
  return puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--lang=ko-KR",
    ],
  });
}

async function setupPage(browser) {
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
  );
  await page.setExtraHTTPHeaders({ "Accept-Language": "ko-KR,ko;q=0.9" });
  await page.setViewport({ width: 1280, height: 800 });
  // webdriver 플래그 제거
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  return page;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function parsePrice(text) {
  if (!text) return null;
  const num = text.replace(/[^0-9]/g, "");
  return num ? parseInt(num, 10) : null;
}

// 상품 상세 정보(이름, 이미지, 가격) 크롤링
async function crawlProductDetail(oliveyoung_id) {
  const url = `https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=${oliveyoung_id}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const browser = await newBrowser();
    const page = await setupPage(browser);

    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await page.waitForFunction(
        () => {
          const title = document.querySelector('meta[property="og:title"]')?.content ?? "";
          return title.length > 0 && !title.includes("잠시만");
        },
        { timeout: 15000 }
      );

      const detail = await page.evaluate(() => {
        const rawTitle = document.querySelector('meta[property="og:title"]')?.content ?? document.title;
        const name = rawTitle.replace(/\s*\|\s*올리브영.*$/, "").trim();
        const image_url = document.querySelector('meta[property="og:image"]')?.content ?? null;
        const priceBeforeEl = document.querySelector('[class*=GoodsDetailInfo_price-before]');
        const priceEl = document.querySelector('[class*=GoodsDetailInfo_price__]');
        return {
          name,
          image_url,
          priceText: priceBeforeEl?.innerText?.trim() ?? null,
          salePriceText: priceEl?.innerText?.trim() ?? null,
        };
      });

      const price = parsePrice(detail.priceText);
      const sale_price = parsePrice(detail.salePriceText);
      console.log(`[Crawler] 상품 정보 - ${detail.name} / 정가: ${price} / 할인가: ${sale_price}`);
      return { name: detail.name, image_url: detail.image_url, price, sale_price };
    } catch (err) {
      console.warn(`[Crawler] 상품 크롤링 실패 (시도 ${attempt}/3): ${err.message}`);
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    } finally {
      await browser.close();
    }
  }
}

async function fetchRanking(page, url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    try {
      await page.waitForFunction(
        () => document.querySelectorAll("a[href*='goodsNo'][href*='t_number']").length > 0,
        { timeout: 15000 }
      );
    } catch {
      if (attempt < retries) {
        await sleep(2000 * attempt);
        continue;
      }
    }

    const result = await page.evaluate(() => {
      const result = {};
      document.querySelectorAll("a[href*='goodsNo'][href*='t_number']").forEach((el) => {
        const href = el.getAttribute("href") ?? "";
        const goodsNo = href.match(/goodsNo=(\w+)/)?.[1];
        const rank = href.match(/t_number=(\d+)/)?.[1];
        if (goodsNo && rank && !(goodsNo in result)) {
          result[goodsNo] = parseInt(rank, 10);
        }
      });
      return result;
    });

    if (Object.keys(result).length > 0 || attempt === retries) {
      return result;
    }

    await sleep(2000 * attempt);
  }

  return {};
}

async function crawlAll() {
  const startedAt = Date.now();
  const startLabel = new Date().toLocaleString("ko-KR");
  console.log(`[Crawler] 랭킹 크롤링 시작 - ${startLabel}`);
  await notifyOps(`🟡 크롤링 시작 - ${startLabel}`);

  const { rows: products } = await pool.query("SELECT id, oliveyoung_id, name FROM products");
  if (products.length === 0) {
    console.log("[Crawler] 등록된 상품 없음, 종료");
    return;
  }

  const browser = await newBrowser();
  const page = await setupPage(browser);

  for (const [category, url] of Object.entries(CATEGORIES)) {
    try {
      const rankings = await fetchRanking(page, url);
      const count = Object.keys(rankings).length;
      console.log(`[Crawler] ${category} 파싱 완료 - ${count}개`);

      if (count === 0) {
        await notifyOps(`⚠️ *${category}* 카테고리 파싱 결과 0개`);
      }

      for (const product of products) {
        const rank = rankings[product.oliveyoung_id] ?? null;

        const { rows: [prev] } = await pool.query(
          "SELECT rank FROM rankings WHERE product_id = $1 AND category = $2 ORDER BY crawled_at DESC LIMIT 1",
          [product.id, category]
        );
        const prevRank = prev?.rank ?? null;

        await pool.query(
          "INSERT INTO rankings (product_id, category, rank) VALUES ($1, $2, $3)",
          [product.id, category, rank]
        );
        console.log(`[Crawler] ${category} - ${product.oliveyoung_id}: ${rank ?? "순위권 밖"}`);

        if (prevRank === null && rank !== null) {
          await notifyRanking(`📈 *${product.name}* 이(가) *${category}* 카테고리 순위권에 진입했습니다! (${rank}위)`);
        } else if (prevRank !== null && rank === null) {
          await notifyRanking(`📉 *${product.name}* 이(가) *${category}* 카테고리 순위권에서 이탈했습니다. (이전 ${prevRank}위)`);
        }
      }
    } catch (err) {
      console.error(`[Crawler] ${category} 크롤링 실패:`, err.message);
      await notifyOps(`🔴 *${category}* 카테고리 크롤링 실패\n\`${err.message}\``);
    }
  }

  await browser.close();
  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  console.log("[Crawler] 랭킹 크롤링 완료");
  await notifyOps(`✅ 크롤링 완료 (소요: ${elapsed}초)`);
}

function extractGoodsNoFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("goodsNo");
  } catch {
    return null;
  }
}

async function crawlLatestReviewsByProductUrl(productUrl, limit = 100) {
  const goodsNo = extractGoodsNoFromUrl(productUrl);
  if (!goodsNo) {
    throw new Error("URL에서 goodsNo를 찾을 수 없습니다.");
  }

  const browser = await newBrowser();
  const page = await setupPage(browser);
  const reviewUrl = `https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=${goodsNo}&tab=review`;

  try {
    const collected = [];
    const seenReviewIds = new Set();
    const onResponse = async (res) => {
      try {
        const req = res.request();
        if (
          !res.url().includes("/review/api/v2/reviews") ||
          req.method() !== "POST" ||
          res.status() !== 200
        ) {
          return;
        }
        const body = await res.json().catch(() => null);
        const list = Array.isArray(body?.data) ? body.data : [];
        list.forEach((item) => {
          const rid = item?.reviewId;
          const text = (item?.content || "").replace(/\s+/g, " ").trim();
          const created = item?.createdDateTime || "";
          if (!text || text.length < 8 || text.length > 400) return;
          if (rid && seenReviewIds.has(rid)) return;
          if (rid) seenReviewIds.add(rid);
          collected.push({ text, created });
        });
      } catch {
        // response 파싱 실패는 무시하고 계속 수집
      }
    };
    page.on("response", onResponse);
    const collectRound = async (roundIdx) => {
      await page.goto(reviewUrl, { waitUntil: "networkidle2", timeout: 45000 });
      await sleep(randInt(1200, 2200));

      // 사람이 탐색하는 것처럼 스크롤을 섞어 요청 패턴을 분산
      await page.evaluate(() => {
        window.scrollTo({ top: document.body.scrollHeight * 0.25, behavior: "instant" });
      }).catch(() => {});
      await sleep(randInt(250, 700));
      await page.evaluate(() => {
        window.scrollTo({ top: document.body.scrollHeight * 0.55, behavior: "instant" });
      }).catch(() => {});
      await sleep(randInt(300, 800));
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" })).catch(() => {});

      const clickLimit = 8 + roundIdx * 4;
      for (let i = 0; i < clickLimit; i += 1) {
        const clicked = await page.evaluate(() => {
          const candidates = Array.from(document.querySelectorAll("button, a, span"));
          const button = candidates.find((el) => {
            const text = (el.textContent || "").trim();
            return text === "리뷰 더보기" || text.includes("리뷰 더보기");
          });
          if (!button) return false;
          button.click();
          return true;
        });
        if (!clicked) break;
        await sleep(randInt(500, 1100));
        if (collected.length >= limit) break;
      }

      const pageSize = 20;
      const targetPages = Math.max(3, Math.ceil((limit * 2) / pageSize));
      for (let pageIdx = 0; pageIdx < targetPages; pageIdx += 1) {
        await page.evaluate(
          async ({ targetGoodsNo, page, size }) => {
            await fetch("https://m.oliveyoung.co.kr/review/api/v2/reviews", {
              method: "POST",
              mode: "cors",
              credentials: "include",
              headers: {
                "content-type": "application/json",
                accept: "application/json, text/plain, */*",
              },
              body: JSON.stringify({
                goodsNumber: targetGoodsNo,
                page,
                size,
                sortType: "USEFUL_SCORE_DESC",
                reviewType: "ALL",
              }),
            }).catch(() => null);
          },
          { targetGoodsNo: goodsNo, page: pageIdx, size: pageSize }
        );
        await sleep(randInt(350, 900));
        if (collected.length >= limit) break;
      }
    };

    // 단일 세션 실패를 대비해 같은 URL을 여러 라운드로 다시 시도
    for (let round = 0; round < 3; round += 1) {
      await collectRound(round);
      if (collected.length >= limit) break;
      await sleep(randInt(900, 1800));
    }

    page.off("response", onResponse);

    const reviews = collected
      // 최근순 정렬 (YYYY.MM.DD 포맷을 숫자 비교 가능한 YYYYMMDD로 변환)
      .sort((a, b) => {
        const aa = (a.created || "").replace(/\./g, "");
        const bb = (b.created || "").replace(/\./g, "");
        return bb.localeCompare(aa);
      })
      .map((item) => item.text);

    const uniqueReviews = Array.from(new Set(reviews)).slice(0, limit);

    if (!uniqueReviews.length) {
      throw new Error("리뷰를 찾지 못했습니다. 셀렉터가 변경됐을 수 있습니다.");
    }

    return {
      goodsNo,
      sourceUrl: reviewUrl,
      count: uniqueReviews.length,
      reviews: uniqueReviews,
    };
  } finally {
    await browser.close();
  }
}

module.exports = { crawlAll, crawlProductDetail, crawlLatestReviewsByProductUrl };
