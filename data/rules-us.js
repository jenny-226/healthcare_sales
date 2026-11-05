// 미국 규칙 (README 6-4). 사람이 관리하는 파일.
window.DASH_DATA = window.DASH_DATA || {};
window.DASH_DATA.rules = window.DASH_DATA.rules || {};

(function () {
  const S = {
    chpa: { label: 'CHPA', url: 'https://www.chpa.org/public-policy-regulatory/regulation/regulation-dietary-supplements/marketing-and-advertising' },
    mt: { label: '머니투데이, 2024.9.2', url: 'https://www.mt.co.kr/living/2024/09/02/2024083014574892990' },
    fdaClaim: { label: 'FDA — Structure/Function Claim Notification', url: 'https://www.fda.gov/food/information-industry/structurefunction-claim-notification-dietary-supplements' },
    fdaFac: { label: 'FDA — Registration of Food Facilities', url: 'https://www.fda.gov/food/guidance-regulation-food-and-dietary-supplements/registration-food-facilities-and-other-submissions' },
    agg: { label: 'AGG (FSVP), 2020.6', url: 'https://www.agg.com/news-insights/publications/fsvp-basics-for-importers-of-dietary-supplement-and-their-components/' }
  };
  const V = '2026-11-04';
  const DISCLAIMER = 'This statement has not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.';

  window.DASH_DATA.rules.US = {
    country: 'US',
    version: V,
    entry: '승인 없이 통지',
    disclaimer: DISCLAIMER,
    requiredDocs: [
      { type: 'FDA_FACILITY', label: 'FDA 식품시설 등록 (2년마다 갱신)', ruleId: 'US-FAC-01' },
      { type: 'CGMP', label: 'cGMP (21 CFR Part 111) 준수 자료', ruleId: 'US-MFG-01' },
      { type: 'NDI_NOTICE', label: 'NDI 통지 자료', ruleId: 'US-NDI-01', when: 'ndiConfirmed' }
    ],
    lead: { legal: '시판 전 승인 없음 · NDI면 판매 75일 전 통지 · 구조·기능 표현은 출시 후 30일 이내 통지', practical: '규칙 미등록 — 유통사 입점 요구 서류에 따라 다름' },
    steps: [
      { key: 'ndi', label: 'NDI 통지 (해당 시)' },
      { key: 'launch', label: '출시' },
      { key: 'claim', label: '구조·기능 표현 FDA 통지' }
    ],
    postMarket: [
      '식품시설 등록 2년마다 갱신 (US-FAC-01)',
      '새 원료로 처방을 바꾸면 NDI 해당 여부 재확인 (US-NDI-01)',
      '구조·기능 표현을 바꾸면 통지 내용 재확인 (US-CLM-03)'
    ],
    rules: [
      {
        id: 'US-CAT-01', country: 'US', area: 'category',
        title: 'Dietary Supplement는 FDA 시판 전 승인 없음 · 제조사가 안전성 책임',
        check: 'always', params: {},
        verdictIfFail: 'NOTED',
        message: '시판 전 승인 절차는 없지만, 안전성과 표시의 책임은 제조사·브랜드에 있습니다. (정보)',
        source: S.chpa, verifiedAt: V, needsVerification: true
      },
      {
        id: 'US-NDI-01', country: 'US', area: 'ingredient',
        title: 'NDI(1994-10-15 이전 미국 미시판 원료)는 판매 75일 전 FDA 통지',
        check: 'deadlineCalendar', params: { from: 'targetLaunchDate', days: -75, when: 'ndiConfirmed', whenLabel: 'NDI 해당 판단' },
        verdictIfFail: 'ACTION',
        message: 'NDI로 판단한 원료가 있습니다. 판매 75일 전까지 FDA에 통지해야 합니다.',
        source: S.chpa, verifiedAt: V, needsVerification: true
      },
      {
        id: 'US-NDI-02', country: 'US', area: 'ingredient',
        title: '한국 개별인정형 원료는 NDI 해당 가능성',
        check: 'ingredientFlag', params: { flag: 'koreaIndividual', unsetAsFalse: true },
        verdictIfFail: 'REVIEW',
        message: '한국 개별인정형 원료가 있습니다. 미국 NDI에 해당하는지 규제 담당이 판단하세요.',
        source: S.mt, verifiedAt: V, needsVerification: true
      },
      {
        id: 'US-NDI-03', country: 'US', area: 'applicant',
        title: '대형 유통사는 계약 전에 원료 사전 등록(NDI)을 요구할 수 있음',
        check: 'always', params: {},
        verdictIfFail: 'REVIEW',
        message: '바이어가 입점할 유통사가 NDI 자료를 계약 전에 요구하는지 확인하세요.',
        source: S.mt, verifiedAt: V, needsVerification: true
      },
      {
        id: 'US-CLM-01', country: 'US', area: 'claim',
        title: '질병 진단·치료·완화·예방 표현은 사용 불가',
        check: 'claimTerms', params: { list: 'disease', fields: ['main'] },
        verdictIfFail: 'BLOCK',
        message: '질병을 진단·치료·완화·예방한다는 표현은 Dietary Supplement에 쓸 수 없습니다.',
        suggestion: '질병 표현을 빼고 구조·기능 표현으로 바꾸세요. 예: "Supports joint comfort"',
        source: S.fdaClaim, verifiedAt: V, needsVerification: false
      },
      {
        id: 'US-CLM-02', country: 'US', area: 'claim',
        title: '구조·기능 표현에는 면책 문구 2문장을 굵게 표시',
        check: 'disclaimer', params: { fields: ['main'], text: DISCLAIMER },
        verdictIfFail: 'ACTION',
        message: '면책 문구가 없습니다. 라벨에 아래 문구를 굵게 넣으세요.',
        source: S.fdaClaim, verifiedAt: V, needsVerification: false
      },
      {
        id: 'US-CLM-03', country: 'US', area: 'schedule',
        title: '구조·기능 표현은 출시 후 30일 이내 FDA 통지',
        check: 'deadlineCalendar', params: { from: 'targetLaunchDate', days: 30, when: 'hasClaim', whenLabel: '구조·기능 표현 입력' },
        verdictIfFail: 'ACTION',
        message: '출시 후 30일 이내에 구조·기능 표현을 FDA에 통지해야 합니다.',
        source: S.fdaClaim, verifiedAt: V, needsVerification: true
      },
      {
        id: 'US-MFG-01', country: 'US', area: 'manufacturing',
        title: 'cGMP (21 CFR Part 111) 준수',
        check: 'docRequired', params: { docType: 'CGMP' },
        verdictIfFail: 'ACTION',
        message: 'cGMP 준수 자료가 등록되어 있지 않습니다.',
        source: S.agg, verifiedAt: V, needsVerification: true
      },
      {
        id: 'US-IMP-01', country: 'US', area: 'applicant',
        title: 'FSVP 수입자가 통관 서류에 명시되고 외국 공급자의 cGMP 준수를 검증',
        check: 'always', params: {},
        verdictIfFail: 'REVIEW',
        message: '바이어(또는 지정 수입자)가 FSVP 수입자 역할을 하는지, 우리에게 어떤 검증 자료를 요구할지 확인하세요.',
        source: S.agg, verifiedAt: V, needsVerification: true
      },
      {
        id: 'US-FAC-01', country: 'US', area: 'document',
        title: '미국 소비용 식품 시설은 FDA 등록 · 2년마다 갱신',
        check: 'docRequired', params: { docType: 'FDA_FACILITY', renewMonths: 24 },
        verdictIfFail: 'ACTION',
        message: 'FDA 식품시설 등록 자료가 없거나 갱신 주기(2년)를 넘었습니다.',
        source: S.fdaFac, verifiedAt: V, needsVerification: false
      }
    ],
    unregistered: [
      { area: 'document', title: '외국 시설 미국 대리인·갱신 기간 세부 (FDA 원문 미확인)' },
      { area: 'claim', title: 'Supplement Facts 표시 양식' }
    ],
    timeline: [
      { date: '1994-10-15', title: 'DSHEA — 이 날 이전 미국 미시판 원료는 NDI', status: 'effective', ruleId: 'US-NDI-01' }
    ]
  };
})();
