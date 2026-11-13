# 모델 및 SDK 점검 (공식 문서 직접 확인 판)

## 출처와 정정
이전 판에서 "공식 문서 사이트에 접근할 수 없다"고 썼는데, **`WebFetch`만 막혀 있었고 `curl`로는 열렸다.** 이번에 아래 공식 페이지를 `curl`로 직접 받아 읽었다(2026-11-13 시점). 이전 판의 "검색 발췌" 표기는 이 문서로 대체한다.
- https://platform.decart.ai/models/lucy-vton (제품 페이지)
- https://docs.platform.decart.ai/models/realtime/virtual-try-on.md · `vton-3.5-prompting.md` · `lucy-2.6.md`
- https://docs.platform.decart.ai/getting-started/pricing.md · `models.md` · `client-tokens.md`
- https://docs.platform.decart.ai/api-reference/get-realtime-quota.md
공식 자료에 없는 내용은 **미확인**으로 표시한다. 이 세션은 Decart 계정/키가 없어 실제 호출로 확인한 것은 없다.

## 두 모델 비교 (공식 문서 기준)
| 항목 | `lucy-2.6` (현재 사용) | `lucy-vton-3.6` (= `lucy-vton-latest`) |
|---|---|---|
| 용도 | 범용 실시간 편집(추가·교체·삭제, 캐릭터 교체, 가상 착용 포함) | 가상 착용 전용 |
| 가방/액세서리 | 표에 "Virtual try-on: Swap clothing or accessories", "Add: 새 객체 삽입". **가방 직접 언급 없음** | 문서가 "clothing and accessories"를 지원한다고 쓰고, 프롬프트 가이드 예시에 **"Add a tan leather shoulder bag to the outfit."** 가 있다 → 가방 추가는 **공식 사용 사례** |
| 참조 이미지 | 텍스트·참조 이미지·둘 다 | 의류/액세서리 참조 이미지 + 설명 프롬프트(최선). JPEG/PNG/WebP, 깨끗한 단품·흰 배경·512×512 이상 권장 |
| 프롬프트 형식 | 자유 | **한 동작·한 대상**: 액세서리는 `Add <설명> to the outfit.` 보이는 것만 설명, **보이지 않는 로고·세부 발명 금지**, 대략 영문 750자 한도. 교체+추가를 한 프롬프트에 섞지 말 것 |
| 가격(실시간 720p) | $0.02/초 | $0.02/초 |
| 빠른 모드 | `speed:"fast"` $0.04/초(2배) | 동일 |
| 해상도·FPS | 1280×720, 30fps (SDK 0.2.14에서 직접 확인) | 동일 (SDK에서 직접 확인) |
| SDK 0.2.14 호환 | `models.realtime('lucy-2.6')` OK | `models.realtime('lucy-vton-3.6')`, `-3.5`, `-latest` 모두 OK, 지원 속도 `["fast"]` |
| 가방 형태·로고 충실도 | **미확인**(공식 자료 없음, 실제 호출 필요) | **미확인** |

### 이전 문서와 달라진 점
이전 코드 주석은 "의류 전용 VTON이 가방을 옷으로 바꿨다"고 했다. 공식 문서는 VTON도 `Add … to the outfit` 패턴으로 가방을 다루는 것을 예시로 든다. 그 실패는 모델 자체가 아니라 **당시 프롬프트 형식**(교체 패턴 등) 때문이었을 가능성이 있다. 이것은 가설이며 실제 호출로 확인해야 한다.

## 결정: 자동 교체하지 않는다
- 기본 모델은 **`lucy-2.6` 그대로**다.
- 이번에 **선택 설정**만 만들었다: Worker 환경변수 `REALTIME_MODEL`을 `lucy-vton-3.6`(또는 `-3.5`)로 두면 새 세션 토큰이 그 모델 하나로만 발급되고, 페이지는 토큰 응답의 `model`을 따라 VTON 형식 프롬프트(`Add … to the outfit`)를 쓴다. 허용 목록은 `lucy-2.6`, `lucy-vton-3.6`, `lucy-vton-3.5` 세 개뿐이며 그 밖의 값은 무시되어 `lucy-2.6`이 된다. 페이지가 스스로 모델을 바꾸지 않는다.
- 어느 쪽이 LAGI 가방에 낫다는 결론은 **내리지 않는다**(실제 출력 비교 전). 스모크 1회로는 모델 간 우열을 판단할 수 없고, 연결·출력 여부와 기본 충실도만 본다.

## 토큰 · 세션 · 재연결 (공식 문서)
- 클라이언트 토큰: `expiresIn` 1~3600초(기본 60), `allowedModels`(최대 20), `allowedOrigins`(브라우저 강제, **스푸핑 가능한 비브라우저 클라이언트는 못 막는다**고 문서가 명시), `constraints.realtime.maxSessionDuration`(세션당 최대 초, 최소 10).
- 만료는 **새 연결만** 막고 이미 연결된 세션은 유지. 같은 토큰으로 만료 전까지 여러 연결을 여는 것을 막는 문서화된 필드는 **없다**(미확인이 아니라 "문서에 없음").
- 계정 동시 세션 한도: `GET /v1/realtime/quota`로 조회, 초과 시 WebSocket 1013 거절. 한도 값을 우리 코드가 설정하는 API는 문서에 없다(대시보드/계정 설정은 **미확인**).
- 재연결: 정적 토큰은 만료 후 재연결 거절. 공식 권장은 `apiKeyProvider`(연결·재연결마다 새 토큰). 우리는 의도적으로 **재연결하지 않고 종료**한다(재연결은 새 과금 세션이므로 서버 계량과 맞물려야 함).
- 청구 단위: 가격 페이지는 "realtime: billed per second of active generation", FAQ는 "active generation time". 연결만 유지한 시간·큐 대기 시간이 청구되는지는 **문서에 명시 없음(미확인)**. 비용 계산은 보수적으로 연결 시간 전체를 청구된다고 가정한다.

## 브라우저 호환
WebRTC/`getUserMedia`/`MediaRecorder`: Mac Chrome(헤드리스 Chromium에서 동작 확인), iPhone Safari·Android Chrome은 **미검증**(실기기 필요). Decart SDK의 브라우저 지원 목록은 이번에 확인한 문서에 명시가 없다(**미확인**).
