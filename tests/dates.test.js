// README 9장 날짜·마감 계산 검증. 공휴일은 인자로 직접 넘겨 결과를 고정한다.
TEST.suite('dates.js — 기본', function () {
  const D = DASH.dates;
  TEST.eq(D.addCalendarDays('2026-12-31', 1), '2027-01-01', '달력일 +1 (연도 넘김)');
  TEST.eq(D.addCalendarDays('2027-03-01', -1), '2027-02-28', '달력일 −1 (2027년 2월 말)');
  TEST.eq(D.addBusinessDays('2026-11-06', 1, 'JP', []), '2026-11-09', '금요일 + 1영업일 = 월요일');
  TEST.eq(D.addBusinessDays('2026-11-09', -1, 'JP', []), '2026-11-06', '월요일 − 1영업일 = 금요일');
  TEST.eq(D.addBusinessDays('2026-11-07', 1, 'VN', []), '2026-11-09', '토요일 + 1영업일 = 월요일');
  TEST.eq(D.addBusinessDays('2026-11-04', 0, 'VN', []), '2026-11-04', '0영업일은 그대로');
  TEST.eq(D.addBusinessDays('2026-12-10', 7, 'VN', ['2026-12-15']), '2026-12-22', '공휴일(12-15)은 영업일에서 제외');
  TEST.eq(D.addMonths('2026-01-31', 1), '2026-02-28', '월말 보정 1/31 + 1개월');
  TEST.eq(D.monthsBetween('2025-09-10', '2026-09-10'), 12, '정확히 12개월');
  TEST.ok(D.monthsBetween('2025-09-10', '2026-09-11') > 12, '12개월 + 1일은 12 초과');
  TEST.eq(D.daysUntil('2026-11-14', '2026-11-04'), 10, 'daysUntil 10일');
  TEST.eq(D.daysUntil('2026-11-01', '2026-11-04'), -3, 'daysUntil 지난 날짜는 음수');
  TEST.ok(D.isValid('2026-02-28') && !D.isValid('2026-02-30') && !D.isValid('2026/02/01'), 'isValid 형식·존재 검사');
});

TEST.suite('dates.js — README 9장 마감 계산 예', function () {
  const D = DASH.dates;
  // JP-SCH-01: 판매 희망일 2027-06-01 − 60영업일
  TEST.eq(D.addBusinessDays('2027-06-01', -60, 'JP', []), '2027-03-09', 'JP-SCH-01 신고 마감 (2027-06-01 − 60영업일)');
  TEST.eq(D.addBusinessDays('2027-03-09', -10, 'JP', []), '2027-02-23', '자료 제공 마감 (신고 마감 − 10영업일)');
  // JP-SCH-02: − 120영업일
  TEST.eq(D.addBusinessDays('2027-06-01', -120, 'JP', []), '2026-12-15', 'JP-SCH-02 신고 마감 (− 120영업일)');
  // VN-SCH-02: 보완 요청 2026-12-10 + 7영업일
  TEST.eq(D.addBusinessDays('2026-12-10', 7, 'VN', []), '2026-12-21', 'VN-SCH-02 회신 기한 (2026-12-10 + 7영업일)');
  // VN-DOC-TEST: 발급 2025-09-10, 제출 예정 2026-12-01 → 12개월 초과
  TEST.ok(D.monthsBetween('2025-09-10', '2026-12-01') > 12, 'VN-DOC-TEST 2025-09-10 → 2026-12-01 은 12개월 초과');
  TEST.ok(D.monthsBetween('2026-03-01', '2026-12-01') <= 12, 'VN-DOC-TEST 2026-03-01 → 2026-12-01 은 12개월 이내');
  // US-NDI-01: 출시 2027-03-01 − 75일
  TEST.eq(D.addCalendarDays('2027-03-01', -75), '2026-12-16', 'US-NDI-01 통지 마감 (2027-03-01 − 75일)');
  // US-CLM-03: 출시 + 30일
  TEST.eq(D.addCalendarDays('2027-03-01', 30), '2027-03-31', 'US-CLM-03 문구 통지 마감 (2027-03-01 + 30일)');
});
