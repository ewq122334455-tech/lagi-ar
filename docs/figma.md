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
| `Home / Desktop 1440` | `src/pages/Home.tsx` |
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

컬렉션 `LAGI / Space`(`space-2` … `space-32`)는 4px 배수 간격 스케일입니다.

## 브랜드 색상에 대한 정직한 표기

`blue` / `orange` / `lime` 세 값은 **LAGI 로고 이미지를 눈으로 보고 추정한 값**입니다.
브랜드 공식 색상 코드가 확인되면 Figma 변수와 `tailwind.config.js`를 같은 값으로 함께 고쳐야 합니다.

## 폰트

Jua(디스플레이), Nunito(헤딩·버튼), Gothic A1(본문). 세 가지 모두 Figma에서 사용 가능한 것을
확인했으며 코드의 `fontFamily` 설정과 같습니다.

## 알려진 문제 — 쓰기 권한

처음 만든 파일 `a0MB9fxF0uUJgY4Ol3RMsV`는 팀 플랜이 starter에서 student로 바뀐 뒤
MCP 쓰기가 거부됩니다(읽기는 됨). 그래서 현재 플랜에서 새로 만든 위 파일로 옮겼습니다.
플랜이나 시트가 다시 바뀌면 같은 증상이 날 수 있고, 그때는 새 파일을 만들어 다시 올리면 됩니다.
