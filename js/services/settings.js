// 설정: 환율(원가 탭에서 직접 입력 가능), 공휴일(data/holidays.js). 홈·원가 탭·dates.js가 함께 쓴다.
(function () {
  const DASH = window.DASH;
  const store = DASH.store;
  DASH.services = DASH.services || {};

  // 환율: 외화 1단위당 원화. 원가 탭에서 직접 입력한 값 → 없으면 DB 기준 환율(data/fx-rates.js)
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

  // 공휴일은 DB 사본(data/holidays.js)만 쓴다. 고칠 때는 db/csv/api_holidays.csv와 함께 고친다.
  function holidays(country) {
    const base = ((window.DASH_DATA && window.DASH_DATA.holidays) || {})[country] || [];
    return Array.from(new Set(base)).sort();
  }

  DASH.dates.setHolidayProvider(holidays);

  DASH.services.settings = { fx, dbFx, setFx, resetFx, fxReady, holidays };
})();
