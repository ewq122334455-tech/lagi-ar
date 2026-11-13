# 모델 및 SDK 점검

## 자료 접근 한계
요청하신 공식 문서(`platform.decart.ai`, `docs.platform.decart.ai`, `api-onboarding.decart.ai`)는 이 세션의 네트워크 허용 목록에 없어 **직접 열지 못했다**(DNS 해석 실패). 대신 (a) 설치된 `@decartai/sdk` 0.2.14 코드를 직접 실행해 확인한 사실과 (b) 웹 검색이 돌려준 공식 문서 발췌를 근거로 썼다. (b)는 요약본이라 원문과 다를 수 있으므로 "문서 발췌"로 표시한다. 문서 호스트를 허용해 주시면 원문 대조를 다시 하겠다.

## SDK에서 직접 확인한 것 (실행 결과)
| 항목 | 결과 |
|---|---|
| 설치 버전 | 0.2.14, `npm view` 최신과 동일 (최종 갱신 2026-10-25) |
| 실시간 모델 ID | `lucy-2.6`(1280×720, 30fps, 속도 `fast`), `lucy-vton-latest`(같은 해상도), `lucy-latest`, `lucy-restyle-2`(1280×704) 가 `models.realtime()`에서 조회됨. `lucy-2.1-vton`, `mirage`는 없음 |
| 현재 코드의 모델 | `lucy-2.6` — 존재함. SDK 사용법(`createDecartClient`, `realtime.connect(stream,{model,onRemoteStream})`, `setImage`, `setPrompt`)이 설치된 버전의 타입과 일치(`tsc` 통과) |

## 문서 발췌 (웹 검색 결과, 원문 미열람)
- **가상 착용 모델**: 실시간 VTON은 카메라 영상 + **의류 참조 이미지 + 설명 프롬프트**를 받는다. 이미지는 JPEG/PNG/WebP, 세션 중 이미지를 바꿀 수 있다. SDK 예시는 `models.realtime("lucy-vton-latest")`.
- **클라이언트 토큰**: `expiresIn`은 새 연결에만 적용되고 이미 연결된 세션은 만료 후에도 유지. `constraints.realtime.maxSessionDuration`(최소 10초)이 세션당 최대 시간. 토큰 단위의 동시 세션 필드는 문서에 없음. 계정 단위 동시 세션 상한은 `GET /v1/realtime/quota`로 조회(권고용; 접속 시 WebSocket 1013 거절 처리 필요).
- **가격**: 720p 실시간 2 크레딧/초, 1 크레딧 = $0.01 → **$0.02/초**(Decart 가격 페이지와 fal.ai 표기가 같음). 제3자 글 하나는 "fast" 모드를 $0.04/초로 적었다. 단가는 **확인 전 값**이다.

## 모델 적합성 판단
| 후보 | LAGI 제품 적합성 | 근거 |
|---|---|---|
| `lucy-2.6` (현재) | 가방 같은 **소품 추가**에 쓸 수 있는 범용 편집. 모양·로고 유지는 미보장 | 이전 코드 주석: 의류 전용 VTON이 가방을 옷으로 바꿨음. 이전 스크린샷의 엉뚱한 가방 |
| `lucy-vton-latest` | **의류 전용**. 가방에는 부적합(이전 실제 시도에서 가방이 옷처럼 변형) | 코드 주석 + 문서 발췌(garment 참조) |
| `lucy-restyle-2` | 스타일 변환. 제품 재현 목적에 맞지 않음 | 모델 설명 |

**결론: 모델은 교체하지 않는다.** 근거 없이 새 공급자를 추가하지 않았다. 의류 상품(현재 노출 안 됨, AI_DRAFT 샘플 8종)을 정식 판매하게 되면 그때 `lucy-vton-latest`를 의류에만 쓰는 분기를 검토한다(별도 기능).

## 재연결 / 브라우저
- 현재 코드는 끊기면 **재연결하지 않고 종료**한다(의도적: 재연결은 새 과금 세션). 재연결을 넣으려면 새 토큰·새 유닛이 필요하므로 지금은 "다시 시작"만 제공.
- WebRTC/`getUserMedia`: Mac Chrome·Android Chrome·iOS Safari 지원 여부는 **실기기 검증 전**. `MediaRecorder`는 iOS Safari에서 MP4(H.264), Chrome에서 WebM이며 코드가 지원 형식을 찾아 쓴다.
