# db/ — CSV와 SQLite DB

| 경로 | 내용 |
|---|---|
| `healthcare.db` | 웹사이트 DB (SQLite, git 제외) |
| `schema.sql` | 테이블 정의 (테이블 이름 = CSV 파일 이름) |
| `csv/app_*.csv` | 앱 데이터 (규칙·서류·단계·문구·포장·시장·예시 제품/바이어/건/서류). 규칙 원본은 `data/rules-*.js` |
| `csv/api_*.csv` | 외부 공공데이터 (공휴일·환율·식약처 원료/품목·FDA 리콜) |
| `csv/ref_jp_pharma_only.csv` | 일본 의약품 전용 성분 목록 (`source/jp_pharma_only_ingredients.pdf`의 표 332행) |
| `csv/api_fetch_log.csv` | 데이터셋별 건수·출처·주의사항·기준일 |
| `source/vn_holidays_2027.pdf` | 베트남 2027 공휴일 발표 원문 (Government News, 2026-10-12) → `api_holidays`에 반영 |
| `source/jp_pharma_only_ingredients.pdf` | 일본 후생노동성 「専ら医薬品として使用される成分本質(原材料)リスト」 원문 → `ref_jp_pharma_only` |

## 화면에서 쓰는 파일

웹사이트는 SQLite를 직접 읽지 않는다. 아래 `data/*.js`가 DB 내용의 화면용 사본이며, DB를 고치면 이 파일들도 함께 맞춘다.

| 화면용 파일 | DB 테이블 | 쓰는 곳 |
|---|---|---|
| `data/holidays.js` | `api_holidays` (US는 `is_global = 1`만) | 마감·영업일 계산, 관리자 > 공휴일 |
| `data/fx-rates.js` | `api_fx_rates` | 홈 환율, 원가 탭 (관리자에서 직접 입력하면 그 값 우선) |
| `data/kr-ingredients.js` | `api_kr_notified_ingredients`, `api_kr_individual_ingredients` | 규제 확인 ② 식약처 원료 목록 대조 |
| `data/jp-pharma-only.js` | `ref_jp_pharma_only` | 규제 확인 (일본 건) 의약품 전용 성분 목록·후보 |
| `data/fda-recalls.js` | `api_fda_supplement_recalls` | 규제 확인 (미국 건) FDA 리콜 사례 |

`api_kr_hff_products`(46,200건)·`api_kr_item_groups`·`api_export_stats`는 아직 화면에 쓰지 않는다.

## 데이터 주의

- 베트남 2027년 공휴일은 정부 발표 기준이다. 설(Tết) 2/4~2/10 7일은 **공무원 기준**이며, 민간 기업은 3가지 안 중 하나를 고른다.
- 베트남 2026·2028년에는 **음력 설 연휴·훙왕 기일이 빠져 있다**. 정부 발표로 보완한다.
- 미국 공휴일은 `is_global = 1`(연방 공휴일)만 쓴다.
- 환율(`api_fx_rates`)은 참고용 중간값이다. 견적 확정 전 은행 고시 환율로 재확인한다.
- 일본 목록은 `parts`(部位等)에 적힌 부위만 의약품 전용이다. `note`의 「非医」는 다른 부위·유사 원료가 비의약품 목록에 있다는 뜻이다. 이름 대조는 후보일 뿐이고 판정은 사람이 한다.
- `api_export_stats`(관세청 수출 통계)는 아직 비어 있다.
- openFDA 리콜 데이터는 검증되지 않은 자료로 취급한다.
