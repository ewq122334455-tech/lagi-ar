# 테스트 결과

현재 빌드(`feature/ai-fitting-quality-v2`, 로컬 미리보기)에서 실행한 결과입니다. 모의(가짜) AI 응답을 쓰는 시험은 **흐름 검증**이며 AI 품질 검증이 아닙니다.

| 묶음 | 결과 |
|---|---|
| 링크/라우트 (links) | 53/53 |
| 전체 흐름 (audit-flows) | 40/40 (idle에서 재실행) |
| 신기능 (newfeat) | 49/49 |
| 모바일 구매 바 (buybar) | 33/33 |
| 사진 합성 흐름 (photofit, 모의) | 16/16 |
| 3D 없는 제품 (no3d) | 5/5 |
| phase1 / phase34 | 12/12 · 23/23 |
| 법적 고지 (legal-real) | 5/5 |
| fitCheck 화면 (fitcheck-ui) | 12/12 |
| 초록 영역 영상 (greenlive) | 7/7 |
| 손 착용: plano 4, modular 4, glasses 5, earphone 5, picnic 5 | 전부 통과 |
| 엔진 v1/v2 스모크 | 콘솔 오류 0 |
| WebGL 컨텍스트 누수 | 0 |
| 238회 로드 스윕 | AI 변경 전 기준선과 동일 (axe color-contrast 2건은 기존) |
| 보안 (sec-all) | 48/48 |
| Worker 단위: tryon 8/8, 실시간 10/10, 리뷰 20/20, 설명 3/3 | 통과 |
| `tsc`, `eslint` | 오류 0 |

## 알려진 불안정(flake)
audit-flows의 reduced-motion 검사가 238회 스윕과 **동시에** 돌 때 한 번 실패(애니메이션 1개). 유휴 상태 재실행 40/40, 개별 3회 0개 → 부하로 인한 flake이며 제품 회귀 아님.

## 실행하지 못한 / 미검증
- 실제 Gemini·Decart 생성 결과 (유료, 승인 필요)
- 실기기(iOS Safari, Android Chrome) 실시간 착용 FPS·발열·배터리
- 실제 사용자 사진에서 fitCheck 오탐률
- 점프 거부가 실제 오검출을 잡는지 (녹화에서 오검출 없음)
- 외부 서비스 공식 문서 (접근 불가)
