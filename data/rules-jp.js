// 일본 규칙 (README 6-2). 사람이 관리하는 파일 — 코드가 자동 수정하지 않는다.
window.DASH_DATA = window.DASH_DATA || {};
window.DASH_DATA.rules = window.DASH_DATA.rules || {};

(function () {
  const S = {
    cosmorning: { label: '코스모닝(KOTRA 도쿄), 2024.12.16', url: 'https://cosmorning.com/mobile/article.html?no=49497' },
    tokyo: { label: '도쿄도 보건의료국 교재', url: 'https://www.hokeniryo1.metro.tokyo.lg.jp/shokuhin/hyouji/kyouzai/files/eiyouseibun_chapter_6_kinouseihyoujishokuhin.pdf' },
    nutra: { label: 'NutraIngredients, 2024.7', url: 'https://www.nutraingredients.com/Article/2024/07/08/japanese-functional-foods-businesses-legally-bound-to-four-new-rules-from-sep/' },
    datamax: { label: 'Data Max, 2024.8.26', url: 'https://data-max.co.jp/article/73210' }
  };
  const V = '2026-11-04';

  window.DASH_DATA.rules.JP = {
    country: 'JP',
    version: V,
    entry: '판매 전 신고',
    categories: [
      { code: 'ffc', label: '기능성표시식품 (FFC · 신고)', supported: true },
      { code: 'foshu', label: '특정보건용식품 (허가)', supported: false },
      { code: 'fnfc', label: '영양기능식품', supported: false }
    ],
    defaultCategory: 'ffc',
    // JP-LBL-01 필수 표시 체크리스트
    labelChecklist: [
      '기능성표시식품이라는 표시',
      '기능성 관여 성분과 기능성',
      '영양성분·열량',
      '1일 섭취 기준량과 기능성 관여 성분 함유량',
      '신고번호',
      '사업자 연락처',
      '국가의 평가를 받지 않았다는 표시',
      '섭취 방법·섭취 시 주의',
      '균형 잡힌 식생활 문구',
      '질병 진단·치료·예방을 목적으로 하지 않는다는 표시'
    ],
    requiredDocs: [
      { type: 'FFC_EVIDENCE', label: '안전성·기능성 과학적 근거 자료', ruleId: 'JP-EVD-01' },
      { type: 'GMP', label: 'GMP 증명서', ruleId: 'JP-MFG-01' }
    ],
    lead: { legal: '판매일 60영업일 전 신고 (신규 성분 등 120영업일 전)', practical: '규칙 미등록 — 근거 자료 준비 기간은 별도 확인' },
    steps: [
      { key: 'provide', label: '우리 자료 제공' },
      { key: 'notify', label: '바이어 신고 (소비자청)' },
      { key: 'sellable', label: '판매 가능일' }
    ],
    postMarket: [
      '건강피해 정보 발생 시 15일 이내 보고 — 바이어에게 제공할 제조 정보(로트·제조일·원료 출처·시험 기록) 준비',
      '새로운 과학적 근거 발견 시 보고 지원',
      '연간 자체점검 보고에 필요한 제조 자료 제공'
    ],
    rules: [
      {
        id: 'JP-CAT-01', country: 'JP', area: 'category',
        title: '분류 선택: 특정보건용식품(허가) / 기능성표시식품 FFC(신고) / 영양기능식품',
        check: 'categoryChoice', params: { supported: ['ffc'] },
        verdictIfFail: 'REVIEW',
        message: '선택한 분류 경로를 규제 담당과 확인하세요. MVP는 FFC(신고) 경로를 기본으로 지원합니다.',
        source: S.cosmorning, verifiedAt: V, needsVerification: true
      },
      {
        id: 'JP-ING-01', country: 'JP', area: 'ingredient',
        title: '일본에서 의약품으로만 쓰는 성분 포함 여부',
        check: 'ingredientFlag', params: { flag: 'jpPharmaOnly' },
        verdictIfFail: 'BLOCK',
        message: '일본에서 의약품으로만 쓰는 성분(예: 타우린)이 있으면 의약품으로 취급될 수 있습니다. 해당 성분 제외를 검토하세요.',
        source: S.cosmorning, verifiedAt: V, needsVerification: true
      },
      {
        id: 'JP-SCH-01', country: 'JP', area: 'schedule',
        title: 'FFC는 판매일 60영업일 전까지 소비자청에 신고',
        check: 'deadlineBusiness', params: { from: 'targetLaunchDate', days: -60, bufferDays: 10, unless: 'newIngredient' },
        verdictIfFail: 'ACTION',
        message: '바이어 신고 마감과, 그보다 앞선 우리 자료 제공 마감을 지켜야 합니다.',
        source: S.tokyo, verifiedAt: V, needsVerification: false
      },
      {
        id: 'JP-SCH-02', country: 'JP', area: 'schedule',
        title: '신규 성분 등 확인에 시간이 걸리면 판매일 120영업일 전',
        check: 'deadlineBusiness', params: { from: 'targetLaunchDate', days: -120, bufferDays: 10, when: 'newIngredient', whenLabel: '신규 성분 포함' },
        verdictIfFail: 'ACTION',
        message: '신규 성분 등이 있으면 신고 마감이 120영업일 전으로 앞당겨집니다.',
        source: S.tokyo, verifiedAt: V, needsVerification: false
      },
      {
        id: 'JP-APP-01', country: 'JP', area: 'applicant',
        title: '신고자는 일본의 식품관련사업자 (바이어)',
        check: 'always', params: {},
        verdictIfFail: 'REVIEW',
        message: '신고 명의는 일본 바이어입니다. 바이어의 FFC 신고 실적·건강피해 보고 체계를 확인하세요.',
        source: S.tokyo, verifiedAt: V, needsVerification: false
      },
      {
        id: 'JP-MFG-01', country: 'JP', area: 'manufacturing',
        title: '정제·캡슐·분말 등 보충제 형태는 GMP 의무 (유예 종료 2026-09-01)',
        check: 'docRequired', params: { docType: 'GMP', forms: ['tablet', 'capsule', 'softgel', 'powder'] },
        verdictIfFail: 'ACTION',
        message: 'GMP 서류가 등록되어 있지 않습니다. GMP 증명서를 준비하세요.',
        source: S.nutra, verifiedAt: V, needsVerification: true
      },
      {
        id: 'JP-CLM-01', country: 'JP', area: 'claim',
        title: 'FFC 대상이 아닌 사람(질병자·미성년자·임산부·수유부)을 대상으로 한 표현',
        check: 'claimTerms', params: { list: 'excludedTarget', fields: ['main'] },
        verdictIfFail: 'BLOCK',
        message: 'FFC는 질병자, 미성년자, 임산부(임신 계획자 포함), 수유부를 대상으로 하지 않습니다. 해당 표현을 삭제하세요.',
        suggestion: '대상 표현을 빼고 "건강한 성인" 기준의 기능성 표현으로 바꾸세요.',
        source: S.tokyo, verifiedAt: V, needsVerification: false
      },
      {
        id: 'JP-LBL-01', country: 'JP', area: 'claim',
        title: '필수 표시 체크리스트',
        check: 'checklist', params: { key: 'jpLabelChecks' },
        verdictIfFail: 'REVIEW',
        message: '필수 표시 항목을 하나씩 확인하세요.',
        source: S.tokyo, verifiedAt: V, needsVerification: false
      },
      {
        id: 'JP-LBL-02', country: 'JP', area: 'schedule',
        title: '새 표시 방식 경과조치 종료 2026-08-31',
        check: 'always', params: {},
        verdictIfFail: 'NOTED',
        message: '경과조치가 끝났으므로 새 표시 방식 기준으로 라벨을 준비합니다. (정보)',
        source: S.tokyo, verifiedAt: V, needsVerification: false
      },
      {
        id: 'JP-PM-01', country: 'JP', area: 'post_market',
        title: '건강피해 정보 15일 이내 보고 · 새 과학적 근거 보고 · 연간 자체점검 (2024-09 시행)',
        check: 'always', params: {},
        verdictIfFail: 'ACTION',
        message: '판매 후 바이어가 보고할 때 필요한 제조 정보를 바로 줄 수 있게 준비하세요.',
        source: S.datamax, verifiedAt: V, needsVerification: true
      },
      {
        id: 'JP-EVD-01', country: 'JP', area: 'document',
        title: '안전성·기능성 근거 자료가 제품의 성분·함량과 일치',
        check: 'always', params: {},
        verdictIfFail: 'REVIEW',
        message: '근거 자료의 성분·함량이 실제 처방과 같은지 사람이 확인해야 합니다. (서류함에서 일치 확인 체크)',
        source: S.tokyo, verifiedAt: V, needsVerification: true
      }
    ],
    // 13장: 확인되지 않아 규칙을 만들지 않은 항목 → 화면에 '규칙 미등록'
    unregistered: [
      { area: 'document', title: 'FFC 신고 시 외국 제조사 제출 자료' },
      { area: 'claim', title: '일본 광고 규제' }
    ],
    timeline: [
      { date: '2024-09-01', title: 'FFC 신규 의무 4가지 시행 (건강피해 보고 15일 등)', status: 'effective', ruleId: 'JP-PM-01' },
      { date: '2026-08-31', title: '새 표시 방식 경과조치 종료', status: 'effective', ruleId: 'JP-LBL-02', alert: true },
      { date: '2026-09-01', title: '보충제 형태 GMP 의무 유예 종료', status: 'effective', ruleId: 'JP-MFG-01', alert: true }
    ]
  };
})();
