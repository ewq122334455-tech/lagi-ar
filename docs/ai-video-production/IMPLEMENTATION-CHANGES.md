# 구현 변경 사항 (`feature/ai-video-production`)

기존 구현을 유지하고 필요한 부분만 고쳤다. 삭제한 기능 없음, 모델·공급자 변경 없음, 'AI 영상 (베타)' 표시 유지.

## 클라이언트 `src/v3/LiveTryOn.tsx`
1. **시작 순서 변경**: 카메라 권한 → 입력 검사(비디오 트랙 live 확인) → 상품 참조(`/cutout`) → 토큰(`/realtime/token`) → 연결. 권한 거부/카메라 없음이면 **유료 요청이 0건**(테스트 B2).
2. **11단계 상태 표시**: 시작 전 / 준비 / 카메라 권한 / 입력 검사 / 서버 연결 / AI 처리 / 영상 출력 / 처리 실패 / 연결 끊김 / 사용량 제한 / 종료. 진행 줄과 현재 문구(`live-steps`, `live-step-label`).
3. **오류 구분**: 한도·동시 세션·카운터 오류 → `limited`, 연결 중 끊김 → `disconnected`, 나머지 → `failed`.
4. **종료 보강**: `pagehide`에서도 세션 종료, 종료 시 녹화기·트랙·연결 모두 해제.
5. **영상 녹화(선택)**: 체크박스 동의 시에만. 출력 영상(매핑 켜짐이면 합성 캔버스)을 MediaRecorder로 이 기기에 녹화, 미리보기·삭제·다운로드. 서버로 올리지 않음.

## Worker `server/tryon-worker/src/index.ts`
1. **동시 세션 임대(lease)**: 같은 DO(`rt:<날짜>`)에 `/lease`·`/release`. 방문자당 1세션, 사이트 `REALTIME_MAX_CONCURRENT`(기본 3). 임대는 세션 20초 + 25초 후 자동 만료. 카운터 오류 시 `quota_unavailable`(차단). 일일 한도에서 거절되거나 Decart 토큰 발급이 실패하면 임대를 즉시 반납.
2. **토큰 만료 60→30초**: 카메라가 이미 켜진 뒤 발급하므로 충분.
3. 비용 원장(`/admin/usage`)·일일 한도·실패 시 차단·`unmetered` 가드는 그대로 유지.

## 테스트용 모의 SDK `src/test/decartMock.ts`
`RT_MOCK=1`로 빌드할 때만 `@decartai/sdk`를 대체(`vite.config.ts`). 화면에 "MOCK — NOT AI"를 그리며 Decart와 통신하지 않는다. 공개 빌드에는 포함되지 않는다(아래 TEST-RESULTS에 번들 확인).

## 새 도구
- `scripts/check-video-references.mjs` → `docs/ai-fitting-upgrade/data/video-reference-check.json`: 실제 상품별 참조 이미지 점검.
- `docs/ai-fitting-upgrade/tools/worker-realtime-lease-test.mjs`, `docs/ai-video-production/tests/level1-ui.mjs`.

## 하지 않은 것
- 새 공급자·모델 추가, 3D(무료) 모드 변경, 사진 합성 변경, 서버 영상 보관, 자동 재연결.
