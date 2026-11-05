// 국가 요약 카드 (README 1-2). 수출액은 반드시 통계 기준과 함께 표시한다.
window.DASH_DATA = window.DASH_DATA || {};
window.DASH_DATA.markets = {
  note: '관세청 \'미분류 조제식품\' 기준 — 건기식이 아닌 조제식품도 포함될 수 있음. 식약처 건기식 수출 통계(2025년 3억 1,817만 달러)는 국가별 수치 미공개.',
  source: { label: '헤럴드경제, 2025.2.3', url: 'https://mbiz.heraldcorp.com/article/10410733' },
  countries: {
    JP: { exportUSD: 110960000, sharePct: 12.3, year: 2024, basis: '2024년 관세청 미분류 조제식품', channels: '드럭스토어·유통 체인·크로스보더', entry: '판매 전 신고 (FFC) · 판매 60영업일 전 신고' },
    VN: { exportUSD: 103280000, sharePct: 11.5, year: 2024, basis: '2024년 관세청 미분류 조제식품', channels: '약국 체인·수입 등록 법인', entry: '판매 전 등록 · 법정 21영업일 / 실무 2~6개월' },
    US: { exportUSD: 81650000, sharePct: 9.1, year: 2024, basis: '2024년 관세청 미분류 조제식품', channels: '브랜드사·대형 유통·온라인', entry: '시판 전 승인 없음 · NDI면 75일 전 통지' }
  }
};
