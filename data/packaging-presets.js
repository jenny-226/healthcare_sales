// 건기식 포장 프리셋 (README 7-4). 값은 모두 예시 — 원가 탭에서 직접 수정할 수 있다.
window.DASH_DATA = window.DASH_DATA || {};
window.DASH_DATA.packagingPresets = [
  { id: 'bottle-60cap', label: '병 60캡슐', countPerUnit: 60, unitsPerCarton: 100, cartonCBM: 0.045, packKRW: 450 },
  { id: 'bottle-90tab', label: '병 90정', countPerUnit: 90, unitsPerCarton: 80, cartonCBM: 0.050, packKRW: 500 },
  { id: 'stick-30', label: '스틱 30포', countPerUnit: 30, unitsPerCarton: 60, cartonCBM: 0.060, packKRW: 650 },
  { id: 'ptp-blister', label: 'PTP 블리스터 (30정)', countPerUnit: 30, unitsPerCarton: 200, cartonCBM: 0.040, packKRW: 300 },
  { id: 'jelly-pouch', label: '젤리 파우치 (14포)', countPerUnit: 14, unitsPerCarton: 48, cartonCBM: 0.055, packKRW: 700 }
];
// 물류비 추정용 예시 값 (원/CBM). 실제 견적은 포워더 확인
window.DASH_DATA.logisticsDefaults = { fobPerCBM_KRW: 60000, freightPerCBM_KRW: { JP: 80000, VN: 70000, US: 180000 }, insurancePct: 0.3 };
