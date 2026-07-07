/* =========================================================
   EventHub Prototype — main.js
   ========================================================= */

/* ---------- Category Definitions ---------- */
const CATEGORIES = [
  { id: "all",       label: "전체",     emoji: "🏠" },
  { id: "fashion",   label: "패션",     emoji: "👗" },
  { id: "beauty",    label: "뷰티",     emoji: "💄" },
  { id: "food",      label: "푸드",     emoji: "🍔" },
  { id: "tech",      label: "전자기기", emoji: "📱" },
  { id: "delivery",  label: "배달",     emoji: "🛵" },
  { id: "stay",      label: "숙박",     emoji: "🏨" },
  { id: "living",    label: "리빙",     emoji: "🛋️" },
];

/* ---------- Event Dummy Dataset (14 brands / 8 categories) ---------- */
const EVENTS = [
  {
    id: "e001", category: "fashion", brand: "ZARA",
    title: "시즌 오프 세일", subtitle: "신상 컬렉션을 합리적인 가격에",
    discount: "40% OFF", period: "2026.05.05 - 2026.05.15", channel: "온라인 & 오프라인 매장",
    dday: "D-1",
    desc: "ZARA의 시즌 오프 세일. 신상 컬렉션을 합리적인 가격에 지금 만나보세요. 인기 아이템은 조기 품절될 수 있으니 서둘러 확인해보세요.",
    tags: ["신상", "한정수량", "온오프라인"],
    image: "https://picsum.photos/seed/zara-fashion-0/600/600",
    domain: "zara.com",
    link: "https://www.zara.com/"
  },
  {
    id: "e002", category: "fashion", brand: "Nike",
    title: "위크엔드 스타일 위크", subtitle: "매장 및 온라인 동시 진행되는 할인전",
    discount: "45% OFF", period: "2026.05.08 - 2026.05.23", channel: "온라인 전용",
    dday: "D-2",
    desc: "Nike의 위크엔드 스타일 위크. 매장 및 온라인 동시 진행되는 할인전 지금 만나보세요. 인기 아이템은 조기 품절될 수 있으니 서둘러 확인해보세요.",
    tags: ["온오프라인", "시즌오프", "신상"],
    image: "https://picsum.photos/seed/nike-fashion-1/600/600",
    domain: "nike.com",
    link: "https://www.nike.com/"
  },
  {
    id: "e003", category: "fashion", brand: "MANGO",
    title: "뉴 아라이벌 컬렉션", subtitle: "이번 시즌 놓치면 안 될 스타일 제안",
    discount: "1+1", period: "2026.05.12 - 2026.06.01", channel: "오프라인 매장 전용",
    dday: "D-3",
    desc: "MANGO의 뉴 아라이벌 컬렉션. 이번 시즌 놓치면 안 될 스타일 제안 지금 만나보세요. 인기 아이템은 조기 품절될 수 있으니 서둘러 확인해보세요.",
    tags: ["시즌오프", "신상", "온오프라인"],
    image: "https://picsum.photos/seed/mango-fashion-2/600/600",
    domain: "mango.com",
    link: "https://www.mango.com/"
  },
  {
    id: "e004", category: "fashion", brand: "H&M",
    title: "클로짓 리프레시 이벤트", subtitle: "데일리룩 완성을 위한 아이템 모음",
    discount: "50% OFF", period: "2026.05.13 - 2026.06.07", channel: "온라인 & 오프라인 매장",
    dday: "D-4",
    desc: "H&M의 클로짓 리프레시 이벤트. 데일리룩 완성을 위한 아이템 모음 지금 만나보세요. 인기 아이템은 조기 품절될 수 있으니 서둘러 확인해보세요.",
    tags: ["한정수량", "신상", "온오프라인"],
    image: "https://picsum.photos/seed/hm-fashion-3/600/600",
    domain: "hm.com",
    link: "https://www.hm.com/"
  },
  {
    id: "e005", category: "fashion", brand: "adidas",
    title: "스트릿 무드 특가전", subtitle: "시즌 아우터부터 액세서리까지 한번에",
    discount: "20% OFF", period: "2026.05.19 - 2026.05.29", channel: "온라인 전용",
    dday: "D-5",
    desc: "adidas의 스트릿 무드 특가전. 시즌 아우터부터 액세서리까지 한번에 지금 만나보세요. 인기 아이템은 조기 품절될 수 있으니 서둘러 확인해보세요.",
    tags: ["스타일", "신상", "한정수량"],
    image: "https://picsum.photos/seed/adidas-fashion-4/600/600",
    domain: "adidas.com",
    link: "https://www.adidas.com/"
  },
  {
    id: "e006", category: "fashion", brand: "GUESS",
    title: "시즌 오프 세일", subtitle: "신상 컬렉션을 합리적인 가격에",
    discount: "20% OFF", period: "2026.05.21 - 2026.06.05", channel: "오프라인 매장 전용",
    dday: "D-6",
    desc: "GUESS의 시즌 오프 세일. 신상 컬렉션을 합리적인 가격에 지금 만나보세요. 인기 아이템은 조기 품절될 수 있으니 서둘러 확인해보세요.",
    tags: ["신상", "시즌오프", "한정수량"],
    image: "https://picsum.photos/seed/guess-fashion-5/600/600",
    domain: "guess.com",
    link: "https://www.guess.com/"
  },
  {
    id: "e007", category: "fashion", brand: "Uniqlo",
    title: "위크엔드 스타일 위크", subtitle: "매장 및 온라인 동시 진행되는 할인전",
    discount: "30% OFF", period: "2026.05.25 - 2026.06.14", channel: "온라인 & 오프라인 매장",
    dday: "D-7",
    desc: "Uniqlo의 위크엔드 스타일 위크. 매장 및 온라인 동시 진행되는 할인전 지금 만나보세요. 인기 아이템은 조기 품절될 수 있으니 서둘러 확인해보세요.",
    tags: ["한정수량", "신상", "온오프라인"],
    image: "https://picsum.photos/seed/uniqlo-fashion-6/600/600",
    domain: "uniqlo.com",
    link: "https://www.uniqlo.com/"
  },
  {
    id: "e008", category: "fashion", brand: "8seconds",
    title: "뉴 아라이벌 컬렉션", subtitle: "이번 시즌 놓치면 안 될 스타일 제안",
    discount: "45% OFF", period: "2026.05.30 - 2026.06.24", channel: "온라인 전용",
    dday: "D-8",
    desc: "8seconds의 뉴 아라이벌 컬렉션. 이번 시즌 놓치면 안 될 스타일 제안 지금 만나보세요. 인기 아이템은 조기 품절될 수 있으니 서둘러 확인해보세요.",
    tags: ["시즌오프", "스타일", "신상"],
    image: "https://picsum.photos/seed/8seconds-fashion-7/600/600",
    domain: "8seconds.co.kr",
    link: "https://www.8seconds.co.kr/"
  },
  {
    id: "e009", category: "fashion", brand: "New Balance",
    title: "클로짓 리프레시 이벤트", subtitle: "데일리룩 완성을 위한 아이템 모음",
    discount: "최대 70% OFF", period: "2026.05.06 - 2026.05.16", channel: "오프라인 매장 전용",
    dday: "D-9",
    desc: "New Balance의 클로짓 리프레시 이벤트. 데일리룩 완성을 위한 아이템 모음 지금 만나보세요. 인기 아이템은 조기 품절될 수 있으니 서둘러 확인해보세요.",
    tags: ["스타일", "온오프라인", "신상"],
    image: "https://picsum.photos/seed/newbalance-fashion-8/600/600",
    domain: "newbalance.com",
    link: "https://www.newbalance.com/"
  },
  {
    id: "e010", category: "fashion", brand: "Levi's",
    title: "스트릿 무드 특가전", subtitle: "시즌 아우터부터 액세서리까지 한번에",
    discount: "45% OFF", period: "2026.05.04 - 2026.05.19", channel: "온라인 & 오프라인 매장",
    dday: "D-10",
    desc: "Levi's의 스트릿 무드 특가전. 시즌 아우터부터 액세서리까지 한번에 지금 만나보세요. 인기 아이템은 조기 품절될 수 있으니 서둘러 확인해보세요.",
    tags: ["시즌오프", "스타일", "한정수량"],
    image: "https://picsum.photos/seed/levi-fashion-9/600/600",
    domain: "levi.com",
    link: "https://www.levi.com/"
  },
  {
    id: "e011", category: "beauty", brand: "MAC",
    title: "글로우 뷰티 위크", subtitle: "피부 타입별 맞춤 스킨케어 제안",
    discount: "35% OFF", period: "2026.05.04 - 2026.05.14", channel: "온라인 전용",
    dday: "D-1",
    desc: "MAC의 글로우 뷰티 위크. 피부 타입별 맞춤 스킨케어 제안 대표 인기 제품들이 할인 대상에 포함되어 있어 부담없이 새로운 제품을 시도해볼 수 있는 기회입니다.",
    tags: ["클린뷰티", "베스트셀러", "스킨케어"],
    image: "https://picsum.photos/seed/maccosmetics-beauty-0/600/600",
    domain: "maccosmetics.com",
    link: "https://www.maccosmetics.com/"
  },
  {
    id: "e012", category: "beauty", brand: "Innisfree",
    title: "스킨케어 리추얼 프로모션", subtitle: "베스트셀러 라인업을 합리적인 가격에",
    discount: "20% OFF", period: "2026.05.13 - 2026.05.28", channel: "온라인 & 오프라인 매장",
    dday: "D-2",
    desc: "Innisfree의 스킨케어 리추얼 프로모션. 베스트셀러 라인업을 합리적인 가격에 대표 인기 제품들이 할인 대상에 포함되어 있어 부담없이 새로운 제품을 시도해볼 수 있는 기회입니다.",
    tags: ["클린뷰티", "스킨케어", "메이크업"],
    image: "https://picsum.photos/seed/innisfree-beauty-1/600/600",
    domain: "innisfree.com",
    link: "https://www.innisfree.com/"
  },
  {
    id: "e013", category: "beauty", brand: "Sulwhasoo",
    title: "베스트셀러 특가전", subtitle: "그린 성분 기반 클린 뷰티 아이템 모음",
    discount: "25% OFF", period: "2026.05.16 - 2026.06.05", channel: "오프라인 매장 전용",
    dday: "D-3",
    desc: "Sulwhasoo의 베스트셀러 특가전. 그린 성분 기반 클린 뷰티 아이템 모음 대표 인기 제품들이 할인 대상에 포함되어 있어 부담없이 새로운 제품을 시도해볼 수 있는 기회입니다.",
    tags: ["메이크업", "스킨케어", "베스트셀러"],
    image: "https://picsum.photos/seed/sulwhasoo-beauty-2/600/600",
    domain: "sulwhasoo.com",
    link: "https://www.sulwhasoo.com/"
  },
  {
    id: "e014", category: "beauty", brand: "Etude",
    title: "클린 뷰티 캠페인", subtitle: "메이크업 필수템을 한자리에서",
    discount: "최대 60% OFF", period: "2026.05.15 - 2026.06.09", channel: "온라인 전용",
    dday: "D-4",
    desc: "Etude의 클린 뷰티 캠페인. 메이크업 필수템을 한자리에서 대표 인기 제품들이 할인 대상에 포함되어 있어 부담없이 새로운 제품을 시도해볼 수 있는 기회입니다.",
    tags: ["클린뷰티", "온라인한정", "스킨케어"],
    image: "https://picsum.photos/seed/etude-beauty-3/600/600",
    domain: "etude.com",
    link: "https://www.etude.com/"
  },
  {
    id: "e015", category: "beauty", brand: "The Face Shop",
    title: "메이크업 앳홈 이벤트", subtitle: "촉촉한 여름 피부를 위한 준비",
    discount: "1+1", period: "2026.05.26 - 2026.06.05", channel: "온라인 & 오프라인 매장",
    dday: "D-5",
    desc: "The Face Shop의 메이크업 앳홈 이벤트. 촉촉한 여름 피부를 위한 준비 대표 인기 제품들이 할인 대상에 포함되어 있어 부담없이 새로운 제품을 시도해볼 수 있는 기회입니다.",
    tags: ["메이크업", "스킨케어", "베스트셀러"],
    image: "https://picsum.photos/seed/thefaceshop-beauty-4/600/600",
    domain: "thefaceshop.com",
    link: "https://www.thefaceshop.com/"
  },
  {
    id: "e016", category: "beauty", brand: "Laneige",
    title: "글로우 뷰티 위크", subtitle: "피부 타입별 맞춤 스킨케어 제안",
    discount: "30% OFF", period: "2026.05.23 - 2026.06.07", channel: "오프라인 매장 전용",
    dday: "D-6",
    desc: "Laneige의 글로우 뷰티 위크. 피부 타입별 맞춤 스킨케어 제안 대표 인기 제품들이 할인 대상에 포함되어 있어 부담없이 새로운 제품을 시도해볼 수 있는 기회입니다.",
    tags: ["스킨케어", "클린뷰티", "메이크업"],
    image: "https://picsum.photos/seed/laneige-beauty-5/600/600",
    domain: "laneige.com",
    link: "https://www.laneige.com/"
  },
  {
    id: "e017", category: "beauty", brand: "Nature Republic",
    title: "스킨케어 리추얼 프로모션", subtitle: "베스트셀러 라인업을 합리적인 가격에",
    discount: "25% OFF", period: "2026.05.04 - 2026.05.24", channel: "온라인 전용",
    dday: "D-7",
    desc: "Nature Republic의 스킨케어 리추얼 프로모션. 베스트셀러 라인업을 합리적인 가격에 대표 인기 제품들이 할인 대상에 포함되어 있어 부담없이 새로운 제품을 시도해볼 수 있는 기회입니다.",
    tags: ["온라인한정", "클린뷰티", "메이크업"],
    image: "https://picsum.photos/seed/naturerepublic-beauty-6/600/600",
    domain: "naturerepublic.com",
    link: "https://www.naturerepublic.com/"
  },
  {
    id: "e018", category: "beauty", brand: "Missha",
    title: "베스트셀러 특가전", subtitle: "그린 성분 기반 클린 뷰티 아이템 모음",
    discount: "35% OFF", period: "2026.05.28 - 2026.06.22", channel: "온라인 & 오프라인 매장",
    dday: "D-8",
    desc: "Missha의 베스트셀러 특가전. 그린 성분 기반 클린 뷰티 아이템 모음 대표 인기 제품들이 할인 대상에 포함되어 있어 부담없이 새로운 제품을 시도해볼 수 있는 기회입니다.",
    tags: ["베스트셀러", "스킨케어", "메이크업"],
    image: "https://picsum.photos/seed/missha-beauty-7/600/600",
    domain: "missha.com",
    link: "https://www.missha.com/"
  },
  {
    id: "e019", category: "beauty", brand: "Clio",
    title: "클린 뷰티 캠페인", subtitle: "메이크업 필수템을 한자리에서",
    discount: "30% OFF", period: "2026.05.29 - 2026.06.08", channel: "오프라인 매장 전용",
    dday: "D-9",
    desc: "Clio의 클린 뷰티 캠페인. 메이크업 필수템을 한자리에서 대표 인기 제품들이 할인 대상에 포함되어 있어 부담없이 새로운 제품을 시도해볼 수 있는 기회입니다.",
    tags: ["베스트셀러", "클린뷰티", "스킨케어"],
    image: "https://picsum.photos/seed/clio-beauty-8/600/600",
    domain: "clio.co.kr",
    link: "https://www.clio.co.kr/"
  },
  {
    id: "e020", category: "beauty", brand: "Tonymoly",
    title: "메이크업 앳홈 이벤트", subtitle: "촉촉한 여름 피부를 위한 준비",
    discount: "1+1", period: "2026.05.06 - 2026.05.21", channel: "온라인 전용",
    dday: "D-10",
    desc: "Tonymoly의 메이크업 앳홈 이벤트. 촉촉한 여름 피부를 위한 준비 대표 인기 제품들이 할인 대상에 포함되어 있어 부담없이 새로운 제품을 시도해볼 수 있는 기회입니다.",
    tags: ["베스트셀러", "스킨케어", "온라인한정"],
    image: "https://picsum.photos/seed/tonymoly-beauty-9/600/600",
    domain: "tonymoly.com",
    link: "https://www.tonymoly.com/"
  },
  {
    id: "e021", category: "food", brand: "Starbucks",
    title: "시즌 음료 프로모션", subtitle: "시원한 시즌 메뉴를 특별한 가격에",
    discount: "최대 70% OFF", period: "2026.05.10 - 2026.05.20", channel: "오프라인 매장 전용",
    dday: "D-1",
    desc: "Starbucks의 시즌 음료 프로모션. 시원한 시즌 메뉴를 특별한 가격에 전국 매장에서 만나볼 수 있으며, 이벤트 기간 내 방문 시 바로 혜택이 적용됩니다.",
    tags: ["디저트", "매장전용", "1+1"],
    image: "https://picsum.photos/seed/starbucks-food-0/600/600",
    domain: "starbucks.com",
    link: "https://www.starbucks.com/"
  },
  {
    id: "e022", category: "food", brand: "Baskin Robbins",
    title: "베이커리 위크 할인전", subtitle: "갓 구운 베이커리를 합리적으로",
    discount: "45% OFF", period: "2026.05.18 - 2026.06.02", channel: "온라인 & 오프라인 매장",
    dday: "D-2",
    desc: "Baskin Robbins의 베이커리 위크 할인전. 갓 구운 베이커리를 합리적으로 전국 매장에서 만나볼 수 있으며, 이벤트 기간 내 방문 시 바로 혜택이 적용됩니다.",
    tags: ["디저트", "베이커리", "매장전용"],
    image: "https://picsum.photos/seed/baskinrobbins-food-1/600/600",
    domain: "baskinrobbins.com",
    link: "https://www.baskinrobbins.com/"
  },
  {
    id: "e023", category: "food", brand: "Paris Baguette",
    title: "디저트 페스타", subtitle: "달콤한 디저트 메뉴 할인 프로모션",
    discount: "50% OFF", period: "2026.05.21 - 2026.06.10", channel: "앱 주문 전용",
    dday: "D-3",
    desc: "Paris Baguette의 디저트 페스타. 달콤한 디저트 메뉴 할인 프로모션 전국 매장에서 만나볼 수 있으며, 이벤트 기간 내 방문 시 바로 혜택이 적용됩니다.",
    tags: ["디저트", "베이커리", "1+1"],
    image: "https://picsum.photos/seed/parisbaguette-food-2/600/600",
    domain: "parisbaguette.com",
    link: "https://www.parisbaguette.com/"
  },
  {
    id: "e024", category: "food", brand: "Tous les Jours",
    title: "모닝 세트 스페셜", subtitle: "바쁜 아침을 위한 든든한 세트 구성",
    discount: "1+1", period: "2026.05.24 - 2026.06.18", channel: "오프라인 매장 전용",
    dday: "D-4",
    desc: "Tous les Jours의 모닝 세트 스페셜. 바쁜 아침을 위한 든든한 세트 구성 전국 매장에서 만나볼 수 있으며, 이벤트 기간 내 방문 시 바로 혜택이 적용됩니다.",
    tags: ["디저트", "시즌메뉴", "1+1"],
    image: "https://picsum.photos/seed/touslesjours-food-3/600/600",
    domain: "touslesjours.com",
    link: "https://www.touslesjours.com/"
  },
  {
    id: "e025", category: "food", brand: "Ediya Coffee",
    title: "여름 시원 메뉴 이벤트", subtitle: "무더위를 날려줄 시원한 메뉴 모음",
    discount: "50% OFF", period: "2026.05.25 - 2026.06.04", channel: "온라인 & 오프라인 매장",
    dday: "D-5",
    desc: "Ediya Coffee의 여름 시원 메뉴 이벤트. 무더위를 날려줄 시원한 메뉴 모음 전국 매장에서 만나볼 수 있으며, 이벤트 기간 내 방문 시 바로 혜택이 적용됩니다.",
    tags: ["베이커리", "1+1", "시즌메뉴"],
    image: "https://picsum.photos/seed/ediya-food-4/600/600",
    domain: "ediya.com",
    link: "https://www.ediya.com/"
  },
  {
    id: "e026", category: "food", brand: "A Twosome Place",
    title: "시즌 음료 프로모션", subtitle: "시원한 시즌 메뉴를 특별한 가격에",
    discount: "20% OFF", period: "2026.05.01 - 2026.05.16", channel: "앱 주문 전용",
    dday: "D-6",
    desc: "A Twosome Place의 시즌 음료 프로모션. 시원한 시즌 메뉴를 특별한 가격에 전국 매장에서 만나볼 수 있으며, 이벤트 기간 내 방문 시 바로 혜택이 적용됩니다.",
    tags: ["매장전용", "1+1", "베이커리"],
    image: "https://picsum.photos/seed/twosome-food-5/600/600",
    domain: "twosome.co.kr",
    link: "https://www.twosome.co.kr/"
  },
  {
    id: "e027", category: "food", brand: "BBQ Chicken",
    title: "베이커리 위크 할인전", subtitle: "갓 구운 베이커리를 합리적으로",
    discount: "1+1", period: "2026.05.30 - 2026.06.19", channel: "오프라인 매장 전용",
    dday: "D-7",
    desc: "BBQ Chicken의 베이커리 위크 할인전. 갓 구운 베이커리를 합리적으로 전국 매장에서 만나볼 수 있으며, 이벤트 기간 내 방문 시 바로 혜택이 적용됩니다.",
    tags: ["1+1", "베이커리", "디저트"],
    image: "https://picsum.photos/seed/bbq-food-6/600/600",
    domain: "bbq.co.kr",
    link: "https://www.bbq.co.kr/"
  },
  {
    id: "e028", category: "food", brand: "Mega Coffee",
    title: "디저트 페스타", subtitle: "달콤한 디저트 메뉴 할인 프로모션",
    discount: "최대 60% OFF", period: "2026.05.03 - 2026.05.28", channel: "온라인 & 오프라인 매장",
    dday: "D-8",
    desc: "Mega Coffee의 디저트 페스타. 달콤한 디저트 메뉴 할인 프로모션 전국 매장에서 만나볼 수 있으며, 이벤트 기간 내 방문 시 바로 혜택이 적용됩니다.",
    tags: ["디저트", "시즌메뉴", "매장전용"],
    image: "https://picsum.photos/seed/megamgccoffee-food-7/600/600",
    domain: "megamgccoffee.com",
    link: "https://www.megamgccoffee.com/"
  },
  {
    id: "e029", category: "food", brand: "Compose Coffee",
    title: "모닝 세트 스페셜", subtitle: "바쁜 아침을 위한 든든한 세트 구성",
    discount: "30% OFF", period: "2026.05.09 - 2026.05.19", channel: "앱 주문 전용",
    dday: "D-9",
    desc: "Compose Coffee의 모닝 세트 스페셜. 바쁜 아침을 위한 든든한 세트 구성 전국 매장에서 만나볼 수 있으며, 이벤트 기간 내 방문 시 바로 혜택이 적용됩니다.",
    tags: ["시즌메뉴", "디저트", "베이커리"],
    image: "https://picsum.photos/seed/composecoffee-food-8/600/600",
    domain: "composecoffee.com",
    link: "https://www.composecoffee.com/"
  },
  {
    id: "e030", category: "food", brand: "Domino's Pizza",
    title: "여름 시원 메뉴 이벤트", subtitle: "무더위를 날려줄 시원한 메뉴 모음",
    discount: "35% OFF", period: "2026.05.12 - 2026.05.27", channel: "오프라인 매장 전용",
    dday: "D-10",
    desc: "Domino's Pizza의 여름 시원 메뉴 이벤트. 무더위를 날려줄 시원한 메뉴 모음 전국 매장에서 만나볼 수 있으며, 이벤트 기간 내 방문 시 바로 혜택이 적용됩니다.",
    tags: ["디저트", "시즌메뉴", "매장전용"],
    image: "https://picsum.photos/seed/dominos-food-9/600/600",
    domain: "dominos.com",
    link: "https://www.dominos.com/"
  },
  {
    id: "e031", category: "tech", brand: "Samsung",
    title: "신제품 런칭 프로모션", subtitle: "최신 기기로 업그레이드할 최적의 타이밍",
    discount: "1+1", period: "2026.05.08 - 2026.05.18", channel: "온라인 & 오프라인 매장",
    dday: "D-1",
    desc: "Samsung의 신제품 런칭 프로모션. 최신 기기로 업그레이드할 최적의 타이밍 공식 스토어와 주요 매장에서 동시에 진행되는 프로모션입니다.",
    tags: ["번들할인", "가전", "신제품"],
    image: "https://picsum.photos/seed/samsung-tech-0/600/600",
    domain: "samsung.com",
    link: "https://www.samsung.com/"
  },
  {
    id: "e032", category: "tech", brand: "Apple",
    title: "보상판매 업그레이드 이벤트", subtitle: "기존 기기 반납 시 추가 할인 혜택",
    discount: "50% OFF", period: "2026.05.09 - 2026.05.24", channel: "온라인 전용",
    dday: "D-2",
    desc: "Apple의 보상판매 업그레이드 이벤트. 기존 기기 반납 시 추가 할인 혜택 공식 스토어와 주요 매장에서 동시에 진행되는 프로모션입니다.",
    tags: ["오디오", "번들할인", "가전"],
    image: "https://picsum.photos/seed/apple-tech-1/600/600",
    domain: "apple.com",
    link: "https://www.apple.com/"
  },
  {
    id: "e033", category: "tech", brand: "LG Electronics",
    title: "홈 가전 리프레시 위크", subtitle: "여름철 필수 가전을 합리적인 가격에",
    discount: "50% OFF", period: "2026.05.21 - 2026.06.10", channel: "공식 스토어 전용",
    dday: "D-3",
    desc: "LG Electronics의 홈 가전 리프레시 위크. 여름철 필수 가전을 합리적인 가격에 공식 스토어와 주요 매장에서 동시에 진행되는 프로모션입니다.",
    tags: ["오디오", "보상판매", "번들할인"],
    image: "https://picsum.photos/seed/lg-tech-2/600/600",
    domain: "lg.com",
    link: "https://www.lg.com/"
  },
  {
    id: "e034", category: "tech", brand: "Xiaomi",
    title: "오디오 사운드 페스타", subtitle: "몰입감 넘치는 사운드 경험을 위한 준비",
    discount: "최대 70% OFF", period: "2026.05.16 - 2026.06.10", channel: "온라인 & 오프라인 매장",
    dday: "D-4",
    desc: "Xiaomi의 오디오 사운드 페스타. 몰입감 넘치는 사운드 경험을 위한 준비 공식 스토어와 주요 매장에서 동시에 진행되는 프로모션입니다.",
    tags: ["보상판매", "번들할인", "가전"],
    image: "https://picsum.photos/seed/mi-tech-3/600/600",
    domain: "mi.com",
    link: "https://www.mi.com/"
  },
  {
    id: "e035", category: "tech", brand: "Sony",
    title: "액세서리 번들 할인전", subtitle: "필수 액세서리를 한번에 구성해보세요",
    discount: "최대 60% OFF", period: "2026.05.17 - 2026.05.27", channel: "온라인 전용",
    dday: "D-5",
    desc: "Sony의 액세서리 번들 할인전. 필수 액세서리를 한번에 구성해보세요 공식 스토어와 주요 매장에서 동시에 진행되는 프로모션입니다.",
    tags: ["번들할인", "가전", "오디오"],
    image: "https://picsum.photos/seed/sony-tech-4/600/600",
    domain: "sony.com",
    link: "https://www.sony.com/"
  },
  {
    id: "e036", category: "tech", brand: "Dyson",
    title: "신제품 런칭 프로모션", subtitle: "최신 기기로 업그레이드할 최적의 타이밍",
    discount: "20% OFF", period: "2026.05.21 - 2026.06.05", channel: "공식 스토어 전용",
    dday: "D-6",
    desc: "Dyson의 신제품 런칭 프로모션. 최신 기기로 업그레이드할 최적의 타이밍 공식 스토어와 주요 매장에서 동시에 진행되는 프로모션입니다.",
    tags: ["번들할인", "오디오", "가전"],
    image: "https://picsum.photos/seed/dyson-tech-5/600/600",
    domain: "dyson.com",
    link: "https://www.dyson.com/"
  },
  {
    id: "e037", category: "tech", brand: "Bose",
    title: "보상판매 업그레이드 이벤트", subtitle: "기존 기기 반납 시 추가 할인 혜택",
    discount: "20% OFF", period: "2026.05.23 - 2026.06.12", channel: "온라인 & 오프라인 매장",
    dday: "D-7",
    desc: "Bose의 보상판매 업그레이드 이벤트. 기존 기기 반납 시 추가 할인 혜택 공식 스토어와 주요 매장에서 동시에 진행되는 프로모션입니다.",
    tags: ["오디오", "가전", "신제품"],
    image: "https://picsum.photos/seed/bose-tech-6/600/600",
    domain: "bose.com",
    link: "https://www.bose.com/"
  },
  {
    id: "e038", category: "tech", brand: "JBL",
    title: "홈 가전 리프레시 위크", subtitle: "여름철 필수 가전을 합리적인 가격에",
    discount: "20% OFF", period: "2026.05.25 - 2026.06.19", channel: "온라인 전용",
    dday: "D-8",
    desc: "JBL의 홈 가전 리프레시 위크. 여름철 필수 가전을 합리적인 가격에 공식 스토어와 주요 매장에서 동시에 진행되는 프로모션입니다.",
    tags: ["보상판매", "오디오", "신제품"],
    image: "https://picsum.photos/seed/jbl-tech-7/600/600",
    domain: "jbl.com",
    link: "https://www.jbl.com/"
  },
  {
    id: "e039", category: "tech", brand: "Logitech",
    title: "오디오 사운드 페스타", subtitle: "몰입감 넘치는 사운드 경험을 위한 준비",
    discount: "50% OFF", period: "2026.05.03 - 2026.05.13", channel: "공식 스토어 전용",
    dday: "D-9",
    desc: "Logitech의 오디오 사운드 페스타. 몰입감 넘치는 사운드 경험을 위한 준비 공식 스토어와 주요 매장에서 동시에 진행되는 프로모션입니다.",
    tags: ["신제품", "번들할인", "오디오"],
    image: "https://picsum.photos/seed/logitech-tech-8/600/600",
    domain: "logitech.com",
    link: "https://www.logitech.com/"
  },
  {
    id: "e040", category: "tech", brand: "Anker",
    title: "액세서리 번들 할인전", subtitle: "필수 액세서리를 한번에 구성해보세요",
    discount: "40% OFF", period: "2026.05.03 - 2026.05.18", channel: "온라인 & 오프라인 매장",
    dday: "D-10",
    desc: "Anker의 액세서리 번들 할인전. 필수 액세서리를 한번에 구성해보세요 공식 스토어와 주요 매장에서 동시에 진행되는 프로모션입니다.",
    tags: ["보상판매", "오디오", "가전"],
    image: "https://picsum.photos/seed/anker-tech-9/600/600",
    domain: "anker.com",
    link: "https://www.anker.com/"
  },
  {
    id: "e041", category: "delivery", brand: "배달의민족",
    title: "첫 주문 할인 쿠폰", subtitle: "신규 및 복귀 고객을 위한 특별 혜택",
    discount: "45% OFF", period: "2026.05.06 - 2026.05.16", channel: "앱 전용",
    dday: "D-1",
    desc: "배달의민족의 첫 주문 할인 쿠폰. 신규 및 복귀 고객을 위한 특별 혜택 앱에서 쿠폰함을 확인하면 바로 적용 가능합니다.",
    tags: ["첫주문", "신메뉴", "런치타임"],
    image: "https://picsum.photos/seed/baemin-delivery-0/600/600",
    domain: "baemin.com",
    link: "https://www.baemin.com/"
  },
  {
    id: "e042", category: "delivery", brand: "요기요",
    title: "런치 타임 특가", subtitle: "점심시간 한정 할인 쿠폰 제공",
    discount: "40% OFF", period: "2026.05.07 - 2026.05.22", channel: "앱 & 웹",
    dday: "D-2",
    desc: "요기요의 런치 타임 특가. 점심시간 한정 할인 쿠폰 제공 앱에서 쿠폰함을 확인하면 바로 적용 가능합니다.",
    tags: ["단골혜택", "신메뉴", "배달비무료"],
    image: "https://picsum.photos/seed/yogiyo-delivery-1/600/600",
    domain: "yogiyo.co.kr",
    link: "https://www.yogiyo.co.kr/"
  },
  {
    id: "e043", category: "delivery", brand: "쿠팡이츠",
    title: "주말 배달비 무료 이벤트", subtitle: "주말 동안 배달비 부담 없이 주문",
    discount: "50% OFF", period: "2026.05.11 - 2026.05.31", channel: "앱 주문 전용",
    dday: "D-3",
    desc: "쿠팡이츠의 주말 배달비 무료 이벤트. 주말 동안 배달비 부담 없이 주문 앱에서 쿠폰함을 확인하면 바로 적용 가능합니다.",
    tags: ["배달비무료", "첫주문", "단골혜택"],
    image: "https://picsum.photos/seed/coupangeats-delivery-2/600/600",
    domain: "coupangeats.com",
    link: "https://www.coupangeats.com/"
  },
  {
    id: "e044", category: "delivery", brand: "Domino's Pizza",
    title: "신메뉴 출시 기념 할인", subtitle: "새로 출시된 메뉴를 할인가에 맛보세요",
    discount: "1+1", period: "2026.05.24 - 2026.06.18", channel: "앱 전용",
    dday: "D-4",
    desc: "Domino's Pizza의 신메뉴 출시 기념 할인. 새로 출시된 메뉴를 할인가에 맛보세요 앱에서 쿠폰함을 확인하면 바로 적용 가능합니다.",
    tags: ["첫주문", "배달비무료", "신메뉴"],
    image: "https://picsum.photos/seed/dominos-delivery-3/600/600",
    domain: "dominos.co.kr",
    link: "https://www.dominos.co.kr/"
  },
  {
    id: "e045", category: "delivery", brand: "Pizza Hut",
    title: "단골 고객 감사 프로모션", subtitle: "자주 이용해주신 고객님께 드리는 혜택",
    discount: "35% OFF", period: "2026.05.22 - 2026.06.01", channel: "앱 & 웹",
    dday: "D-5",
    desc: "Pizza Hut의 단골 고객 감사 프로모션. 자주 이용해주신 고객님께 드리는 혜택 앱에서 쿠폰함을 확인하면 바로 적용 가능합니다.",
    tags: ["배달비무료", "첫주문", "런치타임"],
    image: "https://picsum.photos/seed/pizzahut-delivery-4/600/600",
    domain: "pizzahut.co.kr",
    link: "https://www.pizzahut.co.kr/"
  },
  {
    id: "e046", category: "delivery", brand: "Mister Pizza",
    title: "첫 주문 할인 쿠폰", subtitle: "신규 및 복귀 고객을 위한 특별 혜택",
    discount: "1+1", period: "2026.05.28 - 2026.06.12", channel: "앱 주문 전용",
    dday: "D-6",
    desc: "Mister Pizza의 첫 주문 할인 쿠폰. 신규 및 복귀 고객을 위한 특별 혜택 앱에서 쿠폰함을 확인하면 바로 적용 가능합니다.",
    tags: ["신메뉴", "런치타임", "단골혜택"],
    image: "https://picsum.photos/seed/misterpizza-delivery-5/600/600",
    domain: "misterpizza.com",
    link: "https://www.misterpizza.com/"
  },
  {
    id: "e047", category: "delivery", brand: "bhc치킨",
    title: "런치 타임 특가", subtitle: "점심시간 한정 할인 쿠폰 제공",
    discount: "25% OFF", period: "2026.05.24 - 2026.06.13", channel: "앱 전용",
    dday: "D-7",
    desc: "bhc치킨의 런치 타임 특가. 점심시간 한정 할인 쿠폰 제공 앱에서 쿠폰함을 확인하면 바로 적용 가능합니다.",
    tags: ["첫주문", "배달비무료", "신메뉴"],
    image: "https://picsum.photos/seed/bhc-delivery-6/600/600",
    domain: "bhc.co.kr",
    link: "https://www.bhc.co.kr/"
  },
  {
    id: "e048", category: "delivery", brand: "교촌치킨",
    title: "주말 배달비 무료 이벤트", subtitle: "주말 동안 배달비 부담 없이 주문",
    discount: "25% OFF", period: "2026.05.26 - 2026.06.20", channel: "앱 & 웹",
    dday: "D-8",
    desc: "교촌치킨의 주말 배달비 무료 이벤트. 주말 동안 배달비 부담 없이 주문 앱에서 쿠폰함을 확인하면 바로 적용 가능합니다.",
    tags: ["런치타임", "첫주문", "배달비무료"],
    image: "https://picsum.photos/seed/kyochon-delivery-7/600/600",
    domain: "kyochon.com",
    link: "https://www.kyochon.com/"
  },
  {
    id: "e049", category: "delivery", brand: "네네치킨",
    title: "신메뉴 출시 기념 할인", subtitle: "새로 출시된 메뉴를 할인가에 맛보세요",
    discount: "30% OFF", period: "2026.05.29 - 2026.06.08", channel: "앱 주문 전용",
    dday: "D-9",
    desc: "네네치킨의 신메뉴 출시 기념 할인. 새로 출시된 메뉴를 할인가에 맛보세요 앱에서 쿠폰함을 확인하면 바로 적용 가능합니다.",
    tags: ["배달비무료", "런치타임", "첫주문"],
    image: "https://picsum.photos/seed/nenechicken-delivery-8/600/600",
    domain: "nenechicken.com",
    link: "https://www.nenechicken.com/"
  },
  {
    id: "e050", category: "delivery", brand: "굽네치킨",
    title: "단골 고객 감사 프로모션", subtitle: "자주 이용해주신 고객님께 드리는 혜택",
    discount: "35% OFF", period: "2026.05.02 - 2026.05.17", channel: "앱 전용",
    dday: "D-10",
    desc: "굽네치킨의 단골 고객 감사 프로모션. 자주 이용해주신 고객님께 드리는 혜택 앱에서 쿠폰함을 확인하면 바로 적용 가능합니다.",
    tags: ["배달비무료", "런치타임", "단골혜택"],
    image: "https://picsum.photos/seed/goobne-delivery-9/600/600",
    domain: "goobne.co.kr",
    link: "https://www.goobne.co.kr/"
  },
  {
    id: "e051", category: "stay", brand: "야놀자",
    title: "얼리버드 예약 특가", subtitle: "조기 예약 시 더 큰 폭의 할인 혜택",
    discount: "35% OFF", period: "2026.05.04 - 2026.05.14", channel: "앱 & 웹",
    dday: "D-1",
    desc: "야놀자의 얼리버드 예약 특가. 조기 예약 시 더 큰 폭의 할인 혜택 인기 숙소는 마감이 빠르니 서둘러 예약하는 것을 추천드립니다.",
    tags: ["특가위크", "얼리버드", "스테이케이션"],
    image: "https://picsum.photos/seed/yanolja-stay-0/600/600",
    domain: "yanolja.com",
    link: "https://www.yanolja.com/"
  },
  {
    id: "e052", category: "stay", brand: "Agoda",
    title: "여름휴가 프로모션", subtitle: "여름 휴가철을 위한 인기 숙소 모음",
    discount: "50% OFF", period: "2026.05.09 - 2026.05.24", channel: "앱 전용",
    dday: "D-2",
    desc: "Agoda의 여름휴가 프로모션. 여름 휴가철을 위한 인기 숙소 모음 인기 숙소는 마감이 빠르니 서둘러 예약하는 것을 추천드립니다.",
    tags: ["스테이케이션", "장기숙박", "얼리버드"],
    image: "https://picsum.photos/seed/agoda-stay-1/600/600",
    domain: "agoda.com",
    link: "https://www.agoda.com/"
  },
  {
    id: "e053", category: "stay", brand: "Booking.com",
    title: "주말 스테이케이션 할인", subtitle: "가까운 곳에서 즐기는 힐링 스테이",
    discount: "35% OFF", period: "2026.05.18 - 2026.06.07", channel: "웹 전용",
    dday: "D-3",
    desc: "Booking.com의 주말 스테이케이션 할인. 가까운 곳에서 즐기는 힐링 스테이 인기 숙소는 마감이 빠르니 서둘러 예약하는 것을 추천드립니다.",
    tags: ["얼리버드", "스테이케이션", "여름휴가"],
    image: "https://picsum.photos/seed/booking-stay-2/600/600",
    domain: "booking.com",
    link: "https://www.booking.com/"
  },
  {
    id: "e054", category: "stay", brand: "Hotels.com",
    title: "장기 숙박 할인 이벤트", subtitle: "3박 이상 예약 시 추가 할인 제공",
    discount: "35% OFF", period: "2026.05.20 - 2026.06.14", channel: "앱 & 웹",
    dday: "D-4",
    desc: "Hotels.com의 장기 숙박 할인 이벤트. 3박 이상 예약 시 추가 할인 제공 인기 숙소는 마감이 빠르니 서둘러 예약하는 것을 추천드립니다.",
    tags: ["여름휴가", "얼리버드", "장기숙박"],
    image: "https://picsum.photos/seed/hotels-stay-3/600/600",
    domain: "hotels.com",
    link: "https://www.hotels.com/"
  },
  {
    id: "e055", category: "stay", brand: "Airbnb",
    title: "국내외 숙소 특가 위크", subtitle: "인기 여행지 숙소를 특가로 만나보세요",
    discount: "20% OFF", period: "2026.05.19 - 2026.05.29", channel: "앱 전용",
    dday: "D-5",
    desc: "Airbnb의 국내외 숙소 특가 위크. 인기 여행지 숙소를 특가로 만나보세요 인기 숙소는 마감이 빠르니 서둘러 예약하는 것을 추천드립니다.",
    tags: ["특가위크", "얼리버드", "장기숙박"],
    image: "https://picsum.photos/seed/airbnb-stay-4/600/600",
    domain: "airbnb.com",
    link: "https://www.airbnb.com/"
  },
  {
    id: "e056", category: "stay", brand: "여기어때",
    title: "얼리버드 예약 특가", subtitle: "조기 예약 시 더 큰 폭의 할인 혜택",
    discount: "최대 70% OFF", period: "2026.05.20 - 2026.06.04", channel: "웹 전용",
    dday: "D-6",
    desc: "여기어때의 얼리버드 예약 특가. 조기 예약 시 더 큰 폭의 할인 혜택 인기 숙소는 마감이 빠르니 서둘러 예약하는 것을 추천드립니다.",
    tags: ["장기숙박", "얼리버드", "스테이케이션"],
    image: "https://picsum.photos/seed/goodchoice-stay-5/600/600",
    domain: "goodchoice.kr",
    link: "https://www.goodchoice.kr/"
  },
  {
    id: "e057", category: "stay", brand: "Marriott",
    title: "여름휴가 프로모션", subtitle: "여름 휴가철을 위한 인기 숙소 모음",
    discount: "40% OFF", period: "2026.05.27 - 2026.06.16", channel: "앱 & 웹",
    dday: "D-7",
    desc: "Marriott의 여름휴가 프로모션. 여름 휴가철을 위한 인기 숙소 모음 인기 숙소는 마감이 빠르니 서둘러 예약하는 것을 추천드립니다.",
    tags: ["여름휴가", "특가위크", "스테이케이션"],
    image: "https://picsum.photos/seed/marriott-stay-6/600/600",
    domain: "marriott.com",
    link: "https://www.marriott.com/"
  },
  {
    id: "e058", category: "stay", brand: "Hilton",
    title: "주말 스테이케이션 할인", subtitle: "가까운 곳에서 즐기는 힐링 스테이",
    discount: "35% OFF", period: "2026.05.28 - 2026.06.22", channel: "앱 전용",
    dday: "D-8",
    desc: "Hilton의 주말 스테이케이션 할인. 가까운 곳에서 즐기는 힐링 스테이 인기 숙소는 마감이 빠르니 서둘러 예약하는 것을 추천드립니다.",
    tags: ["장기숙박", "여름휴가", "특가위크"],
    image: "https://picsum.photos/seed/hilton-stay-7/600/600",
    domain: "hilton.com",
    link: "https://www.hilton.com/"
  },
  {
    id: "e059", category: "stay", brand: "Expedia",
    title: "장기 숙박 할인 이벤트", subtitle: "3박 이상 예약 시 추가 할인 제공",
    discount: "45% OFF", period: "2026.05.02 - 2026.05.12", channel: "웹 전용",
    dday: "D-9",
    desc: "Expedia의 장기 숙박 할인 이벤트. 3박 이상 예약 시 추가 할인 제공 인기 숙소는 마감이 빠르니 서둘러 예약하는 것을 추천드립니다.",
    tags: ["특가위크", "장기숙박", "얼리버드"],
    image: "https://picsum.photos/seed/expedia-stay-8/600/600",
    domain: "expedia.com",
    link: "https://www.expedia.com/"
  },
  {
    id: "e060", category: "stay", brand: "Trip.com",
    title: "국내외 숙소 특가 위크", subtitle: "인기 여행지 숙소를 특가로 만나보세요",
    discount: "1+1", period: "2026.05.06 - 2026.05.21", channel: "앱 & 웹",
    dday: "D-10",
    desc: "Trip.com의 국내외 숙소 특가 위크. 인기 여행지 숙소를 특가로 만나보세요 인기 숙소는 마감이 빠르니 서둘러 예약하는 것을 추천드립니다.",
    tags: ["특가위크", "여름휴가", "스테이케이션"],
    image: "https://picsum.photos/seed/trip-stay-9/600/600",
    domain: "trip.com",
    link: "https://www.trip.com/"
  },
  {
    id: "e061", category: "living", brand: "IKEA",
    title: "홈코디 리뉴얼 위크", subtitle: "계절이 바뀌는 지금, 홈 인테리어 리프레시",
    discount: "40% OFF", period: "2026.05.05 - 2026.05.15", channel: "온라인 & 오프라인 매장",
    dday: "D-1",
    desc: "IKEA의 홈코디 리뉴얼 위크. 계절이 바뀌는 지금, 홈 인테리어 리프레시 매장 방문 시 무료 스타일링 상담도 함께 제공됩니다.",
    tags: ["수납가구", "미니멀", "홈스타일링"],
    image: "https://picsum.photos/seed/ikea-living-0/600/600",
    domain: "ikea.com",
    link: "https://www.ikea.com/"
  },
  {
    id: "e062", category: "living", brand: "무인양품",
    title: "침구 & 매트리스 특가전", subtitle: "숙면을 위한 침구류를 합리적인 가격에",
    discount: "45% OFF", period: "2026.05.08 - 2026.05.23", channel: "온라인 전용",
    dday: "D-2",
    desc: "무인양품의 침구 & 매트리스 특가전. 숙면을 위한 침구류를 합리적인 가격에 매장 방문 시 무료 스타일링 상담도 함께 제공됩니다.",
    tags: ["수납가구", "미니멀", "홈스타일링"],
    image: "https://picsum.photos/seed/muji-living-1/600/600",
    domain: "muji.com",
    link: "https://www.muji.com/"
  },
  {
    id: "e063", category: "living", brand: "현대리바트",
    title: "수납가구 할인 이벤트", subtitle: "정리정돈을 위한 수납가구 모음",
    discount: "1+1", period: "2026.05.12 - 2026.06.01", channel: "오프라인 매장 전용",
    dday: "D-3",
    desc: "현대리바트의 수납가구 할인 이벤트. 정리정돈을 위한 수납가구 모음 매장 방문 시 무료 스타일링 상담도 함께 제공됩니다.",
    tags: ["미니멀", "홈데코", "홈스타일링"],
    image: "https://picsum.photos/seed/hyundailivart-living-2/600/600",
    domain: "hyundailivart.co.kr",
    link: "https://www.hyundailivart.co.kr/"
  },
  {
    id: "e064", category: "living", brand: "에이스침대",
    title: "미니멀 라이프 캠페인", subtitle: "심플하고 실용적인 라이프스타일 제안",
    discount: "최대 60% OFF", period: "2026.05.15 - 2026.06.09", channel: "온라인 & 오프라인 매장",
    dday: "D-4",
    desc: "에이스침대의 미니멀 라이프 캠페인. 심플하고 실용적인 라이프스타일 제안 매장 방문 시 무료 스타일링 상담도 함께 제공됩니다.",
    tags: ["침구", "홈데코", "홈스타일링"],
    image: "https://picsum.photos/seed/acebed-living-3/600/600",
    domain: "acebed.com",
    link: "https://www.acebed.com/"
  },
  {
    id: "e065", category: "living", brand: "Zara Home",
    title: "웰컴 홈 스타일링 프로모션", subtitle: "신혼집·자취방 스타일링에 필요한 아이템",
    discount: "35% OFF", period: "2026.05.22 - 2026.06.01", channel: "온라인 전용",
    dday: "D-5",
    desc: "Zara Home의 웰컴 홈 스타일링 프로모션. 신혼집·자취방 스타일링에 필요한 아이템 매장 방문 시 무료 스타일링 상담도 함께 제공됩니다.",
    tags: ["홈데코", "침구", "수납가구"],
    image: "https://picsum.photos/seed/zarahome-living-4/600/600",
    domain: "zarahome.com",
    link: "https://www.zarahome.com/"
  },
  {
    id: "e066", category: "living", brand: "Nitori",
    title: "홈코디 리뉴얼 위크", subtitle: "계절이 바뀌는 지금, 홈 인테리어 리프레시",
    discount: "25% OFF", period: "2026.05.22 - 2026.06.06", channel: "오프라인 매장 전용",
    dday: "D-6",
    desc: "Nitori의 홈코디 리뉴얼 위크. 계절이 바뀌는 지금, 홈 인테리어 리프레시 매장 방문 시 무료 스타일링 상담도 함께 제공됩니다.",
    tags: ["침구", "홈데코", "미니멀"],
    image: "https://picsum.photos/seed/nitori-net-living-5/600/600",
    domain: "nitori-net.jp",
    link: "https://www.nitori-net.jp/"
  },
  {
    id: "e067", category: "living", brand: "한샘",
    title: "침구 & 매트리스 특가전", subtitle: "숙면을 위한 침구류를 합리적인 가격에",
    discount: "최대 60% OFF", period: "2026.05.21 - 2026.06.10", channel: "온라인 & 오프라인 매장",
    dday: "D-7",
    desc: "한샘의 침구 & 매트리스 특가전. 숙면을 위한 침구류를 합리적인 가격에 매장 방문 시 무료 스타일링 상담도 함께 제공됩니다.",
    tags: ["홈데코", "침구", "홈스타일링"],
    image: "https://picsum.photos/seed/hanssem-living-6/600/600",
    domain: "hanssem.com",
    link: "https://www.hanssem.com/"
  },
  {
    id: "e068", category: "living", brand: "Tempur",
    title: "수납가구 할인 이벤트", subtitle: "정리정돈을 위한 수납가구 모음",
    discount: "35% OFF", period: "2026.05.28 - 2026.06.22", channel: "온라인 전용",
    dday: "D-8",
    desc: "Tempur의 수납가구 할인 이벤트. 정리정돈을 위한 수납가구 모음 매장 방문 시 무료 스타일링 상담도 함께 제공됩니다.",
    tags: ["홈데코", "수납가구", "홈스타일링"],
    image: "https://picsum.photos/seed/tempur-living-7/600/600",
    domain: "tempur.com",
    link: "https://www.tempur.com/"
  },
  {
    id: "e069", category: "living", brand: "Casper",
    title: "미니멀 라이프 캠페인", subtitle: "심플하고 실용적인 라이프스타일 제안",
    discount: "40% OFF", period: "2026.05.01 - 2026.05.11", channel: "오프라인 매장 전용",
    dday: "D-9",
    desc: "Casper의 미니멀 라이프 캠페인. 심플하고 실용적인 라이프스타일 제안 매장 방문 시 무료 스타일링 상담도 함께 제공됩니다.",
    tags: ["홈스타일링", "침구", "미니멀"],
    image: "https://picsum.photos/seed/casper-living-8/600/600",
    domain: "casper.com",
    link: "https://www.casper.com/"
  },
  {
    id: "e070", category: "living", brand: "코웨이",
    title: "웰컴 홈 스타일링 프로모션", subtitle: "신혼집·자취방 스타일링에 필요한 아이템",
    discount: "30% OFF", period: "2026.05.01 - 2026.05.16", channel: "온라인 & 오프라인 매장",
    dday: "D-10",
    desc: "코웨이의 웰컴 홈 스타일링 프로모션. 신혼집·자취방 스타일링에 필요한 아이템 매장 방문 시 무료 스타일링 상담도 함께 제공됩니다.",
    tags: ["미니멀", "침구", "수납가구"],
    image: "https://picsum.photos/seed/coway-living-9/600/600",
    domain: "coway.com",
    link: "https://www.coway.com/"
  },
];

