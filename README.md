# 올리브영 랭킹 트래커

올리브영 상품의 카테고리별 랭킹을 **매시 정각** 자동 수집하고, 시간별/일별 순위 추이를 시각화하는 모니터링 툴입니다.

- **프론트엔드**: https://oliveyoung-tracker.vercel.app
- **백엔드**: https://oliveyoung-tracker-production.up.railway.app

---

## 로컬 실행

### 환경변수 설정

```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4000
```

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
