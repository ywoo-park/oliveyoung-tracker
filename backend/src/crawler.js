const puppeteer = require("puppeteer");
const axios = require("axios");
const { pool } = require("./db");
const { notifyOps, notifyRanking } = require("./slack");

const CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

function cookiesToHeader(cookies) {
  if (!cookies?.length) return "";
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

/** 올리브영 리뷰 API JSON에서 배열 후보 추출 */
function extractReviewList(json) {
  if (!json || typeof json !== "object") return [];
  if (Array.isArray(json.data)) return json.data;
  if (json.data && Array.isArray(json.data.list)) return json.data.list;
  if (json.data && Array.isArray(json.data.content)) return json.data.content;
  if (json.data && Array.isArray(json.data.reviews)) return json.data.reviews;
  if (Array.isArray(json.result)) return json.result;
  if (json.result && Array.isArray(json.result.data)) return json.result.data;
  if (json.result && Array.isArray(json.result.list)) return json.result.list;
  if (Array.isArray(json.reviews)) return json.reviews;
  if (json.data && Array.isArray(json.data.rows)) return json.data.rows;
  if (json.data && Array.isArray(json.data.reviewList)) return json.data.reviewList;
  if (json.payload && Array.isArray(json.payload)) return json.payload;
  return [];
}

/** 응답 JSON 깊이 제한 탐색 — 스키마 변경 대비 */
function extractReviewListDeep(json, depth = 0) {
  if (depth > 6 || json == null) return [];
  const direct = extractReviewList(json);
  if (direct.length) return direct;
  if (typeof json !== "object") return [];
  for (const v of Object.values(json)) {
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object") {
      const sample = v[0];
      if (
        sample.content != null ||
        sample.reviewText != null ||
        sample.reviewContent != null ||
        sample.reviewBody != null
      ) {
        return v;
      }
    }
    if (typeof v === "object" && v) {
      const inner = extractReviewListDeep(v, depth + 1);
      if (inner.length) return inner;
    }
  }
  return [];
}

function looksLikeReviewItem(obj) {
  if (!obj || typeof obj !== "object") return false;
  if (
    obj.content != null ||
    obj.reviewText != null ||
    obj.reviewContent != null ||
    obj.reviewBody != null ||
    obj.body != null ||
    obj.reviewDesc != null ||
    obj.comment != null ||
    obj.text != null
  ) {
    return true;
  }
  return reviewTextFromItem(obj).length >= 8;
}

/**
 * JSON 안에 리뷰 형태 배열이 여러 개일 때(고정 19건 + 전체 목록 등) 가장 긴 배열을 사용
 */
function extractReviewListBest(json) {
  const candidates = [];
  const walk = (node, depth) => {
    if (depth > 10 || node == null) return;
    if (Array.isArray(node)) {
      if (node.length > 0 && typeof node[0] === "object" && looksLikeReviewItem(node[0])) {
        candidates.push(node);
      }
      return;
    }
    if (typeof node !== "object") return;
    for (const v of Object.values(node)) walk(v, depth + 1);
  };
  walk(json, 0);
  if (!candidates.length) return [];
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0];
}

function reviewTextFromItem(item) {
  const raw =
    item?.content ??
    item?.reviewText ??
    item?.reviewContent ??
    item?.reviewDesc ??
    item?.comment ??
    item?.body ??
    item?.reviewBody ??
    item?.text ??
    "";
  return String(raw).replace(/\s+/g, " ").trim();
}

function reviewIdFromItem(item) {
  return (
    item?.reviewId ??
    item?.id ??
    item?.reviewSeq ??
    item?.seq ??
    item?.reviewNo ??
    item?.rwId ??
    item?.goodsReviewSeq ??
    item?.goodsReviewNo ??
    null
  );
}

function createdFromItem(item) {
  return item?.createdDateTime ?? item?.createdAt ?? item?.regDt ?? item?.createDate ?? "";
}

