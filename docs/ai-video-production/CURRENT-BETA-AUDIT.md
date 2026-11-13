# 현재 'AI 영상 (베타)' 감사

기준 브랜치: `feature/ai-video-production` (V5 + 검증 랩 위에서 분기). main·V5 브랜치는 건드리지 않았다.

## 한 줄 정의
**카메라 기반 실시간 AI 영상**이다. 사진으로 영상을 만드는 기능도, 녹화 영상을 재생하는 기능도 아니다. 실제 공급자(Decart)에 연결되도록 짜여 있고, UI만 있는 껍데기가 아니다. 다만 이 세션에서는 **실제 Decart를 호출하지 않았다**(승인 전). 아래 "연결됨"은 코드 경로가 실제 SDK/엔드포인트를 쓰도록 되어 있다는 뜻이지, 이번에 작동을 확인했다는 뜻이 아니다.

## 실행 경로 (확인한 코드)
| # | 항목 | 위치 |
|---|---|---|
| 1 | 버튼 | `src/v3/pages/Again.tsx:222` 탭 `['live', 'AI 영상 (베타)', 'AI가 다시 그리는 영상 · 20초']` |
| 2 | 이동 | 탭 클릭 → `#/again?p=<상품>&m=live` (`Again.tsx:49`, `:306`) |
| 3 | 렌더링 컴포넌트 | `src/v3/LiveTryOn.tsx` (`<LiveTryOn product stylePrompt styleChips/>`) |
| 4 | API | Worker `POST /realtime/token`, `POST /cutout` (`server/tryon-worker/src/index.ts`) |
| 5 | Decart SDK | `@decartai/sdk` 0.2.14(npm 최신과 동일), 시작할 때만 `import()`; 모델 `lucy-2.6` (1280×720, 30fps) |
| 6 | 토큰 발급 | Worker가 `https://api.decart.ai/v1/client/tokens`에 영구 키(`DECART_API_KEY`, Worker 비밀값)로 요청 → 브라우저는 단기 토큰만 받음 |
| 7 | 비용 제한 | Durable Object `QuotaCounter` 범위 `rt:<날짜>`: IP당 하루 3회, 사이트 하루 100회, 실패 시 차단(토큰 안 줌), 환불 없음 |
| 8 | 사용자 이미지 | 카메라 `getUserMedia` → WebRTC로 Decart. 서버(우리)에는 저장·전송하지 않음 |
| 9 | 상품 참조 | `/cutout`(Gemini로 배경 제거+설명, 캐시) → `smallReference`(768px JPEG) → `conn.setImage(ref, {prompt})`. "디자인 입히기" 켜짐(기본)이면 `/cutout?matte`로 초록 실루엣을 만들어 AI에게 초록 가방을 그리게 하고 `greenMap.ts`가 실제 디자인을 덮음 |
| 10 | 영상 스트림 | `onRemoteStream` → `<video>`; 매핑 켜짐이면 `<canvas>`에 합성 |
| 11 | 결과 저장 | 기존: 한 장면 PNG 저장 + "정확한 사진"(Gemini 사진 합성). **신규: 로컬 영상 녹화(MediaRecorder)** |
| 12 | 오류·상태 | 기존: idle/starting/live/ended + 문구. **신규: 11단계 표시**(`data-testid=live-steps`) |

## 기존 구현에서 정상이라 유지한 것
- 20초 세션 상한이 토큰(`maxSessionDuration`)에 들어 있어 페이지가 죽어도 공급자가 끊는다.
- 탭이 숨겨지면/언마운트되면 세션 종료, 12초 안에 생성 프레임이 없으면 중단.
- 동의 체크 없이는 시작 불가, 영구 키 브라우저 노출 없음.
- "디자인 고정"(초록 영역에 실제 사진) 구조 — 이전에 모델이 엉뚱한 가방(예: "EARF.FIO" 토트)을 그린 실제 스크린샷이 있어 도입된 것이다(`docs/ai-fitting-upgrade/ACTUAL-QUALITY-ISSUES.md` Q2).

## 한계 (정직하게)
- 이 세션에서 실제 AI 영상 출력은 **한 번도 확보하지 못했다**. 품질 판단 근거는 이전 세션의 사용자 스크린샷뿐이다.
- 모델이 상품을 정확히 그리지 못한다는 증거(Q2)가 있고, 디자인 고정은 그 완화책일 뿐 해결이 아니다.
