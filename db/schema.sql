-- 건기식 해외영업 대시보드 — SQLite 스키마 (README 2-2: 2단계 Flask + SQLite)
-- 테이블 이름 = db/csv/<테이블>.csv
-- app_*  : 앱 데이터 (규칙 원본은 data/rules-*.js — 사람이 관리, README 6-1)
-- api_*  : 외부 공공데이터
-- boolean = INTEGER 0/1, 빈칸 = NULL(미입력), *_json = JSON 문자열

PRAGMA foreign_keys = ON;

-- ===================== 앱 데이터 =====================
CREATE TABLE app_country_profile (
  country TEXT PRIMARY KEY CHECK (country IN ('JP','VN','US')),
  rule_version TEXT, entry TEXT, lead_legal TEXT, lead_practical TEXT,
  post_market_json TEXT, unregistered_json TEXT, banner_text TEXT
);

CREATE TABLE app_rules (
  id TEXT PRIMARY KEY,
  country TEXT NOT NULL REFERENCES app_country_profile(country),
  area TEXT NOT NULL CHECK (area IN ('category','ingredient','claim','document','schedule','manufacturing','post_market','applicant')),
  title TEXT, check_fn TEXT, params_json TEXT,
  verdict_if_fail TEXT CHECK (verdict_if_fail IN ('BLOCK','ACTION','REVIEW','NOTED','UNKNOWN')),
  message TEXT, source_label TEXT, source_url TEXT, verified_at TEXT,
  needs_verification INTEGER NOT NULL DEFAULT 1, rule_version TEXT
);

CREATE TABLE app_required_docs (
  country TEXT NOT NULL REFERENCES app_country_profile(country),
  doc_type TEXT NOT NULL, label TEXT, rule_id TEXT REFERENCES app_rules(id),
  PRIMARY KEY (country, doc_type)
);

CREATE TABLE app_registration_steps (
  country TEXT NOT NULL REFERENCES app_country_profile(country),
  seq INTEGER NOT NULL, step_key TEXT NOT NULL, label TEXT,
  PRIMARY KEY (country, step_key)
);

CREATE TABLE app_rule_timeline (
  country TEXT NOT NULL, date TEXT NOT NULL, title TEXT,
  status TEXT,                    -- draft | grace | effective | suspended
  rule_id TEXT REFERENCES app_rules(id)
);

CREATE TABLE app_claim_terms (
  country TEXT NOT NULL, term_group TEXT NOT NULL, term TEXT NOT NULL,
  PRIMARY KEY (country, term_group, term)
);

CREATE TABLE app_packaging_presets (
  id TEXT PRIMARY KEY, label TEXT, count_per_unit INTEGER, units_per_carton INTEGER,
  carton_cbm REAL, pack_krw REAL
);

CREATE TABLE app_markets (
  country TEXT NOT NULL, year INTEGER NOT NULL, export_usd REAL, share_pct REAL,
  basis TEXT NOT NULL,            -- 수출액은 반드시 통계 기준과 함께 표시 (README 1-2)
  channels TEXT, entry TEXT, source_label TEXT, source_url TEXT,
  PRIMARY KEY (country, year)
);

CREATE TABLE app_products (
  id TEXT PRIMARY KEY, sample INTEGER DEFAULT 0, name TEXT NOT NULL,
  form TEXT CHECK (form IN ('capsule','tablet','powder','softgel','jelly_stick','liquid')),
  korea_status TEXT CHECK (korea_status IN ('notified','individual','none')),
  korea_claim TEXT, servings_per_day INTEGER, units_per_serving INTEGER
);

CREATE TABLE app_product_ingredients (
  product_id TEXT NOT NULL REFERENCES app_products(id),
  seq INTEGER NOT NULL, ingredient_id TEXT, name_ko TEXT, name_en TEXT,
  amount_per_serving REAL, unit TEXT,
  korea_individual INTEGER DEFAULT 0,   -- 1 → US-NDI-02 자동 경고
  jp_pharma_only INTEGER,               -- NULL = 미입력 → JP-ING-01 UNKNOWN
  PRIMARY KEY (product_id, seq)
);

CREATE TABLE app_buyers (
  id TEXT PRIMARY KEY, sample INTEGER DEFAULT 0, country TEXT NOT NULL, name TEXT, type TEXT,
  lead_source TEXT, contact_name TEXT, contact_email TEXT, timezone TEXT,
  holder_capability_json TEXT, last_contact_at TEXT, awaiting_reply INTEGER DEFAULT 0
);

CREATE TABLE app_cases (
  id TEXT PRIMARY KEY, sample INTEGER DEFAULT 0,
  country TEXT NOT NULL CHECK (country IN ('JP','VN','US')),
  buyer_id TEXT REFERENCES app_buyers(id), product_id TEXT REFERENCES app_products(id),
  stage TEXT CHECK (stage IN ('regulatory','request','cost','registration','selling','closed')),
  created_at TEXT, target_launch_date TEXT,
  regulatory_json TEXT, request_json TEXT, cost_json TEXT, registration_json TEXT
);

