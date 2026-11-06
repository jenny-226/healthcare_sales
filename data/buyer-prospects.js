// 바이어 발굴 탭 데이터 (README 7-5).
// masters = 검색 조건 선택지 (국가·기업 유형·제품 카테고리·원료·제형·거래 형태 마스터 DB의 화면용 사본)
// prospects = 잠재 바이어 목록 — 지금은 화면 설명용 **가상 데이터**다. 실제 데이터는 README 2-4의 출처에서 수집해 같은 모양으로 바꾼다.
// capability = 자사 제조 역량 기본값 (바이어 발굴 탭 '자사 제조 역량'에서 고친 값이 우선)
window.DASH_DATA = window.DASH_DATA || {};
window.DASH_DATA.buyerMasters = {
  countries: [
    { code: 'US', name: '미국', tz: 'America/New_York' },
    { code: 'JP', name: '일본', tz: 'Asia/Tokyo' },
    { code: 'VN', name: '베트남', tz: 'Asia/Ho_Chi_Minh' },
    { code: 'DE', name: '독일', tz: 'Europe/Berlin' },
    { code: 'CN', name: '중국', tz: 'Asia/Shanghai' },
    { code: 'TW', name: '대만', tz: 'Asia/Taipei' },
    { code: 'TH', name: '태국', tz: 'Asia/Bangkok' },
    { code: 'AU', name: '호주', tz: 'Australia/Sydney' }
  ],
  types: [
    { value: 'brand', label: '브랜드사' },
    { value: 'd2c', label: 'D2C 브랜드' },
    { value: 'distributor', label: '유통사·수입사' },
    { value: 'pb', label: 'PB 운영사 (리테일러)' },
    { value: 'pharmacy', label: '약국 체인·납품사' }
  ],
  categories: ['장 건강', '뷰티·이너뷰티', '비타민·미네랄', '관절·뼈', '면역', '수면·스트레스', '체중 관리', '눈 건강', '간 건강'],
  ingredients: ['프로바이오틱스', '프락토올리고당', '콜라겐', '히알루론산', '비타민 C', '비타민 D', '마그네슘', '아연', '오메가3', '루테인', 'MSM', '글루코사민', '홍삼', '밀크씨슬', '테아닌', '가르시니아'],
  dealTypes: ['OEM', 'ODM', '완제품 공급'],
  channels: ['온라인(D2C·아마존)', '드럭스토어', '약국', '대형 유통', '홈쇼핑', '크로스보더']
};

window.DASH_DATA.companyCapability = {
  forms: ['capsule', 'tablet', 'powder', 'softgel', 'jelly_stick'],
  certs: ['식약처 GMP', 'HACCP', 'ISO 22000'],
  dealTypes: ['OEM', 'ODM', '완제품 공급'],
  strengths: ['프로바이오틱스', '콜라겐', '홍삼'],
  moq: 5000
};