/** 페이지별로 여러 필드 조합 시도 (page vs pageIdx vs currentPage 등) */
function buildReviewPostBodies(gno, page1, page0, size) {
  const st = "USEFUL_SCORE_DESC";
  const stDate = "DATE_DESC";
  const rt = "ALL";
  return [
    { goodsNumber: gno, page: page1, size, sortType: st, reviewType: rt },
    { goodsNumber: gno, page: page0, size, sortType: st, reviewType: rt },
    { goodsNumber: gno, pageIdx: page1, rowsPerPage: size, sortType: st, reviewType: rt },
    { goodsNumber: gno, pageIdx: page0, rowsPerPage: size, sortType: st, reviewType: rt },
    { goodsNumber: gno, currentPage: page1, size, sortType: st, reviewType: rt },
    { goodsNumber: gno, pageNumber: page1, pageSize: size, sortType: st, reviewType: rt },
    { goodsNo: gno, page: page1, size, sortType: st, reviewType: rt },
    { goodsNo: gno, page: page0, size, sortType: st, reviewType: rt },
    { goodsNumber: gno, page: page1, size, sortType: stDate, reviewType: rt },
    { goodsNumber: gno, page: page1, rows: size, sortType: st, reviewType: rt },
  ];
}

function pickPageSize(limit) {
  if (limit >= 500) return 50;
  if (limit >= 250) return 30;
  return 20;
}

function pickMaxPages(limit, pageSize) {
  return Math.min(320, Math.ceil(limit / pageSize) + 48);
}

/** 한 번 통과한 본문 형태를 다음 페이지에서 우선 시도 (필드명이 어긋나면 2~3페이지에서 끊김 방지) */
function orderedBodies(bodies, preferredIndex) {
  if (preferredIndex == null || preferredIndex < 0 || preferredIndex >= bodies.length) {
    return bodies.map((body, index) => ({ body, index }));
  }
  const out = [{ body: bodies[preferredIndex], index: preferredIndex }];
  for (let j = 0; j < bodies.length; j += 1) {
    if (j !== preferredIndex) out.push({ body: bodies[j], index: j });
  }
  return out;
}

/**
 * 세션 쿠키로 리뷰 API 직접 페이지네이션 (브라우저 fetch/CORS 이슈 우회)
 */
