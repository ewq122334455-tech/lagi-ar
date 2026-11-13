# 최소 실호출 스모크 테스트 설계 (승인 전에는 실행하지 않음)

**목적**: 대규모 A/B가 아니라 "실제 Decart 영상이 생성되어 화면에 나오는가"를 최소 비용으로 확인한다. 아래 테스트는 **사용자의 별도 승인 전까지 실행하지 않았다.**

## 범위
| 항목 | 값 |
|---|---|
| 상품 | **daily-tote** 1개 (실제 LAGI 가방, 흰 배경 사진이라 컷아웃·Gemini 불필요, 3D·치수 있음) |
| 세션 | 1회, **10초** (`REALTIME_SESSION_SECONDS=10`) |
| 속도 | 표준 (빠른 모드 아님) |
| 모델 | 기본 `lucy-2.6` (모델을 바꾸지 않음) |
| 입력 | 실제 카메라(앞 카메라, 가방을 한 손에 들고 시작) |
| "실제 디자인 입히기" | **끔** (켜면 Gemini 매트가 필요해 비용이 늘어남) |
| Gemini | 키 미설정 → 0원 |

## 비용
- 계산: 10초 × $0.02/초 = **$0.20** (공식 가격 페이지, 표준 720p; `lucy-2.6`·`lucy-vton-3.6` 동일).
- 실패 시도 포함 최대(일 2회 허용 설정): $0.40. 빠른 모드가 아니므로 2배는 적용되지 않는다.
- 무료 크레딧이 있는 신규 계정이면 청구가 0일 수 있다(가격 페이지 FAQ). 실제 청구는 Decart 사용량 페이지로 확인.
- 이 금액은 "서버가 관찰한 값"이 아니라 공급자 공시 단가 × 최대 시간의 **상한 추정**이다.

## 성공/실패 기준 (모두 기록한다. 실패도 결과다)
| 결과 | 기록 |
|---|---|
| 토큰 오류(401/403/5xx, `provider`) | FAIL: 토큰 단계 |
| 연결 실패(WebRTC/`TOKEN_EXPIRED`/1013) | FAIL: 연결 단계 |
| 연결됐으나 영상 미출력(12초 내 프레임 없음) | FAIL: 영상 미출력 |
| 영상 출력, 내 모습 유지 | PASS: 영상 출력 |
| 가방 형태·색·로고가 사진과 대체로 일치 | PASS/FAIL: 기본 충실도 (아래 점검표) |
| 20초가 아니라 10초 안에 끊김 | PASS: 공급자가 세션 길이 제약을 강제 |

화면의 "AI 처리" 단계가 지난 뒤 **영상 출력** 단계가 되면 영상 도착이다. 모의가 아님은 화면에 "MOCK — NOT AI"가 **없는 것**으로 확인한다.

## 충실도 점검표 (사람이 3점 척도로 기록)
daily-tote 사진을 옆에 놓고: 전체 실루엣(○/△/×), 색, 로고·글자(읽히는가, 지어낸 글자가 있는가), 손잡이 위치·개수, 크기(몸 대비), 손과 가방의 접촉, 프레임 사이 형태 변화. 로고가 다른 가방(예: 엉뚱한 글자)으로 바뀌면 **실패 사례로 기록**한다.

## 준비 (한 번)
1. Decart에서 **시험용** 프로젝트·API 키를 만든다(운영 키 금지). 계정 동시 세션 한도·월 예산을 낮게 설정한다.
2. `server/tryon-worker/.dev.vars`(git 무시됨)를 만든다:
```
DECART_API_KEY=<시험용 키>
ALLOWED_ORIGINS=http://localhost:5173
REALTIME_SESSION_SECONDS=10
REALTIME_DAILY_SESSIONS=2
REALTIME_MAX_CONCURRENT=1
ADMIN_TOKEN=<임의의 긴 문자열>
```
(`GEMINI_API_KEY`는 넣지 않는다.)
3. 사전 점검(아무것도 전송하지 않음):
```
node scripts/rt-smoke-preflight.mjs --seconds 10
```
모든 항목이 OK이면 비용 요약이 출력된다.

## 실행 명령 (승인 후)
터미널 1 (로컬 Worker, 실제 Durable Object):
```
cd server/tryon-worker && npx wrangler dev --local --port 8787
```
터미널 2 (사이트):
```
VITE_TRYON_API_URL=http://localhost:8787 npm run dev
```
브라우저(Mac Chrome): `http://localhost:5173/#/again?p=daily-tote&m=live` → "실제 디자인 입히기" **끄기** → 동의 체크 → "결과 영상을 이 기기에 녹화" 체크 → "실시간 착용 시작" → 카메라 허용. 10초 후 자동 종료되고 녹화본을 저장할 수 있다.

## 실행 후 대조 (청구 차이 기록)
```
# 내부 기록: 토큰 수, 예약 초, 페이지가 보고한 초
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" -H "Origin: http://localhost:5173" http://localhost:8787/admin/usage | jq .realtime
# 공급자 쪽: 잔액·동시 세션
curl -s -H "x-api-key: $DECART_API_KEY" https://api.decart.ai/v1/credits
curl -s -H "x-api-key: $DECART_API_KEY" https://api.decart.ai/v1/realtime/quota
```
시험 전후 `credits` 차이 ÷ 100 = 실제 청구 달러(공식: $1 = 100 크레딧). 이 값과 `reservedSeconds`(10) × $0.02 = $0.20, `reportedByPagesSeconds`를 한 표에 적는다. **차이가 있으면 그대로 기록한다**(큐 대기·무프레임 구간이 청구되는지 이 시험으로 첫 관측이 된다).

## 시험 후 정리
`.dev.vars`의 키를 폐기하거나 시험용 프로젝트 한도를 0으로 낮춘다. 녹화 파일은 기기에만 있으며 개인 얼굴이 포함되므로 직접 삭제한다.

## 이 시험이 증명하지 않는 것
모델 간 우열, 다른 상품 7개, 로고·질감의 안정성, 모바일 기기, 20초 전체 구간의 모션 품질, 비용의 장기 추이. 단 1회이며 통계적 근거가 아니다.