window.DASH_DATA.buyerProspects = [
  { id: 'BP-001', name: 'A Wellness (가상)', country: 'US', city: '오스틴', type: 'd2c', categories: ['장 건강', '비타민·미네랄'], ingredients: ['프로바이오틱스', '프락토올리고당', '비타민 D', '아연'], forms: ['capsule', 'powder'], dealTypes: ['OEM', 'ODM'], channels: ['온라인(D2C·아마존)'], certsRequired: ['cGMP (21 CFR 111)', 'NSF'], size: '연매출 $10–50M', website: '', note: '아마존 장 건강 카테고리 상위 브랜드 (가상)' },
  { id: 'BP-002', name: 'B Nutrition GmbH (가상)', country: 'DE', city: '함부르크', type: 'brand', categories: ['뷰티·이너뷰티', '비타민·미네랄'], ingredients: ['콜라겐', '히알루론산', '마그네슘', '비타민 C'], forms: ['powder', 'capsule', 'liquid'], dealTypes: ['ODM'], channels: ['드럭스토어', '온라인(D2C·아마존)'], certsRequired: ['IFS / BRC', 'EU Novel Food 확인'], size: '연매출 €20–100M', website: '', note: '드럭스토어 체인 입점 브랜드 (가상)' },
  { id: 'BP-003', name: 'C Health Distribution (가상)', country: 'US', city: '로스앤젤레스', type: 'distributor', categories: ['장 건강', '면역', '관절·뼈', '비타민·미네랄'], ingredients: ['프로바이오틱스', '글루코사민', 'MSM', '오메가3'], forms: ['tablet', 'capsule', 'softgel'], dealTypes: ['완제품 공급'], channels: ['대형 유통', '약국'], certsRequired: ['cGMP (21 CFR 111)'], size: '연매출 $50M+', website: '', note: '아시안 마켓·약국 납품 유통사 (가상)' },
  { id: 'BP-004', name: 'D Beauty Inner Co. (가상)', country: 'JP', city: '오사카', type: 'brand', categories: ['뷰티·이너뷰티'], ingredients: ['콜라겐', '히알루론산', '비타민 C'], forms: ['jelly_stick', 'powder'], dealTypes: ['OEM', 'ODM'], channels: ['드럭스토어', '홈쇼핑'], certsRequired: ['건강식품 GMP (일본)'], size: '연매출 ¥3–10억', website: '', note: '기능성표시식품(FFC) 신고 실적 있음 (가상)' },
  { id: 'BP-005', name: 'E Drug Chain PB (가상)', country: 'JP', city: '도쿄', type: 'pb', categories: ['비타민·미네랄', '장 건강', '눈 건강'], ingredients: ['비타민 C', '비타민 D', '루테인', '프로바이오틱스'], forms: ['tablet', 'capsule'], dealTypes: ['OEM'], channels: ['드럭스토어'], certsRequired: ['건강식품 GMP (일본)'], size: '점포 500개+', website: '', note: 'PB 저가 라인 확대 중 (가상)' },
  { id: 'BP-006', name: 'F Pharma JSC (가상)', country: 'VN', city: '하노이', type: 'pharmacy', categories: ['장 건강', '면역', '간 건강'], ingredients: ['프로바이오틱스', '홍삼', '밀크씨슬'], forms: ['capsule', 'liquid'], dealTypes: ['완제품 공급', 'OEM'], channels: ['약국'], certsRequired: ['GMP 증명서', 'CFS'], size: '약국 납품처 300곳', website: '', note: '건강보호식품 등록 대행 경험 있음 (가상)' },
  { id: 'BP-007', name: 'G Fit Brand (가상)', country: 'US', city: '마이애미', type: 'd2c', categories: ['체중 관리', '수면·스트레스'], ingredients: ['가르시니아', '테아닌', '마그네슘'], forms: ['jelly_stick', 'capsule'], dealTypes: ['ODM'], channels: ['온라인(D2C·아마존)'], certsRequired: ['cGMP (21 CFR 111)'], size: '연매출 $5–10M', website: '', note: '구미·젤리 제형 신제품 탐색 중 (가상)' },
  { id: 'BP-008', name: 'H Natur AG (가상)', country: 'DE', city: '뮌헨', type: 'pb', categories: ['비타민·미네랄', '관절·뼈'], ingredients: ['마그네슘', '비타민 D', '글루코사민'], forms: ['tablet', 'powder'], dealTypes: ['OEM'], channels: ['대형 유통'], certsRequired: ['IFS / BRC'], size: '연매출 €100M+', website: '', note: '대형 마트 PB (가상)' },
  { id: 'BP-009', name: 'I Herb Trading (가상)', country: 'TW', city: '타이베이', type: 'distributor', categories: ['면역', '간 건강', '뷰티·이너뷰티'], ingredients: ['홍삼', '밀크씨슬', '콜라겐'], forms: ['liquid', 'jelly_stick', 'capsule'], dealTypes: ['완제품 공급'], channels: ['크로스보더', '홈쇼핑'], certsRequired: ['수입 식품 등록'], size: '연매출 NT$ 3억', website: '', note: '한국 건기식 수입 경험 다수 (가상)' },
  { id: 'BP-010', name: 'J Vital Brand (가상)', country: 'AU', city: '시드니', type: 'brand', categories: ['장 건강', '뷰티·이너뷰티'], ingredients: ['프로바이오틱스', '콜라겐'], forms: ['powder', 'capsule'], dealTypes: ['ODM'], channels: ['약국', '온라인(D2C·아마존)'], certsRequired: ['TGA 등록 확인'], size: '연매출 A$10–30M', website: '', note: '약국 채널 중심 (가상)' },
  { id: 'BP-011', name: 'K Smart Retail (가상)', country: 'TH', city: '방콕', type: 'distributor', categories: ['비타민·미네랄', '체중 관리'], ingredients: ['비타민 C', '가르시니아'], forms: ['jelly_stick', 'tablet'], dealTypes: ['완제품 공급', 'OEM'], channels: ['크로스보더', '대형 유통'], certsRequired: ['Thai FDA 등록'], size: '편의점 납품 (가상)', website: '', note: '젤리 스틱 수요 증가 (가상)' },
  { id: 'BP-012', name: 'L Joint Care Inc. (가상)', country: 'US', city: '시카고', type: 'brand', categories: ['관절·뼈'], ingredients: ['MSM', '글루코사민', '오메가3'], forms: ['tablet', 'softgel'], dealTypes: ['OEM', 'ODM'], channels: ['약국', '대형 유통'], certsRequired: ['cGMP (21 CFR 111)', 'NSF'], size: '연매출 $20–50M', website: '', note: '관절 라인 리뉴얼 예정 (가상)' }
];