async function fetchReviewsViaAxios(goodsNo, limit, cookieHeader) {
  const collected = [];
  const seen = new Set();
  const pageSize = pickPageSize(limit);
  const maxPages = pickMaxPages(limit, pageSize);
  const origins = ["https://www.oliveyoung.co.kr", "https://m.oliveyoung.co.kr"];
  const apiPaths = ["/review/api/v2/reviews", "/review/api/v3/reviews"];

  for (const apiPath of apiPaths) {
    for (const origin of origins) {
      let preferredBodyIndex = null;
      let emptyStreak = 0;
      for (let i = 0; i < maxPages && collected.length < limit; i += 1) {
        const bodies = buildReviewPostBodies(goodsNo, i + 1, i, pageSize);
        const attempts = orderedBodies(bodies, preferredBodyIndex);
        let progressed = false;

        for (const { body, index: bodyIndex } of attempts) {
          let res;
          try {
            res = await axios.post(`${origin}${apiPath}`, body, {
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json, text/plain, */*",
                Cookie: cookieHeader,
                "User-Agent": CHROME_UA,
                Referer: `https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=${goodsNo}`,
                Origin: origin,
              },
              timeout: 35000,
              validateStatus: () => true,
            });
          } catch {
            continue;
          }

          if (res.status !== 200) {
            if (i === 0 && origin === origins[0] && apiPath === apiPaths[0] && bodyIndex === 0) {
              console.warn(
                `[Crawler] 리뷰 API HTTP ${res.status} (${origin})`,
                typeof res.data === "object" ? JSON.stringify(res.data).slice(0, 180) : ""
              );
            }
            continue;
          }

          const list = extractReviewListBest(res.data);
          if (!list.length) continue;

          let added = 0;
          for (const item of list) {
            const text = reviewTextFromItem(item);
            if (text.length < 8 || text.length > 8000) continue;
            const rid = reviewIdFromItem(item);
            const key = rid != null ? String(rid) : text.slice(0, 200);
            if (seen.has(key)) continue;
            seen.add(key);
            collected.push({ text, created: createdFromItem(item) });
            added += 1;
            if (collected.length >= limit) return collected;
          }

          if (added > 0) {
            preferredBodyIndex = bodyIndex;
            progressed = true;
            break;
          }
        }

        const maxEmpty = collected.length >= 120 ? 6 : collected.length >= 40 ? 4 : 2;
        if (!progressed) {
          emptyStreak += 1;
          if (emptyStreak >= maxEmpty) break;
        } else {
          emptyStreak = 0;
        }
        await sleep(randInt(35, 120));
      }
      if (collected.length >= limit) return collected;
    }
  }

  return collected;
}

/**
 * Puppeteer 페이지와 동일 출처에서 fetch — 브라우저 쿠키·세션이 자동 포함됨 (Node axios 한계 보완)
 * 페이지마다 본문 필드 조합을 바꿔 가며 시도해, 잘못된 필드로 항상 1페이지만 오는 경우를 줄임
 */
async function fetchReviewsViaBrowserFetch(page, originBase, goodsNo, limit) {
  const pageSize = pickPageSize(limit);
  const maxPages = pickMaxPages(limit, pageSize);
  const out = [];
  const seenLocal = new Set();
  const paths = ["/review/api/v2/reviews", "/review/api/v3/reviews"];

  const postReviewJson = (pathSuffix, body) =>
    page.evaluate(
      async ({ base, path, body: b }) => {
        try {
          const res = await fetch(`${base}${path}`, {
            method: "POST",
            credentials: "include",
            headers: {
              "content-type": "application/json",
              accept: "application/json, text/plain, */*",
            },
            body: JSON.stringify(b),
          });
          const text = await res.text();
          return { status: res.status, ok: res.ok, text };
        } catch {
          return { status: 0, ok: false, text: "" };
        }
      },
      { base: originBase, path: pathSuffix, body }
    );

  for (const pathSuffix of paths) {
    let preferredBodyIndex = null;
    for (let i = 0; i < maxPages && out.length < limit; i += 1) {
      const page1 = i + 1;
      const page0 = i;
      const bodies = buildReviewPostBodies(goodsNo, page1, page0, pageSize);
      const attempts = orderedBodies(bodies, preferredBodyIndex);
      let progressed = false;

      for (const { body, index: bodyIndex } of attempts) {
        const payload = await postReviewJson(pathSuffix, body);
        if (!payload.ok || !payload.text?.startsWith("{")) continue;

        let json;
        try {
          json = JSON.parse(payload.text);
        } catch {
          continue;
        }

        const list = extractReviewListBest(json);
        if (!list.length) continue;

        let added = 0;
        for (const item of list) {
          const text = reviewTextFromItem(item);
          if (text.length < 8 || text.length > 8000) continue;
          const rid = reviewIdFromItem(item);
          const key = rid != null ? String(rid) : text.slice(0, 200);
          if (seenLocal.has(key)) continue;
          seenLocal.add(key);
          out.push({ text, created: createdFromItem(item) });
          added += 1;
          if (out.length >= limit) return out;
        }

        if (added > 0) {
          preferredBodyIndex = bodyIndex;
          progressed = true;
          break;
        }
      }

      if (i === 0 && pathSuffix === paths[0] && !progressed) {
        console.warn(`[Crawler] 브라우저 fetch 1페이지 실패 ${originBase} (${pathSuffix})`);
      }
      if (!progressed) break;
      await sleep(randInt(30, 110));
    }
    if (out.length >= limit) return out;
  }

  return out;
}

function pushReviewApiItem(collected, seen, item, limit) {
  const text = reviewTextFromItem(item);
  if (text.length < 8 || text.length > 8000) return;
  const rid = reviewIdFromItem(item);
  const key = rid != null ? `id:${rid}` : `t:${text.slice(0, 280)}`;
  if (seen.has(key) || collected.length >= limit) return;
  seen.add(key);
  collected.push({ text, created: createdFromItem(item) });
}

function pushTextRow(collected, seen, row, limit) {
  const text = (row && row.text) || "";
  if (text.length < 8 || text.length > 8000) return;
  const key = `t:${text.slice(0, 280)}`;
  if (seen.has(key) || collected.length >= limit) return;
  seen.add(key);
  collected.push({ text, created: row.created || "" });
}

/** API가 막힐 때 상세 탭 DOM에서 보조 수집 (중복·UI 문구는 휴리스틱으로 걸러냄) */
async function scrapeReviewsFromDom(page, cap) {
  const texts = await page.evaluate((max) => {
    const seen = new Set();
    const out = [];
    const roots = [];
    document
      .querySelectorAll(
        '[id*="review"], [id*="Review"], [class*="review"], [class*="Review"], [class*="goods_review"]'
      )
      .forEach((el) => {
        if (el instanceof HTMLElement) roots.push(el);
      });
    if (!roots.length) roots.push(document.body);

    const tryAdd = (raw) => {
      const n = (raw || "").replace(/\s+/g, " ").trim();
      if (n.length < 28 || n.length > 2200) return;
      if (
        /^(평점|리뷰\s*\(|도움이\s*돼요|신고|비밀글|한줄평|구매자\s*리뷰|리뷰\s*더보기)/.test(n)
      ) {
        return;
      }
      if (/^\d{1,2}\.\d{1,2}\.\d{2,4}/.test(n) && n.length < 40) return;
      const k = n.slice(0, 48);
      if (seen.has(k)) return;
      seen.add(k);
      out.push(n);
    };

    for (const root of roots) {
      root.querySelectorAll("p, div, span, dd").forEach((el) => {
        const ch = el.children?.length ?? 0;
        if (ch > 8) return;
        tryAdd(el.innerText);
      });
      if (out.length >= max) break;
    }
    return out.slice(0, max);
  }, cap + 40);

  return Array.isArray(texts) ? texts : [];
}

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
  await page.setUserAgent(CHROME_UA);
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

  // 카테고리별 결과 수집 (순위 요약 알림용)
  const summaryByProduct = {};
  for (const product of products) {
    summaryByProduct[product.id] = { name: product.name, ranks: {} };
  }

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
        await pool.query(
          "INSERT INTO rankings (product_id, category, rank) VALUES ($1, $2, $3)",
          [product.id, category, rank]
        );
        console.log(`[Crawler] ${category} - ${product.oliveyoung_id}: ${rank ?? "순위권 밖"}`);
        summaryByProduct[product.id].ranks[category] = rank;
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

  const categoryNames = Object.keys(CATEGORIES);
  const summaryLines = Object.values(summaryByProduct).map(({ name, ranks }) => {
    const rankText = categoryNames.map((cat) => {
      const r = ranks[cat];
      return `${cat}: ${r != null ? `${r}위` : "순위권 밖"}`;
    }).join(" | ");
    return `• *${name}* — ${rankText}`;
  });
  await notifyRanking(`📊 *랭킹 요약* (${new Date().toLocaleString("ko-KR")})\n${summaryLines.join("\n")}`);
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
  const reviewUrlWww = `https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=${goodsNo}&tab=review`;
  const reviewUrlM = `https://m.oliveyoung.co.kr/goods/getGoodsDetail.do?goodsNo=${goodsNo}&tab=review`;

  const collected = [];
  const seen = new Set();

  const onReviewApiResponse = async (res) => {
    try {
      const u = res.url();
      if (!/\/review\/api\//i.test(u) && !u.toLowerCase().includes("review")) return;
      const method = res.request().method();
      if (method !== "POST" && method !== "GET") return;
      const json = await res.json().catch(() => null);
      if (!json) return;
      const list = extractReviewListBest(json);
      for (const item of list) {
        pushReviewApiItem(collected, seen, item, limit);
      }
    } catch {
      /* ignore */
    }
  };

  try {
    page.on("response", onReviewApiResponse);

    await page.goto(reviewUrlWww, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(randInt(1800, 3200));
    await page
      .evaluate(() => {
        window.scrollTo({ top: document.body.scrollHeight * 0.45, behavior: "instant" });
      })
      .catch(() => {});
    await sleep(randInt(500, 1100));

    console.log(`[Crawler] 리뷰 수집 goodsNo=${goodsNo} 목표=${limit} (브라우저 fetch + 스니퍼 + axios)`);

    // 1) www 출처: 페이지와 동일 origin fetch (쿠키 자동)
    let fromBrowser = await fetchReviewsViaBrowserFetch(page, "https://www.oliveyoung.co.kr", goodsNo, limit);
    for (const row of fromBrowser) {
      pushTextRow(collected, seen, row, limit);
    }

    // 2) 리뷰 더보기로 추가 네트워크 유도
    const moreClicks = limit >= 500 ? 85 : limit >= 200 ? 55 : 35;
    for (let c = 0; c < moreClicks && collected.length < limit; c += 1) {
      const clicked = await page.evaluate(() => {
        const els = [...document.querySelectorAll("button, a, span, div[role='button']")];
        const hit = els.find((el) => {
          const t = (el.textContent || "").replace(/\s+/g, " ").trim();
          return /리뷰\s*더보기|더\s*많은\s*리뷰|리뷰\s*펼치기|리뷰\s*더\s*보기/.test(t);
        });
        if (hit) {
          hit.click();
          return true;
        }
        return false;
      });
      if (!clicked) break;
      await sleep(randInt(450, 1100));
    }

    // 3) m 도메인에서 동일 시도 (세션 분리 대비)
    if (collected.length < limit) {
      await page.goto(reviewUrlM, { waitUntil: "domcontentloaded", timeout: 55000 }).catch(() => {});
      await sleep(randInt(1500, 2800));
      fromBrowser = await fetchReviewsViaBrowserFetch(page, "https://m.oliveyoung.co.kr", goodsNo, limit);
      for (const row of fromBrowser) {
        pushTextRow(collected, seen, row, limit);
      }
    }

    // 4) axios 백업 (서버 직통 — 일부 환경에서만 성공)
    if (collected.length < limit) {
      await page.goto(reviewUrlWww, { waitUntil: "networkidle2", timeout: 55000 }).catch(() => {});
      await sleep(2000);
      const cookieHeader = cookiesToHeader(await page.cookies());
      const fromAxios = await fetchReviewsViaAxios(goodsNo, limit, cookieHeader);
      for (const row of fromAxios) {
        pushTextRow(collected, seen, row, limit);
      }
    }

    // 5) API가 짧은 배열만 주거나 페이지 필드가 어긋날 때: 스크롤하며 DOM에서 보충
    if (collected.length < limit) {
      await page.goto(reviewUrlWww, { waitUntil: "networkidle2", timeout: 55000 }).catch(() => {});
      await sleep(randInt(1000, 1800));
      const domScrolls = limit >= 500 ? 75 : limit >= 200 ? 50 : 35;
      for (let s = 0; s < domScrolls && collected.length < limit; s += 1) {
        await page.evaluate(() => window.scrollBy(0, 520)).catch(() => {});
        await sleep(200);
        const domBatch = await scrapeReviewsFromDom(page, limit);
        for (const t of domBatch) {
          pushTextRow(collected, seen, { text: t, created: "" }, limit);
        }
      }
    }

    const reviews = collected
      .sort((a, b) => {
        const aa = (a.created || "").replace(/\./g, "");
        const bb = (b.created || "").replace(/\./g, "");
        return bb.localeCompare(aa);
      })
      .map((item) => item.text);

    const uniqueReviews = Array.from(new Set(reviews)).slice(0, limit);

    if (!uniqueReviews.length) {
      throw new Error("리뷰를 찾지 못했습니다. 셀렉터·API가 변경됐을 수 있습니다.");
    }

    console.log(`[Crawler] 리뷰 수집 완료 ${uniqueReviews.length}건 (요청 상한 ${limit})`);

    /** 올리브영 상세 메타의 등록 상품명 (og:title) — 히스토리·UI 표시용 */
    let registeredProductName = "";
    try {
      const cur = page.url();
      if (!cur.includes("www.oliveyoung.co.kr") || !cur.includes("getGoodsDetail")) {
        await page.goto(reviewUrlWww, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
        await sleep(randInt(500, 900));
      }
      await page
        .waitForFunction(
          () => {
            const title = document.querySelector('meta[property="og:title"]')?.content ?? "";
            return title.length > 0 && !title.includes("잠시만");
          },
          { timeout: 12000 }
        )
        .catch(() => {});
      registeredProductName = await page.evaluate(() => {
        const raw = document.querySelector('meta[property="og:title"]')?.content ?? document.title;
        const t = raw.replace(/\s*\|\s*올리브영.*$/, "").trim();
        if (!t || t.includes("잠시만")) return "";
        return t;
      });
    } catch {
      /* 상품명 없이 리뷰만 반환 */
    }

    return {
      goodsNo,
      sourceUrl: reviewUrlWww,
      count: uniqueReviews.length,
      reviews: uniqueReviews,
      productName: registeredProductName || null,
    };
  } finally {
    page.off("response", onReviewApiResponse);
    await browser.close();
  }
}

module.exports = { crawlAll, crawlProductDetail, crawlLatestReviewsByProductUrl };
