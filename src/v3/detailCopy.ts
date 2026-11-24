/**
 * Headline copy for the long product detail page (the FlourSack tote page is the model).
 * LAGI-written lines built from the product photos and product data — no facts are invented here.
 */
export type DetailCopy = { hook: [string, string] };

export const DETAIL_COPY: Record<string, DetailCopy> = {
  'daily-pouch-bag': { hook: ['가볍게 메는', '작은 포인트'] },
  'origami-picnic-bag': { hook: ['펼치면 돗자리,', '접으면 가방'] },
  'plano-bag': { hook: ['번호판으로 만든', '단 하나의 가방'] },
  'modular-bag-s': { hook: ['슬림하게 드는', '데일리 투웨이백'] },
  'milkpack-earphone-case': { hook: ['우유팩의', '두 번째 쓰임'] },
  'book-cover': { hook: ['책을 감싸는', '나만의 표지'] },
  'glasses-case': { hook: ['가방 속', '안경 자리'] },
  'lagi-star-knit-denim-set': { hook: ['별 하나로 완성한', '데님 무드'] },
  'lagi-navy-jersey-camo-set': { hook: ['저지와 카모,', '스트리트 한 벌'] },
  'lagi-alien-vest-sweat-set': { hook: ['ACT NORMAL,', '하지만 평범하지 않게'] },
  'lagi-intarsia-knit-cargo-set': { hook: ['컬러로 말하는', '인타르시아 니트'] },
  'lagi-our-house-tee': { hook: ['그림 한 장 같은', '그래픽 티'] },
  'lagi-la-layered-set': { hook: ['LA 빈티지를', '레이어드로'] },
  'lagi-red-stripe-cargo-set': { hook: ['스트라이프와', '와이드 카고'] },
  'lagi-frog-jacket-wide-set': { hook: ['프로그 버튼이', '만든 포인트'] },
  'lagi-plaid-cami-denim-set': { hook: ['체크 캐미로', '가볍게 레이어드'] },
  'lagi-pleats-cami-bolero-set': { hook: ['플리츠와 볼레로,', '부드러운 한 벌'] },
  'lagi-not-normal-layered-set': { hook: ['NOT NORMAL,', '그래서 더 나답게'] },
};

export function detailCopy(id: string, clothing: boolean): DetailCopy {
  return DETAIL_COPY[id] ?? { hook: [clothing ? '라기가 고른' : '일상 스타일링의', clothing ? '오늘의 한 벌' : '새로운 포인트'] };
}
