# LAGI 서버 (Cloudflare Worker) — AI 피팅 + 회원

사이트의 "AI 피팅"은 방문자 사진과 상품 사진을 Google Gemini 이미지 모델에 보내
"그 상품을 든 사람 사진"을 새로 만들어 줍니다. 이 Worker는 Gemini API 키를 숨겨 두고
대신 호출하는 작은 서버입니다. 사진은 저장하지 않습니다.

## 1. Gemini API 키 만들기
1. https://aistudio.google.com/apikey 에 Google 계정으로 로그인합니다.
2. **Create API key**를 눌러 키를 만들고 복사해 둡니다.
3. 이미지 생성은 유료입니다(한 장당 과금). 결제 설정과 현재 요금은 Google AI Studio에서 확인하세요.

## 2. Worker 배포하기 (한 번만)
컴퓨터 터미널에서:
```bash
cd server/tryon-worker
npx wrangler login                    # Cloudflare 계정으로 로그인 (무료 계정 가능)
npx wrangler secret put GEMINI_API_KEY  # 1번에서 만든 키 붙여넣기
npx wrangler deploy
```
배포가 끝나면 `https://lagi-tryon.<계정이름>.workers.dev` 같은 주소가 나옵니다.

## 3. 사이트에 연결하기
현재 주소 `https://lagi-tryon.lagi-official.workers.dev` 는 `src/tryon/aiTryOn.ts` 에 기본값으로 들어 있습니다.
주소가 바뀌면 그 값을 고치거나, GitHub 저장소 → **Settings → Secrets and variables → Actions → Variables** 에
`TRYON_API_URL` 이름으로 새 주소를 넣고 배포를 다시 실행하세요.

## 참고
- 모델 이름이 바뀌면 `wrangler.toml`의 `GEMINI_MODEL`을 바꾸고 `npx wrangler deploy` 하세요.
  (AI Studio의 모델 목록에서 "image"가 들어간 Gemini 모델을 고르면 됩니다.)
- 남용 방지: Worker에 간단한 횟수 제한이 있지만, 비용이 걱정되면 Cloudflare 대시보드에서
  Rate limiting 규칙을 추가하고 Google AI Studio에서 사용 한도를 설정하세요.
- 허용된 사이트(`ALLOWED_ORIGINS`)에서만 호출할 수 있고, 상품 이미지도 그 사이트에서만 가져옵니다.

## 회원가입 · 로그인
같은 Worker가 회원 정보도 저장합니다(Cloudflare KV, `USERS`). 비밀번호는 PBKDF2로 암호화해 저장하고, 로그인은 30일 유지됩니다.
`wrangler.toml`의 `[[kv_namespaces]] binding = "USERS"` 덕분에 `npx wrangler deploy` 때 저장소가 자동으로 만들어집니다.
자동 생성이 안 되는 wrangler 버전이면:
```bash
npx wrangler kv namespace create USERS   # "설정에 추가할까요?" → y
npx wrangler deploy
```
- `POST /auth/signup` {name, email, password, agree, marketing} · `POST /auth/login` {email, password}
- `GET /auth/me` · `POST /auth/logout` (헤더 `Authorization: Bearer <token>`)


## 주문 · 결제 (토스페이먼츠)
- `POST /orders` — 주문서를 받아 **공개된 제품 데이터(`PRODUCTS_BASE_URL`)에서 가격을 다시 읽어** 금액을 계산하고 미결제 주문을 만든다(하루 뒤 자동 삭제).
- `POST /payments/confirm` — 결제 성공 페이지가 보낸 `paymentKey · orderId · amount`를 확인하고 토스 승인 API를 호출한다. 금액이 다르면 거절, 같은 결제의 재요청은 같은 결과.
- `GET /admin/orders` — 결제된 주문 목록. `Authorization: Bearer <ADMIN_TOKEN>` 필요.

설정:
```
npx wrangler secret put TOSS_SECRET_KEY   # 토스 결제위젯 시크릿 키 (test_gsk_… / live_gsk_…)
npx wrangler secret put ADMIN_TOKEN       # 주문 조회용 임의의 긴 문자열
npx wrangler deploy                       # ORDERS 저장소 자동 생성
```
사이트 쪽 클라이언트 키는 GitHub 저장소 변수 `TOSS_CLIENT_KEY`에 넣는다(공개용 키).
