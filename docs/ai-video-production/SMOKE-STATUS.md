# 스모크 테스트 설정 상태 (점검 시점의 스냅샷)

기준 커밋 `65d44c5`. 이 점검에서 **유료 호출 0건**, Decart 키는 확인하지 않았고(이 세션에 없음) 값을 출력하지 않았다.

| 조건 | 상태 |
|---|---|
| Decart 시험용 키 | **없음** — 세션 환경에 `DECART_*` 변수 0개. 이 컨테이너의 `.dev.vars`에는 키 칸이 비어 있음(키 길이 0) |
| `server/tryon-worker/.dev.vars` | 컨테이너에서 `rt-smoke-setup.mjs --no-key`로 생성(권한 600, git 무시): 세션 10초·일 2·동시 1·localhost:5173·난수 ADMIN_TOKEN·Gemini 없음. preflight **FIX 1건: DECART_API_KEY** 만 남음. 이 파일은 컨테이너에만 있고 Mac에는 없으므로 Mac에서 `node scripts/rt-smoke-setup.mjs`를 직접 실행해야 한다 |
| 계정 동시 세션 한도 | **BLOCKED** (미확인) |
| 월 예산·사용량 제한 | **BLOCKED** (미확인) |
| 계정 과금 조건(무료 크레딧 등) | **BLOCKED** (미확인) |
| 비용 제한 · 중지 스위치(무료 테스트) | 통과: 동시 세션 10/10, 토큰 폭주 3/3, Gemini 한도 23/23, 면 이미지 8/8, 비용 원장 10/10, **실제 workerd + DO 11/11**, 킬 스위치 `REALTIME_DISABLED=1` → 토큰 없음(`disabled`), 설정 점검 통과. 킬 스위치는 모의 DO 테스트로 확인(실제 workerd 테스트에는 포함하지 않음) |
| 참조 사진 | daily-tote 1800×1658 흰 배경 OK |

**판정: BLOCKED** — 위 "없음/미확인" 항목이 소유자 설정으로 해소되고 preflight가 전부 OK이며 별도의 유료 호출 승인이 있을 때만 실행한다.

## 실행 규칙 (승인 후)
- daily-tote, 10초, 1회만. 버튼은 한 번. **연결 실패 시 자동 재시도 없음**(코드에 재시도가 없음; 다시 시도하려면 사람이 새로 시작하고 별도 판단).
- 예상 밖 과금·세션 동작(실제 세션 > 12초, 차감 > $0.30, 종료 1분 후 `quota.active` ≠ 0, 토큰이 2개 이상 발급) 발견 시 추가 호출 중단, `REALTIME_DISABLED=1` 후 보고.
- 결과 저장 경로: `docs/ai-video-production/results/` (git 무시).

## 명령 (복사용)
```
node scripts/rt-smoke-preflight.mjs --seconds 10
node scripts/rt-smoke-balance.mjs before
cd server/tryon-worker && npx wrangler dev --local --port 8787          # 터미널 A
VITE_TRYON_API_URL=http://localhost:8787 npm run dev                     # 터미널 B
# 브라우저: http://localhost:5173/#/again?p=daily-tote&m=live  → 디자인 입히기 끔, 녹화·동의 체크, 시작 1회
node scripts/rt-smoke-balance.mjs after                                  # 종료 30초 뒤
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" -H "Origin: http://localhost:5173" http://localhost:8787/admin/usage | jq .realtime
```
