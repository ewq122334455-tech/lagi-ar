# 정식 출시 준비 상태

**판정: 정식 기능 출시 불가(BLOCKED). 이유: 실제 AI 영상 출력을 한 번도 확인하지 못했다.** 운영 사이트의 '베타' 표시는 유지한다.

## 항목별 상태
| 항목 | 상태 |
|---|---|
| 카메라 우선 시작 순서(권한 거부 시 유료 요청 0) | IMPLEMENTED · LOCALLY VERIFIED (모의) |
| 11단계 상태 표시 | IMPLEMENTED · LOCALLY VERIFIED (모의) |
| 오류 종류 구분(제한/끊김/실패) | IMPLEMENTED · LOCALLY VERIFIED (모의) |
| 종료·자원 해제(자동 종료, 탭 전환, 끊김) | IMPLEMENTED · LOCALLY VERIFIED (모의) |
| 로컬 녹화·다운로드 | IMPLEMENTED · LOCALLY VERIFIED (Chromium WebM, 모의 영상) · iPhone/Android **미검증** |
| 동시 세션 임대(방문자 1, 사이트 3) | IMPLEMENTED · LOCALLY VERIFIED (모의 DO) · 실제 workerd **미검증** |
| 일일 한도·실패 시 차단·분리 계량 | LOCALLY VERIFIED (기존 + 재실행) |
| Decart 토큰 발급·`maxSessionDuration` 강제 | IMPLEMENTED · **PROVIDER VERIFIED 아님** |
| 실제 AI 영상 출력 | **BLOCKED (유료 승인 필요)** |
| 상품 일관성(형태·로고·색·손잡이·접촉) | **BLOCKED (VISUALLY VERIFIED 아님)** |
| 실기기(iPhone Safari, Android Chrome, Mac Chrome) | **BLOCKED (DEVICE VERIFIED 아님)** |
| 공급자 공식 문서 원문 대조 | **BLOCKED**: 호스트가 세션 네트워크에 허용되어 있지 않음(검색 발췌로만 확인) |
| 실시간 세션 사용 기록(시작·종료·초) | 미구현 |

## 정식화 전에 필요한 것 (순서)
1. 소유자: Decart 대시보드에서 계정 동시 세션 한도와 월 예산 상한 설정(우리 코드로는 보장 불가).
2. 아래 LEVEL 2 유료 검증 승인 → 실제 영상 8상품 캡처 → 블라인드 평가 → 상품별 "제한 표시" 결정.
3. 실기기 3종 검증(발열·배터리·녹화 형식 포함).
4. 실시간 세션 사용 기록 추가, Decart 사용량과 대조.
5. 위가 끝나면 '베타' 제거를 별도로 결정. main 병합·운영 배포는 승인 후.

## LEVEL 2 유료 검증 요청서 (한 번에)
| 항목 | 내용 |
|---|---|
| 필요한 API | Decart 실시간(`lucy-2.6`, 클라이언트 토큰) / Gemini 이미지(상품 컷아웃·매트·설명, 상품당 첫 1회 캐시) |
| 테스트 상품 | 확인된 8개 중 6개 우선: daily-tote, plano-bag, origami-picnic-bag, modular-bag-s, milkpack-earphone-case, glasses-case (3D 없는 daily-pouch-bag·book-cover는 2차) |
| 호출 계획 | 상품 6개 × 착용 방식 2종 × 20초 × 2회 = **세션 24회 = 480초** (+ 스모크 2회 40초) |
| Decart 비용 | 520초 × $0.02/초 = **$10.4** (단가 출처: Decart 가격 페이지 발췌 2크레딧/초=$0.01/크레딧, fal.ai 동일. 다른 제3자 글은 fast가 $0.04/초 → 최악 **$20.8**) |
| Gemini 비용 | 상품 6개 × (컷아웃+매트+설명 ≈ 2.2유닛) ≈ 13유닛 × $0.04 ≈ **$0.5** (재시도 최악 3배 ≈ $1.6) |
| 예상 합계 | **약 $11 (최악 약 $22)** |
| 제안 상한 | 하루 $25. Decart 계정 월 예산을 $30으로 설정한 뒤 진행, `REALTIME_DAILY_SESSIONS`는 30, 시험용 IP만 허용 |
| 필요한 승인 | (a) 위 예산으로 유료 호출 (b) 시험 때 스테이징 Worker/키 사용(운영 키 분리 권장) (c) 인물 촬영 동의(시험자 본인) |
| 사전 확인 | 단가는 호출 전 Decart 가격 페이지에서 재확인(이 세션은 원문 접근 불가) |

## 로컬 미리보기와 테스트 방법
- **배선 확인용(무료, 이 세션 환경)**: `RT_MOCK=1 npx vite build --outDir /tmp/rtmock && npx vite preview --outDir /tmp/rtmock --port 4195` → `http://localhost:4195/#/again?p=plano-bag&m=live`. 화면은 "MOCK — NOT AI"이며 AI 영상이 아니다. 자동 테스트: `node docs/ai-video-production/tests/level1-ui.mjs`(Playwright 필요).
- **실제 AI 확인(승인 후)**: 로컬 Worker(`wrangler dev --var ALLOWED_ORIGINS:http://localhost:5173`, 스테이징 키)로 `npm run dev`의 `#/again?p=plano-bag&m=live`를 연다. 운영 Worker는 localhost 출처를 허용하지 않아 로컬 화면에서 쓸 수 없다.
