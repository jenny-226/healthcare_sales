// 참고 데이터 조회: 식약처 원료(data/kr-ingredients.js) · 일본 의약품 전용 성분(data/jp-pharma-only.js) · FDA 리콜(data/fda-recalls.js)
// 이름 대조 결과는 '후보'일 뿐이다. 판정·플래그는 사람이 확인한 뒤 바꾼다.
(function () {
  const DASH = window.DASH;
  DASH.services = DASH.services || {};
  const data = k => (window.DASH_DATA && window.DASH_DATA[k]) || null;

  // 비교용: 소문자, 한글·영문·숫자만
  function norm(s) { return String(s || '').toLowerCase().replace(/[^0-9a-z가-힣ぁ-んァ-ヶー一-龯]/g, ''); }

  // ---------- 식약처 원료 ----------
  function krAll() {
    const d = data('krIngredients');
    if (!d) return [];
    if (!d._all) {
      d._all = d.notified.map(x => Object.assign({ type: 'notified', key: norm(x.name) }, x))
        .concat(d.individual.map(x => Object.assign({ type: 'individual', key: norm(x.name) }, x)));
    }
    return d._all;
  }
  function krMatch(ing) {
    const n = norm(ing && ing.nameKo);
    if (n.length < 2) return [];
    const all = krAll();
    let hits = all.filter(x => x.key === n);
    if (!hits.length) hits = all.filter(x => x.key.length >= 2 && (x.key.includes(n) || (x.key.length >= 3 && n.includes(x.key))));
    // 같은 종류·같은 이름은 한 줄로 (개별인정형은 인정번호 여러 개)
    const groups = [];
    hits.forEach(x => {
      let g = groups.find(y => y.type === x.type && y.key === x.key);
      if (!g) { g = Object.assign({ nos: [] }, x); groups.push(g); }
      if (x.no) g.nos.push(x.no);
    });
    return groups.slice(0, 3);
  }

  // ---------- 일본 의약품 전용 성분 ----------
  function jpItems() { const d = data('jpPharmaOnly'); return d ? d.items : []; }
  function jpSource() { const d = data('jpPharmaOnly'); return d ? d.source : null; }
  // 영문 이름(학명·물질명)이 목록의 라틴 표기와 겹치면 후보로 본다
  function latinKeys(item) {
    return (item.name + '/' + item.other).split('/').map(s => norm(s.replace(/属/g, ''))).filter(k => /^[0-9a-z]{4,}$/.test(k));
  }
  function jpCandidates(ing) {
    const en = norm(ing && ing.nameEn);
    const ja = norm(ing && ing.nameKo);
    return jpItems().filter(it => {
      if (en.length >= 4 && latinKeys(it).some(k => en.includes(k) || k.includes(en))) return true;
      return ja.length >= 2 && (it.name + '/' + it.other).split('/').some(s => norm(s) === ja);
    }).slice(0, 3);
  }
  function jpSearch(q) {
    const n = norm(q);
    if (!n) return jpItems();
    return jpItems().filter(it => norm(it.name + it.other + it.parts + it.note).includes(n));
  }

  // ---------- FDA 리콜 ----------
  function fdaItems() { const d = data('fdaRecalls'); return d ? d.items : []; }
  function fdaSource() { const d = data('fdaRecalls'); return d ? d.source : null; }
  function fdaSearch(q) {
    const t = String(q || '').trim().toLowerCase();
    if (t.length < 3) return [];
    return fdaItems().filter(r => (r.product + ' ' + r.reason + ' ' + r.firm).toLowerCase().includes(t));
  }

  // ---------- 이름 대조표 (data/ingredient-aliases.js) ----------
  function aliasAll() {
    const d = window.DASH_DATA && window.DASH_DATA.ingredientAliases;
    if (!d) return [];
    if (!d._parsed) {
      d._parsed = d.map(([ko, en, ja]) => {
        const kos = ko.split('|').filter(Boolean);
        const ens = en.split('|').filter(Boolean);
        return { ko: kos, en: ens, ja: ja || '', keys: kos.concat(ens, ja ? [ja] : []).map(norm).filter(Boolean) };
      });
    }
    return d._parsed;
  }
  // 입력 이름과 같은 대조표 항목. 이름이 정확히 같거나, 입력이 한국어 이름을 포함하면(예: 녹용추출물 ⊃ 녹용) 찾은 것으로 본다
  function aliasesFor(names) {
    const ns = names.map(norm).filter(n => n.length >= 2);
    if (!ns.length) return [];
    return aliasAll().filter(a => a.keys.some(k => ns.includes(k)) ||
      a.ko.some(k => { const kk = norm(k); return kk.length >= 2 && ns.some(n => /[가-힣]/.test(n) && n.includes(kk)); }));
  }

  // ---------- 의약품 해당 여부 (출처를 고르지 않고 DB 사본 전체를 한 번에 대조) ----------
  const DRUG_RE = /drug|unapproved|pharmaceutical|controlled substance|sildenafil|tadalafil|sibutramine|dmaa|steroid/i;
  function isLatin(s) { return /^[\x20-\x7e]+$/.test(String(s || '')) && /[a-z]/i.test(s); }

  // 일본 목록 항목의 부위 조건: 備考에 「非医」가 있으면 다른 부위·유사 원료는 의약품이 아님 → 부위 확인 필요
  function jpLevel(item) { return /非医/.test(item.note || '') ? 'partial' : 'listed'; }

  // 입력: {nameKo, nameEn} 또는 검색어 문자열 하나. 결과는 '후보'이며 승인·허용 판단이 아니다.
  function lookup(input) {
    const nameKo = typeof input === 'string' ? input : (input && input.nameKo) || '';
    const nameEn = typeof input === 'string' ? '' : (input && input.nameEn) || '';
    const names = [nameKo, nameEn].map(s => String(s).trim()).filter(Boolean);
    const aliases = aliasesFor(names);
    const enTerms = Array.from(new Set(names.filter(isLatin).concat(...aliases.map(a => a.en))));
    const jaNames = aliases.map(a => a.ja).filter(Boolean);

    // 일본 의약품 전용 목록
    // 이름이 정확히 같은 항목을 먼저 보고, 없을 때만 학명 부분 일치(예: Aloe vera ⊃ aloe)로 넓힌다
    const exact = it => {
      const parts = (it.name + '/' + it.other).split('/').map(s => s.trim()).filter(Boolean);
      if (jaNames.some(j => parts.includes(j))) return true;
      if (names.some(n => { const k = norm(n); return k.length >= 2 && parts.some(p => norm(p) === k); })) return true;
      return enTerms.some(t => latinKeys(it).includes(norm(t)));
    };
    const loose = it => latinKeys(it).some(k => enTerms.some(t => { const e = norm(t); return e.length >= 5 && (e.includes(k) || k.includes(e)); }));
    let jpRaw = jpItems().filter(exact);
    if (!jpRaw.length) jpRaw = jpItems().filter(loose);
    const jpHits = jpRaw.slice(0, 5).map(it => Object.assign({ level: jpLevel(it) }, it));
    const jp = jpHits.some(x => x.level === 'listed') ? 'listed' : jpHits.length ? 'partial' : 'none';

    // 식약처 원료
    const kr = krMatch({ nameKo: nameKo || nameEn });
    const ks = krStatus({ nameKo, nameEn });

    // FDA 리콜 (영문 이름으로 대조)
    const seen = new Set();
    const recalls = [];
    enTerms.filter(t => t.trim().length >= 4).forEach(t => fdaSearch(t).forEach(r => { if (!seen.has(r.no)) { seen.add(r.no); recalls.push(r); } }));
    const drugRecalls = recalls.filter(r => DRUG_RE.test(r.reason));

    return {
      names, aliases, enTerms, recognized: aliases.length > 0 || isLatin(nameKo) || !!nameEn,
      jp, jpHits, kr, krStatus: ks, recalls, drugRecalls
    };
  }

  // 한국 원료 구분: 이름이 정확히 같은 원료만 본다. (제○○호)가 붙은 항목은 개별인정형으로 본다
  function krKeys(name) {
    const s = String(name || '');
    const base = s.replace(/\([^)]*\)/g, ' ');
    const inner = (s.match(/\(([^)]*)\)/g) || []).map(x => x.slice(1, -1)).filter(x => !/제\s*\d{4}-\d+\s*호/.test(x));
    return [base].concat(...inner.map(x => x.split(','))).map(norm).filter(k => k.length >= 2);
  }
  function krIndex() {
    const d = data('krIngredients');
    if (!d) return null;
    if (!d._idx) {
      const idx = { individual: new Set(), notified: new Set() };
      d.notified.forEach(x => { if (!x.name) return; const t = /제\s*\d{4}-\d+\s*호/.test(x.name) ? 'individual' : 'notified'; krKeys(x.name).forEach(k => idx[t].add(k)); });
      d.individual.forEach(x => krKeys(x.name).forEach(k => idx.individual.add(k)));
      d._idx = idx;
    }
    return d._idx;
  }
  // → 'individual' | 'notified' | 'both' | 'none'
  function krStatus(ing) {
    const idx = krIndex();
    if (!idx) return 'none';
    const ks = [ing && ing.nameKo, ing && ing.nameEn].map(norm).filter(k => k.length >= 2);
    const ind = ks.some(k => idx.individual.has(k));
    const not = ks.some(k => idx.notified.has(k));
    return ind && not ? 'both' : ind ? 'individual' : not ? 'notified' : 'none';
  }

  // 성분명 자동완성 (COSTD: 2글자 이상 → 앞글자 일치 우선, 중복 제거 후 최대 10개)
  function suggest(q, extra) {
    const n = norm(q);
    if (n.length < 2) return [];
    const names = [];
    const seen = new Set();
    const push = (label, kind) => { const k = norm(label); if (k && !seen.has(k)) { seen.add(k); names.push({ label, kind, k }); } };
    (extra || []).forEach(x => push(x, '처방'));
    aliasAll().forEach(a => { push(a.ko[0], a.ja ? '일본 목록 대조 가능' : '대조표'); a.ko.slice(1).forEach(k => push(k, '대조표')); });
    krAll().forEach(x => push(x.name, x.type === 'individual' ? '개별인정형' : '고시형'));
    jpItems().forEach(x => push(x.name, '일본 의약품 전용'));
    const starts = names.filter(x => x.k.startsWith(n));
    const has = names.filter(x => !x.k.startsWith(n) && x.k.includes(n));
    return starts.concat(has).slice(0, 10);
  }

  DASH.services.reference = { suggest, krMatch, krStatus, jpItems, jpSource, jpCandidates, jpSearch, fdaItems, fdaSource, fdaSearch, lookup, aliasesFor };
})();
