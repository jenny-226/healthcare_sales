# 건기식 해외영업 대시보드 (일본 · 베트남 · 미국)

> 한국 건강기능식품 제조사(OEM·ODM)의 해외영업 담당자가 **일본·베트남·미국** 바이어 건을
> 규제 확인 → 개발요청서 → 원가(견적)까지 한 화면에서 처리하는 대시보드.
> 탭별 화면 배치는 COSTD(COSMOA, https://github.com/kimminniegu/COSTD)의 홈·국가별 인허가 규제·개발요청서·원가·마진 시뮬레이션 화면 구성을 따른다.
>
> 이 README는 VS Code에서 구현할 때의 **기준 명세**다. 기능·데이터·규칙이 이 문서와 다르면 이 문서를 먼저 고친 뒤 코드를 고친다.

> ⚠️ **사전검토 보조 도구**: 화면의 모든 판정은 1차 참고용이다. 최종 판단은 규제 담당과 현지 바이어(명의자)가 한다.
> "수출 가능", "규제 통과", "승인" 같은 단정 문구를 쓰지 않는다. 규칙이 없는 항목은 **허용이 아니라 "규칙 미등록 — 수동 확인 필요"** 로 표시한다.

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택과 실행 방법](#2-기술-스택과-실행-방법)
3. [폴더 구조](#3-폴더-구조)
4. [공통 코딩 규칙](#4-공통-코딩-규칙)
5. [데이터 모델](#5-데이터-모델)
6. [국가별 규칙 데이터](#6-국가별-규칙-데이터)
7. [탭별 기능 명세](#7-탭별-기능-명세)
8. [탭 간 연결](#8-탭-간-연결)
9. [날짜·마감 계산 로직](#9-날짜마감-계산-로직)
10. [화면·디자인 가이드](#10-화면디자인-가이드)
11. [구현 순서](#11-구현-순서)
12. [테스트 시나리오](#12-테스트-시나리오)
13. [확인이 필요한 사항](#13-확인이-필요한-사항)
14. [출처](#14-출처)
15. [Claude Code·Copilot에 줄 첫 프롬프트](#15-claude-codecopilot에-줄-첫-프롬프트)

---

## 1. 프로젝트 개요

### 1-1. 전제

| 항목 | 내용 |
|---|---|
| 사용자 | 건기식 OEM·ODM 해외영업 담당자 (신입~실무자), 협업하는 R&D·규제 담당 |
| 대상 국가 | 일본(JP), 베트남(VN), 미국(US) **세 나라만** |
| 핵심 원칙 | 세 나라 모두 **제품 명의자는 현지 바이어**다. 우리(한국 제조사)는 바이어가 현지 절차를 통과하도록 올바른 처방과 서류를 제때 제공하는 역할 |
| 핵심 구조 | 바이어 × 제품 × 국가 = **'건(case)'**. 모든 탭은 선택된 건 하나를 기준으로 동작 |

### 1-2. 시장 배경 (기획 근거)

- 2024년 한국 건기식 수출(관세청 '미분류 조제식품' 기준): 일본 1억 1,096만 달러(12.3%), 베트남 1억 328만 달러(11.5%), 미국 8,165만 달러(9.1%). 세 나라 합계 32.9%.
- 위 통계는 건기식이 아닌 조제식품도 포함할 수 있다. 식약처 건기식 수출 통계(2025년 3억 1,817만 달러)에는 국가별 수치가 공개되지 않았다. **화면에 수출액을 표시할 때는 반드시 통계 기준을 함께 표시한다.**
- 세 나라의 진입 방식은 모두 다르다: 일본 = 판매 전 **신고**, 베트남 = 판매 전 **등록**, 미국 = 승인 없이 **통지**.

### 1-3. 탭 구성 (순서 고정)

```
🏠 홈  →  🔎 바이어 발굴  →  📜 규제 확인  →  🧪 개발요청서  →  💰 원가
```

- **등록·신고 탭과 관리자 메뉴는 없앴다.** 현지 등록·신고는 명의자인 바이어가 진행하고, 우리는 견적 합의(`stage: 'agreed'`)까지 다룬다. 등록·시험 비용 부담 주체는 원가 탭 견적서에 넣는다.
- 필요한 서류·예상 기간·주요 마감(신고·NDI 통지)은 **규제 확인 → 조회 결과**에서 본다.
- 건·바이어 관리와 데이터 백업은 상단 바의 **건·바이어 관리** 창, 새 제품 등록은 **+ 새 건** 창, 처방(성분)은 **규제 확인 → DB 검색**에서 제품명을 검색해 나온 성분 판정 결과 안에서 성분표 파일로 불러온다(규제 확인 탭에는 직접 타이핑하는 칸을 두지 않는다), 환율 직접 입력은 **원가 탭 상단 기준 환율**에서 한다.
- 규칙은 화면에서 고치지 않는다. `data/rules-*.js` 파일에서 사람이 고친다.

---

## 2. 기술 스택과 실행 방법

### 2-1. 1단계 (MVP): 빌드 없는 정적 웹

| 항목 | 선택 | 이유 |
|---|---|---|
| 언어 | HTML · CSS · JavaScript (ES2020, 모듈 없이) | VS Code + Live Server로 바로 실행 |
| 데이터 | `data/*.js` 파일 (`window.DASH_DATA = {...}`) | `fetch` 없이 더블클릭·Live Server 모두 동작 |
| 저장 | `localStorage` (키 접두사 `hsd:`) | MVP 단계 사용자 데이터 보관 |
| 엑셀 읽기 | SheetJS (`vendor/xlsx.full.min.js`, 로컬 파일) | 성분표 .xlsx 업로드 |
| 차트 | 사용 안 함 (MVP) | 필요 시 2단계에서 Chart.js |

> `type="module"`, `import`, npm 빌드는 1단계에서 쓰지 않는다.

### 2-2. 2단계 (선택): Flask 서버

PDF·스캔 이미지 성분 추출(OCR), AI 문구 변환, 메일 발송, 여러 사용자 공유 저장이 필요해지면 Flask + SQLite로 옮긴다. 1단계 코드는 `services/` 함수만 서버 호출로 바꾸면 되도록 **데이터 접근을 한곳에 모아 둔다** (4-3 참고).

### 2-3. 실행

```bash
# 1) VS Code에서 폴더 열기
code health-supplement-dashboard

# 2) 확장 프로그램 'Live Server' 설치
# 3) index.html 우클릭 → Open with Live Server
#    → http://127.0.0.1:5500/index.html
```

첫 실행 시 `data/sample-cases.js`의 예시 건 3개가 자동으로 불러와진다. 화면에는 `예시` 배지가 붙는다. 상단 **건·바이어 관리 → 예시 데이터 지우기**로 비운다.

### 2-4. 외부 API·DB 키 (2단계 서버에서 사용)

1단계(정적 웹)는 브라우저에 API 키를 넣지 않는다. 키는 `.env`(git 제외)에 두고, 수집 스크립트나 2단계 Flask 서버가 호출해 `db/csv` → `data/*.js`를 갱신한다. 이름은 `.env.example` 참고.

| 쓰는 곳 | 환경변수 | 발급처 |
|---|---|---|
| 홈 수출입 카드 (관세청 품목별 국가별 수출입실적) | `export_api` | 공공데이터포털 https://www.data.go.kr → '관세청_품목별 국가별 수출입실적' 활용신청 |
| 홈 규제 업데이트 (KOTRA 해외시장뉴스) | `DATA_GO_KR_KEY` (같은 포털 계정 키) | 공공데이터포털 → 'KOTRA 해외시장뉴스' 활용신청 |
| 홈·원가 환율 (매매기준율·전일 대비) | `KOREAEXIM_API_KEY` | 한국수출입은행 Open API https://www.koreaexim.go.kr/ir/HPHKIR020M01?apino=2 |
| 규제 확인 — 식약처 건기식 원료 (고시형 I2710 · 개별인정형 I-0040) | `MFDS_FOODSAFETY_KEY` | 식품안전나라 Open API https://www.foodsafetykorea.go.kr/api/main.do → 인증키 신청 |
| 규제 확인 — FDA 리콜 | `FDA_API` | openFDA https://open.fda.gov/apis/authentication/ |
| 개발요청서 파일 자동변환 · AI 문구 변환 | `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
| 뉴스 RSS | 키 없음 | 식약처·업계지 공식 RSS (수집을 막은 사이트는 제목·링크만) |
| 바이어 발굴 ① 국가 선정 — 국가별 건기식(HS 2106.90) 수입 규모 | `UN_COMTRADE_KEY` | UN Comtrade https://comtradedeveloper.un.org → 무료 구독 키 |
| 바이어 발굴 ② 잠재 바이어 목록 | 키 없음 (회원가입) | KOTRA 바이코리아 https://www.buykorea.org (바이어 구매 문의) · 한국무역협회 tradeKorea https://www.tradekorea.com · 공공데이터포털에서 'KOTRA' 검색 후 바이어 관련 데이터셋 활용신청 · 유료: Panjiva·ImportGenius (미국 수입 통관 기록) |
| 바이어 발굴 ③ 포트폴리오 — 미국 보충제 라벨 (브랜드·제형·원료) | 키 없음 | NIH ODS Dietary Supplement Label Database API https://dsld.od.nih.gov/api-guide |
| 바이어 발굴 ③ 포트폴리오 — 일본 기능성표시식품 신고 기업·제품 | 키 없음 | 소비자청 기능성표시식품 신고 DB https://www.fld.caa.go.jp/caaks/cssc01/ (CSV 내려받기) |
| 바이어 발굴 ③ 기업 등록 정보 (법인 존재·주소) | `OPENCORPORATES_API_KEY` (선택) | OpenCorporates https://api.opencorporates.com |
| 바이어 발굴 ③·⑥ 홈페이지 요약·메일 문구 다듬기 | `OPENAI_API_KEY` (위와 같음) | https://platform.openai.com/api-keys |
| 바이어 발굴 ⑥·⑦ 제안 메일 발송·답장 확인 | `GMAIL_ADDRESS`, `GMAIL_APP_PASSWORD` | Google 계정 → 2단계 인증 → 앱 비밀번호 https://myaccount.google.com/apppasswords (SMTP·IMAP) |

---

## 3. 폴더 구조

```
health-supplement-dashboard/
├── index.html                  # 전체 레이아웃(사이드바·상단 건 선택 바·탭 영역)
├── README.md                   # 이 문서
├── css/
│   ├── base.css                # 색·글꼴·카드·버튼·배지·표 공통 스타일 (CSS 변수)
│   └── tabs/
│       ├── home.css            # .tab-home 안에서만
│       ├── regulatory.css      # .tab-reg
│       ├── request.css         # .tab-req
│       ├── buyers.css          # .tab-byr
│       └── cost.css            # .tab-cost
├── js/
│   ├── core/
│   │   ├── app.js              # 탭 등록·전환, 해시 라우팅(#home, #regulatory ...)
│   │   ├── store.js            # localStorage 래퍼 (hsd:* 키), 건 CRUD
│   │   ├── case-context.js     # 현재 선택된 건 관리 + 'case:changed' 이벤트
│   │   ├── case-manager.js     # + 새 건(바이어·제품 함께 등록) · 건·바이어 관리 · 데이터 백업
│   │   ├── dates.js            # 영업일·마감 계산 (9장)
│   │   ├── rules-engine.js     # 규칙 판정 공통 함수 (6장)
│   │   └── ui.js               # card(), badge(), table(), modal(), toast(), esc()
│   ├── services/               # 데이터 접근 한곳 (2단계에서 서버 호출로 교체)
│   │   ├── cases.js
│   │   ├── products.js
│   │   ├── documents.js
│   │   ├── rules.js
│   │   ├── settings.js         # 환율(원가 탭 직접 입력 → 없으면 DB 사본)·공휴일(DB 사본)
│   │   ├── reference.js        # 식약처 원료·일본 의약품 전용 성분·FDA 리콜 조회
│   │   └── prospects.js        # 잠재 바이어·영업 적합도·자사 제조 역량·영업 관리 목록
│   └── tabs/
│       ├── home.js
│       ├── regulatory.js
│       ├── request.js
│       ├── buyers.js           # 🔎 바이어 발굴
│       └── cost.js
├── data/
│   ├── rules-jp.js             # 일본 규칙 (6-2)
│   ├── rules-vn.js             # 베트남 규칙 (6-3)
│   ├── rules-us.js             # 미국 규칙 (6-4)
│   ├── claim-terms.js          # 문구 점검용 표현 목록 (질병 표현 등)
│   ├── packaging-presets.js    # 건기식 포장 프리셋 (7-4)
│   ├── holidays.js             # 일본·베트남·미국 공휴일 (9장, DB 사본)
│   ├── fx-rates.js             # 기준 환율 (DB 사본)
│   ├── kr-ingredients.js       # 식약처 고시형·개별인정형 원료 (DB 사본)
│   ├── jp-pharma-only.js       # 일본 의약품 전용 성분 목록 (DB 사본)
│   ├── ingredient-aliases.js   # 성분 이름 대조표 (한국어·영문·일본어, 사람이 관리)
│   ├── fda-recalls.js          # FDA 건기식 리콜 (DB 사본)
│   ├── markets.js              # 국가 요약 카드 데이터 (1-2 수치 + 출처)
│   ├── sample-products.js      # 예시 제품 3개 (가상)
│   ├── sample-cases.js         # 예시 건 3개 (가상)
│   └── buyer-prospects.js      # 바이어 발굴 마스터(국가·유형·카테고리·원료·거래 형태)·잠재 바이어(가상)·자사 제조 역량 기본값
├── vendor/
│   └── xlsx.full.min.js        # SheetJS (버전 고정, 로컬 보관)
└── tests/
    ├── test.html               # 브라우저에서 여는 간단한 테스트 러너
    ├── dates.test.js
    └── rules.test.js
```

---

## 4. 공통 코딩 규칙

### 4-1. 이름 규칙

| 대상 | 규칙 | 예 |
|---|---|---|
| 전역 변수 | `window.DASH`, `window.DASH_DATA` 두 개만 | 나머지는 즉시실행 함수 안 |
| 탭 ID | `home`, `buyers`, `regulatory`, `request`, `cost` | URL 해시와 같음 |
| CSS 접두사 | `home-`, `byr-`, `reg-`, `req-`, `cost-` | `.tab-reg .reg-result` |
| 저장 키 | `hsd:<영역>:<이름>` | `hsd:cases`, `hsd:docs`, `hsd:ui:lastTab` |
| 버튼 동작 | `data-act` + `addEventListener` (`onclick=` 금지) | `data-act="run-check"` |
| 국가 코드 | `JP`, `VN`, `US` | 대문자 고정 |
| 날짜 | ISO 문자열 `YYYY-MM-DD` | 시간대 문제를 피하려고 `Date` 객체로 저장하지 않음 |

### 4-2. 탭 파일 모양

```js
// js/tabs/regulatory.js
(function () {
  const { card, badge, esc } = DASH.ui;

  function render(el, ctx) {           // el = 탭 영역, ctx = 현재 건 (없으면 null)
    if (!ctx) { el.innerHTML = DASH.ui.emptyCase(); return; }
    el.innerHTML = card('제품 분류', `...`);
    el.querySelector('[data-act="run-check"]').addEventListener('click', () => runCheck(ctx));
  }

  function runCheck(ctx) { /* rules-engine 호출 → 결과를 건에 저장 → 다시 그리기 */ }

  DASH.registerTab({
    id: 'regulatory', icon: '📜', label: '규제 확인', order: 20,
    render,
    summary: (ctx) => ({ label: '미확인 항목', value: /* ... */ 0 })  // 홈 할 일에 사용
  });
})();
```

### 4-3. 데이터 접근

- 탭 파일은 `localStorage`를 직접 만지지 않는다. 항상 `DASH.services.cases.get(id)` 같은 서비스 함수를 쓴다.
- 건 데이터를 바꾸면 `DASH.caseContext.save(case)` → `case:changed` 이벤트 → 열린 탭이 다시 그려진다.

### 4-4. 안전 문구 규칙

- 사용자 입력은 항상 `esc()`로 이스케이프 후 `innerHTML`에 넣는다.
- 판정 결과 색: **초록색을 쓰지 않는다** (허용처럼 보이지 않게). 아래 5단계만 쓴다.

| 판정 코드 | 화면 표시 | 색 | 의미 |
|---|---|---|---|
| `BLOCK` | 사용 불가 | 빨강 | 규칙상 쓸 수 없음 (예: 미국 질병 치료 표현) |
| `ACTION` | 조치 필요 | 주황 | 서류·절차·수정이 필요 (예: NDI 통지, 성적서 재발급) |
| `REVIEW` | 검토 필요 | 노랑 | 사람이 판단해야 함 |
| `NOTED` | 규칙 확인됨 | 회색 | 등록된 규칙에 걸린 것이 없음 (**승인 아님**) |
| `UNKNOWN` | 규칙 미등록 | 점선 테두리 | 규칙이 없어 판단 불가 → 수동 확인 |

---

## 5. 데이터 모델

### 5-1. 건 (case) — 모든 탭의 중심

```js
{
  id: 'C-2026-0001',
  sample: false,                       // 예시 데이터면 true → '예시' 배지
  country: 'VN',                       // JP | VN | US
  buyerId: 'B-001',
  productId: 'P-001',
  stage: 'regulatory',                 // regulatory | request | cost | agreed(견적 합의) — 예전 registration·selling은 agreed로 읽음
  createdAt: '2026-11-04',
  targetLaunchDate: '2027-04-01',      // 판매 희망일(일본·베트남) 또는 출시일(미국)

  regulatory: {                        // 📜 규제 확인 결과
    checkedAt: '2026-11-04',
    category: 'health_supplement',     // 국가별 분류 코드 (6장)
    ingredientFindings: [ /* {ingredientId, ruleId, verdict, message, source} */ ],
    claimFindings:      [ /* {text, ruleId, verdict, suggestion} */ ],
    dailyIntake:        [ /* {ingredientId, amountPerServing, unit, servingsPerDay, daily} */ ],
    requiredDocs:       [ 'VN-DOC-CFS', 'VN-DOC-TEST', ... ],
    estimatedLead:      { legal: '21 working days', practical: '2–6 months' },
    ruleVersion:        { VN: '2026-11-04' }
  },

  request: {                           // 🧪 개발요청서
    baseFormulaId: 'F-001',
    countryVariant: [ /* {ingredientId, change, reason} */ ],
    targetFunction: '장 건강',
    allowedClaimDraft: '...',
    testPlan: [ /* {test, lab, plannedDate, mustBeAfter} */ ],
    rdReplies: [ /* {item, status: 'ok'|'no'|'alt', note} */ ],
    priceBand: 'mid', deliverTo: 'lab', buyerBanned: '', quality: { stability: true },
    plannedSubmitDate: '2026-12-01',   // 베트남 등록용 시험 계획 기준일
    attachments: [ /* 파일 이름 */ ],
    status: 'draft'                    // draft | sent | replied | fixed
  },

  cost: {                              // 💰 원가
    incoterms: 'FOB', orderQty: 10000, moq: 5000, packagingPresetId: 'bottle-60cap',
    plans: [ /* {name, rawKRW, processKRW, packKRW} */ ], planIdx: 0,
    itemMargin: { raw: 20, process: 10, pack: 15, logistics: 10 },   // 1차·물류 마진 (판매가 대비 %)
    targetSalesPct: 20, minSalesPct: 15, itemFloorPct: 5,           // 목표·최소 영업마진, 1차 마진 양보 한계치
    tiers: [ /* {qty, discountPct} */ ], underMoq: 'surcharge', surchargePct: 10,
    regulatoryCosts: [ /* {item, amountKRW, payer: 'us'|'buyer'|'split'} */ ],
    counterUSD: null, payFx: null, quoteStyle: 'combined',
    fxRate: { USD: 0, JPY: 0, VND: 0, date: '' },
    quote: { unitPriceUSD: 0, perDayUSD: 0, incoterms: 'FOB', qty: 10000 }
  }
}
```

### 5-2. 바이어 (buyer)

```js
{
  id: 'B-001', country: 'VN', name: 'A Pharma JSC (가상)',
  type: 'importer_registrant',         // 아래 표 참고
  leadSource: '2026 KOTRA 상담회',
  contact: { name: '', email: '', timezone: 'Asia/Ho_Chi_Minh' },
  holderCapability: {                  // 명의자 역량 (7-1)
    JP: null,
    VN: { localEntity: true, pastRegistrations: 3, canAcceptLoA: true },
    US: null
  },
  lastContactAt: '2026-11-01', awaitingReply: true
}
```

| 국가 | 바이어 유형 코드 |
|---|---|
| JP | `seller_notifier`(판매·신고 사업자), `retail_chain`(유통 체인), `cross_border`(크로스보더 셀러) |
| VN | `importer_registrant`(수입·등록 법인), `pharmacy_supplier`(약국 체인 납품사) |
| US | `brand_owner`(브랜드사), `retail_supplier`(대형 유통사 납품사), `online_seller`(온라인 셀러) |

### 5-3. 제품·처방 (product / formula)

```js
{
  id: 'P-001', name: '유산균 캡슐 (가상)', form: 'capsule',   // capsule | tablet | powder | softgel | jelly_stick | liquid
  koreaStatus: 'notified',             // 한국 기능성 원료 구분: notified(고시형) | individual(개별인정형) | none
  koreaClaim: '장 건강에 도움을 줄 수 있음',
  formula: [
    { ingredientId: 'ING-001', nameKo: '프로바이오틱스', nameEn: 'Probiotics',
      amountPerServing: 1, unit: 'billion CFU', koreaIndividual: false }
  ],
  servingsPerDay: 1
}
```

> `koreaIndividual: true` (한국 개별인정형 원료)는 미국 NDI 경고의 자동 트리거다 (6-4 `US-NDI-02`).

### 5-4. 서류 (document)

```js
{
  id: 'D-001', productId: 'P-001', type: 'TEST_REPORT',
  // TEST_REPORT | CFS | GMP | EFFICACY | LOA | LABEL | FDA_FACILITY | CGMP | NDI_NOTICE | FFC_EVIDENCE
  issuedAt: '2025-09-10', expiresAt: null,
  lab: { name: '', iso17025: true, mohDesignated: false },
  legalization: 'apostille',           // none | apostille | embassy  (CFS용)
  fileName: 'test_report_P001.pdf',    // MVP는 파일명만 저장, 파일 자체는 2단계
  note: ''
}
```

### 5-5. 규칙 (rule) — 6장 데이터 파일의 한 줄

```js
{
  id: 'VN-DOC-TEST',
  country: 'VN',
  area: 'document',                    // category | ingredient | claim | document | schedule | manufacturing | post_market | applicant
  title: '등록용 시험성적서는 12개월 이내',
  check: 'docAgeMonthsMax',            // rules-engine.js에 구현된 검사 함수 이름
  params: { docType: 'TEST_REPORT', months: 12, requireLab: ['iso17025', 'mohDesignated'] },
  verdictIfFail: 'ACTION',
  message: '시험성적서 발급일이 12개월을 넘었거나 인정 기관이 아닙니다. 재시험이 필요합니다.',
  source: { label: 'Medibase (2026-10-27 갱신)', url: 'https://medibase.vn/supplement/registration/' },
  verifiedAt: '2026-11-04',
  needsVerification: true              // 제3자 요약 등 원문 미확인 → 화면에 '원문 확인 필요' 표시
}
```

---

## 6. 국가별 규칙 데이터

### 6-1. 규칙 엔진 동작

```
rules-engine.evaluate(case, product, documents, country)
  → 해당 국가 규칙 전부 실행
  → 각 결과 {ruleId, verdict, message, source, needsVerification}
  → 규칙이 없는 영역은 UNKNOWN 결과를 하나 추가 ("이 영역에 등록된 규칙 없음")
```

- 규칙 파일은 **사람이 관리**한다. 코드가 규칙을 자동 생성·수정하지 않는다.
- 모든 결과 카드 하단에 `출처 · 마지막 검증일`을 표시한다. `needsVerification: true`면 `원문 확인 필요` 배지.
- 규칙 수치(일수·개월)는 코드에 하드코딩하지 않고 `params`에서 읽는다.

### 6-2. 일본 (`data/rules-jp.js`)

| ID | 영역 | 규칙 | 판정 | 출처 |
|---|---|---|---|---|
| `JP-CAT-01` | category | 분류 선택지: 특정보건용식품(허가) / **기능성표시식품 FFC(신고)** / 영양기능식품. MVP는 FFC 경로를 기본으로 지원 | REVIEW | 코스모닝(KOTRA 도쿄) |
| `JP-ING-01` | ingredient | 일본에서 **의약품으로만 쓰는 성분**이 있으면 의약품으로 취급될 수 있음 (예: 타우린). 목록 데이터는 아직 없음 → 성분에 `jpPharmaOnly` 플래그를 사람이 입력 | BLOCK / 데이터 없으면 UNKNOWN | 코스모닝(KOTRA 도쿄) |
| `JP-SCH-01` | schedule | FFC는 **판매일 60영업일 전**까지 소비자청에 신고 | ACTION (마감 계산) | 도쿄도 교재 |
| `JP-SCH-02` | schedule | 신규 성분 등 확인에 시간이 걸리면 **120영업일 전** | ACTION | 도쿄도 교재 |
| `JP-APP-01` | applicant | 신고자는 일본의 식품관련사업자 (바이어) | REVIEW | 도쿄도 교재 |
| `JP-MFG-01` | manufacturing | 정제·캡슐·분말 등 보충제 형태는 **GMP 의무**, 유예 종료 2026-09-01 | ACTION (GMP 서류 없으면) | NutraIngredients 2024.7 |
| `JP-CLM-01` | claim | FFC 대상이 아닌 사람(질병자, 미성년자, 임산부·임신 계획자, 수유부)을 대상으로 한 표현 | BLOCK | 도쿄도 교재 |
| `JP-LBL-01` | claim | 필수 표시 체크리스트: 기능성표시식품임, 기능성 관여 성분과 기능성, 영양성분·열량, 1일 섭취 기준량과 함유량, 신고번호, 사업자 연락처, 국가 평가를 받지 않았다는 표시, 섭취 방법·주의, 균형 잡힌 식생활 문구, 질병 진단 등을 목적으로 하지 않는다는 표시 | REVIEW (체크리스트) | 도쿄도 교재 |
| `JP-LBL-02` | schedule | 새 표시 방식 경과조치 종료 2026-08-31 | NOTED (정보) | 도쿄도 교재 |
| `JP-PM-01` | post_market | 건강피해 정보 보고 **15일 이내**, 새 과학적 근거 보고, 연간 자체점검 보고 (2024-09 시행) | ACTION (사후 의무 안내) | Data Max 2024.8, NutraIngredients |
| `JP-EVD-01` | document | 안전성·기능성의 과학적 근거 자료가 제품의 성분·함량과 일치해야 함 (일치 여부는 사람이 체크) | REVIEW | 도쿄도 교재 + 실무 추론 |

### 6-3. 베트남 (`data/rules-vn.js`)

| ID | 영역 | 규칙 | 판정 | 출처 |
|---|---|---|---|---|
| `VN-LAW-01` | category | **현재 적용 규정: Decree 15/2018/ND-CP**. Decree 46/2026은 2026-01-26 시행 후 정지(결의 15/2026, 2026-04-08). 식품안전법 개정안 2026년 10~11월 논의 예정 | NOTED (상단 고정 배너) | Medibase, Cisema, Vietnam Briefing |
| `VN-CAT-01` | category | 건강보호식품(health supplement)은 자기공표가 아닌 **등록** 대상 | ACTION | InCorp, Medibase |
| `VN-APP-01` | applicant | 신청자는 **베트남 법인만**. 외국 제조사 직접 신청 불가, 제조사 위임장(LoA) 필요. 유통계약만으로는 부족 | ACTION (바이어 역량 없으면 BLOCK) | Medibase |
| `VN-DOC-TEST` | document | 시험성적서: MOH 지정 또는 ISO/IEC 17025 기관, **제출 전 12개월 이내** 발급 | ACTION | Medibase, ChemLinked |
| `VN-DOC-CFS` | document | 자유판매증명서(CFS): 아포스티유 또는 베트남 대사관 합법화 필요 | ACTION | Medibase |
| `VN-DOC-GMP` | document | 베트남이 인정하는 GMP 증명서 | ACTION | Medibase |
| `VN-DOC-EVD` | document | 효능 근거는 **해당 성분과 용량**에 맞는 문헌·시험. 원료 일반의 효능 인용은 반려 위험 | REVIEW | Medibase |
| `VN-LBL-01` | claim | 베트남어 라벨이 등록 문구와 1:1 일치, '의약품이 아님' 문구 필수 | ACTION | Medibase |
| `VN-SCH-01` | schedule | 법정 처리 **21영업일**(서류 완비 기준), 실무 2~6개월 | NOTED (기간 표시) | Medibase |
| `VN-SCH-02` | schedule | 보완 요청마다 회신 기한 **7영업일** | ACTION (마감 계산) | Medibase |
| `VN-CHG-01` | post_market | 처방·제조소·문구·라벨이 바뀌면 **새 등록** (변경 신고 아님). 등록 자체에는 만료일 없음 | ACTION (변경 시 경고) | Medibase |
| `VN-ADV-01` | post_market | 광고 전 별도 광고내용 확인서 필요. 2026-07-01부터 발급 기관이 성(省) 인민위원회 | ACTION | Medibase |
| `VN-ING-01` | ingredient | 미량영양소 함량 기준 (Circular 17/2023/TT-BYT) — **수치 미확인, 데이터 비워 둠** | UNKNOWN | Medibase (근거 규정명만) |

> 베트남 규칙은 전부 `needsVerification: true`로 시작한다 (제3자 요약 기반). 관보(congbao.chinhphu.vn) 원문 확인 후 `false`로 바꾼다.

### 6-4. 미국 (`data/rules-us.js`)

| ID | 영역 | 규칙 | 판정 | 출처 |
|---|---|---|---|---|
| `US-CAT-01` | category | Dietary Supplement는 FDA 시판 전 승인 없음. 제조사가 안전성 책임 | NOTED | CHPA |
| `US-NDI-01` | ingredient | 1994-10-15 이전 미국에서 시판되지 않은 원료(NDI)는 **판매 75일 전 FDA 통지** | ACTION | CHPA, 머니투데이 |
| `US-NDI-02` | ingredient | 한국 **개별인정형 원료**(`koreaIndividual: true`)는 NDI 해당 가능성 자동 경고 | REVIEW | 머니투데이 + 실무 추론 |
| `US-NDI-03` | applicant | 대형 유통사는 원료 사전 등록(NDI)을 계약 전에 요구할 수 있음 | REVIEW | 머니투데이 |
| `US-CLM-01` | claim | 질병 진단·치료·완화·예방 표현은 사용 불가 (`claim-terms.js`의 질병 표현 목록으로 검사) | BLOCK | FDA (면책 문구 내용에서 도출) |
| `US-CLM-02` | claim | 구조·기능 표현에는 면책 문구 2문장을 **굵게** 표시: "This statement has not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease." | ACTION (문구 없으면) | FDA |
| `US-CLM-03` | schedule | 구조·기능 표현은 **출시 후 30일 이내** FDA 통지 | ACTION (마감 계산) | FDA |
| `US-MFG-01` | manufacturing | cGMP(21 CFR Part 111) 준수 | ACTION (자료 없으면) | AGG(FSVP) |
| `US-IMP-01` | applicant | 수입 시 FSVP 수입자가 통관 서류에 명시되고, 외국 공급자의 cGMP 준수를 검증 | REVIEW | AGG(FSVP) |
| `US-FAC-01` | document | 미국 소비용 식품을 제조·가공·포장·보관하는 시설은 FDA 등록, **2년마다 갱신** | ACTION | FDA |

### 6-5. 문구 점검 표현 목록 (`data/claim-terms.js`)

```js
window.DASH_DATA.claimTerms = {
  US: {
    disease: ['cure', 'treat', 'prevent', 'diagnose', 'heal', 'disease', '치료', '예방', '완화', '질병'],
    // 질병명 목록(예: diabetes, cancer)은 규제 담당이 추가
  },
  JP: {
    excludedTarget: ['임산부', '수유', '어린이', '미성년', '환자', '妊婦', '授乳', '子ども', '病気'],
  },
  VN: {
    medicineLike: ['thuốc', 'chữa', 'điều trị', '치료', '약']   // '의약품이 아님' 문구와 충돌하는 표현
  }
};
```

> 표현 목록은 출발점일 뿐이다. 단어 하나로 판정을 확정하지 않고, `BLOCK`이라도 걸린 단어와 이유를 같이 보여 주고 담당자가 확인한다.

---

## 7. 탭별 기능 명세

각 탭의 화면 배치는 COSTD(COSMOA)의 같은 화면을 따른다. 서버·외부 API가 필요한 부분은 자리를 두고 `2단계`로 표시한다.

### 7-0. 공통 레이아웃

```
┌──────────────┬──────────────────────────────────────────────────────────────┐
│ 사이드바      │ 상단 바: [현재 건 ▼] [+ 새 건] [건·바이어 관리]      ⚠️ 사전검토 │
│ 🏠 홈         ├──────────────────────────────────────────────────────────────┤
│ 📜 규제 확인  │ 페이지 제목 + 설명 (COSTD .page-title / .page-description)      │
│ 🧪 개발요청서 │ 탭 영역                                                         │
│ 💰 원가       │                                                                │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

- 건이 선택되지 않으면 규제 확인·개발요청서·원가 탭은 "건을 고르거나 + 새 건으로 만드세요" 빈 화면.
- 국가가 VN인 건을 열면 건이 필요한 탭 상단에 `VN-LAW-01` 배너(현재 적용 규정) 고정.
- **+ 새 건**: 국가 → 바이어(기존 선택 또는 새로 등록) → 제품(기존 선택 또는 새로 등록: 이름·제형·1회 개수·1일 횟수·한국 기능성) → 판매 희망일. 저장하면 규제 확인으로 이동.
- **건·바이어 관리**: 건 목록(열기·단계 변경·삭제), 바이어 목록(유형·리드 출처·담당자·시간대·마지막 연락·회신 대기·명의자 역량 체크), JSON 내보내기·가져오기, 예시 데이터 지우기, 전체 초기화.

### 7-1. 🏠 홈 (COSTD 홈 배치)

```
인사말 + 날짜
[ 환율 띠 (2/3)                         ][ 바이어 현지 시각 (1/3) ]
[ 건기식 수출 요약   ][ 건기식 최신 뉴스   ]
[ 수출 상위국        ][ 규제 업데이트      ]
[ 품목별 수출        ]
```

| 카드 | 내용 | 데이터 | 단계 |
|---|---|---|---|
| 환율 띠 | USD · CNY · JPY(100) · EUR 기준 환율 (VND는 달러 결제가 일반적이라 제외), 기준일·출처. 전일 대비 등락률 자리 | `data/fx-rates.js` (원가 탭 직접 입력값 우선) | MVP / 매매기준율·등락률은 수출입은행 API 2단계 |
| 바이어 현지 시각 | [진행 건 바이어 / 내가 선택] 전환. 진행 건 바이어의 시간대(최대 4곳) 또는 직접 고른 도시(최대 4곳, 검색). 초록 = 현지 업무 시간(월~금 09–18) | 바이어 `contact.timezone`, `Intl.DateTimeFormat` | MVP |
| 건기식 수출 | 3개국 합계·비중, 월별 추이 자리. 누르면 국가별 상세(채널·진입 절차) | `data/markets.js` (통계 기준 함께 표시) | MVP / 월별·전년 동기 대비는 관세청 API 2단계 |
| 수출 상위국 | JP·VN·US 순위 막대 + 금액·비중 | `data/markets.js` | MVP |
| 품목별 수출 | HS 6단위 순위 자리 | `db/csv/api_export_stats.csv` (비어 있음) | 관세청 API 2단계 |
| 건기식 최신 뉴스 | 출처 바로가기(식약처·건기식협회·NutraIngredients·KOTRA) | — | 자동 수집(RSS·크롤링) 2단계 |
| 규제 업데이트 | 규칙 파일 타임라인을 최신순, 국가 배지·상태·NEW(90일 이내)·영향받는 진행 건 수, 더보기 | `data/rules-*.js` timeline | MVP / KOTRA·식약처 실시간은 2단계 |

### 7-2. 📜 규제 확인 (COSTD '국가별 인허가 규제' 배치)

```
① 성분·제품 DB 검색: [성분명 또는 제품명] [국가] [확인] + 이 건 제품·성분 칩(클릭 한 번으로 확인)
   └ 제품명 검색 결과 = 제품 성분 판정 표 (+ 이 건 제품이면 성분표 파일로 처방 바꾸기)
② 판단 항목 (클릭만: 분류·신규 성분·NDI·FFC 체크리스트) · 점검한 표시 문구(개발요청서에서 가져옴)
③ 조회 결과 (자동 실행): 요약 배지 → 원료·조회 조건·분류·표시 문구·의무 판정 카드 → 필요 서류·예상 기간·주요 마감
④ 참고 (접힘): 세 나라 비교표 · 규제 변화 타임라인
```

> 규제 확인 탭은 **확인용**이다. 실무자가 성분·문구를 일일이 타이핑하지 않는다. 판정에 필요한 값은 DB 사본·처방·개발요청서에서 자동으로 가져오고, 사람이 정할 것은 클릭으로만 고른다.

| 기능 | 내용 | 단계 |
|---|---|---|
| 성분 의약품 해당 여부 | 성분명(자동완성) + 국가만 고르면 **출처를 고르지 않고** DB 사본 전체(일본 의약품 전용 목록 · 식약처 원료 · FDA 리콜)를 한 번에 대조. 한국어 이름은 `data/ingredient-aliases.js`(이름 대조표)로 일본어·영문 이름을 찾아 대조. JP: 의약품 해당 / 부위에 따라 의약품(備考 「非医」) / 목록에 없음 / 대조 불가. US·VN: 의약품 성분 목록 미등록(UNKNOWN) + 참고 정보. 결과 없음 ≠ 사용 허용 | MVP |
| 제품 성분 판정 (검색 결과) | 탭에 고정 표시하지 않고, ① 검색에서 DB에 저장된 제품명(자동완성 📦)을 고르거나 '📦 제품 성분 판정' 칩을 누르면 결과로 표시. 처방 성분마다 1일 섭취량 · 의약품 해당(건 국가) · 한국 원료 구분(고시형/개별인정형) · 확인할 것을 자동 표시. `jpPharmaOnly`·`koreaIndividual`은 DB 대조로 자동 채움. 부위 조건 성분만 담당자가 '예/아니요'를 클릭(`jpPharmaBy: 'user'`) | MVP |
| 성분표 파일 | .xlsx·.csv 끌어다 놓기 → 시트·열(성분명·함량·단위·영문명) 자동 인식 → 판정 미리보기 → 처방으로 저장(바꾸기/뒤에 추가). 열이 틀리면 접힌 '시트·열 바꾸기'에서 고름. 견적 합의 건이면 처방 변경 경고 | MVP / PDF·이미지 OCR 2단계 |
| 판단 항목 | JP: 분류 경로·신규 성분·FFC 필수 표시 체크리스트 / US: 개별인정형 원료 자동 표시 + NDI 해당 판단 체크 / VN: 안내만 | MVP |
| 표시 문구 점검 | 이 탭에서 입력하지 않는다. 개발요청서 '허용 표현 초안' → 예전에 저장된 문구 → 제품의 한국 표시 문구 순으로 가져와 자동 점검 | MVP / AI 문구 변환 2단계 |
| 조회 결과 | 탭을 열거나 처방·조건이 바뀌면 규칙 엔진을 자동 실행해 `case.regulatory`에 저장. 결과가 바뀌면 개발요청서에 확인 배지 | MVP |
| 세 나라 비교·타임라인 | 같은 제품을 JP·VN·US에 동시에 적용한 표, 규칙 날짜 타임라인 | MVP |

- 결과 카드 구성: 판정 배지 → 메시지 → (있으면) 수정 제안 → `출처 · 검증일` → `원문 확인 필요` 배지.
- 상단 버튼: `개발요청서로 보내기 →`(stage → request).

### 7-3. 🧪 개발요청서 (COSTD '개발요청서' 배치)

```
[파일 자동변환 | 직접 작성]
직접 작성: 01 기본정보 / 02 제품 개발 요구사항 / 03 원료 요구사항 / 04 사용 정보 / 05 품질 확인사항 / 06 참고자료 / R&D 회신
           오른쪽 고정: 문서 정보 (입력 완료 n/10 · 확인 필요 · 상태 · 전달 대상 · R&D 회신 n/N · 인쇄·PDF · 바이어 회신 초안)
```

| 영역 | 내용 | 단계 |
|---|---|---|
| 파일 자동변환 | 업로드 영역(PDF·DOCX·XLSX·이미지) + 변환 설정(고객사·원문 언어·출력 언어·전달 대상), STEP 표시. 원칙: 원문에 없는 값은 만들지 않음, 수량·MOQ·단가·마진은 연구소 문서에서 제외, 바이어 금지/법규 금지 원료 구분 | 화면만 MVP / 변환은 2단계(서버 + OpenAI) |
| 01 기본정보 | 고객사* · 제품명* · 유형(제형)* · 수출 대상국*(건 국가) · 목표 가격대(저·중·고) · 목표가 · 판매 희망일 · 전달 대상(연구소/공장) · 제품 설명·처방 가이드 · 벤치마크 | MVP |
| 02 제품 개발 요구사항 | 바이어 희망 기능성 ↔ 국가별 허용 표현 초안, 국가 조건(규제 확인 결과에서 자동, US는 NDI 처방 방향 선택), JP·VN 근거 자료 요청 자동 추가 | MVP |
| 03 원료 요구사항 | 필수·선호 원료, 바이어 금지 원료, 법규 금지·확인 원료(자동), 기준 처방 + 국가별 변경점, 같은 제품 다른 국가 건 비교, 처방 변경 경고 | MVP |
| 04 사용 정보 | 섭취 방법·대상, 포장 프리셋, 일정 | MVP |
| 05 품질 확인사항 | 안정성·미생물·중금속·지표 성분 함량·알레르기 체크, VN 등록용 시험 계획(제출 예정일 기준 12개월 범위 판정) | MVP |
| 06 참고자료 | 참고 메모, 첨부 파일 이름 기록 | MVP / 파일 보관 2단계 |
| R&D 회신 | 항목별 가능·불가·대안 + 메모 → 영문 바이어 회신 초안 | MVP |
| 인쇄·PDF | 6개 영역 순서의 인쇄용 문서 (`window.print()`) | MVP |

### 7-4. 💰 원가 (COSTD '원가·마진 시뮬레이션' 배치·계산식)

```
왼쪽 입력                         오른쪽 결과 [견적 계산 | 역제안 분석 | 수량별 단가 | 환율 영향]   기준 환율 [____] 원/USD
① 견적 조건 (주문수량·인코텀즈·목표/최소 영업마진)
② 제조원가·1차 마진 (처방안별 원재료·임가공·부자재 + 항목별 1차 마진, ERP 연동 자리)
③ 물류비 (접힘: 포장 프리셋·입수·카톤·CBM·내륙/해상 단가·보험·물류 마진)
④ 등록·시험 비용 (접힘: 항목·금액·부담 주체, 우리 부담분 원가 반영)
현재 견적 요약 (고정)
```

**계산식** (COSTD margin.md 7.2와 같음, 마진은 판매가 대비)

```
P1 = Σ 항목원가 / (1 − 1차마진_k) + 등록비 반영        L = 개당 FOB 물류비 (EXW면 0)
P2 = P1 + L / (1 − 물류마진)                         P3 = P2 / (1 − 목표 영업마진)
P4 = P3 × (1 − 수량 할인) × (1 + MOQ 미만 할증)        USD = P4 / 환율 (+ CFR·CIF 해상운임, CIF는 × (1 + 1.1 × 보험요율))
영업마진 = 1 − P2 / P4      총 마진 = (P4 − 원가 − L) / P4
물류비: 카톤 수 = ⌈수량 ÷ 카톤당 개수⌉, 청구 CBM = max(1, 카톤 수 × 카톤 CBM), 총액 = 청구 CBM × 단가
```

| 탭 | 내용 | 단계 |
|---|---|---|
| 견적 계산 | 큰 단가 + 원화·주문 총액, 단가 구성 막대(원가·1차 마진·물류비·물류 마진·영업마진), 타일(원가·1차 마진·할인 후 영업마진·1일분/1회분 단가). 하위 탭 [항목별 원가 / 처방안·국가 비교 / 견적서] — 견적서는 통합형/분리형, 등록 명의·서류 제공 범위·비용 부담 조건 포함, 인쇄·PDF, 영문 커버레터 | MVP |
| 역제안 분석 | 바이어 목표가 + 1차 마진 양보 한계치 → 판정 4구간(수락 가능 / 영업마진 양보 / 1차·물류 마진 조정 / 마진만으로 불가) + R&R 배지(팀장 전결 / 임원 승인) + 부족·여유 금액. 가격 위치 게이지(손익분기·최대 양보가·최소 마진가·목표 마진가). 대응 방안(재역제안·공통 마진율·EXW 전환·다음 구간 수량 유도). 사양 변경(VE: 용기 변경·단상자·원료 등급 대체 → 국가별 규제 영향)과 마진 직접 조정은 판정에 즉시 반영 | MVP |
| 수량별 단가 | MOQ, MOQ 미만(소량 할증/주문 불가), 할증률, 할인 구간 칩, 견적 수량 추가 → 수량별 물류비·단가 막대·영업마진 배지·1일분, 바이어용 가격표·영문 제안문 복사 | MVP |
| 환율 영향 | 계약 단가(USD 고정) + 결제 시점 환율(입력·슬라이더, 트랙이 위험/안전 구간) → 실현 영업마진·환차손익·방어 단가, 마지노선 환율(손익분기·최소·목표), ±5·±10% 시나리오 표 | MVP |
| ERP 연동 | 버튼 자리 — 지금은 예시 원가 넣기 | 2단계 |

- 판정 구간 색은 4-4 규칙대로 초록을 쓰지 않는다 (수락 = 파랑).
- 상단 `견적 합의로 표시` → `stage: 'agreed'`. 이후 처방을 바꾸면 처방 변경 경고(VN 새 등록 / US NDI 재확인 / JP 근거 재확인)가 기록된다.

### 7-5. 🔎 바이어 발굴 (reboot-dashboard '업체 컨택' 짜임)

목표: 건강기능식품을 취급하는 기업 중 자사에 맞는 해외 바이어를 찾고, 제안·첫 연락·후속 관리까지 한 탭에서 이어 간다. 건이 없어도 쓸 수 있다 (`needsCase: false`).

**간편화 원칙** — 검색 조건 6줄(국가·유형·카테고리·원료·제형·거래 형태 칩)을 모두 고르게 하지 않는다.
- 점수 기준은 **기준 제품 하나**로 정한다. 자사 제품을 고르면 카테고리·원료·제형이 자동으로 들어가고, 개발 전이면 '신규 아이디어'에서 카테고리·제형 두 개만 고른다.
- 목록은 **한 줄 필터 바**로 좁힌다: 검색창(기업·국가·제품·원료) + 국가·유형·세부 카테고리 드롭다운(옵션마다 개수 표시) + 토글 2개(자사 생산 가능만 · 규제 규칙 있는 국가만) + 필터 지우기 + 정렬.
- 처음부터 전체 목록을 적합도 순으로 보여 주고, 필터는 좁힐 때만 쓴다.

```
[현황 띠: 관리 중인 바이어 · 진행 중인 협의 · 7일 안 후속 연락]
[🔎 바이어 찾기 | ✉️ 제안 작성 | 🗂️ 영업 관리]
바이어 찾기:  ① 기준 [자사 제품 | 신규 아이디어] [제품 ▼]
              ② 바이어 목록 (한 줄 필터 바 · 표 · 페이지)        | 오른쪽 바이어 카드 (③ 포트폴리오 · ④ 자사 생산 비교 · ⑤ 적합도 구성 · 최근 활동 · 제안 작성 ↗)
```

**실무 흐름(페인포인트) → 화면 위치**

| 실무 단계 | 지금 겪는 불편 | 위치 |
|---|---|---|
| ① 수출 목표 국가·제품군 선정 | 조건을 매번 처음부터 정함 | 기준 제품 + 국가 드롭다운 |
| ② 잠재 바이어 검색 | 목록이 엑셀·메일에 흩어짐 | 바이어 목록 (기업·국가·유형·세부 카테고리·영업 적합도·확인 근거, 페이지당 8곳) |
| ③ 홈페이지·포트폴리오 분석 | 홈페이지를 하나씩 열어 메모 | 바이어 카드 ③ (채널·제품군·메모 + 분석 메모 입력) |
| ④ 자사 생산 가능 제품과 비교 | 생산·인증 가능 여부를 따로 물음 | 바이어 카드 ④ (제형·원료·인증·거래 형태: ✓ 가능 / ✕ 불가 / ? 확인 필요) |
| ⑤ 거래 가능성·우선순위 판단 | 감으로 순서를 정함 | 목록 정렬(적합도) + 바이어 카드 ⑤ (6개 항목 점수, A/B/C) |
| ⑥ 바이어별 제품 제안 준비 | 바이어마다 메일을 새로 씀 | 제안 작성 (받는 바이어·제안 제품·제안 포인트 → 영문 초안, 표현 점검, 현지 시각) |
| ⑦ 첫 영업 연락·후속 관리 | 후속 연락을 놓침 | 영업 관리 (단계별 보드 + 표: 다음 할 일·다음 연락일·연락 기록·건으로 전환) |

**영업 적합도 (100점)** — 제품군 일치 25 · 제형 생산 가능 20 · 취급 원료 유사 20 · 거래 형태 적합 15 · 국가 진입 준비(규제 규칙 등록) 10 · 요구 인증 보유 10.
점수는 **영업 우선순위 지표**이며 구매 확률이 아니다 (87점 ≠ 구매 확률 87%). 화면에 항상 이 문구를 표시한다.

- 제안 작성의 '보냈어요 — 연락 기록 저장'은 관리 목록에 기록하고 단계를 '첫 연락', 다음 연락일을 7일 뒤로 잡는다. 실제 Gmail 발송·답장 확인은 2단계 서버(SMTP·IMAP, 앱 비밀번호).
- 표현 점검은 규칙 파일의 `claimTerms`(질병·의약품 표현)로 한다. 규칙이 없는 국가는 점검하지 않는다고 표시한다.
- 잠재 바이어 데이터(`data/buyer-prospects.js`)는 지금 **가상 데이터**이며 이름에 `(가상)`을 붙인다. 실제 데이터는 2-4의 출처에서 수집해 같은 필드로 바꾼다.
- 저장: 화면 상태 `hsd:ui:byr`, 관리 목록 `hsd:pipeline`, 분석 메모·메일 초안 `hsd:prospectNotes`, 자사 제조 역량 `hsd:settings:capability`.
- 사이드바 숫자 = 7일 안에 후속 연락할 바이어 수.

---

## 8. 탭 간 연결

```
바이어 발굴 ── 건으로 전환(바이어·제품·국가) ──┐
+ 새 건(국가·바이어·제품) ─────────────────────┤
   │
   ▼
규제 확인 ── case.regulatory ──┬──▶ 개발요청서: 국가 조건·법규 금지 원료·허용 표현·시험 계획
                               └──▶ 원가: 1일 섭취량(1일분 단가)·필요 서류(견적서 서류 제공 범위)·VE 규제 영향
개발요청서 ── NDI 처방 방향(두 안) ──▶ 원가: 처방안 2개 비교
개발요청서 ── 목표가·포장 ──▶ 원가: 바이어 목표가·포장 프리셋 기본값
원가 ── 견적 합의(stage: agreed) ──▶ 규제 확인·개발요청서: 처방 변경 경고
```

- 연결은 전부 **같은 건 객체의 필드**로 한다. 탭끼리 직접 함수를 부르지 않는다.
- 규제 조회를 다시 해서 결과가 바뀌면 개발요청서에 "규제 결과가 바뀌었습니다 — 확인" 배지를 띄운다 (자동 덮어쓰기 금지).

---

## 9. 날짜·마감 계산 로직

`js/core/dates.js`에 구현하고 `tests/dates.test.js`로 검증한다.

| 함수 | 용도 | 규칙 |
|---|---|---|
| `addBusinessDays(date, n, country)` | 영업일 더하기/빼기(n 음수) | 토·일 + `holidays.js`의 해당 국가 공휴일 제외 |
| `addCalendarDays(date, n)` | 달력일 | 미국 NDI 75일, 문구 통지 30일 |
| `monthsBetween(from, to)` | 개월 차이 | 베트남 성적서 12개월 |
| `daysUntil(date)` | 오늘부터 남은 일수 | 홈 할 일 정렬·색 |

**마감 계산 예**

| 규칙 | 계산 |
|---|---|
| `JP-SCH-01` | `addBusinessDays(targetLaunchDate, -60, 'JP')` |
| `JP-SCH-02` | `addBusinessDays(targetLaunchDate, -120, 'JP')` |
| `VN-SCH-02` | `addBusinessDays(query.receivedAt, 7, 'VN')` |
| `VN-DOC-TEST` | `monthsBetween(doc.issuedAt, plannedSubmitDate) <= 12` |
| `US-NDI-01` | `addCalendarDays(targetLaunchDate, -75)` |
| `US-CLM-03` | `addCalendarDays(launchDate, 30)` |

> **한계 표시**: 공휴일 목록이 비어 있으면 화면에 "공휴일 미반영 — 실제 마감은 더 이를 수 있음"을 표시한다. 미국 '75일'·'30일'을 달력일로 계산한 것은 근거 문서 표현을 따른 것이며, 원문 확인 전까지 `needsVerification` 배지를 붙인다.

---

## 10. 화면·디자인 가이드

| 항목 | 값 |
|---|---|
| 기준 해상도 | 1440 × 900, 최소 1280 |
| 글꼴 | Pretendard (없으면 시스템 sans-serif) |
| 배경 / 카드 | `--bg: #F5F6F8` / `--card: #FFFFFF`, 모서리 12px |
| 기본색 | `--primary: #2F6FEB` (버튼·선택 탭) |
| 판정색 | `--block: #D92D20` · `--action: #E67700` · `--review: #CA8A04` · `--noted: #667085` · `UNKNOWN`은 점선 테두리 |
| 국가 배지 | JP `#E8F0FE`/`#1A56DB` · VN `#FDECEC`/`#B42318` · US `#EEF4FF`/`#3538CD` |
| 예시 배지 | 연한 회색 배경 `예시` |
| 표 | 행 높이 44px, 헤더 고정, 긴 원문은 상세 모달로 |
| 접근성 | 색만으로 의미를 전달하지 않음 — 배지에 항상 글자(사용 불가/조치 필요 …) |

---

## 11. 구현 순서

| 순서 | 작업 | 완료 기준 |
|---|---|---|
| 1 | `index.html` 레이아웃, `app.js` 탭 전환·해시 라우팅, `base.css` | 4개 탭이 전환됨 |
| 2 | `store.js`, `case-context.js`, `services/*`, 예시 데이터 | 새로고침해도 건이 유지됨, 건 선택 시 `case:changed` 발생 |
| 3 | `dates.js` + 테스트 | `tests/test.html`에서 9장 예시 전부 통과 |
| 4 | 🏠 홈: 건 목록·새 건·바이어 카드·현지 시각 | 새 건 → 규제 확인 탭으로 이동 |
| 5 | `rules-engine.js` + `rules-us.js`, `rules-vn.js` | 12장 시나리오 B·C 규칙 판정 결과가 맞음 |
| 6 | 📜 규제 확인 ①~⑤ + 성분표 업로드(xlsx·csv) | 결과가 `case.regulatory`에 저장됨 |
| 7 | 🧪 개발요청서 (국가 조건 자동 삽입·처방 변형·변경 경고·인쇄) | 규제 결과가 폼에 들어옴 |
| 8 | 💰 원가 (COSTD 계산 로직 + 등록 비용·1일분 단가·VE 경고) | 견적서 인쇄에 비용 부담 조건 포함 |
| 10 | `rules-jp.js` + 일본 화면 | 시나리오 A 통과 |
| 11 | 세 나라 비교표, 규제 변화 타임라인, 건·바이어 관리 창 | |
| 12 | (2단계) Flask 이전, PDF·OCR, AI 문구 변환, 공유 링크 | |

---

## 12. 테스트 시나리오

`data/sample-cases.js`에 아래 세 건을 넣고, 각 단계 결과를 확인한다. (제품·바이어는 가상)

### A. 일본 — 유통 체인 × 콜라겐 젤리 스틱 (FFC)

1. 새 건: JP, 바이어 유형 `retail_chain`, 판매 희망일 2027-06-01.
2. 규제 확인: 분류 FFC 선택 → 필수 표시 체크리스트 표시. 성분에 `jpPharmaOnly` 데이터가 없으면 `JP-ING-01` = **UNKNOWN**.
3. 문구 "임산부에게도 좋은 피부 보습" 입력 → `JP-CLM-01` **BLOCK**.
4. 조회 결과 → 주요 마감: 신고 마감 = 2027-06-01에서 60영업일 전, 자료 제공 마감은 그보다 10영업일 전.
5. 필요 서류: GMP 서류 없음 → `JP-MFG-01` **ACTION**.

### B. 베트남 — 약국 체인 납품사 × 유산균 캡슐

1. 새 건: VN, 바이어 `holderCapability.VN.localEntity = false` → 건·바이어 관리에 **명의자 역량 부족** 표시, `VN-APP-01` **BLOCK**.
2. 건이 필요한 탭 상단에 `VN-LAW-01` 배너(Decree 15/2018 적용 중).
3. 필요 서류: 시험성적서 발급일 2025-09-10, 제출 예정일(개발요청서 05) 2026-12-01 → 12개월 초과 → `VN-DOC-TEST` **ACTION**.
4. CFS `legalization: 'none'` → `VN-DOC-CFS` **ACTION**.
5. 견적 합의(`agreed`) 이후 처방에서 원료 하나 변경 → **새 등록 필요** 경고.

### C. 미국 — 브랜드사 × 개별인정형 원료 포함 제품

1. 새 건: US, 제품 처방에 `koreaIndividual: true` 원료 → `US-NDI-02` **REVIEW**, `US-NDI-03` 안내.
2. NDI로 판단(사용자 체크) → `US-NDI-01` **ACTION**, 출시일 2027-03-01 → NDI 통지 마감 = 75일 전.
3. 문구 "Prevents joint disease" → `US-CLM-01` **BLOCK**. "Supports joint comfort" + 면책 문구 없음 → `US-CLM-02` **ACTION**, 면책 문구 삽입 제안.
4. 조회 결과 → 주요 마감: NDI 통지 마감(출시 75일 전).
5. 개발요청서: "NDI 통지안 / 대체 원료안" 두 처방 요청 → 원가 탭에서 두 안 원가 비교.

**공통 확인**

- [ ] 어떤 결과도 초록색·"승인"·"수출 가능" 문구로 표시되지 않는다.
- [ ] 규칙이 없는 영역은 UNKNOWN으로 표시된다.
- [ ] 모든 판정 카드에 출처와 검증일이 있다.
- [ ] 새로고침 후에도 건·처방·견적이 유지된다.
- [ ] 예시 데이터에 `예시` 배지가 붙는다.

---

## 13. 확인이 필요한 사항

구현 중 아래 항목은 **임의로 값을 채우지 않는다**. 근거를 확인한 뒤 규칙 파일에 넣고 `needsVerification`을 갱신한다.

| 항목 | 현재 상태 | 처리 |
|---|---|---|
| 일본 '의약품으로만 쓰는 성분' 목록 | 원문 확보 (db/source, 332행) | 규제 확인 화면에서 검색·후보 표시, 성분 플래그는 사람이 입력 (미입력은 UNKNOWN) |
| 일본 FFC 신고 시 외국 제조사 제출 자료, 일본 광고 규제 | 미확인 | 화면에 '규칙 미등록' |
| 베트남 미량영양소 함량 기준(Circular 17/2023) 수치 | 미확인 | `VN-ING-01` UNKNOWN 유지 |
| 베트남 규정 전반 | 제3자 요약 기준, Decree 46 정지 후 법 개정 논의 중 | 관보 확인 전 `needsVerification: true` |
| 미국 시설 등록 세부(외국 시설 미국 대리인, 갱신 기간), Supplement Facts 표시 양식 | FDA 원문 미확인 | 규칙 추가 보류 |
| 미국 '75일'·'30일'의 일수 기준(달력일 여부) | 근거 문서 표현만 확인 | 달력일 계산 + 확인 필요 배지 |
| 일본·베트남 공휴일 | 2026~2028 반영 (베트남 2027은 정부 발표, 2026·2028 설 연휴 누락) | 누락분은 `db/csv/api_holidays.csv`·`data/holidays.js`에 추가 |
| 한국 CFS 발급 기관·절차, 아포스티유 방식 | 미확인 | 필요 서류 안내 문구만 |
| 국가별 2025년 건기식 수출액 | 미확인 (2024년 관세청 기준만) | `markets.js`에 기준 연도·통계명 표시 |

---

## 14. 출처

| 내용 | 출처 |
|---|---|
| 2024 국가별 수출액(관세청 기준) | [헤럴드경제, 2025.2.3](https://mbiz.heraldcorp.com/article/10410733) |
| 2025 건기식 수출·원료별(식약처) | [푸드투데이, 2026.5.29](https://www.foodtoday.or.kr/news/article.html?no=205160) |
| 일본 시장·분류·의약품 성분·이너뷰티 처방 변경 | [코스모닝(KOTRA 도쿄), 2024.12.16](https://cosmorning.com/mobile/article.html?no=49497) |
| 일본 FFC 신고 기한·신고자·표시 항목·대상 외 | [도쿄도 보건의료국 교재](https://www.hokeniryo1.metro.tokyo.lg.jp/shokuhin/hyouji/kyouzai/files/eiyouseibun_chapter_6_kinouseihyoujishokuhin.pdf) |
| 일본 FFC 4가지 신규 의무·GMP 유예 | [NutraIngredients, 2024.7](https://www.nutraingredients.com/Article/2024/07/08/japanese-functional-foods-businesses-legally-bound-to-four-new-rules-from-sep/) |
| 일본 건강피해 보고 15일 | [Data Max, 2024.8.26](https://data-max.co.jp/article/73210) |
| 베트남 등록 서류·신청자·기간·광고·변경 | [Medibase, 2026.10.27 갱신](https://medibase.vn/supplement/registration/) |
| 베트남 Decree 46 정지(결의 15/2026) | [Cisema](https://cisema.com/news/vietnam-food-registration-suspension), [Vietnam Briefing, 2026.2.4](https://www.vietnam-briefing.com/news/vietnam-addresses-implementation-bottlenecks-under-decree-46-on-food-safety.html/) |
| 베트남 Decree 46 내용·건강보호식품 등록 | [InCorp](https://vietnam.incorp.asia/vietnam-new-food-safety-regulation/) |
| 베트남 유통 구조(2020) | [데일리팜, 2020.5.12](https://m.dailypharm.com/user/news/63030) |
| 미국 구조·기능 표현 통지·면책 문구 | [FDA](https://www.fda.gov/food/information-industry/structurefunction-claim-notification-dietary-supplements) |
| 미국 시설 등록·2년 갱신 | [FDA](https://www.fda.gov/food/guidance-regulation-food-and-dietary-supplements/registration-food-facilities-and-other-submissions) |
| 미국 시판 전 승인 없음·NDI 75일 | [CHPA](https://www.chpa.org/public-policy-regulatory/regulation/regulation-dietary-supplements/marketing-and-advertising) |
| 미국 FSVP·cGMP | [AGG, 2020.6](https://www.agg.com/news-insights/publications/fsvp-basics-for-importers-of-dietary-supplement-and-their-components/) |
| 미국 대형 유통사 NDI 요구·한국 개별인정형 | [머니투데이, 2024.9.2](https://www.mt.co.kr/living/2024/09/02/2024083014574892990) |

---

## 15. Claude Code·Copilot에 줄 첫 프롬프트

```text
README.md를 먼저 끝까지 읽고 그대로 따라줘.

# 작업
11장 구현 순서의 1~3단계만 진행해줘.
- index.html, css/base.css, js/core/app.js(탭 전환·해시 라우팅), store.js, case-context.js, dates.js
- data/sample-products.js, data/sample-cases.js (12장 시나리오 A·B·C, sample: true)
- tests/test.html + tests/dates.test.js (9장 예시 전부)

# 반드시
- 빌드·npm·type="module" 쓰지 마 (Live Server로 바로 열려야 함)
- 전역은 window.DASH, window.DASH_DATA만
- 4장 이름 규칙(접두사, hsd: 저장 키, data-act) 지키기
- 판정 색에 초록색 쓰지 말고 4-4 표의 5단계만 사용
- 13장 '확인이 필요한 사항'의 값은 임의로 채우지 말 것
- 파일을 만들기 전에 만들 파일 목록을 먼저 보여주고 허락받기
```

이후 단계는 "11장의 4단계 진행해줘"처럼 번호로 요청한다.
