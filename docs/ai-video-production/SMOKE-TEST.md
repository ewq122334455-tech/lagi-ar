# LEVEL 2 스모크 테스트 — 실행 준비서 (승인 전에는 실행하지 않음)

기준 커밋: `1963604` 이후 이 브랜치. **이 문서를 쓰는 동안 유료 호출은 0건이다.**

## 1. 목표와 범위
LAGI **daily-tote**로 **10초 실시간 AI 영상 1회**를 만들어, 실제 Decart 출력이 오는지와 기본 품질을 본다.

| 항목 | 값 |
|---|---|
| 제품 | daily-tote (참조 사진 `public/products/daily-tote/images/main.jpg`, 1800×1658, 흰 배경 → 컷아웃·Gemini 불필요) |
| 모델 · 속도 | `lucy-2.6` · 표준(빠른 모드 아님, 코드가 `speed`를 보내지 않음) |
| 세션 | 10초 (`REALTIME_SESSION_SECONDS=10`, 토큰 `maxSessionDuration=10`) |
| 의도한 호출 | **세션 1회** (설정상 하루 최대 2회 허용 = 재시도 여유 1회) |
| 입력 | 본인의 실제 카메라, 가방을 한 손에 든 상태 |
| 디자인 입히기 | **끔** (켜면 Gemini 매트가 필요) |
| 결과 | 기기에 영상 녹화 + 측정 기록 JSON 저장 |

## 2. 실행 전 조건 점검표
| # | 조건 | 상태 | 확인 방법 |
|---|---|---|---|
| 1 | Decart 공식 단가 | ✅ 확인(2026-11-13 재확인): `lucy-2.6` 표준 $0.02/초, 빠른 모드 $0.04/초, 1달러=100크레딧 | docs.platform.decart.ai/getting-started/pricing |
| 1b | **계정의 실제 과금 조건**(무료 크레딧, 요금제, 한도) | ❌ **미확인**: 이 세션에 계정이 없다. 공식 FAQ는 "신규 계정은 무료 크레딧 제공"이라고만 한다 | 소유자가 Decart 대시보드에서 확인 |
| 2 | 시험용 API 키 | ❌ 소유자가 발급 | 시험용 프로젝트·키(운영 키 금지) |
| 3 | 계정 동시 세션 한도 | ❌ **미확인** | 소유자가 설정 후 `GET /v1/realtime/quota`의 `limit` 기록 |
| 4 | 월 예산·사용량 제한 | ❌ **미확인** (Decart 쪽 설정; 우리 코드로 대신할 수 없음) | 소유자가 대시보드에서 설정 |
| 5 | Durable Object 비용 상한 | ✅ 코드·테스트 확인(실제 workerd): 일 2세션, 동시 1, 10초, 토큰 만료 20초 | `.dev.vars` 값 + preflight |
| 6 | Gemini 유료 호출 비활성 | ✅ 설계상 0: `GEMINI_API_KEY`를 넣지 않으면 컷아웃·매트·설명이 호출되지 않음(키가 있으면 preflight가 FIX) | preflight |
| 7 | 테스트 입력·참조 이미지 | ✅ 참조 사진 1800×1658 흰 배경 확인(preflight가 검사). 입력은 실시간 본인 카메라 | preflight |
| 8 | `rt-smoke-preflight.mjs` 전체 통과 | ⏳ `.dev.vars`가 있어야 통과(예시 값으로 모든 항목이 OK가 되는 것과, 위험한 설정에서 5건 FIX가 나는 것을 확인함) | `node scripts/rt-smoke-preflight.mjs --seconds 10` |
| 9 | 호출 전후 크레딧 기록 | ✅ 준비: `scripts/rt-smoke-balance.mjs before|after` (읽기 전용 GET 두 개, 키는 출력·저장 안 함, 모의 서버로 동작 확인) | 아래 순서 |
| 10 | 위험 안내 | ✅ 아래 7절 | |

