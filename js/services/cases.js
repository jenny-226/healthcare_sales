// 건(case)·바이어(buyer) 데이터 접근. 2단계에서 서버 호출로 바꿀 곳.
(function () {
  const DASH = window.DASH;
  const store = DASH.store;
  DASH.services = DASH.services || {};

  function nextSeq(list, prefix, width) {
    let max = 0;
    list.forEach(x => {
      if (x.id && x.id.startsWith(prefix)) {
        const n = parseInt(x.id.slice(prefix.length), 10);
        if (n > max) max = n;
      }
    });
    return prefix + String(max + 1).padStart(width, '0');
  }

  // ---------- 건 ----------
  // 등록·신고 탭은 없앴다. 견적 합의 뒤 현지 절차는 바이어(명의자)가 진행한다 → 'agreed'
  const STAGES = [
    { id: 'regulatory', label: '규제 확인', tab: 'regulatory' },
    { id: 'request', label: '개발', tab: 'request' },
    { id: 'cost', label: '견적', tab: 'cost' },
    { id: 'agreed', label: '견적 합의', tab: 'cost' }
  ];
  // 예전 저장 데이터의 단계(registration·selling)는 '견적 합의'로 읽는다
  const LEGACY_STAGE = { registration: 'agreed', selling: 'agreed' };

  function list() {
    return store.get('cases', []).map(c => (LEGACY_STAGE[c.stage] ? Object.assign({}, c, { stage: LEGACY_STAGE[c.stage] }) : c));
  }
  function get(id) { return list().find(c => c.id === id) || null; }
  function save(c) {
    const all = list();
    const i = all.findIndex(x => x.id === c.id);
    if (i >= 0) all[i] = c; else all.push(c);
    store.set('cases', all);
    return c;
  }
  function remove(id) { store.set('cases', list().filter(c => c.id !== id)); }

  function create(fields) {
    const year = DASH.dates.today().slice(0, 4);
    const c = {
      id: nextSeq(list(), `C-${year}-`, 4),
      sample: false,
      country: fields.country,
      buyerId: fields.buyerId,
      productId: fields.productId,
      stage: 'regulatory',
      createdAt: DASH.dates.today(),
      targetLaunchDate: fields.targetLaunchDate || '',
      regulatory: { claimInputs: {} },
      request: { status: 'draft' },
      cost: {}
    };
    return save(c);
  }

  // 견적이 합의되어 바이어가 현지 등록·신고를 진행하는 건인지 (처방 변경 경고 기준)
  function registrationStarted(c) {
    return c.stage === 'agreed' || !!LEGACY_STAGE[c.stage];
  }

  // README 7-3 처방 변경 경고 문구
  const FORMULA_CHANGE_WARN = {
    VN: '베트남: 등록 후 처방이 바뀌면 변경 신고가 아니라 새 등록이 필요합니다 (VN-CHG-01).',
    US: '미국: 새로 들어간 원료가 NDI에 해당하는지 다시 확인하세요 (US-NDI-01·02).',
    JP: '일본: 신고 내용과 근거 자료의 성분·함량이 바뀐 처방과 맞는지 다시 확인하세요 (JP-EVD-01).'
  };

  // 제품 처방이 바뀌었을 때: 그 제품을 쓰는 건 중 등록·신고가 시작된 건에 기록하고 경고 목록을 돌려준다
  function flagFormulaChange(productId, note) {
    const affected = [];
    list().forEach(c => {
      if (c.productId !== productId || !registrationStarted(c)) return;
      c.formulaChangedAfterReg = { at: DASH.dates.today(), note: note || '처방 변경' };
      save(c);
      affected.push({ caseId: c.id, country: c.country, message: FORMULA_CHANGE_WARN[c.country] });
    });
    return affected;
  }

  // ---------- 바이어 ----------
  // README 5-2 유형 코드
  const BUYER_TYPES = {
    JP: [
      { value: 'seller_notifier', label: '판매·신고 사업자' },
      { value: 'retail_chain', label: '유통 체인' },
      { value: 'cross_border', label: '크로스보더 셀러' }
    ],
    VN: [
      { value: 'importer_registrant', label: '수입·등록 법인' },
      { value: 'pharmacy_supplier', label: '약국 체인 납품사' }
    ],
    US: [
      { value: 'brand_owner', label: '브랜드사' },
      { value: 'retail_supplier', label: '대형 유통사 납품사' },
      { value: 'online_seller', label: '온라인 셀러' }
    ]
  };

  // README 7-1 명의자 역량 체크 항목
  const CAPABILITIES = {
    JP: [
      { key: 'ffcRecord', label: 'FFC 신고 실적' },
      { key: 'adverseReporting', label: '건강피해 보고 체계' }
    ],
    VN: [
      { key: 'localEntity', label: '베트남 현지 법인' },
      { key: 'pastRegistrations', label: '건강보호식품 등록 경험(건수)', type: 'number' },
      { key: 'canAcceptLoA', label: '제조사 위임장(LoA) 수령 구조' }
    ],
    US: [
      { key: 'fsvpImporter', label: 'FSVP 수입자 역할' },
      { key: 'retailerDocs', label: '유통사 요구 서류 파악' }
    ]
  };

  function typeLabel(country, code) {
    const t = (BUYER_TYPES[country] || []).find(x => x.value === code);
    return t ? t.label : code || '-';
  }

  // 부족한 역량 목록 (비어 있으면 부족 없음). 정보가 없으면 '미입력'으로 취급
  function capabilityGaps(buyer, country) {
    const c = country || buyer.country;
    const hc = buyer.holderCapability && buyer.holderCapability[c];
    const defs = CAPABILITIES[c] || [];
    if (!hc) return defs.map(d => d.label + ' (미입력)');
    return defs.filter(d => d.type === 'number' ? !(Number(hc[d.key]) > 0) : hc[d.key] !== true).map(d => d.label);
  }

  function blist() { return store.get('buyers', []); }
  function bget(id) { return blist().find(b => b.id === id) || null; }
  function bsave(b) {
    const all = blist();
    if (!b.id) b.id = nextSeq(all, 'B-', 3);
    const i = all.findIndex(x => x.id === b.id);
    if (i >= 0) all[i] = b; else all.push(b);
    store.set('buyers', all);
    return b;
  }
  function bremove(id) { store.set('buyers', blist().filter(b => b.id !== id)); }

  DASH.services.cases = { STAGES, FORMULA_CHANGE_WARN, list, get, save, remove, create, registrationStarted, flagFormulaChange };
  DASH.services.buyers = { TYPES: BUYER_TYPES, CAPABILITIES, typeLabel, capabilityGaps, list: blist, get: bget, save: bsave, remove: bremove };
})();
