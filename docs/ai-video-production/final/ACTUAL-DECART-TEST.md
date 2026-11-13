# 실제 Decart 시험 결과

## 결론: **실제 AI 영상 시험은 실행하지 않았다 (BLOCKED)**
- 이유: 유료 호출에 대한 **명시적 승인("시험 시작해도 돼")이 없었다.** 지시문은 "명시적 승인이 없으면 호출하지 말고 BLOCKED로 남겨라"고 했다.
- 따라서 아래 10개 점검 항목 중 실제 공급자 응답이 필요한 것은 **모두 NOT VERIFIED**다. 모의 SDK 결과는 성공으로 세지 않는다.

| # | 항목 | 상태 | 근거 |
|---|---|---|---|
| 1 | Decart API 키 존재 | **확인(값은 기록하지 않음)** | 사용자가 본인 Mac에서 비공개 입력으로 설정, `rt-smoke-preflight` 12개 항목 전부 OK(사용자 화면). 이 세션(클라우드)에는 키가 없다 |
| 2 | 공식 모델 지원 | 확인 | 공식 문서: `lucy-2.6`, `lucy-vton-3.6`(=`lucy-vton-latest`) 실시간 720p. 가방 충실도는 문서에 없음 |
| 3 | SDK 호환성 | 확인 | `@decartai/sdk` 0.2.14(npm 최신), 두 모델 모두 `models.realtime()` 조회 OK, 1280×720·30fps |
| 4 | Worker 토큰 발급 | **부분**: 모의 Decart 토큰 API로 실제 workerd+DO에서 발급·제약 확인. 실제 Decart 토큰 API는 **미호출** | run-realtime 11/11 |
| 5 | WebRTC 연결 | NOT VERIFIED | 실제 SDK 연결 없음 |
| 6 | 실제 영상 스트림 | NOT VERIFIED | |
| 7 | 첫 AI 출력 프레임 | NOT VERIFIED | |
| 8 | 세션 종료(공급자가 10초에 끊는지) | NOT VERIFIED | 우리 쪽 종료 처리는 모의 테스트 통과 |
| 9 | 실제 크레딧 차감 | NOT VERIFIED | 시험 전 잔액만 기록 |
| 10 | 결과 영상 저장 | **부분**: 모의 영상 녹화·다운로드는 통과, **실제 AI 출력 녹화는 NOT VERIFIED** | level1-ui 42/42 |

## 읽기 전용 계정 조회 (사용자가 본인 Mac에서 실행, 과금 없음으로 보임)
`node scripts/rt-smoke-balance.mjs before` 결과(사용자 화면, HTTP 200 두 건):
- 잔액 **1274 크레딧(약 $12.74)**, `key_quota` 없음 = **이 키에 크레딧 상한이 없음**
- 동시 세션 한도 **없음**(`limit: null`)
- **월 예산·자동 충전 설정: 미확인**(조회 API 없음, 대시보드에서만 확인 가능)
1회 시험(10초) = 20크레딧, 잔액의 약 1.6%.

## 시험을 실행하기 위한 상태
- 로컬 설정과 사전 점검: **완료**(안전 한도: 세션 10초, 일 2회, 동시 1, localhost만, Gemini 없음).
- 남은 것: **"시험 시작해도 돼"라는 명시적 승인**, (권장) 크레딧 상한 키, 자동 충전 확인.
- 실행 순서·중단 방법·결과 평가표: `../SMOKE-TEST.md`.
- 결과 저장 경로(git 제외): `docs/ai-video-production/results/` (`smoke-run.json`, 녹화본, 측정 JSON).
