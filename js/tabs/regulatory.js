// 📜 규제 확인 (README 7-2): ① 분류 ② 원료 ③ 1일 섭취량 ④ 표시 문구 ⑤ 서류·기간 ⑥ 세 나라 비교 ⑦ 규제 변화 타임라인 + 성분표 업로드
(function () {
  const DASH = window.DASH;
  const { card, esc, badge, countryBadge, tag, table, findingCard, worst, options, toast, modal, COUNTRIES, FORMS, VERDICTS, num } = DASH.ui;
  const S = DASH.services;
  const D = DASH.dates;
  const E = () => DASH.engine;
  const STATUS_LABEL = { draft: '초안', grace: '유예 중', effective: '시행', suspended: '정지' };

  function render(el, ctx) {
    const c = ctx;
    const product = S.products.get(c.productId);
    const pack = S.rules.forCountry(c.country);
    const reg = c.regulatory || {};
    const findings = reg.findings || null;

    if (!product) {
      el.innerHTML = `<div class="tab-page">${card('제품 없음', '<p>이 건에 연결된 제품이 없습니다. 관리자 메뉴에서 제품을 확인하세요.</p>')}</div>`;
      return;
    }

    el.innerHTML = `<div class="tab-page">
      <div class="page-head">
        <div>
          <h1>📜 규제 확인 ${countryBadge(c.country)}</h1>
          <p class="muted">${esc(DASH.caseLabel(c))} · 규칙 버전 ${esc(pack.version)}${reg.checkedAt ? ` · 마지막 실행 ${esc(reg.checkedAt)}` : ' · 아직 실행하지 않음'}</p>
        </div>
        <div class="head-actions">
          ${reg.dirty && findings ? '<span class="badge v-review">입력이 바뀜 — 다시 실행하세요</span>' : ''}
          <button class="btn primary" data-act="run-check">규제 확인 실행</button>
        </div>
      </div>
      ${findings ? summaryBar(findings) : '<p class="note">입력값을 확인한 뒤 <strong>규제 확인 실행</strong>을 누르세요. 결과는 이 건에 저장되고 개발요청서·원가·등록·신고 탭에서 이어서 씁니다.</p>'}
      <div class="reg-grid">
        ${sectionCategory(c, pack, findings)}
        ${sectionIngredients(c, product, findings)}
        ${sectionDaily(product)}
        ${sectionClaims(c, pack, findings)}
        ${sectionDocs(c, product, pack, findings)}
        ${sectionOthers(findings)}
      </div>
      ${c.country === 'JP' ? jpListCard() : ''}
      ${c.country === 'US' ? fdaCard(product) : ''}
      ${uploadCard(product)}
      ${compareCard(c, product)}
      ${timelineCard()}
      <div class="bottom-actions">
        <button class="btn" data-act="prep-registration">등록·신고 단계 미리 만들기</button>
        <button class="btn primary" data-act="to-request">개발요청서로 보내기 →</button>
      </div>
    </div>`;

    bind(el.firstElementChild, c, product);
  }

  function summaryBar(findings) {
    const n = E().countBy(findings);
    return `<div class="reg-summary">${['BLOCK', 'ACTION', 'REVIEW', 'UNKNOWN', 'NOTED'].map(v =>
      `<div class="reg-sum-item">${badge(v)} <strong>${n[v] || 0}</strong></div>`).join('')}
      <span class="muted small">'규칙 확인됨'은 등록된 규칙에 걸린 것이 없다는 뜻이며 승인이 아닙니다.</span></div>`;
  }

  function findingsOf(findings, areas) {
    if (!findings) return '<p class="muted small">실행하면 이 영역 판정이 표시됩니다.</p>';
    const list = findings.filter(f => areas.includes(f.area));
    if (!list.length) return '';
    const order = ['BLOCK', 'ACTION', 'REVIEW', 'UNKNOWN', 'NOTED'];
    list.sort((a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict));
    return `<div class="findings">${list.map(findingCard).join('')}</div>`;
  }

  // ① 제품 분류
  function sectionCategory(c, pack, findings) {
    const reg = c.regulatory || {};
    let body = '';
    if (c.country === 'JP') {
      body = `<label class="inline">분류 경로 <select data-field="category">${options(pack.categories.map(x => ({ value: x.code, label: x.label + (x.supported ? '' : ' — 규칙 미등록') })), reg.category || pack.defaultCategory)}</select></label>
        <p class="muted small">의약품 분류 위험은 ② 원료 체크(JP-ING-01)에서 확인합니다.</p>`;
    } else if (c.country === 'VN') {
      body = '<p><strong>건강보호식품 (health supplement)</strong> — 자기공표가 아닌 <strong>등록</strong> 대상</p>';
    } else {
      body = '<p><strong>Dietary Supplement</strong> — FDA 시판 전 승인 없음, 통지 중심</p>';
    }
    return card('① 제품 분류', body + findingsOf(findings, ['category']));
  }

  // ② 원료 체크
  function sectionIngredients(c, product, findings) {
    const reg = c.regulatory || {};
    const isJP = c.country === 'JP';
    const R = S.reference;
    const headers = ['성분', '1회 함량', '한국 개별인정형', '식약처 원료 목록'].concat(isJP ? ['일본 의약품 전용 성분'] : []);
    const rows = (product.formula || []).map((i, idx) => {
      const r = [
        esc(S.products.ingredientName(i)),
        `${esc(i.amountPerServing)} ${esc(i.unit)}`,
        i.koreaIndividual ? tag('개별인정형', 'b-plain') : '<span class="muted">아님</span>',
        krMatchCell(i, R.krMatch(i))
      ];
      if (isJP) {
        const v = i.jpPharmaOnly === true ? 'yes' : i.jpPharmaOnly === false ? 'no' : '';
        const cand = R.jpCandidates(i);
        r.push(`<select data-flag="jpPharmaOnly" data-idx="${idx}">${options([{ value: '', label: '미입력' }, { value: 'yes', label: '해당' }, { value: 'no', label: '비해당' }], v)}</select>` +
          (cand.length ? `<div class="small">${tag('목록 후보', 'v-review')} ${cand.map(x => esc(`${x.name} (${x.parts || '전체'})`)).join(', ')}</div>` : ''));
      }
      return r;
    });
    let extra = '<p class="muted small">식약처 원료 목록 열은 성분명(한글)으로 고시형·개별인정형 목록을 대조한 후보입니다. 개별인정형 여부는 관리자 메뉴 &gt; 제품 마스터에서 확인 후 체크하세요.</p>';
    if (isJP) extra += `<label class="check"><input type="checkbox" data-field="newIngredient"${reg.newIngredient ? ' checked' : ''}> 신규 성분 등 확인에 시간이 걸리는 성분 포함 (신고 마감 120영업일 전 적용)</label>
      <p class="muted small">일본 의약품 전용 성분은 아래 '일본 의약품 전용 성분 목록'에서 검색해 확인한 뒤 성분별 '해당/비해당'을 사람이 고릅니다. 같은 식물이라도 부위에 따라 다르니 部位等·備考를 꼭 보세요. 선택은 제품 마스터에 저장되어 같은 제품의 다른 건에도 적용됩니다.</p>`;
    if (c.country === 'US') extra += `<label class="check"><input type="checkbox" data-field="ndiConfirmed"${reg.ndiConfirmed ? ' checked' : ''}> NDI 해당으로 판단 (규제 담당 확인 후 체크) → 판매 75일 전 통지 마감 계산</label>`;
    if (c.country === 'VN') extra += '<p class="muted small">미량영양소 함량 기준(Circular 17/2023) 수치는 미확인이라 비워 두었습니다 → VN-ING-01 규칙 미등록.</p>';
    return card('② 원료 체크', table(headers, rows, { empty: '처방 성분이 없습니다. 아래 성분표 업로드나 관리자 메뉴에서 입력하세요.' }) + extra + findingsOf(findings, ['ingredient']));
  }

  function krMatchCell(ing, list) {
    if (!list.length) return '<span class="muted small">목록에 없음</span>';
    const items = list.map(x => x.type === 'individual'
      ? `${tag('개별인정형', 'b-plain')} ${esc(x.name)} <span class="muted small" title="${esc(x.nos.map(n => '제' + n + '호').join(', '))}">${x.nos.length > 1 ? `인정 ${x.nos.length}건` : `제${esc(x.nos[0])}호`}</span>`
      : `${tag('고시형', 'b-plain')} ${esc(x.name)}${x.min || x.max ? ` <span class="muted small">1일 ${esc(x.min || '')}~${esc(x.max || '')}${esc(x.unit || '')}</span>` : ''}`);
    const warn = list.some(x => x.type === 'individual') && !ing.koreaIndividual
      ? `<div class="small">${tag('확인 필요', 'v-review')} 개별인정형 목록과 이름이 겹칩니다</div>` : '';
    return `<div class="small">${items.join('<br>')}</div>${warn}`;
  }

  // 일본 의약품 전용 성분 목록 (JP 건만)
  function jpListCard() {
    const R = S.reference;
    const src = R.jpSource();
    const n = R.jpItems().length;
    if (!n) return '';
    return card(`일본 의약품 전용 성분 목록 <span class="muted small">${n}개 · 厚生労働省 「専ら医薬品として使用される成分本質(原材料)リスト」</span>`, `
      <input type="search" class="block" data-search="jp" placeholder="일본어·학명으로 검색 (예: アシュワガンダ, Boswellia, メラトニン)">
      <div data-out="jp-list">${jpRows(R.jpSearch(''))}</div>
      <p class="muted small">部位等에 적힌 부위만 의약품 전용입니다. 備考의 「非医」는 다른 부위·유사 원료가 '의약품으로 보지 않는 목록'에 있다는 뜻입니다.
      ${src ? `원문 <a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.label)}</a>` : ''}</p>`, { cls: 'span-2' });
  }
  const JP_CAT = { plant: '식물', animal: '동물', chemical: '화학물질' };
  function jpRows(list) {
    return table(['구분', '名称', '他名等', '部位等', '備考'], list.slice(0, 60).map(x => [
      esc(JP_CAT[x.cat] || x.cat), `<strong>${esc(x.name)}</strong>`, esc(x.other), esc(x.parts), esc(x.note)
    ]), { scroll: true, empty: '일치하는 성분이 없습니다.' }) + (list.length > 60 ? `<p class="muted small">${list.length}개 중 60개만 표시 — 검색어를 좁히세요.</p>` : '');
  }

  // FDA 리콜 사례 (US 건만)
  function fdaCard(product) {
    const R = S.reference;
    const all = R.fdaItems();
    if (!all.length) return '';
    const src = R.fdaSource();
    const hits = (product.formula || []).filter(i => i.nameEn).map(i => ({ name: i.nameEn, n: R.fdaSearch(i.nameEn).length }));
    const chips = hits.map(h => `<button class="chip" data-act="fda-term" data-v="${esc(h.name)}">${esc(h.name)} ${h.n}건</button>`).join('');
    return card(`FDA 리콜 사례 <span class="muted small">dietary supplement ${all.length}건 · 최신순</span>`, `
      ${chips ? `<div class="chips">${chips}</div>` : ''}
      <input type="search" class="block" data-search="fda" placeholder="영문 성분명·회사명으로 검색 (3자 이상)">
      <div data-out="fda-list">${fdaRows(all.slice(0, 10), '최근 10건')}</div>
      <p class="muted small">openFDA 데이터는 검증되지 않은 자료입니다. 같은 성분의 리콜 사유(표시 누락·오염 등)를 라벨·시험 계획에 참고하세요.
      ${src ? `출처 <a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.label)}</a>` : ''}</p>`, { cls: 'span-2' });
  }
  function fdaRows(list, label) {
    return `<p class="muted small">${esc(label)}</p>` + table(['보고일', '등급', '회사', '제품', '리콜 사유'], list.slice(0, 30).map(r => [
      esc(r.date), esc(r.cls), esc(r.firm), esc(r.product), esc(r.reason)
    ]), { scroll: true, empty: '일치하는 리콜이 없습니다.' }) + (list.length > 30 ? `<p class="muted small">${list.length}건 중 30건만 표시</p>` : '');
  }

  // ③ 1일 섭취량
  function sectionDaily(product) {
    const rows = S.products.dailyIntake(product).map(d => [
      esc(d.name), `${esc(d.amountPerServing)} ${esc(d.unit)}`, `× ${esc(d.servingsPerDay)}회`, `<strong>${esc(num(d.daily, 3))} ${esc(d.unit)}</strong>`
    ]);
    return card('③ 1일 섭취량 계산', table(['성분', '1회 함량', '1일 횟수', '1일 섭취량'], rows) +
      `<p class="muted small">제형 ${esc(FORMS[product.form] || product.form)} · 1회 ${esc(product.unitsPerServing || 1)}개 · 1일 ${esc(product.servingsPerDay || 1)}회. 횟수는 관리자 메뉴 &gt; 제품 마스터에서 수정합니다.</p>`);
  }

  // ④ 표시 문구 점검
  function sectionClaims(c, pack, findings) {
    const reg = c.regulatory || {};
    const ci = reg.claimInputs || {};
    let body = '';
    if (c.country === 'JP') {
      const isFfc = (reg.category || pack.defaultCategory) === 'ffc';
      const checks = reg.jpLabelChecks || {};
      body = `<label class="block">표시 문구 (한국어·일본어)<textarea data-claim="main" rows="3" placeholder="예: 피부 보습에 도움을 줄 수 있음">${esc(ci.main)}</textarea></label>
        ${isFfc ? `<div class="reg-checklist"><div class="muted small">JP-LBL-01 필수 표시 체크리스트 (담당자가 하나씩 확인)</div>
          ${pack.labelChecklist.map((t, i) => `<label class="check"><input type="checkbox" data-check="${i}"${checks[i] ? ' checked' : ''}> ${esc(t)}</label>`).join('')}</div>` : ''}`;
    } else if (c.country === 'VN') {
      body = `<div class="reg-3col">
        <label class="block">등록 문구<textarea data-claim="vnRegistered" rows="4">${esc(ci.vnRegistered)}</textarea></label>
        <label class="block">라벨 문구<textarea data-claim="vnLabel" rows="4">${esc(ci.vnLabel)}</textarea></label>
        <label class="block">광고 문구<textarea data-claim="vnAd" rows="4">${esc(ci.vnAd)}</textarea></label>
      </div><p class="muted small">세 칸이 1:1로 같아야 하고, 라벨에 '의약품이 아님' 문구가 있어야 합니다.</p>`;
    } else {
      body = `<label class="block">Structure/Function claim (영문)<textarea data-claim="main" rows="3" placeholder="예: Supports joint comfort">${esc(ci.main)}</textarea></label>
        <button class="btn sm" data-act="insert-disclaimer">면책 문구 삽입</button>`;
    }
    return card('④ 표시 문구 점검 <span class="muted small">규칙 기반 · AI 변환은 2단계</span>', body + findingsOf(findings, ['claim']));
  }

  // ⑤ 필요 서류·예상 기간
  function sectionDocs(c, product, pack, findings) {
    const docs = S.documents.forProduct(product.id);
    const req = E().requiredDocs(c);
    const rows = req.map(r => {
      const has = docs.some(d => d.type === r.type);
      return [esc(r.label), has ? '보유' : '<strong>없음</strong>', `<span class="rule-id">${esc(r.ruleId)}</span>`];
    });
    return card('⑤ 필요 서류·예상 기간', `${table(['서류', '서류함', '규칙'], rows)}
      <dl class="kv"><dt>법정·규칙 기간</dt><dd>${esc(pack.lead.legal)}</dd><dt>실무 기간</dt><dd>${esc(pack.lead.practical)}</dd></dl>
      <p class="muted small">유효성 판정은 등록·신고 탭의 서류함에서 서류별로 확인합니다.</p>` + findingsOf(findings, ['document', 'schedule']));
  }

  function sectionOthers(findings) {
    return card('신청자·제조·판매 후 의무', findingsOf(findings, ['applicant', 'manufacturing', 'post_market']), { cls: 'span-2' });
  }

  // ⑥ 세 나라 비교표
  function compareCard(c, product) {
    const docs = S.documents.forProduct(product.id);
    const buyer = S.buyers.get(c.buyerId);
    const per = S.rules.COUNTRY_CODES.map(cc => {
      const same = cc === c.country;
      const tmp = {
        id: c.id, country: cc, targetLaunchDate: c.targetLaunchDate,
        regulatory: same ? (c.regulatory || {}) : { claimInputs: { main: ((c.regulatory || {}).claimInputs || {}).main || '' } },
        registration: same ? (c.registration || {}) : {}
      };
      return { cc, same, pack: S.rules.forCountry(cc), f: E().evaluate(tmp, product, docs, cc, { buyer: same ? buyer : null }), tmp };
    });
    const cell = (list) => {
      if (!list.length) return '<span class="muted">-</span>';
      const w = worst(list.map(f => f.verdict));
      const items = list.filter(f => f.verdict !== 'NOTED').map(f => `<li><span class="rule-id">${esc(f.ruleId || '—')}</span> ${esc(VERDICTS[f.verdict].label)}</li>`).join('');
      return `${badge(w)}${items ? `<ul class="mini">${items}</ul>` : ''}`;
    };
    const row = (label, fn) => [`<strong>${esc(label)}</strong>`].concat(per.map(fn));
    const rows = [
      row('진입 방식', p => esc(p.pack.entry)),
      row('분류', p => cell(p.f.filter(f => f.area === 'category'))),
      row('원료 경고', p => cell(p.f.filter(f => f.area === 'ingredient'))),
      row('문구 제약', p => cell(p.f.filter(f => f.area === 'claim'))),
      row('필요 서류', p => `<ul class="mini">${E().requiredDocs(p.tmp, p.cc).map(r => `<li>${esc(r.label)}</li>`).join('')}</ul>`),
      row('기간', p => `${esc(p.pack.lead.legal)}<br><span class="muted small">${esc(p.pack.lead.practical)}</span>`)
    ];
    const headers = ['항목'].concat(per.map(p => `${COUNTRIES[p.cc].name} ${p.cc}${p.same ? ' (현재 건)' : ''}`));
    return card('⑥ 세 나라 비교표 <span class="muted small">같은 제품을 JP·VN·US 규칙에 동시에 적용</span>',
      table(headers, rows, { cls: 'reg-compare' }) +
      '<p class="muted small">현재 건이 아닌 나라는 바이어 정보 없이, 표시 문구는 기본 칸(main)만 넣어 계산했습니다.</p>');
  }

  // ⑦ 규제 변화 타임라인
  function timelineCard() {
    const items = S.rules.timeline().map(t => `<li class="reg-tl-item st-${esc(t.status)}">
      <span class="reg-tl-date">${esc(t.date)}</span>
      <span>${countryBadge(t.country)} ${tag(STATUS_LABEL[t.status] || t.status, 'st-' + t.status)}</span>
      <span>${esc(t.title)} <span class="rule-id">${esc(t.ruleId || '')}</span></span>
    </li>`).join('');
    return card('⑦ 규제 변화 타임라인 <span class="muted small">상태: 초안 / 유예 중 / 시행 / 정지</span>', `<ol class="reg-timeline">${items}</ol>`);
  }

  // 성분표 업로드
  function uploadCard(product) {
    const xlsxOk = !!window.XLSX;
    return card('성분표 업로드 <span class="muted small">.xlsx · .csv → 열 지정 → 확인·수정 → 처방 반영</span>', `
      <input type="file" class="reg-file" accept=".csv,.xlsx,.xls" data-act="upload">
      <p class="muted small">${xlsxOk ? '' : 'SheetJS(vendor/xlsx.full.min.js)를 불러오지 못해 CSV만 읽을 수 있습니다. '}반영하면 제품 '${esc(product.name)}'의 처방이 바뀝니다. PDF·스캔 이미지(OCR)는 2단계.</p>`);
  }

  // ---------- 동작 ----------
  function bind(page, c, product) {
    page.addEventListener('click', e => {
      const t = e.target.closest('[data-act]');
      if (!t) return;
      const act = t.dataset.act;
      if (act === 'fda-term') {
        const box = page.querySelector('[data-search="fda"]');
        if (box) { box.value = t.dataset.v; box.dispatchEvent(new Event('input', { bubbles: true })); }
      } else if (act === 'run-check') runCheck(c.id);
      else if (act === 'insert-disclaimer') insertDisclaimer(c.id);
      else if (act === 'to-request') {
        const cur = S.cases.get(c.id);
        if (!cur.regulatory || !cur.regulatory.findings) toast('규제 확인을 아직 실행하지 않았습니다. 개발요청서의 국가 조건이 비어 있을 수 있습니다.', 'warn');
        if (cur.stage === 'regulatory') cur.stage = 'request';
        DASH.caseContext.save(cur, { silent: true });
        DASH.go('request');
      } else if (act === 'prep-registration') {
        const cur = S.cases.get(c.id);
        const made = S.cases.ensureSteps(cur);
        DASH.caseContext.save(cur);
        toast(made ? '등록·신고 진행 단계를 만들었습니다.' : '이미 진행 단계가 있습니다.');
      }
    });

    // 참고 목록 검색 (저장하지 않음)
    page.addEventListener('input', e => {
      const t = e.target;
      if (t.dataset.search === 'jp') {
        page.querySelector('[data-out="jp-list"]').innerHTML = jpRows(S.reference.jpSearch(t.value));
      } else if (t.dataset.search === 'fda') {
        const q = t.value.trim();
        page.querySelector('[data-out="fda-list"]').innerHTML = q.length >= 3
          ? fdaRows(S.reference.fdaSearch(q), `'${q}' 검색 결과 ${S.reference.fdaSearch(q).length}건`)
          : fdaRows(S.reference.fdaItems().slice(0, 10), '최근 10건');
      }
    });

    page.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.search) return;
      if (t.dataset.act === 'upload') { handleUpload(t, c.id, product.id); return; }
      const cur = S.cases.get(c.id);
      cur.regulatory = cur.regulatory || {};
      if (t.dataset.field) {
        cur.regulatory[t.dataset.field] = t.type === 'checkbox' ? t.checked : t.value;
        cur.regulatory.dirty = true;
        DASH.caseContext.save(cur);
      } else if (t.dataset.claim) {
        cur.regulatory.claimInputs = cur.regulatory.claimInputs || {};
        cur.regulatory.claimInputs[t.dataset.claim] = t.value;
        cur.regulatory.dirty = true;
        DASH.caseContext.save(cur, { silent: true });
      } else if (t.dataset.check !== undefined) {
        cur.regulatory.jpLabelChecks = cur.regulatory.jpLabelChecks || {};
        cur.regulatory.jpLabelChecks[t.dataset.check] = t.checked;
        cur.regulatory.dirty = true;
        DASH.caseContext.save(cur, { silent: true });
      } else if (t.dataset.flag) {
        const p = S.products.get(product.id);
        const ing = p.formula[Number(t.dataset.idx)];
        if (!ing) return;
        if (t.value === '') delete ing[t.dataset.flag]; else ing[t.dataset.flag] = t.value === 'yes';
        S.products.save(p);
        cur.regulatory.dirty = true;
        DASH.caseContext.save(cur);
      }
    });
  }

  function runCheck(caseId) {
    const c = S.cases.get(caseId);
    const product = S.products.get(c.productId);
    const pack = S.rules.forCountry(c.country);
    const docs = S.documents.forProduct(c.productId);
    const findings = E().evaluate(c, product, docs, c.country);
    const sig = E().signature(findings);
    const prev = c.regulatory || {};
    c.regulatory = Object.assign({}, prev, {
      checkedAt: D.today(),
      category: prev.category || pack.defaultCategory || null,
      findings,
      ingredientFindings: findings.filter(f => f.area === 'ingredient'),
      claimFindings: findings.filter(f => f.area === 'claim'),
      dailyIntake: S.products.dailyIntake(product),
      requiredDocs: E().requiredDocs(c).map(d => d.type),
      estimatedLead: pack.lead,
      ruleVersion: { [c.country]: pack.version },
      signature: sig,
      dirty: false
    });
    // README 8장: 다시 실행해서 결과가 바뀌면 다른 탭에 확인 배지 (자동 덮어쓰기 금지)
    if (prev.signature && prev.signature !== sig) {
      c.flags = Object.assign({}, c.flags, { regChanged: { request: true, registration: true, at: D.today() } });
      toast('규제 결과가 바뀌었습니다 — 개발요청서·등록·신고 탭에 확인 배지를 띄웠습니다.', 'warn');
    } else toast('규제 확인을 실행했습니다.');
    DASH.caseContext.save(c);
  }

  function insertDisclaimer(caseId) {
    const c = S.cases.get(caseId);
    const text = S.rules.forCountry('US').disclaimer;
    c.regulatory = c.regulatory || {};
    c.regulatory.claimInputs = c.regulatory.claimInputs || {};
    const main = c.regulatory.claimInputs.main || '';
    if (main.toLowerCase().includes('not been evaluated by the food and drug administration')) { toast('이미 면책 문구가 있습니다.'); return; }
    c.regulatory.claimInputs.main = (main ? main.replace(/\*?\s*$/, '') + '*\n\n*' : '') + text;
    c.regulatory.dirty = true;
    DASH.caseContext.save(c);
    toast('면책 문구를 넣었습니다. 라벨에서는 굵게 표시하세요.');
  }

  // ---------- 성분표 업로드 ----------
  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    const rows = [];
    let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (ch !== '\r') cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(x => String(x).trim() !== ''));
  }

  function handleUpload(input, caseId, productId) {
    const file = input.files && input.files[0];
    if (!file) return;
    const isCsv = /\.csv$/i.test(file.name);
    const reader = new FileReader();
    reader.onerror = () => toast('파일을 읽지 못했습니다.', 'warn');
    reader.onload = () => {
      try {
        let sheets;
        if (isCsv) sheets = { [file.name]: parseCSV(String(reader.result)) };
        else {
          if (!window.XLSX) { toast('엑셀 읽기 라이브러리가 없습니다. CSV로 저장해 올리세요.', 'warn'); return; }
          const wb = window.XLSX.read(new Uint8Array(reader.result), { type: 'array' });
          sheets = {};
          wb.SheetNames.forEach(n => { sheets[n] = window.XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' }); });
        }
        openMapping(sheets, caseId, productId);
      } catch (e) {
        console.error(e);
        toast('파일을 해석하지 못했습니다: ' + e.message, 'warn');
      } finally {
        input.value = '';
      }
    };
    if (isCsv) reader.readAsText(file, 'utf-8'); else reader.readAsArrayBuffer(file);
  }

  function guessCol(header, re) {
    const i = header.findIndex(h => re.test(String(h)));
    return i >= 0 ? i : null;
  }

  function openMapping(sheets, caseId, productId) {
    const names = Object.keys(sheets);
    if (!names.length) { toast('시트가 없습니다.', 'warn'); return; }
    const body = `<div class="form-grid">
        <label>시트 <select name="sheet">${options(names, names[0])}</select></label>
        <label class="check"><input type="checkbox" name="hasHeader" checked> 첫 행은 머리글</label>
        <label>성분명 열 <select name="colName"></select></label>
        <label>함량 열 <select name="colAmount"></select></label>
        <label>단위 열 <select name="colUnit"></select></label>
        <div class="radio-row">반영 방식
          <label class="check"><input type="radio" name="mode" value="replace" checked> 처방 바꾸기</label>
          <label class="check"><input type="radio" name="mode" value="append"> 뒤에 추가</label>
        </div>
      </div>
      <div class="map-preview"></div>`;
    const m = modal('성분표 열 지정 · 확인', body, {
      wide: true, okLabel: '처방에 반영',
      onOk: el => applyMapping(el, caseId, productId)
    });
    const el = m.el;
    const fillCols = (guess) => {
      const rows = sheets[el.querySelector('[name="sheet"]').value] || [];
      const width = rows.reduce((w, r) => Math.max(w, r.length), 0);
      const header = el.querySelector('[name="hasHeader"]').checked ? (rows[0] || []) : [];
      const opts = [{ value: '', label: '(없음)' }].concat(Array.from({ length: width }, (_, i) => ({ value: i, label: `${String.fromCharCode(65 + (i % 26))}열${header[i] ? ' · ' + header[i] : ''}` })));
      const g = guess ? {
        colName: guessCol(header, /성분|원료|ingredient|name/i),
        colAmount: guessCol(header, /함량|amount|qty|content/i),
        colUnit: guessCol(header, /단위|unit/i)
      } : {};
      ['colName', 'colAmount', 'colUnit'].forEach((k, idx) => {
        const sel = el.querySelector(`[name="${k}"]`);
        const prev = sel.value;
        const v = guess ? (g[k] !== null && g[k] !== undefined ? g[k] : (idx < width ? idx : '')) : prev;
        sel.innerHTML = options(opts, v);
      });
      preview();
    };
    const preview = () => {
      const rows = sheets[el.querySelector('[name="sheet"]').value] || [];
      const body = el.querySelector('[name="hasHeader"]').checked ? rows.slice(1) : rows;
      const col = k => el.querySelector(`[name="${k}"]`).value;
      const pick = (r, k) => (col(k) === '' ? '' : String(r[Number(col(k))] === undefined ? '' : r[Number(col(k))]).trim());
      const items = body.map(r => ({ name: pick(r, 'colName'), amount: pick(r, 'colAmount'), unit: pick(r, 'colUnit') })).filter(x => x.name);
      el.querySelector('.map-preview').innerHTML = items.length ? `<p class="muted small">${items.length}개 성분 — 반영 전에 고칠 수 있습니다.</p>
        <div class="table-wrap scroll"><table class="tbl"><thead><tr><th>성분명</th><th>1회 함량</th><th>단위</th><th>제외</th></tr></thead><tbody>
        ${items.map(x => `<tr class="map-row"><td><input data-k="name" value="${esc(x.name)}"></td><td><input data-k="amount" value="${esc(x.amount)}"></td><td><input data-k="unit" value="${esc(x.unit)}"></td><td><input type="checkbox" data-k="skip"></td></tr>`).join('')}
        </tbody></table></div>` : '<p class="muted">성분명 열을 지정하세요.</p>';
    };
    el.querySelector('[name="sheet"]').addEventListener('change', () => fillCols(true));
    el.querySelector('[name="hasHeader"]').addEventListener('change', () => fillCols(true));
    ['colName', 'colAmount', 'colUnit'].forEach(k => el.querySelector(`[name="${k}"]`).addEventListener('change', preview));
    fillCols(true);
  }

  function applyMapping(el, caseId, productId) {
    const rows = Array.from(el.querySelectorAll('.map-row')).map(tr => {
      const get = k => tr.querySelector(`[data-k="${k}"]`);
      return { name: get('name').value.trim(), amount: get('amount').value.trim(), unit: get('unit').value.trim(), skip: get('skip').checked };
    }).filter(r => r.name && !r.skip);
    if (!rows.length) { toast('반영할 성분이 없습니다.', 'warn'); return false; }
    const mode = (el.querySelector('[name="mode"]:checked') || {}).value || 'replace';
    const p = S.products.get(productId);
    const old = p.formula || [];
    const built = [];
    rows.forEach(r => {
      const prev = old.find(o => o.nameKo === r.name || o.nameEn === r.name);
      const amount = Number(String(r.amount).replace(/,/g, ''));
      built.push(Object.assign({}, prev || { koreaIndividual: false }, {
        ingredientId: prev ? prev.ingredientId : S.products.newIngredientId(old.concat(built)),
        nameKo: prev ? prev.nameKo : r.name,
        nameEn: prev ? prev.nameEn : '',
        amountPerServing: isNaN(amount) ? 0 : amount,
        unit: r.unit
      }));
    });
    p.formula = mode === 'append' ? old.concat(built) : built;
    S.products.save(p);
    const affected = S.cases.flagFormulaChange(p.id, '성분표 업로드로 처방 변경');
    const c = S.cases.get(caseId);
    c.regulatory = c.regulatory || {};
    c.regulatory.dirty = true;
    DASH.caseContext.save(c);
    if (affected.length) {
      modal('처방 변경 경고', `<p>등록·신고 단계가 시작된 건의 처방이 바뀌었습니다.</p><ul>${affected.map(a => `<li><strong>${esc(a.caseId)}</strong> — ${esc(a.message)}</li>`).join('')}</ul>`);
    } else toast(`${built.length}개 성분을 처방에 반영했습니다. 규제 확인을 다시 실행하세요.`);
  }

  DASH.registerTab({
    id: 'regulatory', icon: '📜', label: '규제 확인', order: 20, cssClass: 'tab-reg', needsCase: true,
    render,
    summary: ctx => {
      const f = (ctx.regulatory && ctx.regulatory.findings) || [];
      return { label: '사용 불가·조치 필요', value: f.filter(x => x.verdict === 'BLOCK' || x.verdict === 'ACTION').length };
    }
  });
})();
