# 올리브영 랭킹 트래커

올리브영 상품의 카테고리별 랭킹을 **매시 정각** 자동 수집하고, 시간별/일별 순위 추이를 시각화하는 모니터링 툴입니다.

- **프론트엔드**: https://oliveyoung-tracker.vercel.app
- **백엔드**: https://oliveyoung-tracker-production.up.railway.app

---

## 로컬 실행

### Node.js (nvm 권장)

Cursor·일부 터미널에서는 `npm`이 안 보일 수 있습니다. **매 터미널에서 nvm을 먼저 로드**하세요.

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
```

프로젝트 루트에서 Node 버전 맞추기 (`.nvmrc` = 22):

```bash
cd oliveyoung-tracker
nvm install    # 최초 1회: 22 설치
nvm use
node -v && npm -v   # 확인
```

이후 `backend` / `frontend`에서 `npm install`, `npm run dev` 실행하면 됩니다.

**한 번에 실행 (nvm 자동 로드 + 백·프론트 동시):**

```bash
cd oliveyoung-tracker
./dev-with-nvm.sh
```

종료할 때는 터미널에서 `Ctrl+C` 한 번.

### 환경변수 설정

```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4000
```

**리뷰 전략 인사이트**는 기본적으로 **비용 없는 로컬 분석**(키워드·패턴 매칭)으로 동작합니다.

**Google AI Studio**에서 발급한 키로 **Gemini**(기본 `gemini-2.5-flash`, 구형 `gemini-1.5-flash`는 API에서 404가 날 수 있음) 분석을 켜면 VDL 전략 장표 형태로 채워집니다. Gemini가 실패했을 때만 선택적으로 **Claude** 키가 2차로 시도됩니다.

```bash
# backend/.env (선택) — 없으면 무료 모드만 사용
GEMINI_API_KEY=...           # 또는 GOOGLE_API_KEY=
# GEMINI_MODEL=gemini-2.5-flash   # 생략 시 자동 폴백 체인 사용

# Gemini 없이/실패 시에만 2차 시도
# ANTHROPIC_API_KEY=sk-ant-api03-...

# API 키가 있어도 무조건 무료만 쓰려면:
# USE_FREE_INSIGHTS_ONLY=true
```

`backend/.env.example` 참고.

**리뷰 분석 히스토리(사이드바)** 는 `backend/.env`에 **`DATABASE_URL`**(PostgreSQL)이 있으면 **서버 DB**에 저장되고, 없으면 브라우저 **localStorage**만 사용합니다. Railway 등에 Postgres를 붙인 뒤 백엔드를 재시작하면 `review_analysis_sessions` 테이블이 자동 생성됩니다.

- `GET /api/review-sessions` — 목록
- `POST /api/review-sessions` — 분석 완료 시 저장
- `PATCH /api/review-sessions/:id` — 표시 이름 변경
- `DELETE /api/review-sessions/:id` — 삭제

### 백엔드

```bash
cd backend
npm install
npm run dev   # nodemon (개발) / npm start (일반)
```

서버: `http://localhost:4000`

### 프론트엔드

Node.js 18 이상 필요 (nvm 사용 시 `nvm use 22`)

```bash
cd frontend
npm install
npm run dev
```

서버: `http://localhost:3000`

---

## 사용 방법

### 1. 어드민 (`/admin`)
- 올리브영 상품 URL에서 `goodsNo` 값을 복사해 등록
  - 예: `https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000176322`
- 등록 후 상품명·이미지·가격은 백그라운드에서 자동 수집
- **지금 크롤링** 버튼으로 즉시 수동 실행 가능

### 2. 대시보드 (`/dashboard`)
- **오늘 / 어제**: 시간별 순위 추이 (X축 = HH:mm)
- **7일 / 30일**: 일별 순위 추이 (X축 = MM/DD)
- 카테고리 탭으로 전체 / 메이크업 전환
- 상품 카드에서 현재 순위, 최고 순위, 7일 평균, 크롤링 시각 확인

### 3. 크롤링 스케줄
- **매시 정각** 자동 실행 (Asia/Seoul 기준)
- 올리브영 랭킹은 1시간 단위로 갱신되므로 시간별 모니터링 가능

---

## API

### 상품

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/products` | 상품 목록 |
| POST | `/api/products` | 상품 등록 `{ oliveyoung_id }` |
| DELETE | `/api/products/:id` | 상품 삭제 (랭킹 데이터 함께 삭제) |

### 랭킹

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/rankings/stats` | 상품별 KPI 통계 `?category=전체` |
| GET | `/api/rankings/hourly` | 시간별 순위 `?category=전체&date=YYYY-MM-DD` |
| GET | `/api/rankings/daily-best` | 일별 최고 순위 `?category=전체&from=&to=` |

### 크롤링 / 관리

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/crawl` | 수동 크롤링 트리거 |
| DELETE | `/api/rankings/all` | 랭킹 데이터 전체 초기화 |

---

## 배포 구성

| 서비스 | 플랫폼 | 비고 |
|--------|--------|------|
| 백엔드 | Railway | nixpacks + Chromium (Puppeteer) |
| 프론트엔드 | Vercel | Next.js 16 |
| DB | SQLite | Railway 앱 내부 저장 |

### Railway 환경변수

```
FRONTEND_URL=https://oliveyoung-tracker.vercel.app
```

### Vercel 환경변수

```
NEXT_PUBLIC_API_URL=https://oliveyoung-tracker-production.up.railway.app
```