## 3. 누락된 설정 (소유자 작업)
1. Decart 시험용 프로젝트와 API 키, 계정 동시 세션 한도(1~2로), 월 예산/크레딧 한도 설정, 잔액 확인.
2. `server/tryon-worker/.dev.vars` 작성(git 무시됨, 키는 채팅에 붙이지 말고 파일에만):
```
DECART_API_KEY=<시험용 키>
ALLOWED_ORIGINS=http://localhost:5173
REALTIME_SESSION_SECONDS=10
REALTIME_DAILY_SESSIONS=2
REALTIME_MAX_CONCURRENT=1
ADMIN_TOKEN=<16자 이상 임의 문자열>
```
(`GEMINI_API_KEY`, `REALTIME_MODEL`, `TRYON_QUOTA`는 넣지 않는다.)
3. 호출 승인(별도).

## 4. 예상 비용
| 경우 | 계산 | 비용 |
|---|---|---|
| 의도한 1회 | 10초 × $0.02 | **$0.20** |
| 재시도 1회 포함(설정 상한) | 2 × 10 × $0.02 | **$0.40** |
| 만약 빠른 모드가 켜졌다면(코드는 켜지 않음) | ×2 | $0.40 / $0.80 |
| Gemini | 키 미설정 | $0 |
| 무료 크레딧이 있는 신규 계정 | 청구 0일 수 있음(계정 확인 필요) | $0 가능 |
공시 단가 × 최대 시간의 **상한 추정**이다. Decart는 "active generation" 초를 과금하며 큐 대기·무프레임 구간의 청구 여부는 문서에 없다(첫 관측).

## 5. 승인 후 실행 순서 (정확히 이 순서)
```
# 0. 사전 점검 — 아무것도 전송하지 않음. 모두 OK여야 함
node scripts/rt-smoke-preflight.mjs --seconds 10

# 1. 호출 전 잔액·동시 세션 기록 (읽기 전용, 비용 없음)
node scripts/rt-smoke-balance.mjs before

# 2. 터미널 A: 로컬 Worker (실제 Durable Object)
cd server/tryon-worker && npx wrangler dev --local --port 8787

# 3. 터미널 B: 사이트
VITE_TRYON_API_URL=http://localhost:8787 npm run dev
```
4. Mac Chrome에서 `http://localhost:5173/#/again?p=daily-tote&m=live` 를 연다.
5. "실제 디자인 입히기" **끄기** → "결과 영상을 이 기기에 녹화" **체크** → 동의 **체크**.
6. **가방을 손에 들고** "실시간 착용 시작" → 카메라 허용. 10초 뒤 자동 종료. **버튼은 한 번만 누른다.**
7. 종료 후 화면에서: 녹화본 "영상 저장", "측정 기록 저장(JSON)".
```
# 8. 호출 후 잔액 기록과 차이 계산 (세션이 끝난 뒤 최소 30초 기다린 다음)
node scripts/rt-smoke-balance.mjs after

# 9. 내부 기록 (토큰 수, 예약 초, 페이지가 보고한 초)
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" -H "Origin: http://localhost:5173" http://localhost:8787/admin/usage | jq .realtime
```
10. 터미널 A·B를 Ctrl+C로 끄고 `.dev.vars`의 키를 폐기한다.

## 6. 실패 시 즉시 중지하는 방법 (빠른 순서)
1. **화면 "끝내기" 버튼** 또는 **탭/브라우저 닫기** → 연결·카메라 즉시 종료(`pagehide`).
2. 그래도 안 끊기면 **Ctrl+C로 터미널 A(Worker)를 끈다**: 새 토큰이 더 나가지 않는다. 열린 세션은 10초 상한에서 Decart가 끊는다.
3. 추가 호출을 막으려면 `.dev.vars`에 `REALTIME_DISABLED=1`(킬 스위치, 토큰 발급 즉시 중단 `reason: disabled`).
4. 최후: Decart 대시보드에서 **시험용 API 키 폐기**(새 연결 불가, 세션은 상한에서 종료). 계정 동시 세션 한도를 0~1로.
5. `GET /v1/realtime/quota`의 `active`가 0이 될 때까지 확인(비정상 종료 세션은 최대 45초 더 집계될 수 있음).
설계 한계: 세션 길이는 **Decart가 토큰의 `maxSessionDuration`으로 강제**한다. 우리 서버는 연결을 볼 수 없어 중간에 끊을 수 없다.

