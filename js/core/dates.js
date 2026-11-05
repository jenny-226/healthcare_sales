// 영업일·마감 계산 (README 9장). 날짜는 항상 ISO 문자열 'YYYY-MM-DD'로 주고받는다.
// 내부 계산만 UTC Date를 써서 시간대 문제를 피한다.
(function () {
  const DASH = window.DASH = window.DASH || {};

  let holidayProvider = function (country) {
    const h = window.DASH_DATA && window.DASH_DATA.holidays;
    return (h && h[country]) || [];
  };

  function pad(n) { return String(n).padStart(2, '0'); }

  function parse(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) throw new Error('날짜 형식은 YYYY-MM-DD 이어야 합니다: ' + iso);
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  function format(dt) { return dt.toISOString().slice(0, 10); }

  function isValid(iso) {
    try { return format(parse(iso)) === iso; } catch (e) { return false; }
  }

  function today() {
    const n = new Date();
    return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
  }

  function isWeekend(iso) {
    const w = parse(iso).getUTCDay();
    return w === 0 || w === 6;
  }

  function holidaysOf(country, holidays) {
    return holidays || holidayProvider(country) || [];
  }

  function hasHolidays(country) { return holidaysOf(country).length > 0; }

  function isBusinessDay(iso, country, holidays) {
    return !isWeekend(iso) && !holidaysOf(country, holidays).includes(iso);
  }

  function addCalendarDays(iso, n) {
    const d = parse(iso);
    d.setUTCDate(d.getUTCDate() + n);
    return format(d);
  }

  // n 음수면 과거로. 시작일 자체는 세지 않는다. 토·일 + 해당 국가 공휴일 제외.
  function addBusinessDays(iso, n, country, holidays) {
    const list = holidaysOf(country, holidays);
    const step = n < 0 ? -1 : 1;
    let left = Math.abs(n);
    let cur = iso;
    while (left > 0) {
      cur = addCalendarDays(cur, step);
      if (!isWeekend(cur) && !list.includes(cur)) left--;
    }
    return cur;
  }

  function daysInMonth(y, m0) { return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate(); }

  // 월말 보정: 1/31 + 1개월 = 2/28(29)
  function addMonths(iso, n) {
    const d = parse(iso);
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + n);
    d.setUTCDate(Math.min(day, daysInMonth(d.getUTCFullYear(), d.getUTCMonth())));
    return format(d);
  }

  // 개월 차이 (소수). 2025-09-10 → 2026-09-10 = 12.0
  function monthsBetween(from, to) {
    const a = parse(from), b = parse(to);
    let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
    let anchor = addMonths(from, months);
    if (anchor > to) { months -= 1; anchor = addMonths(from, months); }
    const next = addMonths(from, months + 1);
    const frac = (parse(to) - parse(anchor)) / (parse(next) - parse(anchor));
    return months + frac;
  }

  function daysBetween(from, to) {
    return Math.round((parse(to) - parse(from)) / 86400000);
  }

  function daysUntil(iso, from) { return daysBetween(from || today(), iso); }

  function setHolidayProvider(fn) { holidayProvider = fn; }

  DASH.dates = {
    parse, format, isValid, today, isWeekend, isBusinessDay, hasHolidays,
    addCalendarDays, addBusinessDays, addMonths, monthsBetween, daysBetween, daysUntil,
    setHolidayProvider
  };
})();
