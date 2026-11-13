# 보류 중인 고위험 변경안 (2026-11-10)

이 문서의 변경은 **적용하지 않았습니다.** 각각 승인이 필요하며, 진행할 때는 아래 순서와 테스트를 따르세요.

## C1. react-router 6 → 7 — 준비 완료 (브랜치 `proposal/react-router-7`)

- 목적: 운영 의존성 경고 2건(GHSA-wrjc-x8rr-h8h6, GHSA-337j-9hxr-rhxg)을 없앱니다. 지금 코드에서는 악용할 경로가 없어 긴급하지 않습니다.
- 변경 내용: `react-router-dom` 6.30.6 → 7.18.5 (package.json, lock). 앱 코드는 바꾸지 않았습니다.
- 시험(Node 20 빌드, 모두 통과):
  - links 53/53, flows 40/40, newfeat 49/49, buybar 33/33, phase1 12/12, phase34 23/23(결제 켜짐·꺼짐 포함)
  - AI 사진 합성 16/16, AI 영상 7/7, 3D 5/5, no3d 5/5
  - `npm audit --omit=dev` 0건
- 시험 중 발견: 7에서는 탈퇴 직후 결과 안내가 사라지는 문제가 있었습니다. 원인을 고치는 수정을 6과 7 공통으로 이미 반영했습니다(`71f01b8`, `af075f4`).
- 적용 방법: 승인 후 `proposal/react-router-7`을 수정 브랜치에 병합하고, 전체 회귀 테스트를 다시 실행합니다.

## C2. 해시 주소(`#/`) → 경로 주소 — 설계만

- 목적: 제품 페이지가 검색에 따로 노출되게 하고, 제품별 공유 미리보기(OG)를 갖게 합니다.
- 필요한 일:
  1. `vite.config.ts`의 `base`를 `'./'` → `'/lagi-ar/'`로 바꾸고 `BrowserRouter basename="/lagi-ar"`를 씁니다.
     - 상대 경로로 쓰는 제품 데이터(`products/…`)는 지금 문서 주소를 기준으로 풀립니다. 경로 주소가 되면 `/lagi-ar/product/x/products/…`처럼 깨지므로, 모든 사용처를 `import.meta.env.BASE_URL` 기준으로 바꿔야 합니다.
     - 영향 범위: 이미지, 3D 텍스처, AI 합성의 `productUrl`, preload 스크립트
  2. GitHub Pages는 주소 재작성을 지원하지 않습니다. 빌드할 때 `dist/product/<id>/index.html`, `dist/discover/index.html` 같은 경로별 HTML 사본을 만들고, 사본마다 제목, 설명, `og:image`를 넣습니다. 그 외 주소는 `404.html`로 받습니다(이 경우 HTTP 상태는 404).
  3. 기존 해시 주소 호환: 앱이 시작될 때 `#/…`이면 `history.replaceState`로 `/lagi-ar/…`로 바꿉니다. 기존 공유 링크와 QR은 그대로 열려야 합니다.
  4. Toss `successUrl`, `failUrl`(`payments.ts` `routeUrl`)을 경로형으로 바꾸고, 해시형도 계속 받습니다.
  5. sitemap.xml에 제품 주소를 넣고, 가능하면 사이트 루트에 robots.txt를 둡니다(프로젝트 경로에 둔 robots는 효과 없음).
- 시험:
  - links.mjs의 해시 주소 53개가 같은 화면으로 열리는지
  - 새 경로 주소 53개가 열리는지
  - 전체 회귀 테스트, Lighthouse
  - 배포 후 Search Console 확인
- 위험: 높음(자산 경로 전체, QR, 결제 복귀 주소). 예상 작업량: 1~2일 + 검증.

## C3. 로그인 방식 변경 (localStorage 토큰 → HttpOnly 쿠키) — 설계만

- 조건: 사이트와 Worker가 같은 사이트여야 합니다(예: 커스텀 도메인 `lagi.kr`와 `api.lagi.kr`). github.io와 workers.dev 조합에서는 Safari가 서드파티 쿠키를 막아 로그인이 깨집니다.
- 필요한 것: 커스텀 도메인 결정(사용자) → `Set-Cookie`(HttpOnly, Secure, SameSite=Lax) → CSRF 대책 → 기존 토큰 이전 기간

## C4. 정리 후보 (삭제하지 않음)

| 대상 | 크기 | 배포 포함 | 근거 |
|---|---|---|---|
| `public/media/hero.mp4` | 790KB | **예** | `brand-film.mp4`와 md5 동일. 참조하는 곳은 라우팅되지 않는 `src/components/HeroVideo.tsx`뿐 |
| `public/media/poster.jpg` | – | 예 | `brand-film-poster.jpg`와 md5 동일. 같은 레거시 컴포넌트만 참조 |
| `legacy-prototype/` | 704KB | 아니오 | 예전 시안 |
| `archive/` | 14MB | 아니오 | 예전 자료 |
| 운영 빌드에서 도달하지 않는 소스 37개 | – | 아니오 | 아래 목록 (esbuild 모듈 그래프 기준) |

- `public/fonts/brand-fonts.css`는 라이선스 폰트를 넣을 자리이므로 유지합니다.
- 삭제할 때는 먼저 백업 브랜치를 만들고, 외부에서 `media/hero.mp4`를 직접 링크했는지 확인하세요.

<details><summary>도달하지 않는 소스 파일 37개</summary>

```
src/ai/AIProvider.ts
src/components/BuyPanel.tsx
src/components/ColorBlockLink.tsx
src/components/ContentBadge.tsx
src/components/DetailSection.tsx
src/components/ErrorState.tsx
src/components/HeroVideo.tsx
src/components/Motif.tsx
src/components/ProductCard.tsx
src/components/ProductGallery.tsx
src/components/QRCode.tsx
src/components/Reveal.tsx
src/components/SpotlightMenu.tsx
src/components/SpotlightPanel.tsx
src/components/motifs.ts
src/data/productTypes.ts
src/hooks/useSpotlight.ts
src/pages/About.tsx
src/pages/AiFitPage.tsx
src/pages/AuthPages.tsx
src/pages/Cart.tsx
src/pages/Checkout.tsx
src/pages/Home.tsx
src/pages/Materials.tsx
src/pages/NotFound.tsx
src/pages/ProductCollection.tsx
src/pages/ProductDetail.tsx
src/pages/Story.tsx
src/pages/workspace/AssetWorkspace.tsx
src/pages/workspace/emptyProduct.ts
src/pages/workspace/fields.tsx
src/pages/workspace/validateProduct.ts
src/redesign/DiscoverFlow.tsx
src/redesign/RedesignHome.tsx
src/redesign/discoverPath.ts
src/utils/productImage.ts
src/utils/shipping.ts
```

</details>
