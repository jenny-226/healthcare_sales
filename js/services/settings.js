// 관리자 설정: 환율, 공휴일. 홈·원가 탭·dates.js가 함께 쓴다.
(function () {
  const DASH = window.DASH;
  const store = DASH.store;
  DASH.services = DASH.services || {};

  // 환율: 외화 1단위당 원화. 관리자 메뉴에서 직접 입력한 값 → 없으면 DB 기준 환율(data/fx-rates.js)
  function dbFx() {
    const r = window.DASH_DATA && window.DASH_DATA.fxRates;
    return r ? { USD: r.USD || 0, JPY: r.JPY || 0, VND: r.VND || 0, date: r.date || '', source: r.source || 'DB', fromDb: true } : null;
  }
  function fx() {
    const saved = store.get('settings:fx', null);
    if (saved && saved.USD > 0) return Object.assign({ source: '직접 입력' }, saved);
    return dbFx() || { USD: 0, JPY: 0, VND: 0, date: '' };
  }
  function setFx(v) { store.set('settings:fx', v); }
  function resetFx() { store.remove('settings:fx'); }
  function fxReady() { return fx().USD > 0; }

  function storedHolidays() { return store.get('settings:holidays', { JP: [], VN: [], US: [] }); }
  function holidays(country) {
    const base = ((window.DASH_DATA && window.DASH_DATA.holidays) || {})[country] || [];
    const extra = storedHolidays()[country] || [];
    return Array.from(new Set(base.concat(extra))).sort();
  }
  function setHolidays(country, list) {
    const all = storedHolidays();
    all[country] = list;
    store.set('settings:holidays', all);
  }

  DASH.dates.setHolidayProvider(holidays);

  DASH.services.settings = { fx, dbFx, setFx, resetFx, fxReady, holidays, setHolidays };
})();
