/**
 * Headline copy for the long product detail page (the FlourSack tote page is the model).
 * LAGI-written lines built from the product photos and product data — no facts are invented here.
 */
export type DetailCopy = { hook: [string, string] };

export const DETAIL_COPY: Record<string, DetailCopy> = {
  'daily-tote': { hook: ['일상 스타일링의', '새로운 포인트'] },
  'daily-pouch-bag': { hook: ['가볍게 메는', '작은 포인트'] },
  'origami-picnic-bag': { hook: ['펼치면 돗자리,', '접으면 가방'] },
  'plano-bag': { hook: ['번호판으로 만든', '단 하나의 가방'] },
  'modular-bag-s': { hook: ['슬림하게 드는', '데일리 투웨이백'] },
  'milkpack-earphone-case': { hook: ['우유팩의', '두 번째 쓰임'] },
  'book-cover': { hook: ['책을 감싸는', '나만의 표지'] },
  'glasses-case': { hook: ['가방 속', '안경 자리'] },
  'lagi-charcoal-jersey': { hook: ['가슴 한가운데', '라기를 올린 저지'] },
  'lagi-brown-cap': { hook: ['조용한 브라운에', '작은 세 단어'] },
  'lagi-green-trucker-cap': { hook: ['하우스 마크로', '완성하는 캡'] },
  'lagi-forest-green-denim-jacket': { hook: ['색으로만 바꾼', '클래식 데님'] },
  'lagi-faded-blue-denim-jacket': { hook: ['바랜 색이 만든', '깊이 있는 블루'] },
  'lagi-royal-blue-fleece-pullover': { hook: ['라기의 블루를', '한 벌 가득'] },
  'lagi-grey-ringer-tee': { hook: ['회색 위에 크게', '올린 하우스 로고'] },
  'lagi-painter-pants': { hook: ['물감이 튄 듯', '작품 같은 바지'] },
  'lagi-teal-fleece-sweatpants': { hook: ['부드럽게 떨어지는', '틸 그린 플리스'] },
};

export function detailCopy(id: string, clothing: boolean): DetailCopy {
  return DETAIL_COPY[id] ?? { hook: [clothing ? '라기가 고른' : '일상 스타일링의', clothing ? '오늘의 한 벌' : '새로운 포인트'] };
}