/* ---------- State ---------- */
let currentCategory = "all";
let likedEvents = new Set();

/* ---------- Real Brand Logo Helper ----------
   Fetches each brand's actual logo straight from their real company domain
   using Hunter's free Logo API (https://logos.hunter.io/{domain}) — a
   no-key, no-signup service that returns each company's real logo image.
   (Note: Clearbit's old logo.clearbit.com API, commonly used for this,
   was permanently shut down in Dec 2025 — this is its direct successor.)

   Because logo availability can vary per domain, attachLogoFallback wires
   up a 2-step safety net so the layout never breaks:
     1) Hunter logo API (real logo)
     2) Google's favicon service for that domain (real site icon)
     3) A clean initials badge, generated from the brand name, as a last resort */
function getLogoUrl(domain) {
  return `https://logos.hunter.io/${domain}`;
}

function getFaviconFallbackUrl(domain) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

function attachLogoFallback(imgEl, brandName, domain) {
  imgEl.addEventListener("error", () => {
    const stage = imgEl.dataset.fallbackStage || "0";
    if (stage === "0" && domain) {
      imgEl.dataset.fallbackStage = "1";
      imgEl.src = getFaviconFallbackUrl(domain);
    } else {
      const initial = brandName.trim().charAt(0).toUpperCase();
      imgEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&background=FF6F00&color=fff&bold=true&size=128`;
    }
  });
}

/* ---------- Utilities ---------- */
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 2200);
}

function getCategoryLabel(id) {
  const cat = CATEGORIES.find(c => c.id === id);
  return cat ? cat.label : "";
}

/* ---------- Render: Category Tabs ---------- */
function renderCategoryTabs() {
  const nav = document.getElementById("categoryTabs");
  nav.innerHTML = CATEGORIES.map(cat => `
    <button class="tab-pill ${cat.id === currentCategory ? "active" : ""}" data-cat="${cat.id}">
      <span class="tab-emoji">${cat.emoji}</span>${cat.label}
    </button>
  `).join("");

  nav.querySelectorAll(".tab-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      currentCategory = btn.dataset.cat;
      renderCategoryTabs();
      renderFeed();
    });
  });
}

/* ---------- Render: Ranking (random top 5) ---------- */
function renderRanking() {
  const list = document.getElementById("rankingList");
  const rankedEvents = shuffleArray(EVENTS).slice(0, 5);

  list.innerHTML = rankedEvents.map((ev, idx) => `
    <li class="rank-item" data-id="${ev.id}">
      <span class="rank-num">${idx + 1}</span>
      <img class="rank-logo" data-domain="${ev.domain}" data-brand="${ev.brand}" src="${getLogoUrl(ev.domain)}" alt="${ev.brand} 로고">
      <div class="rank-info">
        <p class="rank-brand">${ev.brand}</p>
        <p class="rank-title">${ev.title}</p>
      </div>
      <span class="rank-discount">${ev.discount}</span>
    </li>
  `).join("");

  list.querySelectorAll(".rank-item").forEach(item => {
    item.addEventListener("click", () => openSheet(item.dataset.id));
  });

  list.querySelectorAll(".rank-logo").forEach(img => attachLogoFallback(img, img.dataset.brand, img.dataset.domain));
}

/* ---------- Render: Feed Grid ---------- */
function renderFeed() {
  const grid = document.getElementById("feedGrid");
  const title = document.getElementById("feedTitle");
  const count = document.getElementById("feedCount");

  const filtered = currentCategory === "all"
    ? EVENTS
    : EVENTS.filter(ev => ev.category === currentCategory);

  title.textContent = currentCategory === "all" ? "전체 이벤트" : `${getCategoryLabel(currentCategory)} 이벤트`;
  count.textContent = `${filtered.length}개`;

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state">아직 등록된 이벤트가 없어요.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(ev => `
    <div class="event-card" data-id="${ev.id}">
      <div class="card-media">
        <img class="card-photo" src="${ev.image}" alt="${ev.title}" loading="lazy">
        <span class="card-logo-badge">
          <img data-domain="${ev.domain}" data-brand="${ev.brand}" src="${getLogoUrl(ev.domain)}" alt="${ev.brand} 로고">
        </span>
        <span class="card-discount">${ev.discount}</span>
        <span class="card-dday">${ev.dday}</span>
      </div>
      <div class="card-body">
        <p class="card-brand-name">${ev.brand}</p>
        <p class="card-title">${ev.title}</p>
        <p class="card-sub">${ev.subtitle}</p>
        <p class="card-meta">📍 ${ev.channel}</p>
      </div>
    </div>
  `).join("");

  grid.querySelectorAll(".event-card").forEach(card => {
    card.addEventListener("click", () => openSheet(card.dataset.id));
  });

  grid.querySelectorAll(".card-logo-badge img").forEach(img => attachLogoFallback(img, img.dataset.brand, img.dataset.domain));
}

/* ---------- Bottom Sheet Modal ---------- */
const sheetOverlay = document.getElementById("sheetOverlay");
let activeEventId = null;

function openSheet(eventId) {
  const ev = EVENTS.find(e => e.id === eventId);
  if (!ev) return;
  activeEventId = eventId;

  document.getElementById("sheetImage").src = ev.image;
  document.getElementById("sheetImage").alt = ev.title;
  const sheetLogoEl = document.getElementById("sheetBrandLogo");
  sheetLogoEl.src = getLogoUrl(ev.domain);
  sheetLogoEl.alt = `${ev.brand} 로고`;
  attachLogoFallback(sheetLogoEl, ev.brand, ev.domain);
  document.getElementById("sheetSubtitle").textContent = `${ev.brand} · ${getCategoryLabel(ev.category)}`;
  document.getElementById("sheetTitle").textContent = ev.title;
  document.getElementById("sheetDiscount").textContent = ev.discount;
  document.getElementById("sheetPeriod").textContent = ev.period;
  document.getElementById("sheetChannel").textContent = ev.channel;
  document.getElementById("sheetDesc").textContent = ev.desc;
  document.getElementById("sheetTags").innerHTML = ev.tags.map(t => `<span class="sheet-tag">#${t}</span>`).join("");
  document.getElementById("visitBtn").href = ev.link;

  updateLikeButton();

  sheetOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeSheet() {
  sheetOverlay.classList.remove("open");
  document.body.style.overflow = "";
  activeEventId = null;
}

function updateLikeButton() {
  const likeBtn = document.getElementById("likeBtn");
  const likeIcon = document.getElementById("likeIcon");
  const likeText = document.getElementById("likeText");
  const isLiked = likedEvents.has(activeEventId);

  likeBtn.classList.toggle("liked", isLiked);
  likeIcon.textContent = isLiked ? "♥" : "♡";
  likeText.textContent = isLiked ? "관심 이벤트로 등록됨" : "관심 이벤트로 등록하기";
}

document.getElementById("sheetClose").addEventListener("click", closeSheet);
sheetOverlay.addEventListener("click", (e) => {
  if (e.target === sheetOverlay) closeSheet();
});

document.getElementById("likeBtn").addEventListener("click", () => {
  if (!activeEventId) return;
  if (likedEvents.has(activeEventId)) {
    likedEvents.delete(activeEventId);
    showToast("관심 이벤트에서 삭제되었습니다");
  } else {
    likedEvents.add(activeEventId);
    showToast("관심 이벤트로 등록되었습니다 ❤");
  }
  updateLikeButton();
});

document.getElementById("downloadBtn").addEventListener("click", () => {
  const ev = EVENTS.find(e => e.id === activeEventId);
  showToast(`${ev ? ev.brand + " " : ""}쿠폰이 다운로드되었습니다 🎉`);
});

/* ---------- AI Recommendation ---------- */
const AI_RESPONSES = [
  "입력하신 키워드를 분석해 관련도 높은 이벤트를 상단에 정렬했어요.",
  "취향에 맞는 브랜드 혜택을 찾았어요! 아래 랭킹과 피드를 확인해보세요.",
  "AI가 유사 관심사를 가진 사용자들이 많이 저장한 이벤트를 우선 추천했어요.",
  "입력하신 내용과 가장 잘 맞는 카테고리로 피드를 정렬했어요.",
];

// ✅ 이 코드로 교체하세요
document.getElementById("aiRecommendBtn").addEventListener("click", async () => {
  const input = document.getElementById("aiInput").value.trim();
  const resultEl = document.getElementById("aiResult");
  const btn = document.getElementById("aiRecommendBtn");

  // ── 예외처리 1: 빈 입력값 ──────────────────────────
  if (!input) {
    resultEl.hidden = false;
    resultEl.textContent = "⚠️ 추천받고 싶은 브랜드나 상황을 입력해주세요!";
    resultEl.style.color = "#E53E3E";
    return;
  }

  // ── 예외처리 2: 로딩 상태 표시 ────────────────────
  resultEl.hidden = false;
  resultEl.textContent = "⏳ AI가 맞춤 이벤트를 찾는 중입니다...";
  resultEl.style.color = "";
  btn.disabled = true;           // 중복 클릭 방지
  btn.textContent = "분석 중...";

  try {
    // ── 실제 백엔드 API 호출 ──────────────────────────
    const response = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interest: input })
    });

    // HTTP 오류 상태코드 처리 (400, 500 등)
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || `서버 오류 (${response.status})`);
    }

    const data = await response.json();

    // ── 성공: 결과 표시 ───────────────────────────────
    resultEl.textContent = `✨ "${input}" 추천 결과\n\n${data.recommendation}`;
    resultEl.style.color = "";

    // ── 보너스: localStorage에 히스토리 저장 ──────────
    saveHistory(input, data.recommendation);
    renderHistory();

    // 피드 시각적 반응 (개인화 느낌)
    renderRanking();
    const grid = document.getElementById("feedGrid");
    grid.style.opacity = "0.4";
    setTimeout(() => { grid.style.opacity = "1"; }, 220);

  } catch (error) {
    // ── 예외처리 3: API 오류/네트워크 오류 ───────────
    console.error("AI 추천 오류:", error);
    resultEl.textContent = "😥 죄송합니다. AI 서비스 서버가 바쁩니다. 잠시 후 다시 시도해주세요.";
    resultEl.style.color = "#E53E3E";

  } finally {
    // 성공/실패 관계없이 버튼 항상 복구
    btn.disabled = false;
    btn.textContent = "추천받기";
  }
});

