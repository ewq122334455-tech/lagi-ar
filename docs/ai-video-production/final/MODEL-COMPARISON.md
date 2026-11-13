# 모델 비교 (`lucy-2.6` vs `lucy-vton-3.6`)

**실제 생성 결과물이 없으므로 어느 모델이 우수하다고 결론 내리지 않는다. 기본값은 `lucy-2.6`로 유지한다.**
자료: Decart 공식 문서를 직접 읽음(2026-11-13): models.md, pricing.md, realtime/virtual-try-on.md, vton-3.5-prompting.md, realtime/lucy-2.6.md, client-tokens.md, get-realtime-quota.md, get-credits.md.

| 항목 | `lucy-2.6` | `lucy-vton-3.6` | 근거 |
|---|---|---|---|
| 가방 지원 | 범용 편집. 표에 "Virtual try-on: clothing or accessories", "Add: 새 객체" | "clothing and accessories" + 프롬프트 예시 **"Add a tan leather shoulder bag to the outfit."** | 공식 문서(가방 형태 충실도 수치는 없음) |
| 제품 참조 이미지 | 텍스트·참조 이미지·둘 다 | 참조 이미지 + 설명 프롬프트가 최선. 깨끗한 단품, 흰/단색 배경, 512×512 이상 | 공식 문서 |
| 프롬프트 구조 | 자유 | 한 동작 `Add <보이는 것> to the outfit`, 발명 금지, 영문 ~750자 한도 | 공식 문서 |
| 실시간 안정성 / 지연 / FPS | **미확인** | **미확인** | 문서에 수치 없음, 실호출 필요 |
| 출력 품질 | **미확인** | **미확인** | 〃 |
| 제품 형태·로고 보존 | **미확인** | **미확인** | 〃 |
| 세션 비용(표준 720p) | $0.02/초 | $0.02/초 | 가격 페이지 |
| 빠른 모드 | $0.04/초(2배) | $0.04/초 | 〃 |
| SDK 0.2.14 | OK (1280×720, 30fps) | OK, `-3.5`, `-latest`도 OK | SDK 직접 실행 |
| 모바일 지원 | **미확인** | **미확인** | 문서 명시 없음 |

## 비교 실험 구조 (준비됨, 실행은 승인 필요)
1. 본인이 가방을 든 10~20초 영상을 한 번 촬영 → 두 모델이 **동일한 입력**을 받도록 `node scripts/rt-compare-launch.mjs --clip <영상>`이 y4m 가짜 카메라로 변환해 Chrome을 연다(변환은 ffmpeg로 확인, Mac Chrome 실행은 미검증).
2. `.dev.vars`의 `REALTIME_MODEL`을 비우고(`lucy-2.6`) 10초 1회 → 녹화·측정 JSON 저장.
3. `REALTIME_MODEL=lucy-vton-3.6`으로 바꾸고 Worker 재시작 → 같은 클립으로 10초 1회.
4. 두 녹화본과 측정 JSON을 `VIDEO-QUALITY-REPORT.md`의 평가표로 비교(제품 보존 우선).
비용: 2회 × $0.20 = $0.40(잔액 대비 3%).

## 선택 규칙
제품 형태·로고 보존이 더 좋은 모델 우선. 한 번의 실험은 통계적 근거가 아니므로, 기본값 변경은 같은 입력 반복 관찰 후 사람이 결정한다. **자동 변경 없음.**

## 주의
이전 코드 주석("의류 전용 VTON이 가방을 옷으로 바꿨다")은 당시 프롬프트 형식 때문이었을 수 있다는 가설이 있으나, 검증되지 않았다.
