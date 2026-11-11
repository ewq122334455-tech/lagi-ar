# 현재 AI 피팅 시스템 분석 (코드 확인 기준)

브랜치 `feature/ai-fitting-quality-v2` (기반 `fix/remediation-all` @ `a1d5e06`). 아래는 모두 **코드를 읽고 확인한 내용**입니다. 존재하지 않는 기능은 "없음"으로 적었습니다.

## 1. 기능 구분 (질문 A~F에 대한 답)

| 구분 | 현재 구현 | 있음/없음 | 위치 |
|---|---|---|---|
| A. 생성형 AI **이미지** 합성 | Gemini 이미지 모델(`gemini-2.5-flash-image`)에 사람 사진 + 제품 사진을 보내 "그 사람이 제품을 든 사진"을 생성 | **있음** | `server/tryon-worker/src/index.ts` `tryOn()`, `src/tryon/aiTryOn.ts`, `src/v3/pages/Again.tsx` (사진 합성 탭) |
| B. 단순 이미지 오버레이 | 제품 사진(Gemini 마스크)을 몸에 붙이는 2D 합성. 3D 모델이 없는 제품의 `m=map` 경로에서 쓰이던 방식 | **코드에 남아 있으나 사용자에게는 노출되지 않음** (3D 없는 제품은 "준비 중" 안내 후 사진 합성으로 유도) | `productOverlay.ts` `paint()`, `MapTryOn.tsx` |
| C. 3D 제품 렌더링 | three.js 3D 가방(tote / box / pouch 3종), 제품 사진을 면별 텍스처로 입힘 | **있음** (8개 제품 중 6개) | `src/v3/bag3d.ts`, `public/products/*/product.json` `model3d` |
| D. 손·신체 랜드마크 추적 | MediaPipe PoseLandmarker(lite) + HandLandmarker, 브라우저에서 실행 | **있음** | `productOverlay.ts` `loadPose/loadHands`, `MapTryOn.tsx` `run()` |
| E. AR 제품 위치 정렬 | 손 관절로 크기(px/cm)·위치·회전을 계산해 3D 가방을 손에 걸고, 손 마스크로 손가락을 다시 위에 그림 | **있음** (손에 들기·어깨에 메기) | `MapTryOn.tsx` 322~420행 부근 |
| F. 생성형 AI **실시간 영상** 피팅 | Decart `lucy-2.6` 실시간 모델. 카메라 + 3D 합성 장면을 보내 AI가 실사 보정, 제품 디자인은 "디자인 고정" 로직으로 다시 덮음 | **있음 (베타, 20초 세션)** | `LiveTryOn.tsx`, `MapTryOn.tsx` `startAi/composeAi`, `greenMap.ts`, Worker `/realtime/token` |

**없는 것**: 옷 전용 가상 착용 모델, 제품 자체의 AI 3D 생성, 서버 측 이미지 세그멘테이션(Worker에는 이미지 디코더가 없음), 결과물 품질 자동 평가(이번 작업 전).

## 2. 기능별 상세

### 2-1. AI 사진 합성 (A)
- **호출 경로**: `Again.tsx run()` → `requestAiTryOn()` → `POST https://lagi-tryon…workers.dev/` → Worker `tryOn()` → `productCutout()`(KV 캐시) → `geminiImage()` → `callGemini()`(Durable Object `GeminiRelay`, 서부 미국에서 호출)
- **입력**: 방문자 사진(클라이언트가 최대 1280px JPEG로 줄임, 서버 상한 4MB), 제품 URL(허용된 출처만), 제품명·분류·크기(mm)·착용 방식(영어 문장)
- **모델/라이브러리**: Gemini 이미지 모델(설정 `GEMINI_MODEL`). 제품 컷아웃도 같은 모델.
- **요청 구조**: `contents: [{ parts: [프롬프트 텍스트, 사람 사진, 제품 참조 사진] }]`, `responseModalities: ['IMAGE']`(첫 시도) → 이후 `['TEXT','IMAGE']`, 안전 필터 `BLOCK_ONLY_HIGH`
- **출력**: base64 이미지 → 클라이언트 `ai-result`에 표시, 저장은 브라우저 다운로드
- **데이터 처리**: 사진은 Worker가 Gemini로 전달만 하고 저장하지 않음(UI 문구). 컷아웃은 KV `MEDIA`에 `cutout:v1:<url>`로 영구 캐시.
- **오류 처리**: 3회 재시도(바쁨 2·4초, 이미지 없음 시 "이미지만 달라" 재요청), 차단 사유 구분, 클라이언트 1회 추가 재시도(5xx/429), 120초 타임아웃, 취소 버튼
- **한계(코드 기준)**:
  1. 참조 이미지가 **AI가 다시 그린 컷아웃**이다(원본 픽셀이 아님) → 형태·그래픽 변형이 합성 전에 시작될 수 있음 (ROOT-CAUSE P1)
  2. 컷아웃 프롬프트는 "가려진 부분을 복원하라"고 요청 → 사람 손에 가려진 제품 부분은 **추측으로 생성**
  3. 결과 검증이 없었음(이번 작업 전): 구도가 잘리거나 제품이 없어도 그대로 표시
  4. 착용 방식 프롬프트가 한 문장("held by the handles…")이라 제품별 구조(손잡이 길이, 끈)를 반영하지 못함
  5. 모델이 확률적이라 같은 입력도 결과가 다름. 로고·글자는 생성 모델의 약점