// ── localStorage 히스토리 함수들 ──────────────────────────────────────────

const HISTORY_KEY = "eventhub-ai-history";

function saveHistory(query, result) {
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  history.unshift({
    query,
    result,
    time: new Date().toLocaleString("ko-KR")
  });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 5)));
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");

  // 히스토리 섹션 없으면 동적 생성
  let section = document.getElementById("aiHistorySection");
  if (!section) {
    section = document.createElement("section");
    section.id = "aiHistorySection";
    section.className = "history-section";
    // AI 섹션 바로 다음에 삽입
    document.querySelector(".ai-section").insertAdjacentElement("afterend", section);
  }

  if (history.length === 0) {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  section.innerHTML = `
    <div class="section-head">
      <h2>🕐 최근 AI 추천 히스토리</h2>
      <button onclick="clearHistory()" class="history-clear-btn">전체 삭제</button>
    </div>
    <ul class="history-list">
      ${history.map(item => `
        <li class="history-item">
          <div class="history-query">"${item.query}"</div>
          <div class="history-result">${item.result}</div>
          <div class="history-time">${item.time}</div>
        </li>
      `).join("")}
    </ul>
  `;
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
  showToast("히스토리가 삭제되었습니다");
}

// 페이지 로드 시 저장된 히스토리 표시
renderHistory();

