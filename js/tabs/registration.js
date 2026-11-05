// 🗂️ 등록·신고 (README 7-5): 서류함(필수 서류 체크리스트·서류 등록·유효성 판정·바이어 패키지)
// + 진행 트래커(단계·자동 마감·베트남 보완 요청) + 판매 후 의무
(function () {
  const DASH = window.DASH;
  const { card, esc, badge, countryBadge, tag, table, options, toast, modal, sourceLine, verifyBadge, dday, COUNTRIES, krw } = DASH.ui;
  const S = DASH.services;
  const D = DASH.dates;

  const STEP_STATUS = [{ value: 'todo', label: '대기' }, { value: 'doing', label: '진행 중' }, { value: 'done', label: '완료' }];
  const PAYER_KO = { us: '우리', buyer: '바이어', split: '분담' };

  function render(el, ctx) {
    const c = ctx;
    const product = S.products.get(c.productId);
    if (!product) { el.innerHTML = `<div class="tab-page">${card('제품 없음', '<p>연결된 제품이 없습니다.</p>')}</div>`; return; }
    const docs = S.documents.forProduct(c.productId);
    const pack = S.rules.forCountry(c.country);
    const rows = DASH.engine.docChecklist(c, product, docs);

    el.innerHTML = `<div class="tab-page">
      <div class="page-head">
        <div><h1>🗂️ 등록·신고 ${countryBadge(c.country)}</h1><p class="muted">${esc(DASH.caseLabel(c))} · 명의자: 현지 바이어</p></div>
        <div class="head-actions">
          <button class="btn" data-act="print-package">바이어 패키지 인쇄</button>
          ${c.stage !== 'selling' ? '<button class="btn primary" data-act="start-selling">판매 시작으로 표시</button>' : tag('판매 중', 'b-plain')}
        </div>
      </div>
      ${changedBanner(c)}
      ${c.formulaChangedAfterReg ? `<div class="warn-box">⚠️ 처방 변경 기록 (${esc(c.formulaChangedAfterReg.at)} · ${esc(c.formulaChangedAfterReg.note || '')}): ${esc(S.cases.FORMULA_CHANGE_WARN[c.country])}</div>` : ''}
      ${checklistCard(c, rows)}
      ${docListCard(c, docs)}
      <div class="grid-2">
        ${trackerCard(c, product, docs, pack)}
        <div class="stack">
          ${c.country === 'VN' ? queriesCard(c) : ''}
          ${responsibilityCard(c)}
          ${postMarketCard(c, pack)}
        </div>
      </div>
    </div>`;
    bind(el.firstElementChild, c.id);
  }

  function changedBanner(c) {
    if (!(c.flags && c.flags.regChanged && c.flags.regChanged.registration)) return '';
    return `<div class="banner banner-warn">규제 결과가 바뀌었습니다 — 확인 (${esc(c.flags.regChanged.at || '')}). 필수 서류와 마감을 다시 보세요.
      <button class="btn sm" data-act="ack-change">확인함</button></div>`;
  }

  // ---------- 서류함 ----------
  function checklistCard(c, rows) {
    const submit = (c.registration || {}).plannedSubmitDate || '';
    const trs = rows.map(r => [
      `<strong>${esc(r.req.label)}</strong><br><span class="rule-id">${esc(r.req.type)} · ${esc(r.req.ruleId)}</span>`,
      r.doc ? `${esc(r.doc.fileName || r.doc.id)}<br><span class="muted small">발급 ${esc(r.doc.issuedAt || '-')}</span>` : '<strong>없음</strong>',
      `${badge(r.verdict)}<div class="small">${esc(r.message)}</div>`,
      `${sourceLine(r)} ${verifyBadge(r)}`,
      r.doc ? `<button class="btn sm ghost" data-act="edit-doc" data-id="${esc(r.doc.id)}">수정</button>` : `<button class="btn sm" data-act="new-doc" data-type="${esc(r.req.type)}">등록</button>`
    ]);
    const submitField = c.country === 'VN' ? `<label class="inline">제출 예정일 (성적서 12개월 판정 기준) <input type="date" data-act="submit-date" value="${esc(submit)}"></label>` : '';
    return card(`필수 서류 체크리스트 <span class="muted small">${esc(COUNTRIES[c.country].name)} 규칙(area: document 등)에서 자동 생성</span>`,
      `${submitField}${table(['서류', '보유', '유효성 판정', '출처', ''], trs, { cls: 'regi-check' })}
      <p class="muted small">MVP는 파일명만 저장합니다 (파일 업로드는 2단계). 한국 CFS 발급 기관·아포스티유 절차는 미확인 — 발급 전 담당 기관에 확인하세요.</p>`);
  }

  function docListCard(c, docs) {
    const L = S.documents.LEGALIZATION;
    const trs = docs.map(d => [
      `${esc(S.documents.TYPES[d.type] || d.type)} ${d.sample ? '<span class="badge b-sample">예시</span>' : ''}`,
      d.productId ? esc(d.productId) : tag('공통', 'b-plain'),
      esc(d.issuedAt || '-'),
      d.lab ? `${esc(d.lab.name || '')} ${d.lab.iso17025 ? tag('ISO 17025', 'b-plain') : ''} ${d.lab.mohDesignated ? tag('MOH 지정', 'b-plain') : ''}` : '-',
      esc(L[d.legalization || 'none']),
      esc(d.fileName || '-'),
      `<button class="btn sm ghost" data-act="edit-doc" data-id="${esc(d.id)}">수정</button>`
    ]);
    return card('서류함 <span class="muted small">이 제품 + 공장 공통 서류</span>', table(['종류', '범위', '발급일', '시험기관', '합법화', '파일명', ''], trs, { empty: '등록된 서류가 없습니다.' }),
      { actions: '<button class="btn sm" data-act="new-doc">+ 서류 등록</button>' });
  }

  function openDoc(c, doc, presetType) {
    const isNew = !doc;
    doc = doc || { productId: c.productId, type: presetType || 'TEST_REPORT', issuedAt: '', expiresAt: '', lab: { name: '', iso17025: false, mohDesignated: false }, legalization: 'none', fileName: '', note: '' };
    const lab = doc.lab || {};
    const T = S.documents.TYPES;
    const body = `<div class="form-grid">
      <label>종류 <select name="type">${options(Object.keys(T).map(k => ({ value: k, label: T[k] })), doc.type)}</select></label>
      <label>범위 <select name="scope">${options([{ value: 'product', label: `이 제품 (${c.productId})` }, { value: 'common', label: '공장 공통 (모든 제품)' }], doc.productId ? 'product' : 'common')}</select></label>
      <label>발급일 (FDA 시설은 등록·갱신일) <input type="date" name="issuedAt" value="${esc(doc.issuedAt)}"></label>
      <label>만료일 (있으면) <input type="date" name="expiresAt" value="${esc(doc.expiresAt || '')}"></label>
      <label>시험기관명 <input name="labName" value="${esc(lab.name)}"></label>
      <div class="checks">
        <label class="check"><input type="checkbox" name="iso17025"${lab.iso17025 ? ' checked' : ''}> ISO/IEC 17025</label>
        <label class="check"><input type="checkbox" name="mohDesignated"${lab.mohDesignated ? ' checked' : ''}> 베트남 MOH 지정</label>
      </div>
      <label>합법화 (CFS) <select name="legalization">${options(Object.keys(S.documents.LEGALIZATION).map(k => ({ value: k, label: S.documents.LEGALIZATION[k] })), doc.legalization || 'none')}</select></label>
      <label>파일명 <input name="fileName" value="${esc(doc.fileName)}" placeholder="예: test_report_P001.pdf"></label>
      <label class="check full"><input type="checkbox" name="matchChecked"${doc.matchChecked ? ' checked' : ''}> (근거 자료) 제품의 성분·함량과 일치함을 확인했음</label>
      <label class="full">메모 <input name="note" value="${esc(doc.note)}"></label>
    </div>`;
    const m = modal(isNew ? '서류 등록' : '서류 수정', body, {
      extraButtons: isNew ? '' : '<button class="btn danger" data-act="del-doc">삭제</button>',
      onOk: el => {
        const v = DASH.ui.readForm(el);
        if (v.issuedAt && !D.isValid(v.issuedAt)) { toast('발급일 형식을 확인하세요.', 'warn'); return false; }
        S.documents.save(Object.assign({}, doc, {
          type: v.type, productId: v.scope === 'common' ? null : c.productId,
          issuedAt: v.issuedAt, expiresAt: v.expiresAt || null,
          lab: { name: v.labName, iso17025: v.iso17025, mohDesignated: v.mohDesignated },
          legalization: v.legalization, fileName: v.fileName, matchChecked: v.matchChecked, note: v.note
        }));
        toast('서류를 저장했습니다.');
        DASH.caseContext.notify();
      }
    });
    const del = m.el.querySelector('[data-act="del-doc"]');
    if (del) del.addEventListener('click', () => { S.documents.remove(doc.id); m.close(); toast('삭제했습니다.'); DASH.caseContext.notify(); });
  }

  // ---------- 진행 트래커 ----------
  function trackerCard(c, product, docs, pack) {
    const steps = (c.registration && c.registration.steps) || [];
    const deadlines = DASH.engine.deadlinesFor(c, product, docs);
    const noHol = c.country !== 'US' && !D.hasHolidays(c.country);
    const stepRows = steps.map((s, i) => [
      `<strong>${i + 1}. ${esc(s.label)}</strong>`,
      `<select data-step="${i}" data-k="status">${options(STEP_STATUS, s.status || 'todo')}</select>`,
      `<input type="date" data-step="${i}" data-k="startedAt" value="${esc(s.startedAt || '')}">`,
      `<input type="date" data-step="${i}" data-k="doneAt" value="${esc(s.doneAt || '')}">`
    ]);
    const dlRows = deadlines.map(d => [
      `${esc(d.label)}${d.ruleId ? `<br><span class="rule-id">${esc(d.ruleId)}</span>` : ''}`,
      `<strong>${esc(d.date)}</strong> ${d.done ? tag('완료', 'b-plain') : dday(d.date)}`,
      `<span class="small muted">${esc(d.basis || '')}</span>`
    ]);
    const lead = `<dl class="kv small"><dt>기간 안내</dt><dd>${esc(pack.lead.legal)} · ${esc(pack.lead.practical)}</dd></dl>`;
    const usNote = c.country === 'US' ? '<p class="note">미국 75일·30일은 근거 문서 표현대로 달력일로 계산했습니다. <span class="badge b-verify">원문 확인 필요</span></p>' : '';
    return card('진행 트래커', `
      ${steps.length ? table(['단계', '상태', '시작일', '완료일'], stepRows) : '<p class="muted">진행 단계가 아직 없습니다.</p><button class="btn sm" data-act="make-steps">단계 만들기</button>'}
      <h4>자동 마감</h4>
      ${noHol ? '<p class="note warn">공휴일 미반영 — 실제 마감은 더 이를 수 있습니다. <a href="#admin">관리자 메뉴에서 공휴일 입력</a></p>' : ''}
      ${c.targetLaunchDate ? '' : '<p class="note warn">판매(출시) 희망일이 없어 마감을 계산할 수 없습니다.</p>'}
      ${table(['마감', '날짜', '계산 근거'], dlRows, { empty: '계산된 마감이 없습니다.' })}
      ${usNote}${lead}
      <label class="inline">판매(출시) 희망일 <input type="date" data-act="launch-date" value="${esc(c.targetLaunchDate || '')}"></label>`);
  }

  function queriesCard(c) {
    const qs = (c.registration && c.registration.queries) || [];
    const days = S.rules.param('VN-SCH-02', 'days', 7);
    const rows = qs.map((q, i) => {
      const due = q.receivedAt ? D.addBusinessDays(q.receivedAt, days, 'VN') : '';
      return [
        `<input type="date" data-q="${i}" data-k="receivedAt" value="${esc(q.receivedAt || '')}">`,
        due ? `<strong>${esc(due)}</strong> ${q.answeredAt ? tag('회신함', 'b-plain') : dday(due)}` : '-',
        `<input type="date" data-q="${i}" data-k="answeredAt" value="${esc(q.answeredAt || '')}">`,
        `<input data-q="${i}" data-k="note" value="${esc(q.note || '')}" placeholder="요청 내용">`,
        `<button class="icon-btn" data-act="q-del" data-i="${i}" aria-label="삭제">✕</button>`
      ];
    });
    return card(`보완 요청 <span class="rule-id">VN-SCH-02</span> <span class="muted small">접수일 + ${days}영업일 = 회신 기한</span>`,
      `${table(['접수일', '회신 기한', '회신일', '내용', ''], rows, { empty: '보완 요청이 없습니다.' })}
      <button class="btn sm" data-act="q-add">+ 보완 요청 접수</button>`);
  }

  // 원가 → 등록·신고: 서류 준비 책임 (README 8장)
  function responsibilityCard(c) {
    const regs = (c.cost && c.cost.regulatoryCosts) || [];
    const body = regs.length
      ? `<ul class="regi-resp">${regs.map(r => `<li>${esc(r.item || '(항목명 없음)')} — <strong>${esc(PAYER_KO[r.payer || 'buyer'])}</strong> ${r.amountKRW ? `<span class="muted small">${krw(r.amountKRW)}</span>` : ''}</li>`).join('')}</ul>`
      : '<p class="muted">원가 탭에서 등록·시험 비용과 부담 주체를 정하면 여기 표시됩니다.</p><a class="btn sm" href="#cost">원가로</a>';
    return card('서류 준비 책임 <span class="muted small">견적 조건에서</span>', body);
  }

  function postMarketCard(c, pack) {
    const extra = c.country === 'JP' ? `<div class="muted small">건강피해 보고(15일) 시 바이어에게 줄 제조 정보 체크리스트</div>
      <ul class="regi-pm">${['로트 번호·제조일', '원료 공급처·원료 로트', '출하 시험 기록', '보관·유통 조건', '연락 담당자 (24시간 이내 회신)'].map(x => `<li>☐ ${esc(x)}</li>`).join('')}</ul>` : '';
    return card(`판매 후 의무 ${c.stage === 'selling' ? tag('판매 중', 'b-plain') : ''}`, `<ul class="regi-pm">${(pack.postMarket || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>${extra}`);
  }

  // ---------- 동작 ----------
  function bind(page, caseId) {
    const fresh = () => { const c = S.cases.get(caseId); c.registration = c.registration || {}; return c; };

    page.addEventListener('click', e => {
      const t = e.target.closest('[data-act]');
      if (!t) return;
      const act = t.dataset.act;
      const c = fresh();
      if (act === 'ack-change') { c.flags.regChanged.registration = false; DASH.caseContext.save(c); }
      else if (act === 'new-doc') openDoc(c, null, t.dataset.type);
      else if (act === 'edit-doc') openDoc(c, S.documents.get(t.dataset.id));
      else if (act === 'make-steps') { S.cases.ensureSteps(c); DASH.caseContext.save(c); }
      else if (act === 'q-add') {
        c.registration.queries = c.registration.queries || [];
        c.registration.queries.push({ id: 'Q-' + Date.now(), receivedAt: D.today(), answeredAt: null, note: '' });
        const st = (c.registration.steps || []).find(s => s.key === 'query');
        if (st && st.status === 'todo') { st.status = 'doing'; st.startedAt = D.today(); }
        DASH.caseContext.save(c);
      } else if (act === 'q-del') { c.registration.queries.splice(Number(t.dataset.i), 1); DASH.caseContext.save(c); }
      else if (act === 'start-selling') {
        c.stage = 'selling';
        DASH.caseContext.save(c);
        toast('판매 단계로 표시했습니다. 판매 후 의무를 확인하세요.');
      } else if (act === 'print-package') printPackage(c);
    });

    page.addEventListener('change', e => {
      const t = e.target;
      const c = fresh();
      if (t.dataset.act === 'submit-date') { c.registration.plannedSubmitDate = t.value; DASH.caseContext.save(c); }
      else if (t.dataset.act === 'launch-date') { c.targetLaunchDate = t.value; DASH.caseContext.save(c); }
      else if (t.dataset.step !== undefined) {
        const s = c.registration.steps[Number(t.dataset.step)];
        s[t.dataset.k] = t.value || null;
        if (t.dataset.k === 'status') {
          if (t.value !== 'todo' && !s.startedAt) s.startedAt = D.today();
          if (t.value === 'done' && !s.doneAt) s.doneAt = D.today();
          if (t.value !== 'done') s.doneAt = null;
          if (['regulatory', 'request', 'cost'].includes(c.stage) && t.value !== 'todo') c.stage = 'registration';
        }
        DASH.caseContext.save(c);
      } else if (t.dataset.q !== undefined) {
        const q = c.registration.queries[Number(t.dataset.q)];
        q[t.dataset.k] = t.value || null;
        DASH.caseContext.save(c, { silent: t.dataset.k === 'note' });
      }
    });
  }

  function printPackage(c) {
    const product = S.products.get(c.productId);
    const buyer = S.buyers.get(c.buyerId);
    const rows = DASH.engine.docChecklist(c, product, S.documents.forProduct(c.productId));
    const html = `<div class="print-doc">
      <h1>바이어 서류 패키지 체크리스트</h1>
      <p class="muted">${esc(c.id)} · ${esc(D.today())}</p>
      <table class="print-kv"><tr><th>바이어 (명의자)</th><td>${esc(buyer ? buyer.name : '-')}</td></tr><tr><th>제품</th><td>${esc(product.name)}</td></tr>
        <tr><th>국가</th><td>${esc(COUNTRIES[c.country].name)}</td></tr><tr><th>판매 희망일</th><td>${esc(c.targetLaunchDate || '-')}</td></tr></table>
      <table class="print-tbl"><tr><th>☐</th><th>서류</th><th>파일</th><th>발급일</th><th>상태</th><th>규칙</th></tr>
        ${rows.map(r => `<tr><td>☐</td><td>${esc(r.req.label)}</td><td>${esc(r.doc ? r.doc.fileName || r.doc.id : '없음')}</td><td>${esc(r.doc ? r.doc.issuedAt || '' : '')}</td><td>${esc(DASH.ui.VERDICTS[r.verdict].label)} — ${esc(r.message)}</td><td>${esc(r.req.ruleId)}</td></tr>`).join('')}
      </table>
      <p class="print-foot">사전검토 보조 도구 기준 — 서류 유효성은 1차 참고용이며 최종 판단은 규제 담당과 현지 바이어(명의자)가 합니다.</p>
    </div>`;
    DASH.ui.printHtml(html);
  }

  DASH.registerTab({
    id: 'registration', icon: '🗂️', label: '등록·신고', order: 50, cssClass: 'tab-regi', needsCase: true,
    render,
    summary: ctx => {
      const product = S.products.get(ctx.productId);
      const list = DASH.engine.deadlinesFor(ctx, product, S.documents.forProduct(ctx.productId))
        .filter(d => !d.done && !d.info && D.daysUntil(d.date) <= 14);
      return { label: '14일 안 마감', value: list.length };
    }
  });
})();
