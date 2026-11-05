# 건기식 해외영업 대시보드 (일본 · 베트남 · 미국)

> 한국 건강기능식품 제조사(OEM·ODM)의 해외영업 담당자가 **일본·베트남·미국** 바이어 건을
> 규제 확인 → 개발요청서 → 원가(견적) → 등록·신고까지 한 화면에서 처리하는 대시보드.
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
🏠 홈  →  📜 규제 확인  →  🧪 개발요청서  →  💰 원가  →  🗂️ 등록·신고
                                                          (+ ⚙️ 관리자 메뉴: 톱니바퀴)
```

- 원가를 등록·신고 **앞**에 둔다. 보통 가격 합의 후 등록을 시작하고, 등록·시험 비용 부담 주체를 견적에 넣어야 하기 때문.
- 바이어 관리는 별도 탭 없이 **홈**에 둔다. 서류함은 **등록·신고** 안에 둔다.
- 국가별 규칙 관리·제품 마스터·계정은 탭이 아닌 **관리자 메뉴**.

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

첫 실행 시 `data/sample-cases.js`의 예시 건 3개가 자동으로 불러와진다. 화면에는 `예시` 배지가 붙는다. 관리자 메뉴의 **예시 데이터 지우기**로 비운다.

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
│       ├── cost.css            # .tab-cost
│       └── registration.css    # .tab-regi
├── js/
│   ├── core/
│   │   ├── app.js              # 탭 등록·전환, 해시 라우팅(#home, #regulatory ...)
│   │   ├── store.js            # localStorage 래퍼 (hsd:* 키), 건 CRUD
│   │   ├── case-context.js     # 현재 선택된 건 관리 + 'case:changed' 이벤트
│   │   ├── dates.js            # 영업일·마감 계산 (9장)
│   │   ├── rules-engine.js     # 규칙 판정 공통 함수 (6장)
│   │   └── ui.js               # card(), badge(), table(), modal(), toast(), esc()
│   ├── services/               # 데이터 접근 한곳 (2단계에서 서버 호출로 교체)
│   │   ├── cases.js
│   │   ├── products.js
│   │   ├── documents.js
│   │   ├── rules.js
│   │   ├── settings.js         # 환율·공휴일 (관리자 입력 → 없으면 DB 사본)
│   │   └── reference.js        # 식약처 원료·일본 의약품 전용 성분·FDA 리콜 조회
│   └── tabs/
│       ├── home.js
│       ├── regulatory.js
│       ├── request.js
│       ├── cost.js
│       └── registration.js
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
│   ├── fda-recalls.js          # FDA 건기식 리콜 (DB 사본)
│   ├── markets.js              # 국가 요약 카드 데이터 (1-2 수치 + 출처)
│   ├── sample-products.js      # 예시 제품 3개 (가상)
│   └── sample-cases.js         # 예시 건 3개 (가상)
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
| 탭 ID | `home`, `regulatory`, `request`, `cost`, `registration` | URL 해시와 같음 |
| CSS 접두사 | `home-`, `reg-`, `req-`, `cost-`, `regi-` | `.tab-reg .reg-result` |
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
  stage: 'regulatory',                 // regulatory | request | cost | registration | selling | closed
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
    status: 'draft'                    // draft | sent | replied | fixed
  },

  cost: {                              // 💰 원가
    incoterms: 'FOB', moq: 10000, packagingPresetId: 'bottle-60cap',
    unitCostKRW: 0, marginPct: { first: 0, logistics: 0, sales: 0 },
    regulatoryCosts: [ /* {item, amountKRW, payer: 'us'|'buyer'|'split'} */ ],
    fxRate: { USD: 0, JPY: 0, VND: 0, date: '' },
    quote: { unitPriceUSD: 0, perDayUSD: 0 }
  },

  registration: {                      // 🗂️ 등록·신고
    steps: [ /* {key, label, status, startedAt, doneAt, dueDate} */ ],
    queries: [ /* 베트남 보완 요청 {receivedAt, dueDate, answeredAt} */ ],
    shareToken: null                   // 바이어 공유 링크 (2단계)
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

각 기능에 `[MVP]` 또는 `[2단계]`를 표시했다. MVP만으로 12장 시나리오가 끝까지 돌아가야 한다.

### 7-0. 공통 레이아웃

```
┌──────────────┬──────────────────────────────────────────────────────────┐
│ 사이드바      │ 상단 건 선택 바: [현재 건 ▼ 베트남 · A사 · 유산균 캡슐] [+ 새 건] │
│ 🏠 홈         ├──────────────────────────────────────────────────────────┤
│ 📜 규제 확인  │                                                          │
│ 🧪 개발요청서 │                      탭 영역                              │
│ 💰 원가       │                                                          │
│ 🗂️ 등록·신고  │                                                          │
│ ─────────    │                                                          │
│ ⚙️ 관리자     │                                                          │
└──────────────┴──────────────────────────────────────────────────────────┘
```

- 건이 선택되지 않으면 규제 확인~등록·신고 탭은 "홈에서 건을 선택하거나 새로 만드세요" 빈 화면.
- 국가가 VN인 건을 열면 모든 탭 상단에 `VN-LAW-01` 배너(현재 적용 규정) 고정.

### 7-1. 🏠 홈

| 기능 | 내용 | 단계 |
|---|---|---|
| 건 목록 | 진행 중인 건을 단계별 칸반(규제 확인 → 개발 → 견적 → 등록·신고 → 판매)으로. 국가 필터 JP/VN/US. 카드 클릭 → 해당 건 선택 + 현재 단계 탭으로 이동 | MVP |
| 새 건 만들기 | 국가 → 바이어(선택 또는 새로) → 제품(선택) → 판매 희망일. 저장하면 규제 확인 탭으로 이동 | MVP |
| 바이어 카드 | 국가·유형(5-2 표), 리드 출처, 담당자, 마지막 연락일, 회신 대기 표시 | MVP |
| 명의자 역량 체크 | JP: FFC 신고 실적·건강피해 보고 체계 / VN: 현지 법인·등록 경험·위임장 구조 / US: FSVP 수입자 역할·유통사 요구 서류. 부족하면 카드에 주황 경고 | MVP |
| 오늘 할 일 (자동) | 모든 건의 마감을 모아 날짜순: 베트남 성적서 12개월 만료 임박(30일 전), 베트남 보완 회신 7영업일, 일본 신고·자료 제공 마감, 미국 NDI 75일·문구 통지 30일, FDA 시설 등록 갱신, R&D 회신 대기. 각 항목 클릭 → 해당 건·탭 | MVP |
| 규제 변화 알림 | 규칙 파일의 날짜 정보 요약(예: VN Decree 46 정지, JP GMP 유예 종료). 영향받는 건 수 | MVP |
| 현지 시각 | 도쿄(Asia/Tokyo), 하노이(Asia/Ho_Chi_Minh), 바이어 소재지 미국 시간대. 업무 중(월~금 09–18)·업무 외·주말. `Intl.DateTimeFormat` 사용 | MVP |
| 환율 | USD·JPY·VND 기준 환율 (MVP는 관리자 메뉴에서 직접 입력, 원가 탭과 공유) | MVP / 자동 조회는 2단계 |
| 국가 요약 카드 | `data/markets.js`의 수출액(통계 기준 표시), 주요 채널, 진입 절차·기간 한 줄 | MVP |

### 7-2. 📜 규제 확인

국가에 따라 화면 내용이 바뀐다. 결과는 `case.regulatory`에 저장.

| 기능 | JP | VN | US | 단계 |
|---|---|---|---|---|
| ① 제품 분류 | 특보 / FFC / 영양기능식품 선택, 의약품 분류 위험 표시 | 건강보호식품 등록 대상 표시 | Dietary Supplement 확인 | MVP |
| ② 원료 체크 | `JP-ING-01` | `VN-ING-01` (UNKNOWN) | `US-NDI-01~03` | MVP |
| ③ 1일 섭취량 계산 | 1회 함량 × 1일 횟수, 단위 표시 | 같음 | 같음 | MVP |
| ④ 표시 문구 점검 | 한국 문구 입력 → `JP-CLM-01` + 필수 표시 체크리스트 | 등록 문구·라벨·광고 문구 3칸 비교(1:1), '의약품 아님' 여부 | 질병 표현 차단, 면책 문구 자동 삽입 제안 | MVP (규칙 기반) / AI 변환 2단계 |
| ⑤ 필요 서류·예상 기간 | 근거 자료·GMP / 60(120)영업일 | CFS·성적서·근거·GMP·LoA·라벨 / 21영업일·실무 2~6개월 | 시설 등록·cGMP·(NDI) / NDI면 75일 | MVP |
| ⑥ 세 나라 비교표 | 같은 제품을 JP·VN·US에 동시에 돌려 한 표로 (분류·원료 경고·문구 제약·서류·기간) | | | MVP |
| ⑦ 규제 변화 타임라인 | 규칙 파일의 날짜 항목을 시간순으로 (상태: 초안 / 유예 중 / 시행 / 정지) | | | MVP |
| 성분표 업로드 | .xlsx / .csv 업로드 → 시트 선택 → 성분명·함량·단위 열 지정 → 확인·수정 → 제품 처방에 반영 | | | MVP (xlsx·csv) / PDF·OCR 2단계 |

- 결과 카드 구성: 판정 배지 → 메시지 → (있으면) 수정 제안 → `출처 · 검증일` → `원문 확인 필요` 배지.
- 하단 버튼: `개발요청서로 보내기`(stage → request), `등록·신고 단계 미리 만들기`.

### 7-3. 🧪 개발요청서

| 기능 | 내용 | 단계 |
|---|---|---|
| 직접 작성 폼 | 기본정보(고객사·제품명·제형·목표가·국가) / 원료 요구사항 / 목표 기능성 / 사용 정보 / 포장 / 일정 | MVP |
| 국가 조건 자동 삽입 | 규제 확인 결과에서 가져옴. JP: 의약품 전용 성분 제외, GMP 라인 / VN: 미량영양소 기준(데이터 있을 때), 등록용 시험 / US: NDI 원료 표시 + "통지안/대체안" 선택 | MVP |
| 목표 기능성 ↔ 허용 표현 | 바이어 희망 기능성과 국가별 표현 초안을 나란히. JP·VN은 성분·용량 일치 근거 자료 요청 항목 자동 추가 | MVP |
| 등록용 시험 계획 | VN: 시험성적서가 예상 제출일 기준 12개월 이내가 되도록 시험 예정일 범위 계산 | MVP |
| 국가별 처방 변형 | 기준 처방 + 국가별 변경점(diff) 표. 같은 제품의 다른 국가 건과 비교 | MVP |
| 처방 변경 경고 | 등록·신고 단계가 시작된 건의 처방을 바꾸면: VN 새 등록 / US 새 원료 NDI 재확인 / JP 신고 내용·근거 재확인 | MVP |
| R&D 회신 | 항목별 가능·불가·대안 + 메모. 회신 결과로 바이어 회신 초안(텍스트) 생성 | MVP |
| PDF 출력 | 브라우저 인쇄(`window.print()`) + 인쇄용 CSS | MVP |
| RFP 자동 변환 | 바이어 PDF·메일 업로드 → 항목 추출 | 2단계 (서버·AI) |

### 7-4. 💰 원가

| 기능 | 내용 | 단계 |
|---|---|---|
| 원가·마진 계산 | 원재료·임가공·부자재(원/개) + 1차·물류·영업 마진(%) → 인코텀즈(EXW/FOB/CFR/CIF)별 USD 단가 | MVP |
| 포장 프리셋 | `packaging-presets.js`: 병 60캡슐, 병 90정, 스틱 30포, PTP 블리스터, 젤리 파우치 → 입수·카톤 CBM·물류비 추정 (값은 예시, 직접 수정 가능) | MVP |
| 등록·시험 비용 | 항목(성적서 재시험, CFS 발급·아포스티유, NDI 통지 자료, FFC 근거 자료 작성 지원 등) + 금액(직접 입력) + **부담 주체(우리/바이어/분담)** | MVP |
| 1회분·1일분 단가 | 견적 단가 ÷ (1통 섭취일수) | MVP |
| 수량별 단가표 | MOQ·할인 구간 | MVP |
| 환율 영향 | 기준 환율 ±% 슬라이더 → 마진 변화 | MVP |
| 역제안 판정 | 바이어 목표가 → 수락 / 마진 양보 / 불가 + 재제안가 | MVP |
| 원료 대체(VE) 경고 | 원료를 바꾸면 국가별 규제 영향 표시 (VN 등록 후 재등록, US NDI, JP 근거 일치) | MVP |
| 국가별 변형 원가 비교 | 같은 제품의 JP·VN·US 처방 변형별 원가·단가 나란히 | MVP |
| 견적서 출력 | 인쇄용 A4 + 영문 커버레터 텍스트 복사. **등록 명의·서류 제공 범위·비용 부담 조건** 자동 포함 | MVP |

### 7-5. 🗂️ 등록·신고

**서류함**

| 기능 | 내용 | 단계 |
|---|---|---|
| 국가별 필수 서류 체크리스트 | 건의 국가 규칙(area: document)으로 자동 생성. 각 행: 서류 종류 · 보유 여부 · 유효성 판정 · 출처 | MVP |
| 서류 등록 | 종류·발급일·시험기관(ISO 17025/MOH 지정)·합법화 방식·파일명 입력 | MVP (파일명만) / 파일 업로드 2단계 |
| 유효성 자동 판정 | VN 성적서 12개월·인정 기관, VN CFS 아포스티유/합법화, JP 근거 자료 성분·함량 일치(체크), US 시설 등록 갱신 주기 | MVP |
| 바이어 패키지 | 필요한 서류 목록을 묶어 체크리스트 PDF(인쇄) | MVP / 공유 링크 2단계 |

**진행 트래커**

| 국가 | 단계(steps) | 자동 마감 |
|---|---|---|
| JP | 자료 제공 → 바이어 신고 → 판매 가능일 | 판매 희망일 − 60영업일(신규 성분 120) = 신고 마감, 신고 마감 − (자료 준비 여유, 기본 10영업일) = 우리 자료 제공 마감 |
| VN | 서류 준비 → 제출 → 보완 요청(반복) → 등록 → 광고 확인서 | 보완 요청 접수일 + 7영업일 = 회신 기한. 기간 안내: 법정 21영업일, 실무 2~6개월 |
| US | NDI 통지(해당 시) → 출시 → 문구 통지 | 출시일 − 75일 = NDI 통지 마감, 출시일 + 30일 = 문구 통지 마감, 시설 등록 갱신 |

- 판매 후 의무 패널: JP 건강피해 보고(15일) 시 바이어에게 제공할 제조 정보 체크리스트, VN 변경 시 재등록 안내, US 시설 등록 갱신.
- 바이어 공유 링크(읽기 전용)는 2단계(서버 필요).

### 7-6. ⚙️ 관리자 메뉴 (탭 아님)

| 기능 | 내용 | 단계 |
|---|---|---|
| 제품 마스터 | 제품·처방·한국 기능성 구분·개별인정형 여부 | MVP |
| 규칙 보기 | 국가별 규칙 표(읽기 전용, 출처·검증일·원문 확인 필요). 수정은 `data/rules-*.js` 파일에서 | MVP |
| 공휴일 | 일본·베트남 공휴일 날짜 입력 (영업일 계산용) | MVP |
| 환율 입력 | USD·JPY·VND | MVP |
| 데이터 관리 | JSON 내보내기·가져오기, 예시 데이터 지우기 | MVP |

---

## 8. 탭 간 연결

```
홈: 새 건(국가·바이어·제품)
   │
   ▼