document.getElementById("aiInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("aiRecommendBtn").click();
});

/* ---------- Global Search (simple filter feedback) ---------- */
document.getElementById("globalSearch").addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const q = e.target.value.trim();
  if (!q) return;
  const match = EVENTS.find(ev =>
    ev.brand.toLowerCase().includes(q.toLowerCase()) ||
    ev.title.toLowerCase().includes(q.toLowerCase())
  );
  if (match) {
    openSheet(match.id);
  } else {
    showToast(`"${q}"에 대한 검색 결과가 없어요`);
  }
});

/* ---------- Hero Button ---------- */
document.getElementById("heroShopBtn").addEventListener("click", () => {
  currentCategory = "all";
  renderCategoryTabs();
  renderFeed();
  document.querySelector(".feed-section").scrollIntoView({ behavior: "smooth", block: "start" });
});

/* ---------- Bottom Nav (visual only, Home is functional) ---------- */
document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    if (btn.dataset.nav !== "home") {
      showToast("준비 중인 기능이에요");
    }
  });
});

/* ---------- Init ---------- */
renderCategoryTabs();
renderRanking();
renderFeed();

/* ---------- Day / Night Theme Toggle ----------
   Reads any saved preference from localStorage; otherwise falls back to
   the visitor's OS-level light/dark setting. Choice is remembered for
   next time and can be flipped anytime via the sun/moon button. */
