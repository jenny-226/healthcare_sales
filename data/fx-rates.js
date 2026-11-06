// 기준 환율: 외화 1단위당 원화. 원본 db/csv/api_fx_rates.csv
// db/healthcare.db에서 만든 화면용 사본 (2026-11-06). 데이터를 고칠 때는 db/csv 원본을 함께 고친다.
// 원가 탭 상단 '기준 환율'에 직접 입력하면 그 값이 우선한다.
window.DASH_DATA = window.DASH_DATA || {};
window.DASH_DATA.fxRates = {"USD":1347.708895,"JPY":8.504775,"CNY":200.521356,"EUR":1510.574018,"VND":0.052626,"date":"2026-11-06","source":"ExchangeRate-API (open.er-api.com)","rateType":"mid (KRW 기준 역산)"};
