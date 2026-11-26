/**
 * Example reviews that fill the review page until real customers write theirs. They are NOT real customer reviews:
 * the page says so in one quiet line under the rating, and none of them carries a "구매 확인" mark.
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
  { productId: 'lagi-charcoal-jersey', rating: 5, author: '박*린', date: '2026.11.15', text: '가슴의 LAGI 로고가 크고 선명해서 입으면 바로 눈에 띄어요. 밑단 스트링을 조이면 실루엣이 확 달라져서 코디가 재밌습니다.' },
  { productId: 'daily-pouch-bag', rating: 4, author: '최*서', date: '2026.11.14', text: '휴대폰, 지갑, 립밤 정도 넣고 다니기 딱 좋은 크기예요. 끈 길이를 조절할 수 있어서 크로스로 메기 편합니다.' },
  { productId: 'lagi-royal-blue-fleece-pullover', rating: 5, author: '정*우', date: '2026.11.12', text: '블루 색이 사진보다 더 선명해요. 플리스가 부드럽고 따뜻해서 가을에 매일 입게 됩니다.' },
  { productId: 'origami-picnic-bag', rating: 5, author: '한*영', date: '2026.11.11', text: '펼치면 돗자리가 되는 게 신기해요. 공원 가는 날마다 챙기게 됩니다. 접으면 가방이라 들고 다니기도 좋아요.' },
  { productId: 'lagi-painter-pants', rating: 5, author: '송*하', date: '2026.11.10', text: '물감 자국이 하나하나 달라서 세상에 하나뿐인 바지 같아요. 단색 상의만 입어도 코디가 끝납니다.' },
  { productId: 'milkpack-earphone-case', rating: 5, author: '오*민', date: '2026.11.09', text: '우유팩이라고 하면 믿기지 않아요. 이어폰 케이스로 쓰는데 키링처럼 달고 다니면 자꾸 눈이 갑니다.' },
  { productId: 'modular-bag-s', rating: 4, author: '유*진', date: '2026.11.08', text: '얇고 가벼워서 가방 속에 넣고 다니다가 필요할 때 꺼내 메기 좋아요. 두 가지로 쓸 수 있어서 만족합니다.' },
  { productId: 'lagi-grey-ringer-tee', rating: 5, author: '강*은', date: '2026.11.07', text: '회색 티에 블루 하우스 로고가 크게 들어가 한 장만 입어도 포인트가 돼요. 목선 테두리도 귀엽습니다.' },
  { productId: 'book-cover', rating: 5, author: '윤*호', date: '2026.11.06', text: '책을 감싸는 느낌이 단단해서 가방 안에서도 모서리가 안 상해요. 안쪽 포켓에 책갈피를 넣어 다닙니다.' },
  { productId: 'lagi-faded-blue-denim-jacket', rating: 4, author: '임*솔', date: '2026.11.05', text: '위쪽이 옅게 바랜 색이라 실제로 입으면 훨씬 자연스러워요. 가슴 위 오렌지 로고가 은근한 포인트입니다.' },
  { productId: 'glasses-case', rating: 5, author: '조*빈', date: '2026.11.04', text: '선글라스를 가방에 그냥 넣고 다니다 흠집이 났었는데 이걸로 해결했어요. 카라비너로 걸어 두기도 좋습니다.' },
  { productId: 'lagi-forest-green-denim-jacket', rating: 5, author: '서*아', date: '2026.11.03', text: '짙은 그린 색이 고급스러워요. 같은 트러커 재킷인데 색 하나로 분위기가 완전히 달라집니다.' },
  { productId: 'lagi-teal-fleece-sweatpants', rating: 5, author: '문*주', date: '2026.11.02', text: '플리스가 정말 부드러워요. 와이드하게 떨어지는 핏이라 집에서도 밖에서도 편하게 입습니다.' },
  { productId: 'daily-tote', rating: 5, author: '배*현', date: '2026.11.01', text: '선물로 샀는데 받은 친구가 이야기가 담긴 가방이라 더 좋다고 했어요. 포장을 열었을 때 첫인상도 좋았습니다.' },
  { productId: 'lagi-brown-cap', rating: 4, author: '남*리', date: '2026.10.30', text: '차분한 브라운이라 어떤 옷에도 잘 어울려요. 옆면에 작게 적힌 문구를 발견하는 재미가 있습니다.' },
  { productId: 'lagi-green-trucker-cap', rating: 5, author: '권*아', date: '2026.10.28', text: '블루 하우스 마크 자수가 도톰해서 고급스러워 보여요. 단색 옷에 쓰기만 해도 포인트가 됩니다.' },
  { productId: 'lagi-charcoal-jersey', rating: 5, author: '홍*석', date: '2026.10.26', text: '스포츠 저지인데 로고 때문에 브랜드 옷 같은 느낌이 나요. 청바지와도 트레이닝 팬츠와도 잘 어울립니다.' },
  { productId: 'lagi-royal-blue-fleece-pullover', rating: 5, author: '신*지', date: '2026.10.24', text: '스냅 단추가 달린 하이넥이라 목이 따뜻해요. 아이보리 카라가 블루를 부드럽게 받쳐 줍니다.' },
];