규제 확인 ── case.regulatory ──┬──▶ 개발요청서: 국가 조건·허용 표현·시험 계획
                               ├──▶ 원가: 1일 섭취량(1일분 단가)·등록 비용 항목
                               └──▶ 등록·신고: 필수 서류 목록·단계·마감
개발요청서 ── 처방 변형 ──▶ 원가: 국가별 변형 원가 비교
원가 ── 견적 조건(비용 부담) ──▶ 등록·신고: 서류 준비 책임
등록·신고 ── 마감·만료·보완 요청 ──▶ 홈: 오늘 할 일
```

- 연결은 전부 **같은 건 객체의 필드**로 한다. 탭끼리 직접 함수를 부르지 않는다.
- 규제 확인을 다시 실행하면 개발요청서·등록·신고에 "규제 결과가 바뀌었습니다 — 확인" 배지를 띄운다 (자동 덮어쓰기 금지).

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
| 1 | `index.html` 레이아웃, `app.js` 탭 전환·해시 라우팅, `base.css` | 5개 탭과 관리자 메뉴가 전환됨 |
| 2 | `store.js`, `case-context.js`, `services/*`, 예시 데이터 | 새로고침해도 건이 유지됨, 건 선택 시 `case:changed` 발생 |
| 3 | `dates.js` + 테스트 | `tests/test.html`에서 9장 예시 전부 통과 |
| 4 | 🏠 홈: 건 목록·새 건·바이어 카드·현지 시각 | 새 건 → 규제 확인 탭으로 이동 |
| 5 | `rules-engine.js` + `rules-us.js`, `rules-vn.js` | 12장 시나리오 B·C 규칙 판정 결과가 맞음 |
| 6 | 📜 규제 확인 ①~⑤ + 성분표 업로드(xlsx·csv) | 결과가 `case.regulatory`에 저장됨 |
| 7 | 🧪 개발요청서 (국가 조건 자동 삽입·처방 변형·변경 경고·인쇄) | 규제 결과가 폼에 들어옴 |
| 8 | 💰 원가 (COSTD 계산 로직 + 등록 비용·1일분 단가·VE 경고) | 견적서 인쇄에 비용 부담 조건 포함 |
| 9 | 🗂️ 등록·신고 (서류함·유효성·트래커·마감) | 마감이 홈 할 일에 뜸 |
| 10 | `rules-jp.js` + 일본 화면 | 시나리오 A 통과 |
| 11 | ⑥ 세 나라 비교표, ⑦ 규제 변화 타임라인, 관리자 메뉴 | |
| 12 | (2단계) Flask 이전, PDF·OCR, AI 문구 변환, 공유 링크 | |

---

## 12. 테스트 시나리오

`data/sample-cases.js`에 아래 세 건을 넣고, 각 단계 결과를 확인한다. (제품·바이어는 가상)

### A. 일본 — 유통 체인 × 콜라겐 젤리 스틱 (FFC)

1. 새 건: JP, 바이어 유형 `retail_chain`, 판매 희망일 2027-06-01.
2. 규제 확인: 분류 FFC 선택 → 필수 표시 체크리스트 표시. 성분에 `jpPharmaOnly` 데이터가 없으면 `JP-ING-01` = **UNKNOWN**.
3. 문구 "임산부에게도 좋은 피부 보습" 입력 → `JP-CLM-01` **BLOCK**.
4. 등록·신고: 신고 마감 = 2027-06-01에서 60영업일 전 (공휴일 미입력 시 경고 표시), 자료 제공 마감은 그보다 10영업일 전.
5. 서류함: GMP 서류 없음 → `JP-MFG-01` **ACTION**.

### B. 베트남 — 약국 체인 납품사 × 유산균 캡슐

1. 새 건: VN, 바이어 `holderCapability.VN.localEntity = false` → 홈 바이어 카드 **명의자 역량 부족** 경고, `VN-APP-01` **BLOCK**.
2. 모든 탭 상단에 `VN-LAW-01` 배너(Decree 15/2018 적용 중).
3. 서류함: 시험성적서 발급일 2025-09-10, 제출 예정일 2026-12-01 → 12개월 초과 → `VN-DOC-TEST` **ACTION**, 홈 할 일에 "재시험".
4. CFS `legalization: 'none'` → `VN-DOC-CFS` **ACTION**.
5. 보완 요청 2026-12-10 접수 → 회신 기한 = 7영업일 뒤.
6. 등록 단계 이후 처방에서 원료 하나 변경 → **새 등록 필요** 경고.

### C. 미국 — 브랜드사 × 개별인정형 원료 포함 제품

1. 새 건: US, 제품 처방에 `koreaIndividual: true` 원료 → `US-NDI-02` **REVIEW**, `US-NDI-03` 안내.
2. NDI로 판단(사용자 체크) → `US-NDI-01` **ACTION**, 출시일 2027-03-01 → NDI 통지 마감 = 75일 전.
3. 문구 "Prevents joint disease" → `US-CLM-01` **BLOCK**. "Supports joint comfort" + 면책 문구 없음 → `US-CLM-02` **ACTION**, 면책 문구 삽입 제안.
4. 출시 후 문구 통지 마감 = 출시일 + 30일, 홈 할 일에 표시.
5. 개발요청서: "NDI 통지안 / 대체 원료안" 두 처방 요청 → 원가 탭에서 두 안 원가 비교.

**공통 확인**

- [ ] 어떤 결과도 초록색·"승인"·"수출 가능" 문구로 표시되지 않는다.
- [ ] 규칙이 없는 영역은 UNKNOWN으로 표시된다.
- [ ] 모든 판정 카드에 출처와 검증일이 있다.
- [ ] 새로고침 후에도 건·서류·마감이 유지된다.
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
| 일본·베트남 공휴일 | 2026~2028 반영 (베트남 2027은 정부 발표, 2026·2028 설 연휴 누락) | 누락분은 관리자 메뉴에서 입력 |
| 한국 CFS 발급 기관·절차, 아포스티유 방식 | 미확인 | 서류함 안내 문구만 |
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