CREATE TABLE app_documents (
  id TEXT PRIMARY KEY, sample INTEGER DEFAULT 0, product_id TEXT REFERENCES app_products(id),
  type TEXT NOT NULL, issued_at TEXT, expires_at TEXT,
  lab_name TEXT, lab_iso17025 INTEGER, lab_moh_designated INTEGER,
  legalization TEXT CHECK (legalization IN ('none','apostille','embassy')),
  file_name TEXT, note TEXT
);

-- ===================== 외부 API 수집 =====================
CREATE TABLE api_holidays (            -- Nager.Date (영업일 계산, README 9장)
  country TEXT NOT NULL, date TEXT NOT NULL, local_name TEXT, name TEXT,
  is_global INTEGER, counties TEXT, types TEXT, source TEXT, fetched_at TEXT
);
CREATE INDEX idx_holidays ON api_holidays(country, date);

CREATE TABLE api_fx_rates (            -- 외화 1단위당 원화
  date TEXT NOT NULL, currency TEXT NOT NULL CHECK (currency IN ('USD','JPY','VND')),
  krw_per_unit REAL NOT NULL, rate_type TEXT, source TEXT,
  PRIMARY KEY (date, currency, source)
);

CREATE TABLE api_kr_notified_ingredients (   -- 식약처 고시형 기능성 원료 (I2710)
  ingredient_name TEXT, functional_component TEXT, primary_function TEXT,
  daily_intake_min REAL, daily_intake_max REAL, intake_unit TEXT, intake_memo TEXT,
  caution TEXT, created_at TEXT, updated_at TEXT, korea_status TEXT
);
CREATE INDEX idx_notified_name ON api_kr_notified_ingredients(ingredient_name);

CREATE TABLE api_kr_individual_ingredients ( -- 식약처 개별인정형 원료 (I-0040) → US NDI 검토 대상
  recognition_no TEXT, ingredient_name TEXT, function_text TEXT, daily_intake TEXT,
  caution TEXT, applicant TEXT, business_type TEXT, recognized_at TEXT,
  korea_status TEXT, us_ndi_review INTEGER
);
CREATE INDEX idx_individual_name ON api_kr_individual_ingredients(ingredient_name);

CREATE TABLE api_kr_item_groups (            -- 식약처 품목 분류 (I0760)
  group_code TEXT, group_name TEXT, large_code TEXT, large_name TEXT,
  mid_code TEXT, mid_name TEXT, small_code TEXT, small_name TEXT
);

CREATE TABLE api_kr_hff_products (           -- 식약처 건기식 품목제조 신고 (I0030)
  report_no TEXT PRIMARY KEY, product_name TEXT, manufacturer TEXT, license_no TEXT, form TEXT,
  primary_function TEXT, functional_ingredients TEXT, other_ingredients TEXT, capsule_ingredients TEXT,
  raw_material_group TEXT, intake_method TEXT, caution TEXT, shelf_life TEXT, storage TEXT,
  packaging_material TEXT, child_certified TEXT, reported_at TEXT, updated_at TEXT
);

CREATE TABLE api_fda_supplement_recalls (    -- openFDA food/enforcement
  recall_number TEXT, status TEXT, classification TEXT, recalling_firm TEXT, country TEXT, state TEXT,
  product_description TEXT, reason_for_recall TEXT, distribution_pattern TEXT, voluntary_mandated TEXT,
  recall_initiation_date TEXT, report_date TEXT, termination_date TEXT
);

CREATE TABLE api_export_stats (              -- 관세청 품목별 국가별 수출입실적
  period TEXT, country TEXT, country_name TEXT, hs_code TEXT, item_name TEXT,
  export_usd REAL, export_kg REAL, import_usd REAL, import_kg REAL, balance_usd REAL,
  basis TEXT, fetched_at TEXT
);

CREATE TABLE api_comtrade_imports (          -- UN Comtrade (public preview): 국가별 건기식(HS 210690) 연간 수입액
  reporter TEXT, year TEXT, partner TEXT,    -- reporter: JP/VN/US, partner: WORLD/KR
  hs_code TEXT, flow TEXT, value_usd REAL, net_kg REAL, hs_version TEXT, fetched_at TEXT
);

CREATE TABLE api_fetch_log (
  dataset TEXT, rows INTEGER, source TEXT, note TEXT, fetched_at TEXT
);

-- ===================== 원문 자료 (db/source/*.pdf) =====================
CREATE TABLE ref_jp_pharma_only (            -- 일본 「専ら医薬品として使用される成分本質(原材料)リスト」 (source/jp_pharma_only_ingredients.pdf)
  seq INTEGER PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('plant','animal','chemical')),  -- 植物由来物等 / 動物由来物等 / その他(化学物質等)
  name TEXT NOT NULL, other_names TEXT,      -- 他名等: '/' 구분
  parts TEXT,                                -- 部位等: 이 부위만 의약품 전용
  note TEXT,                                 -- 備考: 「非医」 = 다른 부위·유사 원료는 비의약품 목록
  source TEXT
);
