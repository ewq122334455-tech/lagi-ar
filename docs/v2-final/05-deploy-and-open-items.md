# 05. 배포 준비 · 남은 일

## 배포 상태
- 작업 브랜치 `claude/lagi-v2-final`, PR로 올림. **main에 병합하지 않았음** — 공개 사이트는 그대로.
- 병합하면 GitHub Actions가 빌드해 GitHub Pages에 자동 배포(HashRouter, 정적 경로 그대로).
- 되돌리기: 백업 브랜치 `claude/backup-pre-v2-final`.

## 승인 후 순서
1. PR 병합 → 사이트 배포(약 1분).
2. Worker 재배포 — 회원 기능과 주문 기능이 들어 있음:
   ```
   cd server/tryon-worker
   npx wrangler deploy          # USERS, ORDERS 저장소 자동 생성
   ```
   이것만으로 로그인·회원가입이 실제 사이트에서 작동한다. 결제는 3단계까지 해야 한다.
3. 온라인 결제 켜기(토스페이먼츠):
   1. developers.tosspayments.com 가입 → 개발자센터 → API 키에서 **결제위젯 연동 키** 확인(테스트 키는 계약 없이 무료).
   2. 시크릿 키: `npx wrangler secret put TOSS_SECRET_KEY`
   3. 관리자 토큰(주문 조회용, 아무 긴 문자열): `npx wrangler secret put ADMIN_TOKEN`
   4. 클라이언트 키: GitHub 저장소 Settings → Secrets and variables → Actions → Variables → `TOSS_CLIENT_KEY` 추가 → Actions에서 다시 배포.
   5. 테스트 키로 결제해 보고, 실제 판매는 토스 가맹 계약 후 라이브 키로 바꿈.
4. 주문 확인: `curl -H "Authorization: Bearer <ADMIN_TOKEN>" -H "Origin: https://ewq122334455-tech.github.io" https://lagi-tryon.lagi-official.workers.dev/admin/orders`

## 실제 판매 전에 꼭 필요한 것 (임의로 만들지 않음)
| 항목 | 이유 |
|---|---|
| 사업자 정보(상호, 대표자, 사업자등록번호, 통신판매업 신고번호, 주소, 연락처) | 직접 판매 시 사이트 하단 표시 의무(전자상거래법). 지금은 표시하지 않음 |
| 이용약관 · 개인정보처리방침 · 교환/환불 정책 | 결제 페이지에 필요 |
| 토스페이먼츠 가맹 계약 · 라이브 키 | 유료 서비스·외부 계약이라 임의 진행 안 함 |
| 재고 관리 방식 | 스마트스토어와 사이트 재고를 어떻게 맞출지 결정 필요(현재 재고 확인 없음) |

## 필요한 자료
| 자료 | 쓰이는 곳 |
|---|---|
| 상품별 스마트스토어 주소 | 지금은 8개 모두 스토어 홈으로 연결 |
| 최신 실판매 상품 목록(기획서상 11개, 데이터에는 8개) | 나머지 3개 추가 |
| 상품별 확정 설명 · 소재 · 제작 과정 · 선정 이유 | 지금은 초안이라 숨김 — 확정되면 상세 페이지 6번 섹션에 표시 |
| 고해상도 원본 사진(현재 약 650px, 1장씩) | 상세 대표 사진·디테일 컷이 흐림. 2000px 이상 권장, 상품당 여러 장 |
| 공식 Light Gray 색상 코드 | 지금은 #F1F1F1 임시 |
| 실제 브랜드 영상 | 지금은 제품 사진으로 만든 임시 영상 |
| 윤고딕100 웹폰트 파일 · 웹 라이선스(쓰려면) | 지금은 Pretendard |

## 미해결
- AI 합성 호출 제한은 Worker 인스턴스 단위라 완벽하지 않음 → Cloudflare Rate limiting 규칙 권장.
- 홈 브랜드 문장, WHY LAGI 페이지의 세 질문에 대한 답, 4가지 역할 설명은 브랜드 포지셔닝 문장("발견·선별·소개·연결하는 큐레이션 브랜드, 직접 제조하지 않음")을 바탕으로 짧게 쓴 것 — 브랜드 확인 필요. 네 가지 선정 기준은 공식 문구 그대로.
- Kakao 주소 검색, 토스 실제 결제창은 실제 키·네트워크에서 한 번 직접 확인 필요(04 문서 참고).