const THEME_KEY = "eventhub-theme";
const themeToggleBtn = document.getElementById("themeToggleBtn");
const themeIconSun = document.getElementById("themeIconSun");
const themeIconMoon = document.getElementById("themeIconMoon");

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const isDark = theme === "dark";
  themeIconSun.hidden = isDark;
  themeIconMoon.hidden = !isDark;
  themeToggleBtn.setAttribute("aria-label", isDark ? "라이트 모드로 전환" : "다크 모드로 전환");
}

function getInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

applyTheme(getInitialTheme());

themeToggleBtn.addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
  showToast(next === "dark" ? "🌙 다크 모드로 전환했어요" : "☀️ 라이트 모드로 전환했어요");
});
/* =========================================================
   문의하기 (Inquiry) — Google Apps Script 웹앱 연동
   1) 아래 APPS_SCRIPT_URL을 배포한 웹앱 URL로 교체하세요.
   2) Apps Script 쪽은 doPost(저장+메일알림), doGet(목록 조회)를
      구현해야 합니다. (Code.gs 파일 참고)
   ========================================================= */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzT2nT_dRD95Ywv6eWSF-JDxDTvI0MOVACQncxAdIRX5kuC2NQc2vNYi4RP71uqx3EO/exec";

const inquiryForm = document.getElementById("inquiryForm");
const inquiryStatus = document.getElementById("inquiryStatus");
const inquirySubmitBtn = document.getElementById("inquirySubmitBtn");

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showInquiryStatus(message, isError) {
  inquiryStatus.hidden = false;
  inquiryStatus.textContent = message;
  inquiryStatus.style.color = isError ? "#E53E3E" : "";
}