## 7. 토큰 재사용 · 세션 종료 실패 위험
- **토큰 재사용**: 토큰은 20초 안에는 여러 연결에 쓸 수 있고(공식 문서에 토큰당 연결 제한이 없음), 만료는 이미 열린 세션을 끊지 않는다. 본인 시험에서는 한 번만 누르면 되지만, 토큰을 복사해 다른 연결을 열면 그만큼 과금된다. 상한은 계정 동시 세션 한도(3번 조건)다.
- **종료 실패**: (a) 탭이 비정상 종료되면 Worker 임대는 25초 안에 저절로 풀리지만 Decart 세션은 상한(10초)까지 열려 있다. (b) 공급자가 `maxSessionDuration`을 실제로 지키는지는 이번에 처음 관측한다 → 측정 기록의 "실제 세션 시간"이 10초를 넘으면 즉시 중단(6절)하고 보고한다.
- **이상 징후 기준(중단)**: 실제 세션 시간 > 12초, 크레딧 차감 > $0.30, `quota.active`가 종료 1분 후에도 0이 아님.

## 8. 결과물 저장 위치 (모두 로컬, git 무시)
`docs/ai-video-production/results/`
- `smoke-run.json` — 호출 전후 잔액·동시 세션 한도와 차이(스크립트가 만듦)
- 브라우저가 내려받는 `lagi-live-daily-tote.webm|mp4` (녹화본), `lagi-live-measure-daily-tote-<시각>.json` (측정 기록)을 이 폴더로 옮긴다
얼굴과 잔액이 들어 있으니 커밋하지 않는다(폴더는 `.gitignore`됨).

## 9. 이것이 실제 Decart 출력인지 확인하는 방법
측정 기록 JSON/화면 패널이 근거다. **다음을 모두 만족해야 "실제 Decart 출력"으로 보고한다.**
1. `sdkIsMock = false` (화면에 "모의 SDK" 문구 없음)
2. `generationTicks ≥ 1` — Decart SDK의 `generationTick` 신호를 실제로 받음
3. `msFirstGenerationTick`이 숫자이고, `firstFrameCameFromTick = true` (화면이 AI 신호보다 먼저 재생됐다면 입력 카메라 통과 화면일 수 있으므로 그 구간은 AI로 치지 않는다)
4. `meanDiffFromInput`이 입력과 뚜렷이 다름(0에 가까우면 입력 통과 의심; 임계값은 이번 관측으로 처음 정한다)
5. 녹화본에 가방이 보이고 사람 모습이 입력과 일치
하나라도 어긋나면 "AI 출력 확인 불가"로 기록한다. 모의 SDK 영상이나 입력 카메라 영상은 AI 결과로 보고하지 않는다.

## 10. 결과 평가표 (실행 후 채움)
| 항목 | 기록 방법 | 결과 |
|---|---|---|
| 연결 성공 | 측정 기록 `msConnected`, `error` | |
| 첫 AI 프레임까지 시간 | `msFirstGenerationTick` (연결 후 몇 ms) | |
| 실제 영상 출력 여부 | `msFirstVideoFrame`, 녹화본 재생 | |
| 실제 Decart 출력 확인(9절 1~5) | 측정 기록 | |
| 입력과 출력의 차이 | `meanDiffFromInput` + 눈으로 비교 | |
| 제품 형태 보존 | 참조 사진과 프레임 캡처 비교(○/△/×) | |
| 로고·글자 보존(지어낸 글자 여부) | 〃 | |
| 색 | 〃 | |
| 손잡이 위치·개수 | 〃 | |
| 손과 제품 접촉 | 눈으로(○/△/×) | |
| 움직임 자연스러움 | 눈으로(○/△/×) | |
| 프레임 끊김 | `stalls200ms`, `maxFrameGapMs`, `fps` | |
| 출력 해상도 | `outputResolution` | |
| 실제 세션 시간 | `actualSessionSeconds` (요청 10초) | |
| 실제 크레딧 차감 | `smoke-run.json`의 `difference` | |
| 내부 기록 대조 | `/admin/usage`의 예약 초 / 페이지 보고 초 | |
| 이상 징후(7절) | | |
실패한 결과(토큰 오류, 연결 실패, 영상 미출력)도 같은 표에 사유와 함께 기록한다.

## 11. 이 시험이 증명하지 않는 것
모델 간 우열, 다른 7개 상품, 로고·질감의 안정성, 모바일 기기, 장시간 구간, 비용의 장기 추이. 단 1회이며 통계적 근거가 아니다.
