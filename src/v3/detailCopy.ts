/**
 * Headline copy for the long product detail page (the FlourSack tote page is the model).
 * LAGI-written marketing lines built from the product photos and product data — no facts are invented here.
 * `kind` = what the 상품 종류 row says. `hook` = the big first headline (two lines, the last word can be red).
 */
export type DetailCopy = {
  hook: [string, string];
  kind: string;
  /** Second headline, about what makes it different from an ordinary item. */
  diff: [string, string];
  /** "이런 분께 추천해요" lines. */
  forWhom?: string[];
};

const BAG_FOR = ['나만의 일상 스타일을 원하시는 분', '외출·통학·출근용 편한 가방을 원하시는 분', '디자인과 활용도를 함께 보시는 분', '소재의 새 가능성에 끌리시는 분', '이야기 담긴 선물을 고르시는 분', '흔하지 않은 가방을 찾으시는 분'];
const ACC_FOR = ['작은 소품도 나답게 고르고 싶은 분', '가방 속 정리가 필요한 분', '업사이클링 소재가 궁금하신 분', '이야기 담긴 선물을 고르시는 분', '흔하지 않은 디자인을 찾으시는 분', '매일 쓰는 물건을 오래 쓰고 싶은 분'];
const SET_FOR = ['코디 고민 없이 한 벌로 입고 싶은 분', '흔하지 않은 스트리트 무드를 찾으시는 분', '레이어드 스타일을 즐기시는 분', '빈티지·세컨핸드 감성을 좋아하시는 분', '사진이 잘 나오는 옷을 찾으시는 분', '라기가 고른 스타일이 궁금하신 분'];

export const DETAIL_COPY: Record<string, DetailCopy> = {
  'daily-pouch-bag': { hook: ['가볍게 메는', '작은 포인트'], kind: '업사이클링 미니 크로스백', diff: ['작지만', '분명한 존재감'], forWhom: BAG_FOR },
  'origami-picnic-bag': { hook: ['펼치면 돗자리,', '접으면 가방'], kind: '업사이클링 피크닉백 · 돗자리 겸용', diff: ['하나로', '두 가지 쓰임'], forWhom: BAG_FOR },
  'plano-bag': { hook: ['번호판으로 만든', '단 하나의 가방'], kind: '업사이클링 투웨이백', diff: ['번호판이 만든', '단단한 형태'], forWhom: BAG_FOR },
  'modular-bag-s': { hook: ['슬림하게 드는', '데일리 투웨이백'], kind: '업사이클링 투웨이백', diff: ['얇고 가볍게', '두 가지 방식'], forWhom: BAG_FOR },
  'milkpack-earphone-case': { hook: ['우유팩의', '두 번째 쓰임'], kind: '업사이클링 이어폰 케이스 · 키링', diff: ['작은 소품의', '새로운 포인트'], forWhom: ACC_FOR },
  'book-cover': { hook: ['책을 감싸는', '나만의 표지'], kind: '업사이클링 핸드메이드 북커버', diff: ['읽는 시간을', '더 나답게'], forWhom: ACC_FOR },
  'glasses-case': { hook: ['가방 속', '안경 자리'], kind: '업사이클링 안경·선글라스 케이스', diff: ['작게 접어', '가볍게 챙기는'], forWhom: ACC_FOR },
  'lagi-star-knit-denim-set': { hook: ['별 하나로 완성한', '데님 무드'], kind: '니트 & 데님 버뮤다 세트', diff: ['메쉬 니트와', '워싱 데님'], forWhom: SET_FOR },
  'lagi-navy-jersey-camo-set': { hook: ['저지와 카모,', '스트리트 한 벌'], kind: '저지 티 & 카고 팬츠 세트', diff: ['스포티하게,', '여유 있게'], forWhom: SET_FOR },
  'lagi-alien-vest-sweat-set': { hook: ['ACT NORMAL,', '하지만 평범하지 않게'], kind: '그래픽 티 · 셔츠 · 스웻 쇼츠 세트', diff: ['레이어드로', '바뀌는 분위기'], forWhom: SET_FOR },
  'lagi-intarsia-knit-cargo-set': { hook: ['컬러로 말하는', '인타르시아 니트'], kind: '니트 & 카고 쇼츠 세트', diff: ['과감한 색,', '단단한 카고'], forWhom: SET_FOR },
  'lagi-our-house-tee': { hook: ['그림 한 장 같은', '그래픽 티'], kind: '레이어드 티 & 미니 스커트 세트', diff: ['손그림 그래픽과', '플라워 스커트'], forWhom: SET_FOR },
  'lagi-la-layered-set': { hook: ['LA 빈티지를', '레이어드로'], kind: '레이어드 티 & 와이드 팬츠 세트', diff: ['겹쳐 입어', '깊어지는 무드'], forWhom: SET_FOR },
  'lagi-red-stripe-cargo-set': { hook: ['스트라이프와', '와이드 카고'], kind: '스트라이프 티 & 카고 팬츠 세트', diff: ['편하게,', '그러나 분명하게'], forWhom: SET_FOR },
  'lagi-frog-jacket-wide-set': { hook: ['프로그 버튼이', '만든 포인트'], kind: '점퍼 & 와이드 팬츠 세트', diff: ['클래식 디테일,', '와이드 실루엣'], forWhom: SET_FOR },
  'lagi-plaid-cami-denim-set': { hook: ['체크 캐미로', '가볍게 레이어드'], kind: '캐미 · 티 · 데님 세트', diff: ['사랑스럽게,', '편안하게'], forWhom: SET_FOR },
  'lagi-pleats-cami-bolero-set': { hook: ['플리츠와 볼레로,', '부드러운 한 벌'], kind: '캐미 · 볼레로 · 팬츠 세트', diff: ['겹겹이 쌓은', '부드러운 결'], forWhom: SET_FOR },
  'lagi-not-normal-layered-set': { hook: ['NOT NORMAL,', '그래서 더 나답게'], kind: '레이어드 티 & 스웻 쇼츠 세트', diff: ['셔츠 레이어드와', '스웻 쇼츠'], forWhom: SET_FOR },
};

export function detailCopy(id: string, clothing: boolean, name: string): DetailCopy {
  return DETAIL_COPY[id] ?? { hook: [clothing ? '라기가 고른' : '일상 스타일링의', clothing ? '오늘의 한 벌' : '새로운 포인트'], kind: name, diff: ['흔하지 않은', '디자인'], forWhom: clothing ? SET_FOR : BAG_FOR };
}
