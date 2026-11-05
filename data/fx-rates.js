// 기준 환율: 외화 1단위당 원화. 원본 db/csv/api_fx_rates.csv
// db/healthcare.db에서 만든 화면용 사본 (2026-11-06). 데이터를 고칠 때는 db/csv 원본을 함께 고친다.
// 관리자 메뉴에서 직접 입력하면 그 값이 우선한다.
window.DASH_DATA = window.DASH_DATA || {};
window.DASH_DATA.fxRates = {"JPY":8.463817,"USD":1340.482574,"VND":0.052164,"date":"2026-11-05","source":"ExchangeRate-API (open.er-api.com)","rateType":"mid (KRW 기준 역산)"};
