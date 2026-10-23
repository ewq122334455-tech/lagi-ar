# PHASE 02 — 기존 LAGI 사이트 감사 (코드 기준, 2026-10-23)

기존 화면 디자인은 새 사이트에 쓰지 않는다. 아래는 **코드에서 실제로 확인한** 기능·데이터와 이식 방법이다.

## 1. 데이터

| 항목 | 위치 | 실제 상태 | 새 사이트 |
|---|---|---|---|
| 상품 목록 | `public/products/manifest.json` | 17개 ID | 그대로 사용 |
| 상품 데이터 | `public/products/<id>/product.json`, 로더 `src/data/productEngine.ts`, 훅 `src/hooks/useProducts.ts` | 런타임 fetch | 로더·타입(`src/data/productTypes.ts`) 그대로 이식 |
| 실제 판매 상품 | 위 JSON 중 `sample` 아님 + 이름·가격 `VERIFIED` | **8개**: daily-tote, daily-pouch-bag, origami-picnic-bag, plano-bag, modular-bag-s, milkpack-earphone-case, book-cover, glasses-case | 새 사이트는 이 8개만 노출 |
| 샘플 상품 | `sample: true` | 티셔츠 4·팬츠 4·product-001 — **임의로 만든 가상 상품** | 노출 금지 (Fake Product Information) |
| 상품명·가격·한 줄 설명·배송비 | product.json | `VERIFIED` (스마트스토어 캡처 기준, 할인가 제외) | 사용 |
| 치수 | product.json `dimensions` | 브랜드가 준 3D 도면 기준 | 사용 |
| 상품 사진 | `images/main.jpg` | 스토어 캡처에서 잘라낸 1장, 가로 약 520–660px | 사용 (고해상도 원본 필요) |
| 설명·소재·공정·이야기·선정 이유 | product.json | **전부 `AI_DRAFT`** — 확인되지 않은 초안. 일부 문구는 “만들었습니다” 등 직접 제조 브랜드처럼 쓰여 새 포지셔닝(큐레이션)과 충돌 | **사용 안 함**. 확정 문구 필요 |
| 협업 정보 | `brandLabel` | “LAGI × POPSICLUS” (8개 상품) | ABOUT에 사용 가능 |
| 공식 채널 | 코드 내 링크 | 스마트스토어 `smartstore.naver.com/lagi_official`, 인스타그램 `@lagi.official` | CONTACT에 사용. 이메일·전화·주소는 **확인된 값 없음** |

## 2. 기능

| 기능 | 기존 구현 위치 | 설명 | 데이터 의존성 | 이식 방법 | 이식 | 테스트 |
|---|---|---|---|---|---|---|
| 상품 목록·정렬·필터·검색 | `src/pages/ProductCollection.tsx` | URL 쿼리(`sort`, `filter`, `q`) | product.json | 로직을 훅으로 분리 후 새 DISCOVER 페이지에 연결 | 대기 | — |
| 상품 상세 | `src/pages/ProductDetail.tsx`, `ProductGallery.tsx` | 사진, 정보, 구매 패널 | product.json | 새 상세 레이아웃에 데이터 바인딩 | 대기 | — |
| 옵션·수량·장바구니 | `src/components/BuyPanel.tsx`, `src/commerce/CartContext.tsx` | localStorage 장바구니, 사이즈/색 variant | variants | `CartContext` 그대로 사용, UI만 새로 | 대기 | — |
| 구매(체크아웃) | `src/pages/Checkout.tsx` | **결제 없음**. 주문 내용을 복사하고 스마트스토어 메인으로 이동 | 장바구니 | 동작 유지, UI 새로 | 대기 | — |
| **상품별 구매 링크** | — | **구현돼 있지 않음**. 모든 상품의 `shopUrl`이 스토어 메인 주소로 동일 | — | 상품별 스마트스토어 URL을 받아 `shopUrl`에 입력 필요 | 불가(자료 없음) | — |
| AI 피팅 | `src/pages/AiFitPage.tsx`, `src/tryon/aiTryOn.ts`, `server/tryon-worker` | 사진 → Gemini 합성 (Cloudflare Worker) | 상품 이미지, Worker | 페이지 UI만 새로, 클라이언트·서버 그대로 | 대기 | — |
| 회원가입·로그인 | `src/auth/AuthContext.tsx`, `src/pages/AuthPages.tsx`, Worker `/auth/*` | KV 저장, PBKDF2 | Worker 배포 필요 | 컨텍스트 그대로, 폼 UI 새로 | 대기 | 로컬 Worker로 E2E 통과(이전 작업) |
| 다시 조합(3D 색 바꾸기)·다시 카드 | `src/pages/Again.tsx`, `src/again/*`, `src/three/*` | three.js | GLB 모델 | 새 사이트 포함 여부 결정 필요 | 대기 | — |
| 소재·스토리·브랜드 페이지 | `Materials.tsx`, `Story.tsx`, `About.tsx` | AI_DRAFT 문구 기반 | product.json | 확정 문구 없으면 이식 안 함 | 대기 | — |
| 관리자 상품 등록 | `src/pages/workspace/*` | 브라우저에서 product.json 작성 | 로컬 드래프트 | 방문자 화면 아님 — 기존 그대로 유지 | 유지 | — |
| 전시 모드 | `src/pages/Exhibition.tsx` | 대형 화면용 3D | GLB | 유지 여부 결정 필요 | 대기 | — |
| 이전 링크 호환 | `App.tsx` `TryOnRedirect` | `/try-on/:id` → `/ai-fit/:id` | — | 새 라우터에 유지 | 대기 | — |

## 3. 공식 브랜드 자산

| 자산 | 위치 | 비고 |
|---|---|---|
| 엠블럼 로고 | `src/components/logoPaths.ts` + `LagiLogo.tsx` (브랜드 .ai에서 추출) | 색 `#1D5198`. 변형 금지 |
| 모티프 12종 | `src/components/motifs.ts` (“모티프 모음 라기” .ai에서 추출) | |
| 컬러 | 엠블럼 `#1D5198`, 기존 사이트 토큰 `blue #2E55A3` | **공식 컬러 코드 문서는 받은 적 없음** — 엠블럼 파일 값 `#1D5198`을 LAGI Blue로 쓰는 것이 근거가 가장 확실 |
| 서체 | Pretendard(한글), Posterama 2001(Adobe Fonts kit `uqf7oqq`) | |

## 4. 새 사이트에 필요한데 없는 자료
1. 레퍼런스 사이트 접근 (또는 화면 녹화·페이지별 캡처)
2. WHY LAGI 네 가지 선정 기준 확정 문구
3. 상품별 스마트스토어 URL
4. 상품별 확정 소재 정보·설명·선정 이유
5. 고해상도 상품 사진
6. CONTACT용 이메일 등 공개 연락처 (있다면)
