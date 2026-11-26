/**
 * Example reviews that fill the review page until real customers write theirs. They are NOT real customer reviews:
 * every card and the top of the page say "예시", and none of them carries a "구매 확인" mark.
 */
export interface SampleReview {
  productId: string;
  rating: 4 | 5;
  text: string;
  author: string;
  date: string;
}

export const SAMPLE_REVIEWS: SampleReview[] = [
  { productId: 'daily-tote', rating: 5, author: '김*아', date: '2026.11.18', text: '밀가루 포대에 찍힌 글자가 그대로 살아 있어서 들고 나가면 다들 어디 거냐고 물어봐요. 생각보다 가볍고 어깨에 메도 편합니다.' },
  { productId: 'plano-bag', rating: 5, author: '이*준', date: '2026.11.16', text: '번호판으로 만들었다는 이야기를 듣고 샀는데 실물이 훨씬 멋져요. 버클 소리가 찰칵 나는 것도 마음에 듭니다.' },
  { productId: 'lagi-alien-vest-sweat-set', rating: 5, author: '박*린', date: '2026.11.15', text: '에일리언 그래픽이 사진보다 귀엽습니다. 셔츠를 걸쳐도, 허리에 묶어도 분위기가 달라져서 코디가 재밌어요.' },
  { productId: 'daily-pouch-bag', rating: 4, author: '최*서', date: '2026.11.14', text: '휴대폰, 지갑, 립밤 정도 넣고 다니기 딱 좋은 크기예요. 끈 길이를 조절할 수 있어서 크로스로 메기 편합니다.' },
  { productId: 'lagi-navy-jersey-camo-set', rating: 5, author: '정*우', date: '2026.11.12', text: '저지 티에 카모 카고를 같이 입으니 한 벌처럼 맞아요. 바지가 넉넉해서 활동하기도 편합니다.' },
  { productId: 'origami-picnic-bag', rating: 5, author: '한*영', date: '2026.11.11', text: '펼치면 돗자리가 되는 게 신기해요. 공원 가는 날마다 챙기게 됩니다. 접으면 가방이라 들고 다니기도 좋아요.' },
  { productId: 'lagi-star-knit-denim-set', rating: 5, author: '송*하', date: '2026.11.10', text: '별 무늬 니트가 비치는 느낌이라 안에 흰 티를 받쳐 입었어요. 데님 버뮤다랑 색 조합이 정말 잘 어울립니다.' },
  { productId: 'milkpack-earphone-case', rating: 5, author: '오*민', date: '2026.11.09', text: '우유팩이라고 하면 믿기지 않아요. 이어폰 케이스로 쓰는데 키링처럼 달고 다니면 자꾸 눈이 갑니다.' },
  { productId: 'modular-bag-s', rating: 4, author: '유*진', date: '2026.11.08', text: '얇고 가벼워서 가방 속에 넣고 다니다가 필요할 때 꺼내 메기 좋아요. 두 가지로 쓸 수 있어서 만족합니다.' },
  { productId: 'lagi-our-house-tee', rating: 5, author: '강*은', date: '2026.11.07', text: '손으로 그린 듯한 그래픽 티가 너무 예뻐요. 플라워 스커트랑 같이 입으니 사진이 잘 나옵니다.' },
  { productId: 'book-cover', rating: 5, author: '윤*호', date: '2026.11.06', text: '책을 감싸는 느낌이 단단해서 가방 안에서도 모서리가 안 상해요. 안쪽 포켓에 책갈피를 넣어 다닙니다.' },
  { productId: 'lagi-la-layered-set', rating: 4, author: '임*솔', date: '2026.11.05', text: '레이어드로 입으면 LA 빈티지 느낌이 확실히 나요. 와이드 팬츠가 길어서 굽 있는 신발이랑 입었습니다.' },
  { productId: 'glasses-case', rating: 5, author: '조*빈', date: '2026.11.04', text: '선글라스를 가방에 그냥 넣고 다니다 흠집이 났었는데 이걸로 해결했어요. 카라비너로 걸어 두기도 좋습니다.' },
  { productId: 'lagi-frog-jacket-wide-set', rating: 5, author: '서*아', date: '2026.11.03', text: '프로그 버튼이 포인트라 단추 잠그는 재미가 있어요. 베이지 점퍼와 블랙 팬츠 대비가 깔끔합니다.' },
  { productId: 'lagi-red-stripe-cargo-set', rating: 5, author: '문*주', date: '2026.11.02', text: '스트라이프 티가 오버핏이라 편하고, 브라운 카고 팬츠랑 색이 잘 맞아요. 주머니가 커서 실용적입니다.' },
  { productId: 'daily-tote', rating: 5, author: '배*현', date: '2026.11.01', text: '선물로 샀는데 받은 친구가 이야기가 담긴 가방이라 더 좋다고 했어요. 포장을 열었을 때 첫인상도 좋았습니다.' },
  { productId: 'lagi-plaid-cami-denim-set', rating: 4, author: '남*리', date: '2026.10.30', text: '체크 캐미가 생각보다 사랑스러워요. 반팔 티를 안에 입으니 가을에도 입기 좋습니다.' },
  { productId: 'lagi-pleats-cami-bolero-set', rating: 5, author: '권*아', date: '2026.10.28', text: '볼레로가 부드러워서 걸치기만 해도 분위기가 살아요. 파라슈트 팬츠 실루엣이 예쁩니다.' },
  { productId: 'lagi-intarsia-knit-cargo-set', rating: 5, author: '홍*석', date: '2026.10.26', text: '니트 색이 정말 화려한데 입으면 의외로 부담스럽지 않아요. 옐로 카고 쇼츠와 같이 입으면 눈에 확 띕니다.' },
  { productId: 'lagi-not-normal-layered-set', rating: 5, author: '신*지', date: '2026.10.24', text: 'NOT NORMAL 문구가 마음에 들어서 샀어요. 셔츠 레이어드랑 플레어 쇼츠 조합이 편하고 귀엽습니다.' },
];
