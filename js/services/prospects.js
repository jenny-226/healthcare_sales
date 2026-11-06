// 바이어 발굴: 잠재 바이어 목록·영업 적합도 점수·자사 제조 역량·영업 관리 목록(pipeline).
// 잠재 바이어는 data/buyer-prospects.js (지금은 가상 데이터). 2단계에서 수집 DB 조회로 바꿀 곳.
(function () {
  const DASH = window.DASH;
  const store = DASH.store;
  DASH.services = DASH.services || {};
  const data = k => (window.DASH_DATA && window.DASH_DATA[k]) || null;

  function masters() { return data('buyerMasters') || { countries: [], types: [], categories: [], ingredients: [], dealTypes: [], channels: [] }; }
  function list() { return data('buyerProspects') || []; }
  function get(id) { return list().find(p => p.id === id) || null; }
  function countryName(code) { const c = masters().countries.find(x => x.code === code); return c ? c.name : code; }
  function countryTz(code) { const c = masters().countries.find(x => x.code === code); return c ? c.tz : 'UTC'; }
  function typeLabel(v) { const t = masters().types.find(x => x.value === v); return t ? t.label : v; }

  // ---------- 자사 제조 역량 ----------
  function capability() { return Object.assign({}, data('companyCapability') || {}, store.get('settings:capability', {})); }
  function setCapability(v) { store.set('settings:capability', v); }

  // ---------- 제품 → 검색 조건 자동 반영 ----------
  const CATEGORY_HINTS = [
    ['장 건강', /장|유산균|probiotic|gut/i], ['뷰티·이너뷰티', /피부|보습|콜라겐|beauty|skin/i], ['관절·뼈', /관절|뼈|joint|bone/i],
    ['면역', /면역|immune/i], ['수면·스트레스', /수면|스트레스|sleep/i], ['체중 관리', /체중|체지방|weight/i],
    ['눈 건강', /눈|eye|루테인/i], ['간 건강', /간 건강|liver|밀크씨슬/i], ['비타민·미네랄', /비타민|미네랄|vitamin|mineral/i]
  ];
  function categoryOf(product) {
    if (!product) return '';
    if (product.category) return product.category;
    const text = `${product.name} ${product.koreaClaim || ''}`;
    const hit = CATEGORY_HINTS.find(([, re]) => re.test(text));
    return hit ? hit[0] : '';
  }
  function ingredientsOf(product) {
    const names = ((product && product.formula) || []).map(i => `${i.nameKo || ''} ${i.nameEn || ''}`.toLowerCase());
    return masters().ingredients.filter(m => names.some(n => n.includes(m.toLowerCase())));
  }
  function criteriaFromProduct(product) {
    return { categories: [categoryOf(product)].filter(Boolean), ingredients: ingredientsOf(product), forms: product ? [product.form] : [] };
  }

  // ---------- 영업 적합도 (0~100, 영업 우선순위 지표 — 구매 확률 아님) ----------
  const inter = (a, b) => (a || []).filter(x => (b || []).includes(x));
  function score(p, cr) {
    cr = cr || {};
    const cap = capability();
    const parts = [];
    const add = (key, label, max, ratio, why) => parts.push({ key, label, max, got: Math.round(max * Math.max(0, Math.min(1, ratio))), why });

    if ((cr.categories || []).length) {
      const hit = inter(cr.categories, p.categories);
      add('cat', '제품군 일치', 25, hit.length / cr.categories.length, hit.length ? `취급: ${hit.join(', ')}` : '찾는 제품군을 취급하지 않음');
    } else add('cat', '제품군 일치', 25, 0.5, '제품 카테고리 미선택 → 중간값');

    const producible = inter(p.forms, cap.forms);
    if ((cr.forms || []).length) {
      const ok = cr.forms.filter(f => p.forms.includes(f) && (cap.forms || []).includes(f));
      add('form', '제형 생산 가능', 20, ok.length / cr.forms.length, ok.length ? `바이어 취급 + 자사 생산: ${ok.map(f => DASH.ui.FORMS[f] || f).join(', ')}` : '희망 제형을 바이어가 취급하지 않거나 자사 생산 불가');
    } else add('form', '제형 생산 가능', 20, p.forms.length ? producible.length / p.forms.length : 0, `바이어 제형 ${p.forms.length}개 중 ${producible.length}개 생산 가능`);

    if ((cr.ingredients || []).length) {
      const hit = inter(cr.ingredients, p.ingredients);
      add('ing', '취급 원료 유사', 20, hit.length / cr.ingredients.length, hit.length ? `겹치는 원료: ${hit.join(', ')}` : '겹치는 원료 없음');
    } else {
      const hit = inter(cap.strengths, p.ingredients);
      add('ing', '취급 원료 유사', 20, hit.length ? 0.5 + 0.25 * hit.length : 0.25, hit.length ? `자사 주력 원료와 겹침: ${hit.join(', ')}` : '관심 원료 미선택');
    }

    const deals = inter((cr.dealTypes || []).length ? cr.dealTypes : p.dealTypes, inter(p.dealTypes, cap.dealTypes));
    add('deal', '거래 형태 적합', 15, deals.length ? 1 : 0, deals.length ? deals.join('·') : `바이어 ${p.dealTypes.join('·')} ↔ 자사 ${(cap.dealTypes || []).join('·')}`);

    const pack = DASH.services.rules.forCountry(p.country);
    add('reg', '국가 진입 준비', 10, pack ? 1 : 0.4, pack ? `규제 규칙 등록 국가 · ${pack.entry}` : '규제 규칙 미등록 국가 — 수동 확인');

    const req = p.certsRequired || [];
    const held = req.filter(c => (cap.certs || []).some(x => x.toLowerCase() === c.toLowerCase()));
    add('cert', '요구 인증 보유', 10, req.length ? held.length / req.length : 1, req.length ? `${held.length}/${req.length} 보유${req.length > held.length ? ` · 확인 필요: ${req.filter(c => !held.includes(c)).join(', ')}` : ''}` : '요구 인증 정보 없음');

    const total = parts.reduce((s, x) => s + x.got, 0);
    const reasons = parts.filter(x => x.got / x.max >= 0.75 && x.key !== 'reg').sort((a, b) => b.got / b.max - a.got / a.max).slice(0, 2).map(x => x.label);
    const flags = parts.filter(x => x.got / x.max < 0.4).map(x => x.key === 'cert' ? '인증 확인 필요' : x.key === 'reg' ? '규제 수동 확인' : x.label + ' 낮음');
    return { total, parts, reasons, flags, priority: total >= 80 ? 'A' : total >= 60 ? 'B' : 'C' };
  }

  function search(cr) {
    cr = cr || {};
    return list()
      .filter(p => !(cr.countries || []).length || cr.countries.includes(p.country))
      .filter(p => !(cr.types || []).length || cr.types.includes(p.type))
      .map(p => ({ p, s: score(p, cr) }))
      .sort((a, b) => b.s.total - a.s.total);
  }

  // 바이어에게 제안할 자사 제품 (제품마다 같은 점수식으로 비교)
  function matchProducts(p) {
    return DASH.services.products.list().map(prod => ({ prod, s: score(p, Object.assign({}, criteriaFromProduct(prod), { dealTypes: [] })) }))
      .sort((a, b) => b.s.total - a.s.total);
  }

  // ---------- 영업 관리 목록 ----------
  const STATUSES = [
    { value: 'found', label: '발굴' }, { value: 'contacted', label: '첫 연락' }, { value: 'replied', label: '회신' },
    { value: 'sample', label: '샘플·견적' }, { value: 'converted', label: '건 전환' }, { value: 'hold', label: '보류' }
  ];
  function plist() { return store.get('pipeline', []); }
  function pget(prospectId) { return plist().find(x => x.prospectId === prospectId) || null; }
  function psave(e) {
    const all = plist();
    const i = all.findIndex(x => x.prospectId === e.prospectId);
    if (i >= 0) all[i] = e; else all.push(e);
    store.set('pipeline', all);
    return e;
  }
  function premove(prospectId) { store.set('pipeline', plist().filter(x => x.prospectId !== prospectId)); }
  function notes(id) { return (store.get('prospectNotes', {}))[id] || {}; }
  function setNote(id, k, v) { const all = store.get('prospectNotes', {}); all[id] = Object.assign({}, all[id], { [k]: v }); store.set('prospectNotes', all); }

  // 건 전환 시 바이어 유형 매핑 (cases.js BUYER_TYPES)
  const TYPE_MAP = {
    JP: { brand: 'seller_notifier', d2c: 'seller_notifier', distributor: 'retail_chain', pb: 'retail_chain', pharmacy: 'retail_chain' },
    VN: { brand: 'importer_registrant', d2c: 'importer_registrant', distributor: 'importer_registrant', pb: 'importer_registrant', pharmacy: 'pharmacy_supplier' },
    US: { brand: 'brand_owner', d2c: 'online_seller', distributor: 'retail_supplier', pb: 'retail_supplier', pharmacy: 'retail_supplier' }
  };

  DASH.services.prospects = {
    masters, list, get, countryName, countryTz, typeLabel, capability, setCapability,
    categoryOf, ingredientsOf, criteriaFromProduct, score, search, matchProducts,
    STATUSES, TYPE_MAP, pipeline: { list: plist, get: pget, save: psave, remove: premove }, notes, setNote
  };
})();
