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

  DASH.services.reference = { krMatch, jpItems, jpSource, jpCandidates, jpSearch, fdaItems, fdaSource, fdaSearch };
})();
