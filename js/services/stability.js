// 요청서 연동과 근거 기반 사전검토. 검증되지 않은 균주별 예측계수는 만들지 않는다.
(function () {
  const D = window.DASH;
  const numeric = v => v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v));
  const definitions = [
    ['strainId', '균주', 'text'], ['targetCFU', '유통기한 말 목표 균수 (CFU/1회)', 'number', 1, 1e15],
    ['months', '목표 보관기간 (개월)', 'number', 1, 120],
    ['temperature', '보관 온도 (°C)', 'number', -80, 80],
    ['aw', '수분활성도 (aw)', 'number', 0, 1],
    ['awSource', '수분활성도 근거', 'text']
  ];
  function library() { return D.store.get('stability:library', { strains: [], studies: [] }); }
  function resolve(c) {
    const p = D.services.products.get(c.productId) || {};
    const r = c.request || {}, explicit = r.stability || {}, values = {}, sources = {};
    const put = (k, v, s) => { values[k] = v; sources[k] = s; };
    put('product', r.productName ?? p.name ?? '', r.productName !== undefined ? '개발요청서' : '제품 DB');
    put('form', r.form || p.form || '', r.form ? '개발요청서' : '제품 DB');
    const pack = (window.DASH_DATA.packagingPresets || []).find(x => x.id === r.packagingPresetId);
    put('packaging', pack ? pack.label : '', '개발요청서');
    const text = [r.description, r.ingredientReq, r.usage, r.referenceNote].filter(Boolean).join('\n');
    function extract(k, regex, convert) {
      const matches = Array.from(text.matchAll(regex));
      const unique = [...new Set(matches.map(convert))];
      if (unique.length === 1) put(k, unique[0], '요청서 문장 추출 · 확인 필요');
      else if (unique.length > 1) sources[k] = '서로 다른 요청값 · 직접 확인 필요';
    }
    extract('targetCFU', /([\d,]+(?:\.\d+)?)\s*(억|만|billion|million)?\s*CFU/gi, m => Number(m[1].replace(/,/g, '')) * ({ 억: 1e8, 만: 1e4, billion: 1e9, million: 1e6 }[(m[2] || '').toLowerCase()] || 1));
    extract('months', /(\d+)\s*(?:개월|months?)/gi, m => Number(m[1]));
    extract('temperature', /(-?\d+(?:\.\d+)?)\s*°\s*C/gi, m => Number(m[1]));
    if (!r.form && /젤리/.test(text)) put('form', 'jelly_stick', '요청서 문장 추출 · 확인 필요');
    if (!pack && /개별\s*포장/.test(text)) put('packaging', '개별 포장', '요청서 문장 추출 · 확인 필요');
    // 기준 처방의 CFU는 유통기한 말 보장량과 다르므로 목표량으로 대입하지 않는다.
    definitions.forEach(([k]) => { if (Object.prototype.hasOwnProperty.call(explicit, k)) put(k, explicit[k], '개발요청서 · 안정성 조건'); });
    const overrides = c.stabilityScenario || {};
    Object.keys(overrides).forEach(k => put(k, overrides[k], '시나리오 수정값'));
    return { values, sources, text, product: p };
  }
  function validate(v) {
    const errors = [];
    definitions.filter(x => x[2] === 'number').forEach(([k, label, , min, max]) => {
      if (v[k] !== undefined && v[k] !== '' && v[k] !== null && (!numeric(v[k]) || Number(v[k]) < min || Number(v[k]) > max || (k === 'months' && !Number.isInteger(Number(v[k]))))) errors.push(`${label}: ${min}~${max} 범위를 확인하세요.`);
    });
    [['initialCFU', 1, 1e15], ['lossRate', 0, 10]].forEach(([k, min, max]) => {
      if (v[k] !== undefined && v[k] !== '' && (!numeric(v[k]) || Number(v[k]) < min || Number(v[k]) > max)) errors.push(k === 'initialCFU' ? '초기 균수 범위를 확인하세요.' : '월별 log10 감소량은 0~10이어야 합니다.');
    });
    return errors;
  }
  function analyze(c) {
    const resolved = resolve(c), v = resolved.values, lib = library();
    const errors = validate(v);
    const missing = ['strainId', 'targetCFU', 'form', 'months', 'temperature', 'packaging', 'aw', 'awSource'].filter(k => v[k] === undefined || v[k] === '' || v[k] === null);
    if (v.strainId && !lib.strains.some(s => s.id === v.strainId)) missing.push('registeredStrain');
    const studies = lib.studies.filter(s => s.strainId === v.strainId);
    const matched = studies.filter(s => ['form', 'packaging'].every(k => s[k] === v[k]) && ['temperature', 'aw'].every(k => numeric(v[k]) && Number(s[k]) === Number(v[k])));
    const notes = [
      /jelly|liquid/.test(v.form || '') ? '젤리·액상: 수분활성도, pH, 가열 공정과 균 투입 시점에 따른 생존율을 확인하세요.' : '제형 적합성은 균주별 시험자료와 실제 제조 공정으로 확인하세요.',
      numeric(v.temperature) ? `${v.temperature}°C 조건 외에도 유통 중 온도 이탈과 상대습도를 시험계획에 반영하세요.` : '상온이라는 표현만으로 25°C를 확정하지 않습니다. 시험 온도를 확인하세요.',
      '수분활성도는 수분함량과 다릅니다. 완제품의 제조 직후 및 보관 중 실측값을 확인하세요.',
      '개별 포장 여부만으로 차단성을 판단할 수 없습니다. 포장재의 수분·산소 투과도, 밀봉성, 건조제와 개봉 조건을 확인하세요.'
    ];
    const curve = [];
    if (!errors.length && numeric(v.initialCFU) && numeric(v.lossRate) && numeric(v.months)) {
      for (let month = 0; month <= Number(v.months); month++) curve.push({ month, cfu: Number(v.initialCFU) * Math.pow(10, -Number(v.lossRate) * month) });
    }
    const rd = [
      `균주 ${v.strainId || '미지정'}의 ${D.ui.FORMS[v.form] || v.form || '미지정 제형'} 적합성 및 제조 공정 생존율 확인`,
      `목표 ${v.targetCFU || '미입력'} CFU/1회, ${v.months || '미입력'}개월, ${v.temperature ?? '미입력'}°C에서 실시간 안정성 시험 설계`,
      '초기 투입량·제조 후 생균수·유통기한 말 보장량, 로트 및 계수법 확인',
      '완제품 aw·pH·상대습도와 포장 차단성 자료 확보',
      matched.length ? '조건 일치 시험의 처방·공정·로트·시험법까지 동일한지 검토 및 추가 시험 범위 확정' : '조건 일치 시험자료 없음: 목표 보관기간까지 완제품 안정성 시험 필요'
    ];
    return { ...resolved, errors, missing, studies, matched, notes, curve, rd };
  }
  function importLibrary(payload) {
    if (!payload || !Array.isArray(payload.strains) || !Array.isArray(payload.studies)) throw new Error('strains와 studies 배열이 필요합니다.');
    const ids = new Set();
    payload.strains.forEach(s => {
      if (!s || typeof s.id !== 'string' || !s.id.trim() || typeof s.name !== 'string' || !s.name.trim() || ids.has(s.id)) throw new Error('균주 ID와 이름을 확인하세요. ID는 중복될 수 없습니다.');
      ids.add(s.id);
    });
    const studyIds = new Set();
    payload.studies.forEach(s => {
      if (!s || typeof s.id !== 'string' || !s.id.trim() || studyIds.has(s.id) || !ids.has(s.strainId) || !s.source || !s.form || !s.packaging || typeof s.temperature !== 'number' || typeof s.aw !== 'number' || s.aw < 0 || s.aw > 1 || !Number.isFinite(s.temperature) || !Number.isFinite(s.aw) || !Array.isArray(s.points) || !s.points.length) throw new Error('시험 ID·균주·출처·제형·포장·온도·aw·측정값을 확인하세요.');
      studyIds.add(s.id);
      const months = new Set();
      s.points.forEach(p => {
        if (!p || !Number.isFinite(p.month) || p.month < 0 || !Number.isFinite(p.cfu) || p.cfu <= 0 || months.has(p.month)) throw new Error('시험 월은 중복 없는 0 이상 숫자, CFU는 0보다 큰 숫자여야 합니다.');
        months.add(p.month);
      });
    });
    // 파일의 ID로 갱신하되 다른 등록 자료는 보존한다.
    const previous = library();
    const merge = (a, b) => [...new Map(a.concat(b).map(x => [x.id, x])).values()];
    if (!D.store.set('stability:library', { strains: merge(previous.strains, payload.strains), studies: merge(previous.studies, payload.studies) })) throw new Error('자료를 저장하지 못했습니다. 저장 공간을 확인하세요.');
  }
  D.services.stability = { definitions, library, resolve, validate, analyze, importLibrary };
})();
