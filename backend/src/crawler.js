const puppeteer = require("puppeteer");
const { pool } = require("./db");

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

function parsePrice(text) {
  if (!text) return null;
  const num = text.replace(/[^0-9]/g, "");
  return num ? parseInt(num, 10) : null;
}

// 상품 상세 정보(이름, 이미지, 가격) 크롤링
async function crawlProductDetail(oliveyoung_id) {
  const browser = await newBrowser();
  const page = await setupPage(browser);

  try {
    const url = `https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=${oliveyoung_id}`;
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    // 실제 상품명 엘리먼트가 렌더링될 때까지 대기
    await page.waitForFunction(
      () => {
        const title = document.querySelector('meta[property="og:title"]')?.content ?? "";
        return title.length > 0 && !title.includes("잠시만");
      },
      { timeout: 15000 }
    ).catch(() => {}); // 타임아웃 시 그냥 진행

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
  } finally {
    await browser.close();
  }
}

async function fetchRanking(page, url) {
  await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

  await page.waitForFunction(
    () => document.querySelectorAll("a[href*='goodsNo']").length > 0,
    { timeout: 15000 }
  ).catch(() => {});

  return page.evaluate(() => {
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
}

async function crawlAll() {
  console.log(`[Crawler] 랭킹 크롤링 시작 - ${new Date().toLocaleString("ko-KR")}`);

  const { rows: products } = await pool.query("SELECT id, oliveyoung_id FROM products");
  if (products.length === 0) {
    console.log("[Crawler] 등록된 상품 없음, 종료");
    return;
  }

  const browser = await newBrowser();
  const page = await setupPage(browser);

  for (const [category, url] of Object.entries(CATEGORIES)) {
    try {
      const rankings = await fetchRanking(page, url);
      console.log(`[Crawler] ${category} 파싱 완료 - ${Object.keys(rankings).length}개`);

      for (const product of products) {
        const rank = rankings[product.oliveyoung_id] ?? null;
        await pool.query(
          "INSERT INTO rankings (product_id, category, rank) VALUES ($1, $2, $3)",
          [product.id, category, rank]
        );
        console.log(`[Crawler] ${category} - ${product.oliveyoung_id}: ${rank ?? "순위권 밖"}`);
      }
    } catch (err) {
      console.error(`[Crawler] ${category} 크롤링 실패:`, err.message);
    }
  }

  await browser.close();
  console.log("[Crawler] 랭킹 크롤링 완료");
}

module.exports = { crawlAll, crawlProductDetail };
