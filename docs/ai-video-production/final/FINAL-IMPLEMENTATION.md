# 최종 구현 정리 (`feature/ai-video-final`)

기존 구조를 보존하고 문제가 있는 부분만 고쳤다. 새 시스템을 만들지 않았다. 브랜치 이력: V5 → 검증 랩 → `feature/ai-video-production` → `feature/ai-video-final`. main·운영은 건드리지 않았다.

## 실제로 수정한 코드
### 클라이언트 `src/v3/LiveTryOn.tsx` (AI 영상 베타 화면)
| 변경 | 이유 |
|---|---|
| 시작 순서: 카메라 → 입력 검사 → 상품 참조 → 토큰 → 연결 | 카메라를 거부해도 유료 토큰·Gemini가 먼저 소모되던 문제, 토큰 만료 문제 |
| 11+1단계 상태 표시(시작 전·준비·카메라·입력 검사·서버 연결·AI 처리·영상 출력·실패·끊김·사용량 제한·미지원·종료) | 사용자가 어느 단계인지 알 수 있게 |
| 오류 구분과 구체적 문구: 카메라 권한 거부 / 카메라 없음 / **카메라를 다른 앱이 사용 중** / **AI 서버에 닿지 못함(인터넷·점검)** / **브라우저 미지원(WebRTC·카메라 API)** / **상품 사진 없음** / 한도 / 끊김 / 영상 미출력 / **녹화 미지원·녹화 실패·빈 녹화** | 일괄 "다시 시도" 문구 제거 |
| 종료 보강: `pagehide`, 탭 이동, 언마운트, 끊김, `disconnect` 예외에도 카메라 정지 | 세션·카메라 누수 방지 |
| 로컬 영상 녹화(동의 시), 미리보기·삭제·다운로드 | 결과 저장 |
| **측정 기록**(모델, 토큰·연결·첫 생성 신호·첫 프레임 시각, 생성 신호 수, 해상도, FPS, 끊김, 입력과의 차이, 실제 세션 시간, 종료 사유) + JSON 저장 + **모의 SDK 표시** | 실제 Decart 출력과 입력 카메라·모의 영상을 구분하는 근거 |
| 세션 종료 후 **상품 상세 이동 링크** | 요구된 사용자 흐름의 마지막 단계 |
| 모델은 Worker가 알려 주는 값만 사용(기본 `lucy-2.6`), 표준 속도(빠른 모드 2배 과금을 요청하지 않음), VTON 모델이면 `Add … to the outfit` 프롬프트 | 모델 자동 교체 금지 |
| 사용 시간을 Worker에 보고(참고용) | 청구 대조 근거 |

### Worker `server/tryon-worker/src/index.ts`
| 변경 | 이유 |
|---|---|
| 동시 세션 임대(방문자당 1, 사이트 `REALTIME_MAX_CONCURRENT`), 자동 만료 35초, 일일 한도·공급자 실패 시 반납, 카운터 오류 시 차단 | 토큰 횟수만으로는 동시·중복 세션을 못 막음 |
| 토큰: 만료 20초, 허용 모델 1개, `maxSessionDuration`=세션 길이(기본 20초, `REALTIME_SESSION_SECONDS`로 10~20) | 공급자 측 세션 상한 |
| `REALTIME_MODEL`(허용 3개 목록만), `REALTIME_DISABLED=1` 킬 스위치 | 모델 선택·즉시 중지 |
| 사용 원장: 토큰 수, 예약 초, 페이지 보고 초, 추정 USD(`/admin/usage`, 토큰 필요) | 내부 기록 대 공급자 과금 대조 |
| `/realtime/report`(참고용, 임대·한도를 풀지 않음) | 클라이언트 신호를 믿지 않음 |

### 도구·테스트·문서
`scripts/rt-smoke-preflight.mjs`(사전 점검), `rt-smoke-setup.mjs`(비공개 `.dev.vars`), `rt-smoke-balance.mjs`(전후 잔액), `rt-compare-launch.mjs`(동일 입력 모델 비교), `check-video-references.mjs`(상품 참조 점검), 모의 SDK `src/test/decartMock.ts`(`RT_MOCK=1` 빌드 전용), `docs/ai-video-production/tests/level1-ui.mjs`, `real-workerd/run-realtime.mjs`.

## 실제로 연결한 AI 모델
- **코드가 연결하는 모델**: Decart `lucy-2.6`(기본, 표준 속도). `lucy-vton-3.6`/`-3.5`는 Worker 설정으로만 선택 가능, 자동 전환 없음.
- **이번 작업에서 실제로 호출한 횟수: 0.** 연결·출력은 **검증되지 않았다**(ACTUAL-DECART-TEST.md).

## 유지한 것
브랜드 디자인·로고·색, 상품 데이터, AI 사진 합성, 3D 착용, 장바구니·회원·스마트스토어 링크, 공유 링크·QR, V1~V5 손 착용 엔진(기본 V2). 회귀 결과는 REGRESSION-RESULTS.md.
