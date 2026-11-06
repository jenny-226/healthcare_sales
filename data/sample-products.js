// 예시 제품 3개 (가상). sample: true → 화면에 '예시' 배지.
// jpPharmaOnly: true(해당) / false(비해당) / 없음(미입력 → JP-ING-01 UNKNOWN)
// koreaIndividual: true → 미국 US-NDI-02 자동 경고
window.DASH_DATA = window.DASH_DATA || {};
window.DASH_DATA.sampleProducts = [
  {
    id: 'P-001', sample: true, name: '유산균 캡슐 (가상)', form: 'capsule', category: '장 건강',
    koreaStatus: 'notified', koreaClaim: '장 건강에 도움을 줄 수 있음',
    servingsPerDay: 1, unitsPerServing: 1,
    formula: [
      { ingredientId: 'ING-001', nameKo: '프로바이오틱스', nameEn: 'Probiotics', amountPerServing: 10, unit: 'billion CFU', koreaIndividual: false },
      { ingredientId: 'ING-002', nameKo: '프락토올리고당', nameEn: 'Fructooligosaccharide', amountPerServing: 300, unit: 'mg', koreaIndividual: false }
    ]
  },
  {
    id: 'P-002', sample: true, name: '콜라겐 젤리 스틱 (가상)', form: 'jelly_stick', category: '뷰티·이너뷰티',
    koreaStatus: 'individual', koreaClaim: '피부 보습에 도움을 줄 수 있음',
    servingsPerDay: 1, unitsPerServing: 1,
    formula: [
      { ingredientId: 'ING-003', nameKo: '저분자 콜라겐 펩타이드', nameEn: 'Collagen peptide', amountPerServing: 1000, unit: 'mg', koreaIndividual: true },
      { ingredientId: 'ING-004', nameKo: '히알루론산', nameEn: 'Hyaluronic acid', amountPerServing: 120, unit: 'mg', koreaIndividual: false },
      { ingredientId: 'ING-005', nameKo: '비타민 C', nameEn: 'Vitamin C', amountPerServing: 100, unit: 'mg', koreaIndividual: false }
    ]
  },
  {
    id: 'P-003', sample: true, name: '관절 케어 정제 (가상)', form: 'tablet', category: '관절·뼈',
    koreaStatus: 'individual', koreaClaim: '관절 건강에 도움을 줄 수 있음',
    servingsPerDay: 2, unitsPerServing: 1,
    formula: [
      { ingredientId: 'ING-006', nameKo: '가상 식물 추출물 A (개별인정형)', nameEn: 'Botanical extract A (virtual)', amountPerServing: 250, unit: 'mg', koreaIndividual: true },
      { ingredientId: 'ING-007', nameKo: 'MSM', nameEn: 'Methylsulfonylmethane', amountPerServing: 500, unit: 'mg', koreaIndividual: false }
    ]
  }
];
