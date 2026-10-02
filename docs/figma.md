# Figma ↔ 코드 연결

이 저장소의 디자인은 아래 Figma 파일과 짝을 이룹니다.

| 항목 | 값 |
| --- | --- |
| 파일 | **LAGI — Web AR Commerce** |
| URL | https://www.figma.com/design/a0MB9fxF0uUJgY4Ol3RMsV |
| fileKey | `a0MB9fxF0uUJgY4Ol3RMsV` |
| 페이지 | `LAGI — Web` |
| 계정 | 20240511@g.kit.ac.kr (팀 `team::1687673643562078069`) |

## 파일에 들어있는 것

- `Home / Desktop 1440` — 내비게이션, 히어로, FEATURED PRODUCTS, LOOK CLOSER(핫스팟 3종),
  MATERIALS·PROCESS·STORY 컬러 블록, EXPERIENCE IN AR, 푸터. 전부 오토 레이아웃 레이어이며
  스크린샷이 아니라 편집 가능한 텍스트/프레임입니다.
- `AR / Mobile 390 — markerless placement` — `src/ar/PlacementARProvider.ts`가 실제로 그리는
  화면 구성(카메라 패스스루, 배치된 제품, 이동 모드 배지, 제스처 안내, 하단 바)을 옮긴 것.

## 변수(토큰) 매핑

Figma 컬렉션 `LAGI / Color`의 변수 이름은 `tailwind.config.js`의 색상 키와 1:1로 같습니다.
한쪽을 바꾸면 다른 쪽도 같은 이름으로 바꿔 주세요.

| Figma 변수 | Variable ID | Tailwind 키 | 값 |
| --- | --- | --- | --- |
| paper | `VariableID:1:3` | `paper` | `#ffffff` |
| ink | `VariableID:1:4` | `ink` | `#111111` |
| graphite | `VariableID:1:5` | `graphite` | `#3a3a3a` |
| stone | `VariableID:1:6` | `stone` | `#8a8a8a` |
| mist | `VariableID:1:7` | `mist` | `#f5f5f5` |
| line | `VariableID:1:8` | `line` | `#e5e5e5` |
| blue | `VariableID:1:9` | `blue` | `#2E55A3` |
| orange | `VariableID:1:10` | `orange` | `#C2662C` |
| lime | `VariableID:1:11` | `lime` | `#DEB457` |

컬렉션 `LAGI / Space`(`space-2` … `space-32`)는 Tailwind 기본 간격 스케일의 4px 배수와 같습니다.

## 브랜드 색상에 대한 정직한 표기

`blue` / `orange` / `lime` 세 값은 **LAGI 로고 이미지를 눈으로 보고 추정한 값**입니다.
브랜드 공식 색상 코드가 확인되면 Figma 변수와 `tailwind.config.js`를 같은 값으로 함께 고쳐야 합니다.

## 폰트

Jua(디스플레이), Nunito(헤딩·버튼), Gothic A1(본문)을 쓰며, 세 가지 모두 Figma에서 사용 가능한
것을 확인했습니다. 코드의 `fontFamily` 설정과 동일합니다.