if (inquiryForm) {
  inquiryForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("inquiryName").value.trim();
    const email = document.getElementById("inquiryEmail").value.trim();
    const message = document.getElementById("inquiryMessage").value.trim();

    if (!email || !isValidEmail(email)) {
      showInquiryStatus("올바른 이메일을 입력해주세요.", true);
      return;
    }
    if (!message) {
      showInquiryStatus("문의 내용을 입력해주세요.", true);
      return;
    }

    inquirySubmitBtn.disabled = true;
    inquirySubmitBtn.textContent = "등록 중...";
    showInquiryStatus("문의를 등록하는 중입니다...", false);

    try {
      await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ name, email, message }),
      });

      showInquiryStatus("문의가 정상적으로 접수되었습니다. 감사합니다!", false);
      inquiryForm.reset();
      loadInquiries();

    } catch (err) {
      console.error("문의 등록 오류:", err);
      showInquiryStatus("잠시 후 다시 시도해주세요.", true);

    } finally {
      inquirySubmitBtn.disabled = false;
      inquirySubmitBtn.textContent = "문의 등록하기";
    }
  });
}

async function loadInquiries() {
  const listEl = document.getElementById("inquiryList");
  if (!listEl) return;

  try {
    const res = await fetch(APPS_SCRIPT_URL);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      listEl.innerHTML = `<li class="empty-state">아직 등록된 문의가 없어요.</li>`;
      return;
    }

    listEl.innerHTML = data.map(item => `
      <li class="inquiry-item">
        <p class="inquiry-item-name">${item.name || "익명"}</p>
        <p class="inquiry-item-message">${item.message}</p>
        <p class="inquiry-item-time">${item.time}</p>
      </li>
    `).join("");

  } catch (err) {
    console.error("문의 목록 조회 오류:", err);
    listEl.innerHTML = `<li class="empty-state">문의 목록을 불러오지 못했어요.</li>`;
  }
}

loadInquiries();