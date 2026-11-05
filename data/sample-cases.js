// 예시 바이어·건·서류 (가상, README 12장 시나리오 A·B·C). 모두 sample: true.
window.DASH_DATA = window.DASH_DATA || {};

window.DASH_DATA.sampleBuyers = [
  {
    id: 'B-001', sample: true, country: 'JP', name: 'Sakura Drug Chain (가상)',
    type: 'retail_chain', leadSource: '2026 도쿄 건강식품 전시회',
    contact: { name: 'Tanaka', email: 'tanaka@example.jp', timezone: 'Asia/Tokyo' },
    holderCapability: { JP: { ffcRecord: true, adverseReporting: true }, VN: null, US: null },
    lastContactAt: '2026-10-28', awaitingReply: false
  },
  {
    id: 'B-002', sample: true, country: 'VN', name: 'A Pharma Supply JSC (가상)',
    type: 'pharmacy_supplier', leadSource: '2026 KOTRA 상담회',
    contact: { name: 'Nguyen', email: 'nguyen@example.vn', timezone: 'Asia/Ho_Chi_Minh' },
    holderCapability: { JP: null, VN: { localEntity: false, pastRegistrations: 0, canAcceptLoA: false }, US: null },
    lastContactAt: '2026-11-01', awaitingReply: true
  },
  {
    id: 'B-003', sample: true, country: 'US', name: 'Brightway Nutrition Inc. (가상)',
    type: 'brand_owner', leadSource: '2026 SupplySide 미팅',
    contact: { name: 'Jordan', email: 'jordan@example.com', timezone: 'America/Los_Angeles' },
    holderCapability: { JP: null, VN: null, US: { fsvpImporter: true, retailerDocs: false } },
    lastContactAt: '2026-10-30', awaitingReply: false
  }
];

window.DASH_DATA.sampleCases = [
  {
    // 시나리오 A: 일본 — 유통 체인 × 콜라겐 젤리 스틱 (FFC)
    id: 'C-2026-0001', sample: true, country: 'JP', buyerId: 'B-001', productId: 'P-002',
    stage: 'regulatory', createdAt: '2026-11-04', targetLaunchDate: '2027-06-01',
    regulatory: { category: 'ffc', claimInputs: { main: '임산부에게도 좋은 피부 보습' } },
    request: {}, cost: {}
  },
  {
    // 시나리오 B: 베트남 — 약국 체인 납품사 × 유산균 캡슐
    id: 'C-2026-0002', sample: true, country: 'VN', buyerId: 'B-002', productId: 'P-001',
    stage: 'agreed', createdAt: '2026-11-04', targetLaunchDate: '2027-04-01',
    regulatory: {
      claimInputs: {
        vnRegistered: 'Hỗ trợ tiêu hóa, giúp cân bằng hệ vi sinh đường ruột.',
        vnLabel: 'Hỗ trợ tiêu hóa, giúp cân bằng hệ vi sinh đường ruột.',
        vnAd: 'Hỗ trợ tiêu hóa, chữa rối loạn tiêu hóa.'
      }
    },
    request: { plannedSubmitDate: '2026-12-01' }, cost: {}
  },
  {
    // 시나리오 C: 미국 — 브랜드사 × 개별인정형 원료 포함 제품
    id: 'C-2026-0003', sample: true, country: 'US', buyerId: 'B-003', productId: 'P-003',
    stage: 'request', createdAt: '2026-11-04', targetLaunchDate: '2027-03-01',
    regulatory: { ndiConfirmed: true, claimInputs: { main: 'Supports joint comfort' } },
    request: { ndiPlan: 'both', status: 'sent', sentAt: '2026-11-02' }, cost: {}
  }
];

window.DASH_DATA.sampleDocs = [
  { id: 'D-001', sample: true, productId: 'P-001', type: 'TEST_REPORT', issuedAt: '2025-09-10', expiresAt: null,
    lab: { name: '가상 시험연구원', iso17025: true, mohDesignated: false }, legalization: 'none', fileName: 'test_report_P001.pdf', note: '' },
  { id: 'D-002', sample: true, productId: 'P-001', type: 'CFS', issuedAt: '2026-08-20', expiresAt: null,
    lab: null, legalization: 'none', fileName: 'cfs_P001.pdf', note: '합법화 전' },
  { id: 'D-003', sample: true, productId: 'P-001', type: 'GMP', issuedAt: '2026-03-01', expiresAt: '2029-02-28',
    lab: null, legalization: 'none', fileName: 'gmp_factory.pdf', note: 'P-001 생산 라인 (예시)' }
];
