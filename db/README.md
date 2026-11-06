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

`api_kr_hff_products`(46,200건)·`api_kr_item_groups`·`api_export_stats`·`api_comtrade_imports`는 아직 화면에 쓰지 않는다.

`api_comtrade_imports`는 UN Comtrade 공개 미리보기(키 없음)로 받은 JP·VN·US의 HS 210690 연간 수입액(전 세계·한국발, 2021~2025)이다. 베트남 2024~2025는 아직 보고되지 않았다. 더 많은 품목·월별 자료는 `UN_COMTRADE_KEY`가 필요하다.

## 데이터 주의

- 베트남 2027년 공휴일은 정부 발표 기준이다. 설(Tết) 2/4~2/10 7일은 **공무원 기준**이며, 민간 기업은 3가지 안 중 하나를 고른다.
- 베트남 2026·2028년에는 **음력 설 연휴·훙왕 기일이 빠져 있다**. 정부 발표로 보완한다.
- 미국 공휴일은 `is_global = 1`(연방 공휴일)만 쓴다.
- 환율(`api_fx_rates`)은 참고용 중간값이다. 견적 확정 전 은행 고시 환율로 재확인한다.
- 일본 목록은 `parts`(部位等)에 적힌 부위만 의약품 전용이다. `note`의 「非医」는 다른 부위·유사 원료가 비의약품 목록에 있다는 뜻이다. 이름 대조는 후보일 뿐이고 판정은 사람이 한다.
- `api_export_stats`(관세청 수출 통계)는 아직 비어 있다.
- openFDA 리콜 데이터는 검증되지 않은 자료로 취급한다.

## AI 안정형 시뮬레이터

`#stability` 탭은 현재 건의 개발요청서(`request`)와 제품·포장 데이터를 읽는다. 요청서의 품질 확인사항에서 균주, 유통기한 말 목표 CFU/1회, 보관개월, 온도, aw 및 aw 근거를 `request.stability`로 저장할 수 있다. 요청서 문장의 CFU·개월·°C는 단일 값일 때만 추출 후보로 표시한다. 상온을 25°C로 치환하거나 기준 처방량을 유통기한 말 보장량으로 간주하지 않는다.

시뮬레이터에서 수정한 값은 건별 `stabilityScenario`에 저장된다. 수정하지 않은 필드는 요청서 변경을 계속 반영한다. ‘요청서 조건으로 복원’은 해당 건의 시나리오 수정값과 가정계수를 지운다. R&D 저장 버튼은 검토 항목을 요청서에 추가하고, 조건이 바뀌면 해당 안정성 항목의 이전 회신 상태를 초기화한다. 저장된 검토 항목은 저장 시점의 스냅샷이므로 조건 변경 후 다시 저장한다.

사내 자료는 탭의 JSON 등록 기능으로 브라우저 저장소 `hsd:stability:library`에 저장한다. 현재 SQLite·서버·AI 모델과 직접 연결되지 않는다. 실측 자료는 기본 제공하지 않는다. 다른 브라우저와 자동 공유되지 않으며 기존 대시보드 전체 백업에 포함된다. 동일 ID를 등록하면 갱신하고 다른 ID는 보존한다. 파일은 2MB 이하여야 한다.

등록 형식(아래 숫자는 **형식 설명용 가상 값**, 실제 시험자료로 교체):

```json
{
  "strains": [{ "id": "INTERNAL-STRAIN-ID", "name": "사내 균주명 및 식별번호" }],
  "studies": [{
    "id": "REPORT-ID", "strainId": "INTERNAL-STRAIN-ID",
    "source": "시험성적서 번호·로트·시험법·시험일자",
    "form": "jelly_stick", "temperature": 25, "aw": 0.3,
    "packaging": "개별 포장",
    "points": [{ "month": 0, "cfu": 20000000000 }, { "month": 18, "cfu": 10000000000 }]
  }]
}
```

CFU는 모두 **1회 섭취량 기준**, aw는 0~1이다. 제형 코드는 `capsule`, `tablet`, `powder`, `softgel`, `jelly_stick`, `liquid`를 사용한다. 조건 일치는 균주·제형·온도·aw·포장 문자열 기준이며 안정성 합격 판정이 아니다. 동일 처방·공정·로트·시험법과 목표 기간 커버리지는 R&D가 확인한다. 등록 파일에는 참조하는 균주의 `strains` 항목도 포함한다.

가정 그래프는 사용자가 입력한 제조 후 초기 균수와 월별 log10 감소량으로 `N(t) = N0 × 10^(-k×t)`를 계산한다. 온도·수분·균주의 영향을 학습한 모델이나 보장수명 예측이 아니다. 문헌은 일반 검토사항에만 사용하며 계수를 추출하지 않는다: [Fenster et al., 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6463069/).

검증: `node tests/stability.test.cjs` (요청서 연동, 누락·범위 검사, 자료 매칭, 건 격리, 화면 렌더링).
