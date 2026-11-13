# 정식 출시 준비 상태

**판정: 정식 기능 출시 불가(BLOCKED). 이유: 실제 AI 영상 출력을 한 번도 확인하지 못했다.** 운영 사이트의 '베타' 표시는 유지한다. **"실제 Decart 연결 준비"는 코드·로컬 설정 기준으로 갖췄지만, 유료 호출 승인과 소유자의 계정 설정이 남아 있다.**

## 항목별 상태
| 항목 | 상태 |
|---|---|
| 카메라 우선 시작(권한 거부 시 유료 요청 0) | IMPLEMENTED · LOCALLY VERIFIED (모의) |
| 11단계 상태 표시, 오류 종류 구분 | IMPLEMENTED · LOCALLY VERIFIED (모의) |
| 종료·자원 해제(자동·탭 이동·끊김·pagehide) | IMPLEMENTED · LOCALLY VERIFIED (모의) |
| 로컬 녹화·다운로드 | IMPLEMENTED · LOCALLY VERIFIED (Chromium WebM, 모의 영상) · iPhone/Android **미검증** |
| 동시 세션 임대·강제 종료 세션 자동 만료·재시작 후 유지 | IMPLEMENTED · LOCALLY VERIFIED (**실제 workerd + 실제 DO**) |
| 서버 사용 기록(토큰 수·예약 초·페이지 보고 초) | IMPLEMENTED · LOCALLY VERIFIED (실제 workerd) |
| 일일 한도·실패 시 차단·Gemini/Decart 분리·unmetered 가드 | LOCALLY VERIFIED (재실행) |
| 스모크 설정(`REALTIME_SESSION_SECONDS`, 사전 점검 스크립트) | IMPLEMENTED · LOCALLY VERIFIED (모의 Decart) |
| 공식 모델·가격·SDK 문서 대조 | 완료(공식 문서 직접 확인, 가방 충실도는 문서에 없어 **미확인**) |
| Decart 토큰 발급·`maxSessionDuration` 실제 강제 | IMPLEMENTED · **PROVIDER VERIFIED 아님** |
| 실제 AI 영상 출력 | **BLOCKED (유료 승인 필요)** |
| 상품 일관성(형태·로고·색·손잡이·접촉) | **BLOCKED (VISUALLY VERIFIED 아님)** |
| 실기기 | **BLOCKED (DEVICE VERIFIED 아님)** |
| 공급자 실제 과금과 내부 기록의 차이 | **미측정** (스모크 후 대조 절차 준비됨) |
| 전체 회귀(238 스윕·링크 53·구매/로그인·손 인식·3D·엔진 V1~V5) | LOCALLY VERIFIED (최종 빌드, 헤드리스) |

## 남은 위험
1. **비용(구조적)**: 한 토큰으로 만료(20초) 전 여러 연결을 열 수 있고, 공식 문서에 토큰 단위 연결 제한이 없다. 서버는 WebRTC 연결을 볼 수 없어 막을 수 없다. 진짜 상한은 **Decart 계정의 동시 세션 한도·예산**이며 소유자가 설정해야 한다. 오리진 제한은 비브라우저 클라이언트의 Origin 위조로 우회될 수 있다(공식 문서 명시).
2. **비용(관측)**: 큐 대기·무프레임 구간의 청구 여부는 문서에 없다. 스모크에서 처음 관측한다.
3. **기능**: 모델이 가방 형태·로고를 유지하는지 미확인. 이전 스크린샷에 다른 가방이 그려진 사례가 있다. 1장뿐인 상품 사진(뒷면·옆면 없음), 7개 상품은 배경 제거(Gemini)가 먼저 필요.
4. **프롬프트**: 영문 약 750자 한도. 현재 설명 포함 프롬프트는 약 660자로 여유가 작다(VTON 모드는 설명을 380자로 자른다).
5. **보안**: 영구 키는 Worker에만. 토큰은 모델 1개·출처 제한·20초 만료. 관리자 엔드포인트는 토큰 필요. 클라이언트 보고는 참고용이며 한도·임대를 풀지 못한다.
6. **자동 재연결 없음**: 끊기면 종료(의도적).

## 실호출 전에 필요한 설정 (소유자)
1. Decart **시험용 프로젝트·키**, 계정 동시 세션 한도 낮게, 월 예산/크레딧 한도. 잔액 `GET /v1/credits` 확인.
2. `server/tryon-worker/.dev.vars` (SMOKE-TEST.md의 값). `GEMINI_API_KEY`는 넣지 않는다.
3. `node scripts/rt-smoke-preflight.mjs --seconds 10`이 모두 OK.
4. 사용자의 **별도 승인**.

## 1회 실호출 예상 비용 (공식 가격 페이지 기준)
10초 × $0.02/초 = **$0.20** (표준 속도, `lucy-2.6`). 빠른 모드는 2배이며 현재 코드는 요청하지 않는다. 스모크 설정의 하루 최대 $0.40(2회). Gemini 0원. 단가는 2026-11-13 공식 문서의 값이며 Decart 청구는 "active generation" 초 기준이다.

## 정식화까지의 순서
스모크 1회(연결·출력·기본 충실도) → 결과에 따라 상품별 대표 6개 확대 시험과 모델 비교(`lucy-2.6` vs `lucy-vton-3.6`, 같은 입력) → 실기기 3종 → 사용 기록 대조 → '베타' 제거 결정 → main 병합·운영 배포는 별도 승인.
