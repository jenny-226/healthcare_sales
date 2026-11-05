// 🧪 개발요청서 (README 7-3): 직접 작성 폼 · 국가 조건 자동 삽입 · 기능성↔허용 표현 · 등록용 시험 계획
// · 국가별 처방 변형 · 처방 변경 경고 · R&D 회신 · 인쇄
(function () {
  const DASH = window.DASH;
  const { card, esc, badge, countryBadge, tag, table, options, toast, modal, COUNTRIES, FORMS } = DASH.ui;
  const S = DASH.services;
  const D = DASH.dates;

  const STATUS = [
    { value: 'draft', label: '초안' }, { value: 'sent', label: 'R&D 발송' },
    { value: 'replied', label: 'R&D 회신' }, { value: 'fixed', label: '확정' }
  ];
  const CHANGE = [
    { value: 'remove', label: '제외' }, { value: 'replace', label: '대체' },
    { value: 'amount', label: '함량 변경' }, { value: 'add', label: '추가' }
  ];
  const RD = [{ value: '', label: '미회신' }, { value: 'ok', label: '가능' }, { value: 'no', label: '불가' }, { value: 'alt', label: '대안' }];
  const NDI_PLAN = [
    { value: '', label: '미정' }, { value: 'notify', label: 'NDI 통지안' },
    { value: 'alternative', label: '대체 원료안' }, { value: 'both', label: '두 안 모두 요청' }
  ];

  function render(el, ctx) {
    const c = ctx;
    const product = S.products.get(c.productId);
    const buyer = S.buyers.get(c.buyerId);
    if (!product) { el.innerHTML = `<div class="tab-page">${card('제품 없음', '<p>연결된 제품이 없습니다.</p>')}</div>`; return; }
    const rq = c.request || {};
    const conds = countryConditions(c, product);

    el.innerHTML = `<div class="tab-page">
      <div class="page-head">
        <div><h1>🧪 개발요청서 ${countryBadge(c.country)}</h1><p class="muted">${esc(DASH.caseLabel(c))}</p></div>
        <div class="head-actions">
          <label class="inline">상태 <select data-f="status" data-rerender="1">${options(STATUS, rq.status || 'draft')}</select></label>
          <button class="btn" data-act="print">인쇄 · PDF</button>
        </div>
      </div>
      ${changedBanner(c)}
      ${c.formulaChangedAfterReg ? `<div class="warn-box">⚠️ 처방 변경 경고 (${esc(c.formulaChangedAfterReg.at)}): ${esc(S.cases.FORMULA_CHANGE_WARN[c.country])}</div>` : ''}
      <div class="grid-2">
        ${basicCard(c, product, buyer, rq)}
        ${conditionsCard(c, product, rq, conds)}
      </div>
      ${claimCard(c, product, rq)}
      ${c.country === 'VN' ? testPlanCard(c, rq) : ''}
      ${variantCard(c, product, rq)}
      ${rdCard(c, product, rq, conds)}
    </div>`;
    bind(el.firstElementChild, c.id);
  }

  function changedBanner(c) {
    if (!(c.flags && c.flags.regChanged && c.flags.regChanged.request)) return '';
    return `<div class="banner banner-warn">규제 결과가 바뀌었습니다 — 확인 (${esc(c.flags.regChanged.at || '')}). 아래 국가 조건을 다시 검토하세요.
      <button class="btn sm" data-act="ack-change">확인함</button></div>`;
  }

  // 규제 확인 결과에서 가져오는 국가 조건
  function countryConditions(c, product) {
    const reg = c.regulatory || {};
    if (!reg.findings) return null;
    const name = S.products.ingredientName;
    const f = product.formula || [];
    const items = [];
    if (c.country === 'JP') {
      const pharma = f.filter(i => i.jpPharmaOnly === true);
      const unknown = f.filter(i => i.jpPharmaOnly !== true && i.jpPharmaOnly !== false);
      if (pharma.length) items.push({ key: 'jp-pharma', text: `일본 의약품 전용 성분 제외: ${pharma.map(name).join(', ')}`, ruleId: 'JP-ING-01', verdict: 'BLOCK' });
      if (unknown.length) items.push({ key: 'jp-pharma-unknown', text: `의약품 전용 성분 여부 확인 필요: ${unknown.map(name).join(', ')}`, ruleId: 'JP-ING-01', verdict: 'UNKNOWN' });
      items.push({ key: 'jp-gmp', text: 'GMP 인정 라인에서 생산 (보충제 형태 GMP 의무)', ruleId: 'JP-MFG-01', verdict: 'ACTION' });
      items.push({ key: 'jp-evidence', text: '기능성 관여 성분·함량과 일치하는 안전성·기능성 근거 자료', ruleId: 'JP-EVD-01', verdict: 'REVIEW' });
    } else if (c.country === 'VN') {
      items.push({ key: 'vn-micro', text: '미량영양소 함량 기준 — 데이터 미등록, 규제 담당 수동 확인', ruleId: 'VN-ING-01', verdict: 'UNKNOWN' });
      items.push({ key: 'vn-test', text: '등록용 시험: ISO/IEC 17025 또는 MOH 지정 기관, 제출 전 12개월 이내 발급', ruleId: 'VN-DOC-TEST', verdict: 'ACTION' });
      items.push({ key: 'vn-evidence', text: '해당 성분·용량에 맞는 효능 근거 자료', ruleId: 'VN-DOC-EVD', verdict: 'REVIEW' });
      items.push({ key: 'vn-label', text: '베트남어 라벨 = 등록 문구 1:1, \'의약품이 아님\' 문구 포함', ruleId: 'VN-LBL-01', verdict: 'ACTION' });
    } else if (c.country === 'US') {
      const ndi = f.filter(i => i.koreaIndividual === true);
      if (ndi.length || reg.ndiConfirmed) items.push({ key: 'us-ndi', text: `NDI 검토 원료: ${ndi.map(name).join(', ') || '(규제 확인에서 NDI 해당으로 체크)'}`, ruleId: 'US-NDI-01', verdict: reg.ndiConfirmed ? 'ACTION' : 'REVIEW' });
      items.push({ key: 'us-cgmp', text: 'cGMP(21 CFR Part 111) 준수 자료 제공', ruleId: 'US-MFG-01', verdict: 'ACTION' });
      items.push({ key: 'us-claim', text: '구조·기능 표현만 사용 + 면책 문구 (질병 표현 불가)', ruleId: 'US-CLM-01', verdict: 'BLOCK' });
    }
    return items;
  }

  function field(label, key, value, opts) {
    opts = opts || {};
    if (opts.textarea) return `<label class="block ${opts.cls || ''}">${esc(label)}<textarea data-f="${key}" rows="${opts.rows || 3}" placeholder="${esc(opts.ph || '')}">${esc(value)}</textarea></label>`;
    return `<label class="block ${opts.cls || ''}">${esc(label)}<input data-f="${key}" type="${opts.type || 'text'}" value="${esc(value)}" placeholder="${esc(opts.ph || '')}"${opts.step ? ` step="${opts.step}"` : ''}></label>`;
  }

  function basicCard(c, product, buyer, rq) {
    const presets = (window.DASH_DATA.packagingPresets || []).map(p => ({ value: p.id, label: p.label }));
    return card('기본정보 · 요구사항', `
      <div class="form-grid">
        ${field('고객사', 'customer', rq.customer !== undefined ? rq.customer : (buyer ? buyer.name : ''))}
        ${field('제품명', 'productName', rq.productName !== undefined ? rq.productName : product.name)}
        <label class="block">제형<select data-f="form">${options(Object.keys(FORMS).map(k => ({ value: k, label: FORMS[k] })), rq.form || product.form)}</select></label>
        ${field('목표가 (USD/개)', 'targetPriceUSD', rq.targetPriceUSD, { type: 'number', step: '0.01' })}
        <label class="block">국가<input value="${esc(COUNTRIES[c.country].name + ' ' + c.country)}" disabled></label>
        <label class="block">판매 희망일<input value="${esc(c.targetLaunchDate || '미입력')}" disabled></label>
      </div>
      ${field('원료 요구사항', 'ingredientReq', rq.ingredientReq, { textarea: true, ph: '예: 프로바이오틱스 100억 CFU 이상, 동물성 원료 제외' })}
      ${field('사용 정보 (섭취 방법·대상)', 'usage', rq.usage, { textarea: true, rows: 2, ph: '예: 1일 1회 1캡슐, 성인' })}
      <div class="form-grid">
        <label class="block">포장<select data-f="packagingPresetId">${options([{ value: '', label: '선택' }].concat(presets), rq.packagingPresetId || '')}</select></label>
        ${field('일정 (샘플·양산 희망일 등)', 'schedule', rq.schedule, { ph: '예: 샘플 2027-01, 양산 2027-03' })}
      </div>`);
  }

  function conditionsCard(c, product, rq, conds) {
    let body;
    if (!conds) body = '<p class="note warn">규제 확인을 먼저 실행하세요. 결과가 있어야 국가 조건이 자동으로 들어옵니다.</p><a class="btn sm" href="#regulatory">규제 확인으로</a>';
    else {
      body = `<ul class="req-conds">${conds.map(x => `<li>${badge(x.verdict)} ${esc(x.text)} <span class="rule-id">${esc(x.ruleId)}</span></li>`).join('')}</ul>`;
      if (c.country === 'US') {
        body += `<div class="req-ndi"><div class="muted small">NDI 원료 처방 방향</div>
          ${NDI_PLAN.filter(o => o.value).map(o => `<label class="check"><input type="radio" name="ndiPlan" data-f="ndiPlan" data-rerender="1" value="${o.value}"${rq.ndiPlan === o.value ? ' checked' : ''}> ${esc(o.label)}</label>`).join('')}
          <p class="muted small">'두 안 모두'를 고르면 원가 탭에서 두 처방안의 원가를 나란히 비교할 수 있습니다.</p></div>`;
      }
      body += `<p class="muted small">규제 확인 실행일 ${esc(c.regulatory.checkedAt)} 기준. 규제 확인을 다시 실행해도 이 탭의 입력값은 자동으로 덮어쓰지 않습니다.</p>`;
    }
    return card('국가 조건 (규제 확인에서 자동)', body);
  }

  function claimDraftDefault(c, product) {
    if (c.country === 'US') return `Supports ${'...'}*\n\n*${S.rules.forCountry('US').disclaimer}`;
    if (c.country === 'VN') return 'Sản phẩm này không phải là thuốc và không có tác dụng thay thế thuốc chữa bệnh.';
    if (c.country === 'JP') return `본 제품에는 [기능성 관여 성분]이 포함되어 있습니다. [기능성 관여 성분]에는 [기능성]이 보고되어 있습니다. (FFC 표현 초안 — 근거 자료와 일치 확인)`;
    return '';
  }

  function claimCard(c, product, rq) {
    const draft = rq.allowedClaimDraft !== undefined ? rq.allowedClaimDraft : claimDraftDefault(c, product);
    const evidence = (c.country === 'JP' || c.country === 'VN')
      ? `<p class="note">자동 추가 요청 항목: <strong>성분·용량이 일치하는 근거 자료</strong> (${c.country === 'JP' ? 'JP-EVD-01' : 'VN-DOC-EVD'}) — R&D 회신 항목에 들어갑니다.</p>` : '';
    return card('목표 기능성 ↔ 국가별 허용 표현', `
      <div class="grid-2 tight">
        <div>
          ${field('바이어 희망 기능성', 'targetFunction', rq.targetFunction !== undefined ? rq.targetFunction : product.koreaClaim, { textarea: true, rows: 4 })}
          <p class="muted small">한국 표시: ${esc(product.koreaClaim || '-')}</p>
        </div>
        <div>
          ${field(`${COUNTRIES[c.country].name} 표현 초안`, 'allowedClaimDraft', draft, { textarea: true, rows: 4 })}
          <p class="muted small">초안은 규제 확인 ④에서 다시 점검하세요. 최종 문구는 규제 담당·바이어가 정합니다.</p>
        </div>
      </div>${evidence}`);
  }

  // 등록용 시험 계획 (베트남)
  function testPlanCard(c, rq) {
    const submit = (c.registration || {}).plannedSubmitDate || '';
    const months = S.rules.param('VN-DOC-TEST', 'months', 12);
    const from = submit && D.isValid(submit) ? D.addMonths(submit, -months) : null;
    const plan = rq.testPlan && rq.testPlan.length ? rq.testPlan : [{ test: '등록용 시험성적서 (품질 규격 항목)', lab: '', plannedDate: '' }];
    const rows = plan.map((t, i) => {
      let v = '';
      if (t.plannedDate && from) {
        if (t.plannedDate < from) v = `${badge('ACTION')} 제출 시점에 ${months}개월 초과`;
        else if (t.plannedDate > submit) v = `${badge('REVIEW')} 제출 예정일보다 늦음`;
        else v = `${badge('NOTED')} 기간 안`;
      }
      return [
        `<input data-tp="${i}" data-k="test" value="${esc(t.test)}">`,
        `<input data-tp="${i}" data-k="lab" value="${esc(t.lab)}" placeholder="ISO 17025 / MOH 지정 기관">`,
        `<input type="date" data-tp="${i}" data-k="plannedDate" value="${esc(t.plannedDate)}">`,
        v,
        `<button class="icon-btn" data-act="tp-del" data-i="${i}" aria-label="삭제">✕</button>`
      ];
    });
    return card('등록용 시험 계획 <span class="rule-id">VN-DOC-TEST</span>', `
      <div class="form-grid">
        <label class="block">예상 제출일 (등록·신고 탭과 공유)<input type="date" data-act="submit-date" value="${esc(submit)}"></label>
        <div class="req-window">${from ? `시험성적서 발급일이 <strong>${esc(from)} ~ ${esc(submit)}</strong> 사이여야 제출 시점에 ${months}개월 이내입니다.` : '<span class="muted">예상 제출일을 넣으면 시험 예정일 범위를 계산합니다.</span>'}</div>
      </div>
      ${table(['시험', '시험기관', '시험(발급) 예정일', '판정', ''], rows)}
      <button class="btn sm" data-act="tp-add">+ 시험 추가</button>`);
  }

  // 국가별 처방 변형
  function variantCard(c, product, rq) {
    const name = S.products.ingredientName;
    const base = table(['성분', '1회 함량'], (product.formula || []).map(i => [esc(name(i)), `${esc(i.amountPerServing)} ${esc(i.unit)}`]));
    const ingOpts = [{ value: '', label: '(새 원료)' }].concat((product.formula || []).map(i => ({ value: i.ingredientId, label: name(i) })));
    const variants = rq.countryVariant || [];
    const rows = variants.map((v, i) => [
      `<select data-cv="${i}" data-k="ingredientId">${options(ingOpts, v.ingredientId || '')}</select>`,
      `<select data-cv="${i}" data-k="change">${options(CHANGE, v.change || 'replace')}</select>`,
      `<input data-cv="${i}" data-k="value" value="${esc(v.value)}" placeholder="새 원료명 / 새 함량">`,
      `<input data-cv="${i}" data-k="reason" value="${esc(v.reason)}" placeholder="변경 이유 (규칙 ID 등)">`,
      `<button class="icon-btn" data-act="cv-del" data-i="${i}" aria-label="삭제">✕</button>`
    ]);
    const others = S.cases.list().filter(x => x.productId === c.productId && x.id !== c.id);
    const cmp = others.length ? table(['건', '국가', '변경점'], others.map(o => [
      esc(o.id), countryBadge(o.country),
      ((o.request && o.request.countryVariant) || []).map(v => esc(variantText(v, product))).join('<br>') || '<span class="muted">기준 처방 그대로</span>'
    ])) : '<p class="muted small">같은 제품의 다른 국가 건이 없습니다.</p>';
    return card('국가별 처방 변형 <span class="muted small">기준 처방 + 이 나라 변경점</span>', `
      <div class="grid-2 tight">
        <div><h4>기준 처방 (${esc(product.id)})</h4>${base}</div>
        <div><h4>${esc(COUNTRIES[c.country].name)} 변경점</h4>
          ${table(['대상 원료', '변경', '값', '이유', ''], rows, { empty: '변경점이 없습니다 (기준 처방 그대로).' })}
          <button class="btn sm" data-act="cv-add">+ 변경점 추가</button>
          ${S.cases.registrationStarted(c) ? '<p class="note warn">이 건은 등록·신고 단계가 시작되었습니다. 변경하면 처방 변경 경고가 기록됩니다.</p>' : ''}
        </div>
      </div>
      <h4>같은 제품의 다른 국가 건</h4>${cmp}`);
  }

  function variantText(v, product) {
    const ing = (product.formula || []).find(i => i.ingredientId === v.ingredientId);
    const label = (CHANGE.find(x => x.value === v.change) || {}).label || v.change;
    return `${ing ? S.products.ingredientName(ing) : '새 원료'} — ${label}${v.value ? ': ' + v.value : ''}${v.reason ? ` (${v.reason})` : ''}`;
  }

  // R&D 회신 항목
  function rdItems(c, product, rq, conds) {
    const items = [
      { key: 'base-form', text: `제형: ${FORMS[rq.form || product.form] || product.form}` },
      { key: 'base-price', text: `목표가: ${rq.targetPriceUSD ? '$' + rq.targetPriceUSD + '/개' : '미입력'}` }
    ];
    if (rq.ingredientReq) items.push({ key: 'base-ing', text: `원료 요구사항: ${rq.ingredientReq}` });
    if (rq.packagingPresetId) {
      const p = (window.DASH_DATA.packagingPresets || []).find(x => x.id === rq.packagingPresetId);
      items.push({ key: 'base-pack', text: `포장: ${p ? p.label : rq.packagingPresetId}` });
    }
    (conds || []).forEach(x => items.push({ key: x.key, text: x.text }));
    if (c.country === 'JP' || c.country === 'VN') items.push({ key: 'evidence-match', text: '성분·용량이 일치하는 근거 자료 제공 가능 여부' });
    if (c.country === 'US' && (rq.ndiPlan === 'notify' || rq.ndiPlan === 'both')) items.push({ key: 'plan-notify', text: 'NDI 통지안 처방 (통지 자료 준비)' });
    if (c.country === 'US' && (rq.ndiPlan === 'alternative' || rq.ndiPlan === 'both')) items.push({ key: 'plan-alt', text: '대체 원료안 처방 (NDI 비해당 원료로 대체)' });
    (rq.countryVariant || []).forEach((v, i) => items.push({ key: 'var-' + i, text: '처방 변형: ' + variantText(v, product) }));
    return items;
  }

  function rdCard(c, product, rq, conds) {
    const replies = rq.rdReplies || {};
    const items = rdItems(c, product, rq, conds);
    const rows = items.map(it => {
      const r = replies[it.key] || {};
      return [esc(it.text),
        `<select data-rd="${esc(it.key)}" data-k="status">${options(RD, r.status || '')}</select>`,
        `<input data-rd="${esc(it.key)}" data-k="note" value="${esc(r.note)}" placeholder="메모 / 대안 내용">`];
    });
    return card('R&D 회신', `${table(['항목', '회신', '메모'], rows)}
      <div class="row-actions"><button class="btn" data-act="make-reply">바이어 회신 초안 만들기</button></div>
      ${rq.buyerReplyDraft ? `<label class="block">바이어 회신 초안 (영문)<textarea data-f="buyerReplyDraft" rows="12">${esc(rq.buyerReplyDraft)}</textarea></label>
        <button class="btn sm" data-act="copy-reply">복사</button>` : ''}`);
  }

  function makeReply(c) {
    const product = S.products.get(c.productId);
    const buyer = S.buyers.get(c.buyerId);
    const rq = c.request || {};
    const items = rdItems(c, product, rq, countryConditions(c, product));
    const replies = rq.rdReplies || {};
    const word = { ok: 'Feasible', no: 'Not feasible', alt: 'Alternative proposed' };
    const lines = items.map(it => {
      const r = replies[it.key] || {};
      return `- ${it.text}: ${word[r.status] || 'Under review'}${r.note ? ' — ' + r.note : ''}`;
    });
    const country = { JP: 'Japan', VN: 'Vietnam', US: 'the United States' }[c.country];
    return `Dear ${(buyer && buyer.contact && buyer.contact.name) || 'Sir/Madam'},

Thank you for your request regarding ${rq.productName || product.name} for ${country}.
Our R&D team has reviewed the items below:

${lines.join('\n')}

Please note that the registration/notification in ${country} is filed under your company's name as the local holder. We will provide the formula information and supporting documents required for the procedure.
This is a preliminary review; the final regulatory decision rests with your regulatory team.

Best regards,`;
  }

  // ---------- 동작 ----------
  function bind(page, caseId) {
    const fresh = () => { const c = S.cases.get(caseId); c.request = c.request || {}; return c; };

    page.addEventListener('change', e => {
      const t = e.target;
      const c = fresh();
      const rq = c.request;
      if (t.dataset.f) {
        let v = t.type === 'number' ? (t.value === '' ? null : Number(t.value)) : t.value;
        rq[t.dataset.f] = v;
        if (t.dataset.f === 'status' && v === 'sent') rq.sentAt = D.today();
        DASH.caseContext.save(c, { silent: !t.dataset.rerender && t.tagName !== 'SELECT' });
      } else if (t.dataset.act === 'submit-date') {
        c.registration = c.registration || {};
        c.registration.plannedSubmitDate = t.value;
        DASH.caseContext.save(c);
      } else if (t.dataset.tp !== undefined) {
        rq.testPlan = rq.testPlan && rq.testPlan.length ? rq.testPlan : [{ test: '등록용 시험성적서 (품질 규격 항목)', lab: '', plannedDate: '' }];
        rq.testPlan[Number(t.dataset.tp)][t.dataset.k] = t.value;
        DASH.caseContext.save(c, { silent: t.dataset.k !== 'plannedDate' });
      } else if (t.dataset.cv !== undefined) {
        rq.countryVariant[Number(t.dataset.cv)][t.dataset.k] = t.value;
        variantChanged(c, t.tagName === 'INPUT');
      } else if (t.dataset.rd) {
        rq.rdReplies = rq.rdReplies || {};
        rq.rdReplies[t.dataset.rd] = rq.rdReplies[t.dataset.rd] || {};
        rq.rdReplies[t.dataset.rd][t.dataset.k] = t.value;
        if (t.dataset.k === 'status' && rq.status === 'sent') rq.status = 'replied';
        DASH.caseContext.save(c, { silent: t.dataset.k === 'note' });
      }
    });

    page.addEventListener('click', e => {
      const t = e.target.closest('[data-act]');
      if (!t) return;
      const act = t.dataset.act;
      const c = fresh();
      const rq = c.request;
      if (act === 'ack-change') { c.flags.regChanged.request = false; DASH.caseContext.save(c); }
      else if (act === 'print') printRequest(c);
      else if (act === 'tp-add') {
        rq.testPlan = rq.testPlan && rq.testPlan.length ? rq.testPlan : [{ test: '등록용 시험성적서 (품질 규격 항목)', lab: '', plannedDate: '' }];
        rq.testPlan.push({ test: '', lab: '', plannedDate: '' });
        DASH.caseContext.save(c);
      } else if (act === 'tp-del') {
        rq.testPlan = (rq.testPlan || []).filter((_, i) => i !== Number(t.dataset.i));
        DASH.caseContext.save(c);
      } else if (act === 'cv-add') {
        rq.countryVariant = rq.countryVariant || [];
        rq.countryVariant.push({ ingredientId: '', change: 'replace', value: '', reason: '' });
        variantChanged(c);
      } else if (act === 'cv-del') {
        rq.countryVariant = (rq.countryVariant || []).filter((_, i) => i !== Number(t.dataset.i));
        variantChanged(c);
      } else if (act === 'make-reply') {
        rq.buyerReplyDraft = makeReply(c);
        DASH.caseContext.save(c);
      } else if (act === 'copy-reply') DASH.ui.copyText(rq.buyerReplyDraft || '');
    });
  }

  // 처방 변경 경고 (README 7-3): 등록·신고가 시작된 건이면 국가별 경고
  // silent: 텍스트 칸 수정은 다시 그리지 않음 (바로 누른 버튼 클릭이 사라지지 않게)
  function variantChanged(c, silent) {
    if (S.cases.registrationStarted(c)) {
      const first = !c.formulaChangedAfterReg;
      c.formulaChangedAfterReg = { at: D.today(), note: '국가별 처방 변형 변경' };
      DASH.caseContext.save(c, { silent: silent && !first });
      if (first) modal('처방 변경 경고', `<p>등록·신고 단계가 시작된 건의 처방을 바꿨습니다.</p><p><strong>${esc(S.cases.FORMULA_CHANGE_WARN[c.country])}</strong></p>`);
    } else DASH.caseContext.save(c, { silent });
  }

  function printRequest(c) {
    const product = S.products.get(c.productId);
    const buyer = S.buyers.get(c.buyerId);
    const rq = c.request || {};
    const conds = countryConditions(c, product) || [];
    const name = S.products.ingredientName;
    const pack = (window.DASH_DATA.packagingPresets || []).find(x => x.id === rq.packagingPresetId);
    const kv = (k, v) => `<tr><th>${esc(k)}</th><td>${esc(v || '-')}</td></tr>`;
    const html = `<div class="print-doc">
      <h1>개발요청서</h1>
      <p class="muted">${esc(c.id)} · 작성일 ${esc(D.today())} · 상태 ${esc((STATUS.find(s => s.value === (rq.status || 'draft')) || {}).label)}</p>
      <h2>1. 기본정보</h2>
      <table class="print-kv">${kv('고객사', rq.customer || (buyer && buyer.name))}${kv('제품명', rq.productName || product.name)}${kv('제형', FORMS[rq.form || product.form])}
        ${kv('국가', COUNTRIES[c.country].name)}${kv('목표가', rq.targetPriceUSD ? '$' + rq.targetPriceUSD + '/개' : '')}${kv('판매 희망일', c.targetLaunchDate)}</table>
      <h2>2. 원료 요구사항</h2><p>${esc(rq.ingredientReq || '-')}</p>
      <table class="print-tbl"><tr><th>성분</th><th>1회 함량</th></tr>${(product.formula || []).map(i => `<tr><td>${esc(name(i))}</td><td>${esc(i.amountPerServing)} ${esc(i.unit)}</td></tr>`).join('')}</table>
      ${(rq.countryVariant || []).length ? `<p><strong>국가별 변경점</strong></p><ul>${rq.countryVariant.map(v => `<li>${esc(variantText(v, product))}</li>`).join('')}</ul>` : ''}
      <h2>3. 국가 조건</h2><ul>${conds.map(x => `<li>[${esc(DASH.ui.VERDICTS[x.verdict].label)}] ${esc(x.text)} (${esc(x.ruleId)})</li>`).join('') || '<li>규제 확인 미실행</li>'}</ul>
      ${c.country === 'US' && rq.ndiPlan ? `<p>NDI 처방 방향: ${esc((NDI_PLAN.find(o => o.value === rq.ndiPlan) || {}).label)}</p>` : ''}
      <h2>4. 목표 기능성</h2><p>${esc(rq.targetFunction || product.koreaClaim)}</p><p><strong>표현 초안</strong></p><pre>${esc(rq.allowedClaimDraft !== undefined ? rq.allowedClaimDraft : claimDraftDefault(c, product))}</pre>
      <h2>5. 사용 정보 · 포장 · 일정</h2>
      <table class="print-kv">${kv('사용 정보', rq.usage)}${kv('포장', pack ? pack.label : '')}${kv('일정', rq.schedule)}</table>
      ${c.country === 'VN' && (rq.testPlan || []).length ? `<h2>6. 등록용 시험 계획</h2><table class="print-tbl"><tr><th>시험</th><th>기관</th><th>예정일</th></tr>${rq.testPlan.map(t => `<tr><td>${esc(t.test)}</td><td>${esc(t.lab)}</td><td>${esc(t.plannedDate)}</td></tr>`).join('')}</table>` : ''}
      <p class="print-foot">사전검토 보조 도구로 작성됨 — 규제 판정은 1차 참고용이며 최종 판단은 규제 담당과 현지 바이어(명의자)가 합니다.</p>
    </div>`;
    DASH.ui.printHtml(html);
  }

  DASH.registerTab({
    id: 'request', icon: '🧪', label: '개발요청서', order: 30, cssClass: 'tab-req', needsCase: true,
    render,
    summary: ctx => ({ label: 'R&D 회신 대기', value: ctx.request && ctx.request.status === 'sent' ? '대기' : 0 })
  });
})();
