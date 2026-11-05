// 규칙 데이터 읽기 (data/rules-*.js). 읽기 전용 — 수정은 규칙 파일에서 사람이 한다.
(function () {
  const DASH = window.DASH;
  DASH.services = DASH.services || {};
  const COUNTRY_CODES = ['JP', 'VN', 'US'];

  function packs() { return (window.DASH_DATA && window.DASH_DATA.rules) || {}; }
  function forCountry(c) { return packs()[c] || null; }
  function rules(c) { const p = forCountry(c); return p ? p.rules : []; }
  function rule(id) {
    for (const c of COUNTRY_CODES) {
      const r = rules(c).find(x => x.id === id);
      if (r) return r;
    }
    return null;
  }
  // 규칙 수치는 코드에 하드코딩하지 않고 params에서 읽는다 (README 6-1)
  function param(id, key, fallback) {
    const r = rule(id);
    return r && r.params && r.params[key] !== undefined ? r.params[key] : fallback;
  }
  function claimTerms(c) { return ((window.DASH_DATA && window.DASH_DATA.claimTerms) || {})[c] || {}; }

  function timeline() {
    const out = [];
    COUNTRY_CODES.forEach(c => {
      const p = forCountry(c);
      ((p && p.timeline) || []).forEach(t => out.push(Object.assign({ country: c }, t)));
    });
    return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  function versions() {
    const v = {};
    COUNTRY_CODES.forEach(c => { const p = forCountry(c); if (p) v[c] = p.version; });
    return v;
  }

  DASH.services.rules = { COUNTRY_CODES, forCountry, rules, rule, param, claimTerms, timeline, versions };
})();