### 2-2. 실시간 3D 착용 (C·D·E) — `MapTryOn.tsx`
- **흐름**: `getUserMedia` → rAF 루프(`frame`) → 약 45ms마다 `PoseLandmarker.detectForVideo`(+분할 마스크) + 손 크롭(256px)에 `HandLandmarker.detectForVideo` → 손 위치·회전·크기 계산 → three.js 정사영 레이어(`createBagLayer`)에 3D 가방 렌더 → 손 마스크를 위에 그려 손가락이 가방 앞에 오게 함
- **입력**: 카메라 영상 프레임. **출력**: 합성 캔버스(저장 가능)
- **좌표 계산**: 손의 5번(검지 뿌리)·17번(새끼 뿌리) 중점 = 쥔 위치, 아홉 개 뼈 길이 비 = px/cm(회전해도 불변), 3D 손 관절의 knuckle 선 = yaw
- **오류/예외**: 손을 8번 연속 못 찾으면 어깨/손목 기준 위치로 전환, 카메라 권한·미발견 메시지, 탭 숨김 시 중단, 언마운트 시 WebGL·모델 해제(이번 라운드 이전 수정)
- **한계(코드 기준, V1)**: 위치 평활이 프레임당 고정 비율(40%)이라 프레임 속도에 의존. 검출은 ≤22Hz인데 렌더는 60Hz라 계단 모양 이동. 손 회전은 45%씩 따라가 튀는 검출을 그대로 따름. 손을 잃으면 즉시 다른 위치 계산으로 전환(순간 이동). 그림자는 없음, 조명은 화면 밝기로 반구광 세기만 조절.

### 2-3. 실시간 AI 영상 (F) — `LiveTryOn.tsx`, `MapTryOn.tsx`
- Decart 클라이언트 토큰(`/realtime/token`, 20초, 사이트 하루 100회·IP당 3회)으로 WebRTC 연결, 입력 영상은 카메라(+3D 합성), 프롬프트와 참조 이미지를 `setImage/setPrompt`로 전달.
- "실제 디자인 입히기": AI에게 초록색 단색 가방을 그리게 하고(`greenMap.ts`), 초록 영역에 우리 제품 이미지를 영상에 맞춰 다시 씌움. 3D 제품은 지연이 맞춘 오버레이 이력으로 디자인을 고정.
- **한계**: 20초 제한·비용, 생성 모델이 제품 형태를 임의로 바꿈(그래서 위 덮어쓰기 구조가 생김).

## 3. 제품별 현황 (실제 데이터 기준)

| 상품 ID | 상품명 | 종류·크기(cm) | 3D 모델 | 실시간 3D 착용 | 사진 합성 |
|---|---|---|---|---|---|
| daily-tote | 데일리토트백 | 토트 28×25×13, 손잡이 13 | tote | 손에 들기·어깨 | 가능 |
| daily-pouch-bag | 데일리 파우치백 | 가방 19×16×14 | **없음** | 불가(안내) | 가능 |
| origami-picnic-bag | 오리가미 피크닉백 | 대형 60×33×14 | box(근사) | 가능(큰 크기 주의) | 가능 |
| plano-bag | 플라노백 | 박스 14×14×14, 손잡이 5 | box | 가능 | 가능 |
| modular-bag-s | 모듈러백 S | 22×14×2.5(표기), 손잡이 11 | box | 가능 | 가능 |
| milkpack-earphone-case | 우유팩 이어폰 케이스 | 소품 8×8×4 + 키링 | pouch | 손에 들기·들어 보이기 | 가능 |
| book-cover | 북커버 | 소품 25×17×4 | **없음** | 불가(안내) | 가능 |
| glasses-case | 안경 보관함 | 소품 19×9×5 | pouch | 가능 | 가능 |

(모든 3D 모델은 고객 제공 사진으로 만든 **근사 모델**입니다. 치수는 상세 페이지 표기.)
