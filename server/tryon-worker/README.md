# LAGI AI 피팅 서버 (Cloudflare Worker)

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
GitHub 저장소 → **Settings → Secrets and variables → Actions → Variables** 에
`TRYON_API_URL` 이름으로 2번 주소를 추가하고, Actions에서 배포를 다시 실행하면
상품 페이지에 "AI로 입어보기" 버튼이 나타납니다.

## 참고
- 모델 이름이 바뀌면 `wrangler.toml`의 `GEMINI_MODEL`을 바꾸고 `npx wrangler deploy` 하세요.
  (AI Studio의 모델 목록에서 "image"가 들어간 Gemini 모델을 고르면 됩니다.)
- 남용 방지: Worker에 간단한 횟수 제한이 있지만, 비용이 걱정되면 Cloudflare 대시보드에서
  Rate limiting 규칙을 추가하고 Google AI Studio에서 사용 한도를 설정하세요.
- 허용된 사이트(`ALLOWED_ORIGINS`)에서만 호출할 수 있고, 상품 이미지도 그 사이트에서만 가져옵니다.
