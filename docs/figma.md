# Figma ↔ 코드 연결

이 저장소의 디자인은 아래 Figma 파일과 짝을 이룹니다.

| 항목 | 값 |
| --- | --- |
| 파일 | **LAGI — Website (Figma sync test)** |
| URL | https://www.figma.com/design/EdyIOeanV1ZGTRNYcKzAqU |
| fileKey | `EdyIOeanV1ZGTRNYcKzAqU` |
| 페이지 | `LAGI — Web` |
| 계정 | 20240511@g.kit.ac.kr / 팀 `team::1687673643562078069` (student 플랜, Full 시트) |

## 파일에 들어있는 프레임

| 프레임 | 대응하는 코드 |
| --- | --- |
| `Home / Desktop 1440` | `src/pages/Home.tsx` — 띠(Band) 구조 |
| `Collection / Desktop 1440` | `src/pages/ProductCollection.tsx` |
| `Product Detail / Desktop 1440` | `src/pages/ProductDetail.tsx` + `src/components/BuyPanel.tsx` |
| `Cart / Desktop 1440` | `src/pages/Cart.tsx` |
| `AR / Mobile 390 — markerless placement` | `src/ar/PlacementARProvider.ts` + `src/ar/ARExperience.tsx` |

전부 오토 레이아웃 레이어입니다. 스크린샷이 아니라 편집 가능한 텍스트·프레임이고,
색은 아래 변수에 바인딩돼 있어서 변수 하나를 바꾸면 모든 화면이 함께 바뀝니다.

## 변수(토큰) 매핑

Figma 컬렉션 `LAGI / Color`의 변수 이름은 `tailwind.config.js`의 색상 키와 1:1로 같습니다.
한쪽을 바꾸면 다른 쪽도 같은 이름으로 바꿔 주세요.

| Figma 변수 | Variable ID | Tailwind 키 | 값 |
| --- | --- | --- | --- |
| paper | `VariableID:2:3` | `paper` | `#ffffff` |
| ink | `VariableID:2:4` | `ink` | `#111111` |
| graphite | `VariableID:2:5` | `graphite` | `#3a3a3a` |
| stone | `VariableID:2:6` | `stone` | `#8a8a8a` |
| mist | `VariableID:2:7` | `mist` | `#f5f5f5` |
| line | `VariableID:2:8` | `line` | `#e5e5e5` |
| blue | `VariableID:2:9` | `blue` | `#2E55A3` |
| orange | `VariableID:2:10` | `orange` | `#C2662C` |
| lime | `VariableID:2:11` | `lime` | `#DEB457` |
| sand | `VariableID:23:2` | `sand` | `#EFEADF` |
| haze | `VariableID:23:3` | `haze` | `#E6EAF4` |
| limePale | `VariableID:23:4` | `limePale` | `#F7ECD5` |

`sand` / `haze` / `limePale`은 DESIGN.md의 띠(Band) 표면입니다. Wise에서 가져온 값이 아니라
LAGI의 라임·블루를 섞어 만든 값이고, 섞은 비율은 `tailwind.config.js` 주석과 Foundations
페이지의 `BAND SURFACES` 행에 적혀 있습니다.

컬렉션 `LAGI / Space`(`space-2` … `space-32`)는 4px 배수 간격 스케일입니다.

## 브랜드 색상에 대한 정직한 표기

`blue` / `orange` / `lime` 세 값은 **LAGI 로고 이미지를 눈으로 보고 추정한 값**입니다.
브랜드 공식 색상 코드가 확인되면 Figma 변수와 `tailwind.config.js`를 같은 값으로 함께 고쳐야 합니다.

## 폰트

Jua(디스플레이), Nunito(헤딩·버튼), Gothic A1(본문). 세 가지 모두 Figma에서 사용 가능한 것을
확인했으며 코드의 `fontFamily` 설정과 같습니다.

## 디자인 시스템 (피그마가 LAGI를 인식하는 방식)

파일에는 화면 외에 두 페이지가 더 있습니다.

### `Foundations` 페이지
색상 견본 12종, 텍스트 스타일 ramp 11종, 띠 표면 3종의 실물 견본. 각 색 아래에 Tailwind 키와
CSS 변수명이 함께 적혀 있습니다.

### `Components` 페이지 — 컴포넌트 9종

| Figma 컴포넌트 | 변형 | 대응 코드 |
| --- | --- | --- |
| `Button` | Primary / Secondary / Tertiary / Dark | `src/components/ui/Button.tsx` |
| `Card` | White / Lime / Cool / Soft / Dark | `src/components/ui/Card.tsx` |
| `Chip` | Default / Active / Strong | `src/pages/ProductCollection.tsx`, `ProductDetail.tsx` (인라인 패턴) |
| `Badge` | AR / 3D | `src/components/ProductCard.tsx` |
| `ContentBadge` | AI_DRAFT / UNKNOWN / CONTENT_REQUIRED | `src/components/ContentBadge.tsx` |
| `QuantityStepper` | — | `src/components/BuyPanel.tsx`, `src/pages/Cart.tsx` |
| `ProductCard` | — | `src/components/ProductCard.tsx` |
| `ColorBlockLink` | Lime / Orange / Blue | `src/components/ColorBlockLink.tsx` |
| `HotspotCard` | Lime / Orange / Blue | `src/pages/Home.tsx` |
| `PhoneMockup` | — | `src/components/PhoneMockup.tsx` |

`VERIFIED`는 코드에서 아무것도 렌더링하지 않으므로 `ContentBadge`에 변형이 없습니다.

### 텍스트 스타일

`Display/XL · L · M`(Jua), `Heading/L · M · S`와 `Label/Button`(Nunito ExtraBold),
`Body/L · M · S`(Gothic A1), `Eyebrow`(Nunito Bold + tracking). 코드의 `font-display` /
`font-heading` / `font-sans` 설정과 같습니다.

### 변수 코드 구문

모든 색 변수에 WEB 코드 구문이 붙어 있어 피그마 Dev Mode가 `var(--lagi-ink)` 같은
실제 CSS 변수명을 그대로 보여줍니다(`src/index.css`의 `:root`와 동일). 간격 변수는
Tailwind 스텝 값(`space-6` → `1.5` → `p-6`)을 보여줍니다.

## 알려진 문제 — Code Connect

Figma Code Connect(컴포넌트 ↔ 코드 자동 연결)는 **Organization / Enterprise 플랜 전용**이라
현재 student 플랜에서는 쓸 수 없습니다. 대신 각 컴포넌트의 `description`에 대응 코드 경로와
저장소/브랜치를 적어 두었습니다. 피그마에서 컴포넌트를 선택하면 바로 보입니다.

`Button` / `Chip` / `HotspotCard`는 아직 코드에서 독립 컴포넌트가 아니라 인라인 Tailwind
패턴입니다. 이들을 실제 컴포넌트로 추출하면 코드와 피그마가 1:1로 맞아떨어집니다.

## 알려진 문제 — 쓰기 권한

처음 만든 파일 `a0MB9fxF0uUJgY4Ol3RMsV`는 팀 플랜이 starter에서 student로 바뀐 뒤
MCP 쓰기가 거부됩니다(읽기는 됨). 그래서 현재 플랜에서 새로 만든 위 파일로 옮겼습니다.
플랜이나 시트가 다시 바뀌면 같은 증상이 날 수 있고, 그때는 새 파일을 만들어 다시 올리면 됩니다.
