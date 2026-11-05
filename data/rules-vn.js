// 베트남 규칙 (README 6-3). 제3자 요약 기반이므로 전부 needsVerification: true 로 시작한다.
// 관보(congbao.chinhphu.vn) 원문 확인 후 false 로 바꾼다.
window.DASH_DATA = window.DASH_DATA || {};
window.DASH_DATA.rules = window.DASH_DATA.rules || {};

(function () {
  const S = {
    medibase: { label: 'Medibase (2026-10-27 갱신)', url: 'https://medibase.vn/supplement/registration/' },
    cisema: { label: 'Cisema', url: 'https://cisema.com/news/vietnam-food-registration-suspension' },
    briefing: { label: 'Vietnam Briefing, 2026.2.4', url: 'https://www.vietnam-briefing.com/news/vietnam-addresses-implementation-bottlenecks-under-decree-46-on-food-safety.html/' },
    incorp: { label: 'InCorp', url: 'https://vietnam.incorp.asia/vietnam-new-food-safety-regulation/' }
  };
  const V = '2026-11-04';

  window.DASH_DATA.rules.VN = {
    country: 'VN',
    version: V,
    entry: '판매 전 등록',
    banner: {
      ruleId: 'VN-LAW-01',
      text: '현재 적용 규정: Decree 15/2018/ND-CP · Decree 46/2026은 2026-01-26 시행 후 정지(결의 15/2026, 2026-04-08) · 식품안전법 개정안 2026년 10~11월 논의 예정'
    },
    requiredDocs: [
      { type: 'CFS', label: '자유판매증명서 (CFS, 아포스티유/대사관 합법화)', ruleId: 'VN-DOC-CFS' },
      { type: 'TEST_REPORT', label: '시험성적서 (12개월 이내, 인정 기관)', ruleId: 'VN-DOC-TEST' },
      { type: 'EFFICACY', label: '효능 근거 자료 (성분·용량 일치)', ruleId: 'VN-DOC-EVD' },
      { type: 'GMP', label: 'GMP 증명서 (베트남 인정)', ruleId: 'VN-DOC-GMP' },
      { type: 'LOA', label: '제조사 위임장 (LoA)', ruleId: 'VN-APP-01' },
      { type: 'LABEL', label: '베트남어 라벨 (등록 문구와 1:1)', ruleId: 'VN-LBL-01' }
    ],
    lead: { legal: '21영업일 (서류 완비 기준)', practical: '실무 2~6개월' },
    steps: [
      { key: 'prepare', label: '서류 준비' },
      { key: 'submit', label: '제출' },
      { key: 'query', label: '보완 요청 대응 (반복)' },
      { key: 'registered', label: '등록' },
      { key: 'adconfirm', label: '광고 내용 확인서' }
    ],
    postMarket: [
      '처방·제조소·문구·라벨이 바뀌면 변경 신고가 아니라 새 등록 (VN-CHG-01)',
      '광고 전 광고 내용 확인서 필요 — 2026-07-01부터 발급 기관이 성(省) 인민위원회 (VN-ADV-01)',
      '등록 자체에는 만료일 없음'
    ],
    rules: [
      {
        id: 'VN-LAW-01', country: 'VN', area: 'category',
        title: '현재 적용 규정: Decree 15/2018/ND-CP',
        check: 'always', params: {},
        verdictIfFail: 'NOTED',
        message: 'Decree 46/2026은 2026-01-26 시행 후 정지(결의 15/2026, 2026-04-08)되었습니다. 식품안전법 개정안이 2026년 10~11월 논의 예정이므로 변동을 계속 확인하세요.',
        source: S.cisema, verifiedAt: V, needsVerification: true
      },
      {
        id: 'VN-CAT-01', country: 'VN', area: 'category',
        title: '건강보호식품(health supplement)은 자기공표가 아닌 등록 대상',
        check: 'always', params: {},
        verdictIfFail: 'ACTION',
        message: '판매 전 등록 절차가 필요합니다. 등록 서류 준비를 시작하세요.',
        source: S.incorp, verifiedAt: V, needsVerification: true
      },
      {
        id: 'VN-APP-01', country: 'VN', area: 'applicant',
        title: '신청자는 베트남 법인만 · 제조사 위임장(LoA) 필요',
        check: 'holderCapability', params: { country: 'VN' },
        verdictIfFail: 'ACTION',
        message: '외국 제조사는 직접 신청할 수 없고, 유통계약만으로는 부족합니다. 베트남 법인 바이어가 제조사 위임장을 받아 신청해야 합니다.',
        source: S.medibase, verifiedAt: V, needsVerification: true
      },
      {
        id: 'VN-DOC-TEST', country: 'VN', area: 'document',
        title: '등록용 시험성적서는 제출 전 12개월 이내 · MOH 지정 또는 ISO/IEC 17025 기관',
        check: 'docAgeMonthsMax', params: { docType: 'TEST_REPORT', months: 12, requireLab: ['iso17025', 'mohDesignated'] },
        verdictIfFail: 'ACTION',
        message: '시험성적서 발급일이 12개월을 넘었거나 인정 기관이 아닙니다. 재시험이 필요합니다.',
        source: S.medibase, verifiedAt: V, needsVerification: true
      },
      {
        id: 'VN-DOC-CFS', country: 'VN', area: 'document',
        title: '자유판매증명서(CFS): 아포스티유 또는 베트남 대사관 합법화',
        check: 'docLegalization', params: { docType: 'CFS', allowed: ['apostille', 'embassy'] },
        verdictIfFail: 'ACTION',
        message: 'CFS가 없거나 아포스티유·대사관 합법화가 되어 있지 않습니다.',
        source: S.medibase, verifiedAt: V, needsVerification: true
      },
      {
        id: 'VN-DOC-GMP', country: 'VN', area: 'document',
        title: '베트남이 인정하는 GMP 증명서',
        check: 'docRequired', params: { docType: 'GMP' },
        verdictIfFail: 'ACTION',
        message: 'GMP 증명서가 등록되어 있지 않습니다.',
        source: S.medibase, verifiedAt: V, needsVerification: true
      },
      {
        id: 'VN-DOC-EVD', country: 'VN', area: 'document',
        title: '효능 근거는 해당 성분과 용량에 맞는 문헌·시험',
        check: 'always', params: {},
        verdictIfFail: 'REVIEW',
        message: '원료 일반의 효능을 인용하면 반려 위험이 있습니다. 제품의 성분·용량에 맞는 근거인지 확인하세요.',
        source: S.medibase, verifiedAt: V, needsVerification: true
      },
      {
        id: 'VN-LBL-01', country: 'VN', area: 'claim',
        title: '베트남어 라벨이 등록 문구와 1:1 일치 · \'의약품이 아님\' 문구 필수',
        check: 'vnLabel', params: { fields: ['vnRegistered', 'vnLabel', 'vnAd'], list: 'medicineLike', requiredPhrases: ['không phải là thuốc', '의약품이 아님', 'not a medicine'],
          // 표현 점검 전에 지우는 문구 (필수 문구 자체가 '약' 표현에 걸리지 않게)
          ignorePhrases: ['không phải là thuốc và không có tác dụng thay thế thuốc chữa bệnh', 'không phải là thuốc', '의약품이 아님', 'not a medicine'] },
        verdictIfFail: 'ACTION',
        message: '등록 문구·라벨·광고 문구가 같아야 하고, 라벨에 \'의약품이 아님\' 문구가 있어야 합니다.',
        suggestion: '라벨에 "Sản phẩm này không phải là thuốc và không có tác dụng thay thế thuốc chữa bệnh." 문구를 넣는 것을 검토하세요.',
        source: S.medibase, verifiedAt: V, needsVerification: true
      },
      {
        id: 'VN-SCH-01', country: 'VN', area: 'schedule',
        title: '법정 처리 21영업일(서류 완비 기준), 실무 2~6개월',
        check: 'always', params: {},
        verdictIfFail: 'NOTED',
        message: '보완 요청이 반복되면 기간이 길어집니다. 판매 희망일에서 역산해 여유를 두세요. (정보)',
        source: S.medibase, verifiedAt: V, needsVerification: true
      },
      {
        id: 'VN-SCH-02', country: 'VN', area: 'schedule',
        title: '보완 요청마다 회신 기한 7영업일',
        check: 'queryDeadline', params: { days: 7 },
        verdictIfFail: 'ACTION',
        message: '보완 요청 접수일로부터 7영업일 안에 회신해야 합니다.',
        source: S.medibase, verifiedAt: V, needsVerification: true
      },
      {
        id: 'VN-CHG-01', country: 'VN', area: 'post_market',
        title: '처방·제조소·문구·라벨이 바뀌면 새 등록 (변경 신고 아님)',
        check: 'changeAfterRegistration', params: {},
        verdictIfFail: 'ACTION',
        message: '등록 단계 이후 처방이 바뀌었습니다. 변경 신고가 아니라 새 등록이 필요합니다. (등록 자체에는 만료일 없음)',
        source: S.medibase, verifiedAt: V, needsVerification: true
      },
      {
        id: 'VN-ADV-01', country: 'VN', area: 'post_market',
        title: '광고 전 광고 내용 확인서 필요 · 2026-07-01부터 성(省) 인민위원회 발급',
        check: 'always', params: {},
        verdictIfFail: 'ACTION',
        message: '바이어가 광고하기 전에 광고 내용 확인서를 받아야 합니다.',
        source: S.medibase, verifiedAt: V, needsVerification: true
      },
      {
        id: 'VN-ING-01', country: 'VN', area: 'ingredient',
        title: '미량영양소 함량 기준 (Circular 17/2023/TT-BYT)',
        check: 'dataMissing', params: {},
        verdictIfFail: 'UNKNOWN',
        message: '근거 규정명만 확인됨 — 함량 기준 수치는 미확인이라 데이터를 비워 두었습니다. 규제 담당이 수동 확인하세요.',
        source: S.medibase, verifiedAt: V, needsVerification: true
      }
    ],
    unregistered: [],
    timeline: [
      { date: '2018-02-02', title: 'Decree 15/2018/ND-CP — 현재 적용 규정', status: 'effective', ruleId: 'VN-LAW-01' },
      { date: '2026-01-26', title: 'Decree 46/2026 시행', status: 'suspended', ruleId: 'VN-LAW-01' },
      { date: '2026-04-08', title: 'Decree 46/2026 정지 (결의 15/2026)', status: 'suspended', ruleId: 'VN-LAW-01', alert: true },
      { date: '2026-07-01', title: '광고 내용 확인서 발급 기관 → 성(省) 인민위원회', status: 'effective', ruleId: 'VN-ADV-01', alert: true },
      { date: '2026-10-01', title: '식품안전법 개정안 논의 (2026년 10~11월 예정)', status: 'draft', ruleId: 'VN-LAW-01', alert: true }
    ]
  };
})();
