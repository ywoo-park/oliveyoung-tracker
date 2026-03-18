# 올리브영 랭킹 트래커

## 실행 방법

### 백엔드

```bash
cd backend
npm install
npm run dev   # 개발: nodemon / npm start: 일반 실행
```

서버: http://localhost:4000

### 프론트엔드

```bash
cd frontend
npm install
npm run dev
```

서버: http://localhost:3000

---

## 사용 방법

1. **어드민** (`/admin`): 상품명 + 올리브영 상품코드 등록
   - 상품코드는 올리브영 상품 URL에서 확인 (`goodsNo=XXXXXXXXXX`)
   - 예: `https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000176322`

2. **크롤링 실행**: 어드민 하단 "지금 크롤링 실행" 버튼 또는 매일 09:00 자동 실행

3. **대시보드** (`/dashboard`): 카테고리/기간 필터로 순위 표 및 차트 확인

---

## API

| Method | Path | 설명 |
|--------|------|------|
| GET | /api/products | 상품 목록 |
| POST | /api/products | 상품 등록 `{ name, oliveyoung_id }` |
| DELETE | /api/products/:id | 상품 삭제 |
| GET | /api/rankings | 기간별 랭킹 `?category=전체&from=&to=` |
| GET | /api/rankings/latest | 최신 랭킹 `?category=전체` |
| POST | /api/crawl | 수동 크롤링 트리거 |
