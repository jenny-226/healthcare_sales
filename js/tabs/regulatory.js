// 📜 규제 확인 (README 7-2) — COSTD '국가별 인허가 규제' 배치를 따른다.
//   ① 조회 방법 선택: [성분 직접 검색 | 파일로 일괄 조회]
//   ② 성분표 확인·수정 (추출값·처방을 표에서 고친 뒤 '확정 성분 규제 조회')
//   ③ 표시 문구 · 분류 (조회 조건)
//   ④ 조회 결과: 요약 → 조회 조건 → 성분별 결과 → 영역별 판정 → 필요 서류·주요 마감
//   ⑤ 참고: 세 나라 비교표 · 규제 변화 타임라인 (접힘)
(function () {
  const DASH = window.DASH;
  const { card, esc, badge, countryBadge, tag, table, findingCard, worst, options, toast, modal, seg, pageHead, COUNTRIES, FORMS, VERDICTS, num } = DASH.ui;
  const S = DASH.services;
  const D = DASH.dates;
  const E = () => DASH.engine;
  const STATUS_LABEL = { draft: '초안', grace: '유예 중', effective: '시행', suspended: '정지' };
  const SOURCES = [
    { value: 'rules', label: '국가 규칙 DB (data/rules)' },
    { value: 'kr', label: '식약처 원료 목록' },
    { value: 'jp', label: '일본 의약품 전용 성분' },
    { value: 'fda', label: 'FDA 리콜 사례' }
  ];

  // 화면에만 있는 작업 상태 (저장 전 추출값·업로드 파일)
  const work = { draft: null, draftProductId: null, draftFrom: '', sheets: null, fileName: '', search: null };

  function render(el, ctx) {
    const c = ctx;
    const product = S.products.get(c.productId);
    const pack = S.rules.forCountry(c.country);
    const reg = c.regulatory || {};
    const findings = reg.findings || null;
    if (work.draftProductId !== c.productId) { work.draft = null; work.draftProductId = c.productId; work.sheets = null; }

    if (!product) {
      el.innerHTML = `<div class="tab-page">${card('제품 없음', '<p>이 건에 연결된 제품이 없습니다. 상단 <strong>+ 새 건</strong>에서 제품을 함께 등록하세요.</p>')}</div>`;
      return;
    }
    const mode = DASH.store.get('ui:regMode', 'search');

    el.innerHTML = `<div class="tab-page">
      ${pageHead(`📜 규제 확인 ${countryBadge(c.country)}`,
        `성분을 직접 검색하거나 성분표를 올려 대상 국가의 규제 조건을 조회해요. 제품 전체의 적법성이나 수출 가능 여부를 확정하지는 않아요.<br><span class="muted small">${esc(DASH.caseLabel(c))} · 규칙 버전 ${esc(pack.version)}</span>`,
        `<button class="btn primary" data-act="to-request">개발요청서로 보내기 →</button>`)}
      <div class="info-note">성분명을 직접 검색하거나 Excel·CSV 성분표에서 성분을 추출해 국가별 규제 정보를 조회할 수 있어요. '규칙 확인됨'은 등록된 규칙에 걸린 것이 없다는 뜻이며 승인이 아닙니다.</div>

      ${card('조회 방법 선택', `
        <p class="muted small">개별 성분은 직접 검색, 개발요청서·성분표는 파일 업로드로 조회해요.</p>
        ${seg([{ value: 'search', label: '성분 직접 검색' }, { value: 'file', label: '파일로 일괄 조회' }], mode, 'mode')}
        <div class="reg-mode">${mode === 'file' ? fileMode(product) : searchMode(c, product)}</div>`)}

      ${formulaCard(c, product)}
      ${conditionCard(c, pack)}
      ${resultsSection(c, product, pack, findings)}
      ${referenceSection(c, product)}
    </div>`;
    bind(el.firstElementChild, c, product);
  }

  // ---------- ① 성분 직접 검색 ----------
  function searchMode(c, product) {
    const s = work.search || { q: '', market: c.country, source: 'rules' };
    return `<div class="reg-search-grid">
        <label class="block reg-q"><span>성분명 <span class="req">*</span></span>
          <input data-s="q" value="${esc(s.q)}" placeholder="한글명 또는 영문명 (예: 비타민 C, Ashwagandha)" autocomplete="off">
          <ul class="reg-suggest" data-out="suggest" hidden></ul>
          <span class="muted small">2글자 이상 입력하면 처방·식약처 원료·일본 목록에서 후보를 보여줘요.</span>
        </label>
        <label class="block"><span>국가/시장 <span class="req">*</span></span>
          <select data-s="market">${options(['JP', 'VN', 'US'].map(x => ({ value: x, label: `${COUNTRIES[x].name} ${x}` })), s.market)}</select>
          <span class="muted small">시장마다 제공되는 규제 데이터 범위가 달라요.</span>
        </label>
      </div>
      <fieldset class="reg-sources"><legend>규제 정보 출처</legend>
        ${SOURCES.map(o => `<label class="reg-source${o.value === s.source ? ' on' : ''}"><input type="radio" name="reg-source" data-s="source" value="${o.value}"${o.value === s.source ? ' checked' : ''}> ${esc(o.label)}</label>`).join('')}
      </fieldset>
      <p class="muted small">출처를 섞거나 자동 전환하지 않아요. 출처를 바꾸면 다시 검색하세요. 출처는 모두 DB 사본(data/*.js)을 읽습니다.</p>
      <button class="btn primary" data-act="search">규제 정보 검색</button>
      <div data-out="search-result">${work.search && work.search.done ? searchResult(work.search) : ''}</div>`;
  }

  function searchResult(s) {
    const R = S.reference;
    const q = s.q.trim();
    const head = `<h4>조회 결과 — '${esc(q)}' · ${esc(COUNTRIES[s.market].name)} · ${esc((SOURCES.find(x => x.value === s.source) || {}).label)}</h4>`;
    if (s.source === 'kr') {
      const list = R.krMatch({ nameKo: q });
      return head + (list.length ? table(['구분', '원료명', '1일 섭취량 기준 / 인정번호'], list.map(x => [
        tag(x.type === 'individual' ? '개별인정형' : '고시형', 'b-plain'), `<strong>${esc(x.name)}</strong>`,
        x.type === 'individual' ? esc(x.nos.map(n => '제' + n + '호').slice(0, 5).join(', ')) : esc(`${x.min || ''}~${x.max || ''}${x.unit || ''}`)
      ])) + '<p class="muted small">이름 대조 후보입니다. 개별인정형이면 미국 NDI·일본 근거 자료 검토 대상이 될 수 있어요.</p>' : '<div class="empty-inline">식약처 원료 목록에서 찾지 못했어요. 조회 결과 없음 ≠ 사용 허용.</div>');
    }
    if (s.source === 'jp') {
      const list = R.jpSearch(q);
      return head + jpRows(list) + jpNote();
    }
    if (s.source === 'fda') {
      if (q.length < 3) return head + '<div class="empty-inline">영문 성분명·회사명을 3자 이상 입력하세요.</div>';
      const list = R.fdaSearch(q);
      return head + fdaRows(list, `'${q}' 리콜 ${list.length}건`);
    }
    // 국가 규칙 DB: 원료 영역 규칙 + 이름 대조 후보
    const rules = S.rules.rules(s.market).filter(r => r.area === 'ingredient');
    const kr = R.krMatch({ nameKo: q });
    const jp = s.market === 'JP' ? R.jpCandidates({ nameKo: q, nameEn: q }) : [];
    const recalls = s.market === 'US' && q.length >= 3 ? R.fdaSearch(q).length : 0;
    const flags = [];
    if (jp.length) flags.push(`${tag('목록 후보', 'v-review')} 일본 의약품 전용 성분 목록과 이름이 겹쳐요: ${jp.map(x => esc(`${x.name} (${x.parts || '전체'})`)).join(', ')}`);
    if (kr.some(x => x.type === 'individual')) flags.push(`${tag('확인 필요', 'v-review')} 한국 개별인정형 원료와 이름이 겹쳐요 → ${s.market === 'US' ? 'NDI 해당 여부(US-NDI-01·02)' : s.market === 'JP' ? '근거 자료 일치(JP-EVD-01)' : '효능 근거 자료(VN-DOC-EVD)'} 확인`);
    if (recalls) flags.push(`${tag('참고', 'b-plain')} FDA 리콜 사례 ${recalls}건 — 출처를 'FDA 리콜 사례'로 바꿔 확인하세요.`);
    return head + `
      ${flags.length ? `<ul class="plain reg-flags">${flags.map(f => `<li>${f}</li>`).join('')}</ul>` : '<div class="empty-inline">이 성분 이름으로 걸린 목록 후보는 없어요. 조회 결과 없음 ≠ 사용 허용.</div>'}
      <h4>${esc(COUNTRIES[s.market].name)} 원료 규칙</h4>
      ${rules.length ? `<div class="findings">${rules.map(r => `<div class="finding v-${(r.verdictIfFail || 'REVIEW').toLowerCase()}-box">
        <div class="finding-head">${badge(r.verdictIfFail || 'REVIEW')} <span class="rule-id">${esc(r.id)}</span> <strong>${esc(r.title)}</strong></div>
        <p class="finding-msg">${esc(r.message || '')}</p>
        <div class="finding-foot">${DASH.ui.sourceLine(r)} ${DASH.ui.verifyBadge(r)}</div></div>`).join('')}</div>` : `<div class="empty-inline">${badge('UNKNOWN')} 원료 규칙 미등록 — 수동 확인 필요</div>`}
      <p class="muted small">규칙 조건은 원문 그대로 표시해요. 배지는 규칙에 걸렸을 때의 판정이며, 이 성분이 걸렸다는 뜻이 아닙니다. 제품 단위 판정은 아래 '확정 성분 규제 조회'로 확인하세요.</p>`;
  }

  // ---------- ① 파일로 일괄 조회 ----------
  function fileMode(product) {
    const xlsxOk = !!window.XLSX;
    const sheetPicker = work.sheets ? (() => {
      const names = Object.keys(work.sheets);
      return `<div class="reg-sheet">
        <div class="muted small">📄 ${esc(work.fileName)} <button class="link-btn" data-act="file-clear">파일 변경</button></div>
        <div class="form-grid three">
          <label class="block">분석할 시트<select data-map="sheet">${options(names, work.sheet || names[0])}</select></label>
          <label class="block">성분명 열<select data-map="colName"></select></label>
          <label class="block">함량 열<select data-map="colAmount"></select></label>
          <label class="block">단위 열<select data-map="colUnit"></select></label>
          <label class="block">영문명 열 (선택)<select data-map="colEn"></select></label>
          <label class="check"><input type="checkbox" data-map="hasHeader" checked> 첫 행은 머리글</label>
        </div>
        <button class="btn primary" data-act="extract">이 시트로 추출</button>
      </div>`;
    })() : '';
    return `<label class="dropzone${work.sheets ? '' : ''}" data-drop>
        <span class="dropzone-icon">⤒</span>
        <strong>성분표 파일을 끌어다 놓거나 클릭하여 선택해요</strong>
        <span class="small">XLSX / XLS / CSV · 파일 1개 · 브라우저 안에서만 읽고 외부로 보내지 않아요</span>
        <input type="file" accept=".csv,.xlsx,.xls" data-act="upload" hidden>
      </label>
      <p class="muted small">${xlsxOk ? '' : 'SheetJS를 불러오지 못해 CSV만 읽을 수 있어요. '}PDF·이미지(OCR)·개발요청서 문서 추출은 서버가 필요해 2단계에서 지원해요. 추출하면 아래 '성분표 확인·수정' 표에 채워지고, 확인 후 처방에 반영됩니다.</p>
      ${sheetPicker}`;
  }

  // ---------- ② 성분표 확인·수정 ----------
  function rowsForTable(product) { return work.draft || (product.formula || []).map(i => Object.assign({}, i)); }

  function formulaCard(c, product) {
    const isJP = c.country === 'JP';
    const rows = rowsForTable(product);
    const R = S.reference;
    const body = rows.map((i, idx) => {
      const kr = R.krMatch(i);
      const jv = i.jpPharmaOnly === true ? 'yes' : i.jpPharmaOnly === false ? 'no' : '';
      const cand = isJP ? R.jpCandidates(i) : [];
      return `<tr data-row="${idx}">
        <td><input data-k="nameKo" value="${esc(i.nameKo || '')}" placeholder="성분명(한글)"></td>
        <td><input data-k="nameEn" value="${esc(i.nameEn || '')}" placeholder="영문명·학명"></td>
        <td class="num"><input data-k="amountPerServing" value="${esc(i.amountPerServing === undefined ? '' : i.amountPerServing)}" inputmode="decimal"></td>
        <td><input data-k="unit" value="${esc(i.unit || '')}" placeholder="mg"></td>
        <td class="center"><input type="checkbox" data-k="koreaIndividual"${i.koreaIndividual ? ' checked' : ''} title="한국 개별인정형 원료"></td>
        ${isJP ? `<td><select data-k="jpPharmaOnly">${options([{ value: '', label: '미입력' }, { value: 'yes', label: '해당' }, { value: 'no', label: '비해당' }], jv)}</select>
          ${cand.length ? `<div class="small">${tag('목록 후보', 'v-review')} ${cand.map(x => esc(x.name)).join(', ')}</div>` : ''}</td>` : ''}
        <td>${krCell(i, kr)}</td>
        <td><button class="icon-btn" data-act="row-del" data-i="${idx}" aria-label="행 삭제">✕</button></td>
      </tr>`;
    }).join('');
    const head = ['성분명', '영문명', '1회 함량', '단위', '개별인정형'].concat(isJP ? ['일본 의약품 전용'] : []).concat(['식약처 원료 목록', '']);
    const draftNote = work.draft ? `<div class="warn-box">${esc(work.draftFrom || '수정 중')} — 아직 처방에 반영되지 않았어요. 확인 후 <strong>확정 성분 규제 조회</strong>를 누르세요.
        <button class="link-btn" data-act="draft-cancel">변경 취소</button></div>` : '';
    return card(`성분표 확인·수정 <span class="muted small">${esc(product.name)} · 이 제품의 처방</span>`, `
      ${draftNote}
      <div class="form-grid three reg-product">
        <label class="block">제형<select data-p="form">${options(Object.keys(FORMS).map(k => ({ value: k, label: FORMS[k] })), product.form)}</select></label>
        <label class="block">1회 섭취 개수<input type="number" min="1" data-p="unitsPerServing" value="${esc(product.unitsPerServing || 1)}"></label>
        <label class="block">1일 섭취 횟수<input type="number" min="1" data-p="servingsPerDay" value="${esc(product.servingsPerDay || 1)}"></label>
      </div>
      <div class="table-wrap"><table class="tbl reg-edit"><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${body || `<tr><td colspan="${head.length}" class="muted center">성분이 없습니다. 행을 추가하거나 파일로 올리세요.</td></tr>`}</tbody></table></div>
      <div class="row-actions">
        <button class="btn sm" data-act="row-add">+ 행 추가</button>
        <span class="casebar-spacer"></span>
        ${work.draft ? '<button class="btn sm" data-act="draft-append">기존 처방 뒤에 추가로 반영</button>' : ''}
        <button class="btn primary" data-act="confirm-run">확정 성분 규제 조회</button>
      </div>
      <p class="muted small">개별인정형 체크와 일본 의약품 전용 '해당/비해당'은 사람이 확인한 뒤 고릅니다. 식약처 원료 목록 열은 이름 대조 후보예요. 처방은 같은 제품을 쓰는 다른 건에도 적용됩니다.</p>`);
  }

  function krCell(ing, list) {
    if (!list.length) return '<span class="muted small">목록에 없음</span>';
    const items = list.map(x => x.type === 'individual'
      ? `${tag('개별인정형', 'b-plain')} ${esc(x.name)}`
      : `${tag('고시형', 'b-plain')} ${esc(x.name)}${x.min || x.max ? ` <span class="muted small">1일 ${esc(x.min || '')}~${esc(x.max || '')}${esc(x.unit || '')}</span>` : ''}`);
    const warn = list.some(x => x.type === 'individual') && !ing.koreaIndividual ? `<div class="small">${tag('확인 필요', 'v-review')} 개별인정형과 이름이 겹침</div>` : '';
    return `<div class="small">${items.join('<br>')}</div>${warn}`;
  }

  // ---------- ③ 표시 문구 · 분류 (조회 조건) ----------
  function conditionCard(c, pack) {
    const reg = c.regulatory || {};
    const ci = reg.claimInputs || {};
    let cat = '';
    let claim = '';
    if (c.country === 'JP') {
      const isFfc = (reg.category || pack.defaultCategory) === 'ffc';
      const checks = reg.jpLabelChecks || {};
      cat = `<label class="block">분류 경로<select data-field="category">${options(pack.categories.map(x => ({ value: x.code, label: x.label + (x.supported ? '' : ' — 규칙 미등록') })), reg.category || pack.defaultCategory)}</select></label>
        <label class="check"><input type="checkbox" data-field="newIngredient"${reg.newIngredient ? ' checked' : ''}> 신규 성분 등 확인에 시간이 걸리는 성분 포함 (신고 마감 120영업일 전)</label>`;
      claim = `<label class="block">표시 문구 (한국어·일본어)<textarea data-claim="main" rows="3" placeholder="예: 피부 보습에 도움을 줄 수 있음">${esc(ci.main)}</textarea></label>
        ${isFfc ? `<details class="fold reg-checklist"><summary>JP-LBL-01 필수 표시 체크리스트</summary>
          ${pack.labelChecklist.map((t, i) => `<label class="check"><input type="checkbox" data-check="${i}"${checks[i] ? ' checked' : ''}> ${esc(t)}</label>`).join('')}</details>` : ''}`;
    } else if (c.country === 'VN') {
      cat = '<p><strong>건강보호식품 (health supplement)</strong> — 자기공표가 아닌 <strong>등록</strong> 대상</p><p class="muted small">미량영양소 함량 기준(Circular 17/2023) 수치는 미확인 → VN-ING-01 규칙 미등록.</p>';
      claim = `<div class="reg-3col">
        <label class="block">등록 문구<textarea data-claim="vnRegistered" rows="3">${esc(ci.vnRegistered)}</textarea></label>
        <label class="block">라벨 문구<textarea data-claim="vnLabel" rows="3">${esc(ci.vnLabel)}</textarea></label>
        <label class="block">광고 문구<textarea data-claim="vnAd" rows="3">${esc(ci.vnAd)}</textarea></label>
      </div><p class="muted small">세 칸이 1:1로 같아야 하고, 라벨에 '의약품이 아님' 문구가 있어야 합니다.</p>`;
    } else {
      cat = `<p><strong>Dietary Supplement</strong> — FDA 시판 전 승인 없음, 통지 중심</p>
        <label class="check"><input type="checkbox" data-field="ndiConfirmed"${reg.ndiConfirmed ? ' checked' : ''}> NDI 해당으로 판단 (규제 담당 확인 후 체크) → 판매 75일 전 통지 마감</label>`;
      claim = `<label class="block">Structure/Function claim (영문)<textarea data-claim="main" rows="3" placeholder="예: Supports joint comfort">${esc(ci.main)}</textarea></label>
        <button class="btn sm" data-act="insert-disclaimer">면책 문구 삽입</button>`;
    }
    return card('조회 조건 · 표시 문구 <span class="muted small">규칙 기반 점검 · AI 문구 변환은 2단계</span>', `
      <div class="grid-2 tight"><div><h4>제품 분류</h4>${cat}</div><div><h4>표시 문구</h4>${claim}</div></div>`);
  }

  // ---------- ④ 조회 결과 ----------
  function findingsOf(findings, areas) {
    const order = ['BLOCK', 'ACTION', 'REVIEW', 'UNKNOWN', 'NOTED'];
    const list = findings.filter(f => areas.includes(f.area)).sort((a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict));
    return list.length ? `<div class="findings">${list.map(findingCard).join('')}</div>` : '<p class="muted small">이 영역 판정 없음</p>';
  }

  function resultsSection(c, product, pack, findings) {
    const reg = c.regulatory || {};
    if (!findings) {
      return card('조회 결과', '<div class="empty-inline">성분표를 확인한 뒤 <strong>확정 성분 규제 조회</strong>를 누르면 결과가 여기에 표시되고 이 건에 저장돼요. 개발요청서·원가 탭이 이 결과를 이어서 씁니다.</div>');
    }
    const n = E().countBy(findings);
    const summary = `<div class="reg-summary">${['BLOCK', 'ACTION', 'REVIEW', 'UNKNOWN', 'NOTED'].map(v => `<div class="reg-sum-item">${badge(v)} <strong>${n[v] || 0}</strong></div>`).join('')}
      ${reg.dirty ? '<span class="badge v-review">입력이 바뀜 — 다시 조회하세요</span>' : ''}</div>`;
    const cond = `<dl class="kv reg-cond">
      <dt>국가/시장</dt><dd>${countryBadge(c.country)} ${esc(pack.entry)}</dd>
      <dt>제품</dt><dd>${esc(product.name)} · ${esc(FORMS[product.form] || product.form)} · 1회 ${esc(product.unitsPerServing || 1)}개 × 1일 ${esc(product.servingsPerDay || 1)}회</dd>
      <dt>규칙 버전</dt><dd>${esc(pack.version)}</dd>
      <dt>조회일</dt><dd>${esc(reg.checkedAt || '-')}</dd>
      <dt>판매 희망일</dt><dd>${esc(c.targetLaunchDate || '미입력')}</dd></dl>`;

    const daily = S.products.dailyIntake(product);
    const ingRows = (product.formula || []).map((i, idx) => {
      const kr = S.reference.krMatch(i);
      const d = daily[idx] || {};
      const marks = [];
      if (c.country === 'JP') marks.push(i.jpPharmaOnly === true ? badge('BLOCK') : i.jpPharmaOnly === false ? badge('NOTED') : badge('UNKNOWN'));
      if (c.country === 'US' && i.koreaIndividual) marks.push(badge(reg.ndiConfirmed ? 'ACTION' : 'REVIEW'));
      if (kr.some(x => x.type === 'individual') && !i.koreaIndividual) marks.push(tag('개별인정형 확인', 'v-review'));
      return [`<strong>${esc(S.products.ingredientName(i))}</strong>`, `${esc(i.amountPerServing)} ${esc(i.unit)}`,
        `${esc(num(d.daily, 3))} ${esc(i.unit)}`, kr.length ? esc(kr.map(x => x.name).join(', ')) : '<span class="muted">없음</span>',
        marks.join(' ') || '<span class="muted small">원료 규칙 결과는 아래 참고</span>'];
    });

    const docRows = E().docChecklist(c, product, S.documents.forProduct(product.id)).map(r => [
      esc(r.req.label), badge(r.verdict), esc(r.message), `<span class="rule-id">${esc(r.req.ruleId)}</span>`
    ]);
    const dl = E().deadlinesFor(c, product, S.documents.forProduct(product.id)).filter(d => !d.info);
    const dlHtml = dl.length ? table(['마감', '날짜', '근거'], dl.map(d => [esc(d.label), `${esc(d.date)} ${DASH.ui.dday(d.date)}`, `<span class="rule-id">${esc(d.ruleId || '')}</span> ${esc(d.basis || '')}`]))
      : '<p class="muted small">판매 희망일을 넣으면 신고·통지 마감을 계산해요 (공휴일은 data/holidays.js 기준).</p>';

    return `<section class="reg-results">
      <div class="reg-results-head"><h2>조회 결과</h2><button class="btn sm" data-act="rerun">다시 조회</button></div>
      ${summary}
      <div class="grid-2-1">
        ${card('성분별 결과', table(['성분', '1회 함량', '1일 섭취량', '식약처 원료 목록', '표시'], ingRows, { empty: '처방 성분이 없습니다.' }))}
        ${card('조회 조건', cond)}
      </div>
      <div class="reg-grid">
        ${card('제품 분류', findingsOf(findings, ['category']))}
        ${card('원료', findingsOf(findings, ['ingredient']))}
        ${card('표시 문구', findingsOf(findings, ['claim']))}
        ${card('신청자 · 제조 · 판매 후 의무', findingsOf(findings, ['applicant', 'manufacturing', 'post_market']))}
        ${card('필요 서류 · 예상 기간', `${table(['서류', '판정', '내용', '규칙'], docRows, { empty: '규칙에 등록된 필수 서류가 없습니다.' })}
          <dl class="kv"><dt>법정·규칙 기간</dt><dd>${esc(pack.lead.legal)}</dd><dt>실무 기간</dt><dd>${esc(pack.lead.practical)}</dd></dl>
          <h4>주요 마감</h4>${dlHtml}
          ${findingsOf(findings, ['document', 'schedule'])}`, { cls: 'span-2' })}
      </div>
    </section>`;
  }

  // ---------- ⑤ 참고 ----------
  function referenceSection(c, product) {
    return `<details class="card fold reg-ref"><summary class="card-head"><h3>세 나라 비교표 <span class="muted small">같은 제품을 JP·VN·US 규칙에 동시에 적용</span></h3></summary>
        <div class="card-body">${compareTable(c, product)}</div></details>
      <details class="card fold reg-ref"><summary class="card-head"><h3>규제 변화 타임라인 <span class="muted small">초안 / 유예 중 / 시행 / 정지</span></h3></summary>
        <div class="card-body">${timeline()}</div></details>`;
  }

  function compareTable(c, product) {
    const docs = S.documents.forProduct(product.id);
    const buyer = S.buyers.get(c.buyerId);
    const per = S.rules.COUNTRY_CODES.map(cc => {
      const same = cc === c.country;
      const tmp = {
        id: c.id, country: cc, targetLaunchDate: c.targetLaunchDate, request: c.request,
        regulatory: same ? (c.regulatory || {}) : { claimInputs: { main: ((c.regulatory || {}).claimInputs || {}).main || '' } }
      };
      return { cc, same, pack: S.rules.forCountry(cc), f: E().evaluate(tmp, product, docs, cc, { buyer: same ? buyer : null }), tmp };
    });
    const cell = list => {
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
    return table(headers, rows, { cls: 'reg-compare' }) + '<p class="muted small">현재 건이 아닌 나라는 바이어 정보 없이, 표시 문구는 기본 칸(main)만 넣어 계산했습니다.</p>';
  }

  function timeline() {
    return `<ol class="reg-timeline">${S.rules.timeline().map(t => `<li class="reg-tl-item st-${esc(t.status)}">
      <span class="reg-tl-date">${esc(t.date)}</span>
      <span>${countryBadge(t.country)} ${tag(STATUS_LABEL[t.status] || t.status, 'st-' + t.status)}</span>
      <span>${esc(t.title)} <span class="rule-id">${esc(t.ruleId || '')}</span></span>
    </li>`).join('')}</ol>`;
  }

  // 일본 목록·FDA 리콜 표 (직접 검색 결과에서 사용)
  const JP_CAT = { plant: '식물', animal: '동물', chemical: '화학물질' };
  function jpRows(list) {
    return table(['구분', '名称', '他名等', '部位等', '備考'], list.slice(0, 60).map(x => [
      esc(JP_CAT[x.cat] || x.cat), `<strong>${esc(x.name)}</strong>`, esc(x.other), esc(x.parts), esc(x.note)
    ]), { scroll: true, empty: '일치하는 성분이 없습니다. 일본어·학명으로도 검색해 보세요.' }) + (list.length > 60 ? `<p class="muted small">${list.length}개 중 60개만 표시 — 검색어를 좁히세요.</p>` : '');
  }
  function jpNote() {
    const src = S.reference.jpSource();
    return `<p class="muted small">部位等에 적힌 부위만 의약품 전용입니다. 備考의 「非医」는 다른 부위·유사 원료가 '의약품으로 보지 않는 목록'에 있다는 뜻입니다.
      ${src ? `원문 <a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.label)}</a>` : ''}</p>`;
  }
  function fdaRows(list, label) {
    const src = S.reference.fdaSource();
    return `<p class="muted small">${esc(label)}</p>` + table(['보고일', '등급', '회사', '제품', '리콜 사유'], list.slice(0, 30).map(r => [
      esc(r.date), esc(r.cls), esc(r.firm), esc(r.product), esc(r.reason)
    ]), { scroll: true, empty: '일치하는 리콜이 없습니다.' }) +
      `<p class="muted small">openFDA 데이터는 검증되지 않은 자료입니다. ${src ? `출처 <a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.label)}</a>` : ''}</p>`;
  }

  // ---------- 동작 ----------
  function readTable(page) {
    return Array.from(page.querySelectorAll('.reg-edit tr[data-row]')).map(tr => {
      const get = k => tr.querySelector(`[data-k="${k}"]`);
      const prev = rowsForTableCache[Number(tr.dataset.row)] || {};
      const jp = get('jpPharmaOnly');
      const row = Object.assign({}, prev, {
        nameKo: get('nameKo').value.trim(),
        nameEn: get('nameEn').value.trim(),
        amountPerServing: Number(String(get('amountPerServing').value).replace(/,/g, '')) || 0,
        unit: get('unit').value.trim(),
        koreaIndividual: get('koreaIndividual').checked
      });
      if (jp) { if (jp.value === '') delete row.jpPharmaOnly; else row.jpPharmaOnly = jp.value === 'yes'; }
      return row;
    });
  }
  let rowsForTableCache = [];

  function bind(page, c, product) {
    rowsForTableCache = rowsForTable(product);

    page.addEventListener('click', e => {
      const t = e.target.closest('[data-act]');
      if (!t) return;
      const act = t.dataset.act;
      if (act === 'mode') { DASH.store.set('ui:regMode', t.dataset.v); DASH.refresh(); }
      else if (act === 'search') {
        const q = page.querySelector('[data-s="q"]').value.trim();
        if (q.length < 2) { toast('성분명을 2글자 이상 입력하세요.', 'warn'); return; }
        work.search = { q, market: page.querySelector('[data-s="market"]').value, source: (page.querySelector('[data-s="source"]:checked') || {}).value || 'rules', done: true };
        page.querySelector('[data-out="search-result"]').innerHTML = searchResult(work.search);
      } else if (act === 'pick-suggest') {
        const box = page.querySelector('[data-s="q"]');
        box.value = t.dataset.v;
        page.querySelector('[data-out="suggest"]').hidden = true;
        box.focus();
      } else if (act === 'file-clear') { work.sheets = null; DASH.refresh(); }
      else if (act === 'extract') extract(page);
      else if (act === 'row-add') { work.draft = readTable(page); work.draft.push({ nameKo: '', nameEn: '', amountPerServing: 0, unit: 'mg', koreaIndividual: false }); work.draftFrom = work.draftFrom || '직접 수정'; DASH.refresh(); }
      else if (act === 'row-del') { work.draft = readTable(page).filter((_, i) => i !== Number(t.dataset.i)); work.draftFrom = work.draftFrom || '직접 수정'; DASH.refresh(); }
      else if (act === 'draft-cancel') { work.draft = null; work.draftFrom = ''; DASH.refresh(); }
      else if (act === 'confirm-run') confirmRun(page, c.id, 'replace');
      else if (act === 'draft-append') confirmRun(page, c.id, 'append');
      else if (act === 'rerun') runCheck(c.id);
      else if (act === 'insert-disclaimer') insertDisclaimer(c.id);
      else if (act === 'to-request') {
        const cur = S.cases.get(c.id);
        if (!cur.regulatory || !cur.regulatory.findings) toast('규제 조회를 아직 하지 않았습니다. 개발요청서의 국가 조건이 비어 있을 수 있습니다.', 'warn');
        if (cur.stage === 'regulatory') cur.stage = 'request';
        DASH.caseContext.save(cur, { silent: true });
        DASH.go('request');
      }
    });

    // 자동완성
    const q = page.querySelector('[data-s="q"]');
    if (q) {
      q.addEventListener('input', () => {
        const out = page.querySelector('[data-out="suggest"]');
        const extra = (product.formula || []).map(i => i.nameKo || i.nameEn).filter(Boolean);
        const list = S.reference.suggest(q.value, extra);
        out.innerHTML = list.map(x => `<li><button type="button" data-act="pick-suggest" data-v="${esc(x.label)}">${esc(x.label)} <span class="muted small">${esc(x.kind)}</span></button></li>`).join('');
        out.hidden = !list.length;
      });
      q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); page.querySelector('[data-act="search"]').click(); } });
    }

    // 업로드 (클릭·끌어다 놓기)
    const drop = page.querySelector('[data-drop]');
    if (drop) {
      drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('over'));
      drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); });
    }
    if (work.sheets) fillCols(page, true);

    page.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.act === 'upload') { if (t.files[0]) readFile(t.files[0]); t.value = ''; return; }
      if (t.dataset.map) { if (t.dataset.map === 'sheet' || t.dataset.map === 'hasHeader') fillCols(page, true); return; }
      if (t.dataset.s) return;
      if (t.closest('.reg-edit')) { work.draft = readTable(page); work.draftFrom = work.draftFrom || '직접 수정'; rowsForTableCache = work.draft; markDraft(page); return; }
      const cur = S.cases.get(c.id);
      cur.regulatory = cur.regulatory || {};
      if (t.dataset.p) {
        const p = S.products.get(product.id);
        p[t.dataset.p] = t.type === 'number' ? (Number(t.value) || 1) : t.value;
        S.products.save(p);
        cur.regulatory.dirty = true;
        DASH.caseContext.save(cur);
      } else if (t.dataset.field) {
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
      }
    });
  }

  function markDraft(page) {
    const box = page.querySelector('.reg-edit').closest('.card-body');
    if (!box.querySelector('.warn-box')) {
      box.insertAdjacentHTML('afterbegin', '<div class="warn-box">직접 수정 — 아직 처방에 반영되지 않았어요. 확인 후 <strong>확정 성분 규제 조회</strong>를 누르세요. <button class="link-btn" data-act="draft-cancel">변경 취소</button></div>');
    }
  }

  // 확정: 표의 성분을 처방에 저장 → 규제 조회 실행
  function confirmRun(page, caseId, mode) {
    const rows = readTable(page).filter(r => r.nameKo || r.nameEn);
    const c = S.cases.get(caseId);
    const p = S.products.get(c.productId);
    const old = p.formula || [];
    const built = [];
    rows.forEach(r => {
      const prev = r.ingredientId ? old.find(o => o.ingredientId === r.ingredientId) : old.find(o => (r.nameKo && o.nameKo === r.nameKo) || (r.nameEn && o.nameEn === r.nameEn));
      built.push(Object.assign({}, prev || {}, r, { ingredientId: (prev && prev.ingredientId) || r.ingredientId || S.products.newIngredientId(old.concat(built)) }));
    });
    const changed = JSON.stringify(old) !== JSON.stringify(mode === 'append' ? old.concat(built) : built);
    if (changed) {
      p.formula = mode === 'append' ? old.concat(built.filter(b => !old.some(o => o.ingredientId === b.ingredientId))) : built;
      S.products.save(p);
      const affected = S.cases.flagFormulaChange(p.id, work.draftFrom || '성분표 수정');
      if (affected.length) modal('처방 변경 경고', `<p>견적이 합의되어 바이어가 현지 등록·신고를 진행 중인 건의 처방이 바뀌었습니다.</p><ul>${affected.map(a => `<li><strong>${esc(a.caseId)}</strong> — ${esc(a.message)}</li>`).join('')}</ul>`);
    }
    work.draft = null;
    work.draftFrom = '';
    work.sheets = null;
    runCheck(caseId);
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
    // README 8장: 다시 조회해서 결과가 바뀌면 개발요청서에 확인 배지 (자동 덮어쓰기 금지)
    if (prev.signature && prev.signature !== sig) {
      c.flags = Object.assign({}, c.flags, { regChanged: { request: true, at: D.today() } });
      toast('규제 결과가 바뀌었습니다 — 개발요청서 탭에 확인 배지를 띄웠습니다.', 'warn');
    } else toast('규제 조회를 마쳤습니다.');
    DASH.caseContext.save(c);
    setTimeout(() => { const r = document.querySelector('.reg-results'); if (r) r.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
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

  // ---------- 파일 읽기 ----------
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

  function readFile(file) {
    if (!/\.(csv|xlsx|xls)$/i.test(file.name)) { toast('XLSX·XLS·CSV 파일만 읽을 수 있어요. PDF·이미지는 2단계(서버 OCR)에서 지원합니다.', 'warn'); return; }
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
        if (!Object.keys(sheets).length) { toast('시트가 없습니다.', 'warn'); return; }
        work.sheets = sheets;
        work.fileName = file.name;
        work.sheet = Object.keys(sheets)[0];
        DASH.refresh();
      } catch (e) {
        console.error(e);
        toast('파일을 해석하지 못했습니다: ' + e.message, 'warn');
      }
    };
    if (isCsv) reader.readAsText(file, 'utf-8'); else reader.readAsArrayBuffer(file);
  }

  function guessCol(header, re) {
    const i = header.findIndex(h => re.test(String(h)));
    return i >= 0 ? i : null;
  }

  function fillCols(page, guess) {
    const sheetSel = page.querySelector('[data-map="sheet"]');
    if (!sheetSel || !work.sheets) return;
    work.sheet = sheetSel.value;
    const rows = work.sheets[work.sheet] || [];
    const width = rows.reduce((w, r) => Math.max(w, r.length), 0);
    const header = page.querySelector('[data-map="hasHeader"]').checked ? (rows[0] || []) : [];
    const opts = [{ value: '', label: '(없음)' }].concat(Array.from({ length: width }, (_, i) => ({ value: i, label: `${String.fromCharCode(65 + (i % 26))}열${header[i] ? ' · ' + header[i] : ''}` })));
    const g = {
      colName: guessCol(header, /성분|원료|ingredient|name|名/i),
      colAmount: guessCol(header, /함량|amount|qty|content|量/i),
      colUnit: guessCol(header, /단위|unit/i),
      colEn: guessCol(header, /영문|english|inci|latin|학명/i)
    };
    ['colName', 'colAmount', 'colUnit', 'colEn'].forEach((k, idx) => {
      const sel = page.querySelector(`[data-map="${k}"]`);
      const v = guess ? (g[k] !== null ? g[k] : (k === 'colEn' ? '' : (idx < width ? idx : ''))) : sel.value;
      sel.innerHTML = options(opts, v);
    });
  }

  function extract(page) {
    const rows = work.sheets[work.sheet] || [];
    const body = page.querySelector('[data-map="hasHeader"]').checked ? rows.slice(1) : rows;
    const col = k => page.querySelector(`[data-map="${k}"]`).value;
    const pick = (r, k) => (col(k) === '' ? '' : String(r[Number(col(k))] === undefined ? '' : r[Number(col(k))]).trim());
    if (col('colName') === '') { toast('성분명 열을 지정하세요.', 'warn'); return; }
    const items = body.map(r => ({
      nameKo: pick(r, 'colName'), nameEn: pick(r, 'colEn'),
      amountPerServing: Number(pick(r, 'colAmount').replace(/,/g, '')) || 0, unit: pick(r, 'colUnit'), koreaIndividual: false
    })).filter(x => x.nameKo);
    if (!items.length) { toast('추출된 성분이 없습니다. 열 지정을 확인하세요.', 'warn'); return; }
    const old = S.products.get(work.draftProductId).formula || [];
    work.draft = items.map(x => {
      const prev = old.find(o => o.nameKo === x.nameKo || (x.nameEn && o.nameEn === x.nameEn));
      return prev ? Object.assign({}, prev, { amountPerServing: x.amountPerServing, unit: x.unit || prev.unit }) : x;
    });
    work.draftFrom = `${work.fileName} · ${work.sheet}에서 ${items.length}개 추출`;
    toast(`${items.length}개 성분을 추출했어요. 표에서 확인·수정하세요.`);
    DASH.refresh();
    setTimeout(() => { const t = document.querySelector('.reg-edit'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 50);
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
