/** LAGI's four official selection criteria. Every product must meet all four. (Supplied by the brand.) */
export const WHY_LAGI = [
  { key: 'ATTRACTION', question: '가치를 설명하지 않아도 먼저 마음이 가는가?' },
  { key: 'POSSIBILITY', question: '제품의 새로운 가치와 가능성을 발견하고 찾아내는가?' },
  {
    key: 'PROCESS & PEOPLE',
    question: '제품을 설명하기 위한 이야기가 아니라, 그 제품이 그렇게 만들어질 수밖에 없었던 과정과 사람의 이야기가 존재하는가?',
  },
  { key: 'CRAFT & SENSE', question: '장인 정신과 디자이너의 감각이 제품만의 차이를 만들어내는가?' },
] as const;

export const WHY_LAGI_RULE = '모든 제품은 네 가지 기준을 모두 충족해야 합니다.';
