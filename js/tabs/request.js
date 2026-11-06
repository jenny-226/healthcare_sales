// 🧪 개발요청서 (README 7-3) — COSTD '개발요청서' 배치를 따른다.
//   [파일 자동변환 | 직접 작성]
//   직접 작성 = 연구소용 6개 영역: 01 기본정보 · 02 제품 개발 요구사항 · 03 원료 요구사항 · 04 사용 정보 · 05 품질 확인사항 · 06 참고자료
//   + 오른쪽 '문서 정보' (입력 완료 n/N · 확인 필요 · 인쇄) + 아래 R&D 회신
//   파일 자동변환(바이어 RFP → 표준 양식)은 서버·AI(OpenAI)가 필요해 2단계. 화면 자리만 둔다.
(function () {
  const DASH = window.DASH;
  const { card, esc, badge, countryBadge, table, options, toast, modal, seg, pageHead, COUNTRIES, FORMS } = DASH.ui;
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
  const PRICE_BAND = [{ value: '', label: '선택' }, { value: 'low', label: '저가' }, { value: 'mid', label: '중가' }, { value: 'high', label: '고가' }];
  const TARGET = [{ value: 'lab', label: '연구소' }, { value: 'plant', label: '공장' }];
  const QUALITY = [
    { key: 'stability', label: '안정성 시험 (가속·실온)' },
    { key: 'micro', label: '미생물 시험' },
    { key: 'heavyMetal', label: '중금속·잔류농약' },
    { key: 'assay', label: '기능성(지표) 성분 함량' },
    { key: 'allergen', label: '알레르기 유발 성분 확인' }
  ];
  const LANGS = ['자동 감지', '영어', '일본어', '베트남어', '중국어', '프랑스어'];
  const PRESETS = () => window.DASH_DATA.packagingPresets || [];

  function render(el, ctx) {
    const c = ctx;
    const product = S.products.get(c.productId);
    const buyer = S.buyers.get(c.buyerId);
    if (!product) { el.innerHTML = `<div class="tab-page">${card('제품 없음', '<p>연결된 제품이 없습니다.</p>')}</div>`; return; }
    const rq = c.request || {};
    const conds = countryConditions(c, product);
    const mode = DASH.store.get('ui:reqMode', 'write');

    el.innerHTML = `<div class="tab-page">
      ${pageHead(`🧪 개발요청서 ${countryBadge(c.country)}`,
        `바이어 요청서를 변환하거나 직접 작성해서 연구소·공장에 전달해요.<br><span class="muted small">${esc(DASH.caseLabel(c))}</span>`,
        `<label class="inline">상태 <select data-f="status" data-rerender="1">${options(STATUS, rq.status || 'draft')}</select></label>
         <button class="btn" data-act="reset">새 요청서</button>`)}
      ${seg([{ value: 'auto', label: '파일 자동변환' }, { value: 'write', label: '직접 작성' }], mode, 'mode', { cls: 'block' })}
      ${changedBanner(c)}
      ${c.formulaChangedAfterReg ? `<div class="warn-box">⚠️ 처방 변경 경고 (${esc(c.formulaChangedAfterReg.at)}): ${esc(S.cases.FORMULA_CHANGE_WARN[c.country])}</div>` : ''}
      ${mode === 'auto' ? autoMode(c, buyer, rq) : writeMode(c, product, buyer, rq, conds)}
    </div>`;
    bind(el.firstElementChild, c.id);
  }

  function changedBanner(c) {
    if (!(c.flags && c.flags.regChanged && c.flags.regChanged.request)) return '';
    return `<div class="banner banner-warn">규제 결과가 바뀌었습니다 — 확인 (${esc(c.flags.regChanged.at || '')}). 02·03 영역의 국가 조건을 다시 검토하세요.
      <button class="btn sm" data-act="ack-change">확인함</button></div>`;
  }

  // ---------- 파일 자동변환 (2단계 자리) ----------
  function autoMode(c, buyer, rq) {
    return `<div class="grid-2-1">
      ${card('개발요청서 업로드', `
        <p class="muted small">바이어에게 받은 RFP, Product Brief, Development Brief를 올려 주세요.</p>
        <div class="dropzone disabled" aria-disabled="true">
          <span class="dropzone-icon">⤒</span>
          <strong>파일을 끌어다 놓거나 클릭하여 선택해요</strong>
          <span class="small">PDF / DOCX / XLSX / PNG / JPG / WEBP · 최대 20MB · 파일 1개</span>
        </div>
        <div class="steps"><span class="on">STEP 1 업로드</span><span>STEP 2 결과(읽기 전용)</span><span>STEP 3 수정</span><span>PDF</span></div>
        <div class="warn-box">자동 변환은 서버(Flask)와 AI(<code>OPENAI_API_KEY</code>)가 있어야 동작해요 — 2단계. 지금은 <button class="link-btn" data-act="mode" data-v="write">직접 작성</button>으로 같은 양식을 채우세요.</div>
        <p class="muted small">원칙: 원문에 없는 값은 만들지 않고 '미입력'으로 둡니다. 수량·MOQ·거래 조건·영업 단가·마진은 연구소용 문서에 넣지 않습니다. 바이어 금지 원료와 법규 금지 원료를 구분합니다.</p>`)}
      ${card('변환 설정', `
        <label class="block">고객사<input data-f="customer" value="${esc(rq.customer !== undefined ? rq.customer : (buyer ? buyer.name : ''))}" placeholder="고객사 입력 또는 파일에서 추출"></label>
        <p class="muted small">입력한 고객사를 우선 적용해요.</p>
        <label class="block">원문 언어<select data-f="sourceLang">${options(LANGS, rq.sourceLang || '자동 감지')}</select></label>
        <label class="block">출력 언어<input value="한국어" disabled></label>
        <label class="block">전달 대상<select data-f="deliverTo">${options(TARGET, rq.deliverTo || 'lab')}</select></label>`)}
    </div>`;
  }

  // ---------- 직접 작성 ----------
  function writeMode(c, product, buyer, rq, conds) {
    return `<div class="req-layout">
      <div class="req-main">
        ${sec01(c, product, buyer, rq)}
        ${sec02(c, product, rq, conds)}
        ${sec03(c, product, rq, conds)}
        ${sec04(rq)}
        ${sec05(c, rq)}
        ${sec06(rq)}
        ${rdCard(c, product, rq, conds)}
      </div>
      <aside class="req-side">${docInfo(c, product, buyer, rq, conds)}</aside>
    </div>`;
  }

  function field(label, key, value, opts) {
    opts = opts || {};
    const req = opts.required ? ' <span class="req">*</span>' : '';
    if (opts.textarea) return `<label class="block ${opts.cls || ''}"><span>${esc(label)}${req}</span><textarea data-f="${key}" rows="${opts.rows || 3}" placeholder="${esc(opts.ph || '')}">${esc(value)}</textarea></label>`;
    return `<label class="block ${opts.cls || ''}"><span>${esc(label)}${req}</span><input data-f="${key}" type="${opts.type || 'text'}" value="${esc(value)}" placeholder="${esc(opts.ph || '')}"${opts.step ? ` step="${opts.step}"` : ''}></label>`;
  }
  const secTitle = (no, title, sub) => `<span class="req-no">${no}</span> ${esc(title)}${sub ? ` <span class="muted small">${esc(sub)}</span>` : ''}`;

  function val(rq, key, fallback) { return rq[key] !== undefined && rq[key] !== null ? rq[key] : fallback; }

  function sec01(c, product, buyer, rq) {
    return card(secTitle('01', '기본정보'), `
      <div class="form-grid three">
        ${field('고객사', 'customer', val(rq, 'customer', buyer ? buyer.name : ''), { required: true })}
        ${field('제품명', 'productName', val(rq, 'productName', product.name), { required: true })}
        <label class="block"><span>제품 유형(제형) <span class="req">*</span></span><select data-f="form">${options(Object.keys(FORMS).map(k => ({ value: k, label: FORMS[k] })), rq.form || product.form)}</select></label>
        <label class="block"><span>수출 대상국 <span class="req">*</span></span><input value="${esc(COUNTRIES[c.country].name + ' ' + c.country)}" disabled></label>
        <label class="block">목표 가격대<select data-f="priceBand">${options(PRICE_BAND, rq.priceBand || '')}</select></label>
        ${field('목표가 (USD/개)', 'targetPriceUSD', val(rq, 'targetPriceUSD', ''), { type: 'number', step: '0.01' })}
        <label class="block">판매 희망일<input value="${esc(c.targetLaunchDate || '미입력')}" disabled></label>
        <label class="block">전달 대상<select data-f="deliverTo">${options(TARGET, rq.deliverTo || 'lab')}</select></label>
      </div>
      ${field('제품 설명 · 처방 가이드', 'description', val(rq, 'description', ''), { textarea: true, rows: 2, ph: '예: 장 건강 콘셉트, 1일 1캡슐, 비건 캡슐 선호' })}
      ${field('벤치마크 제품', 'benchmark', val(rq, 'benchmark', ''), { ph: '원문에 명확할 때만 입력' })}`);
  }

  function sec02(c, product, rq, conds) {
    const draft = val(rq, 'allowedClaimDraft', claimDraftDefault(c));
    let condHtml;
    if (!conds) condHtml = '<p class="note warn">규제 확인 탭을 열면 자동으로 조회돼요. 결과가 있어야 국가 조건이 자동으로 들어옵니다. <a href="#regulatory">규제 확인으로</a></p>';
    else {
      condHtml = `<ul class="req-conds">${conds.map(x => `<li>${badge(x.verdict)} ${esc(x.text)} <span class="rule-id">${esc(x.ruleId)}</span></li>`).join('')}</ul>`;
      if (c.country === 'US') {
        condHtml += `<div class="req-ndi"><div class="muted small">NDI 원료 처방 방향</div>
          ${NDI_PLAN.filter(o => o.value).map(o => `<label class="check"><input type="radio" name="ndiPlan" data-f="ndiPlan" data-rerender="1" value="${o.value}"${rq.ndiPlan === o.value ? ' checked' : ''}> ${esc(o.label)}</label>`).join('')}
          <p class="muted small">'두 안 모두'를 고르면 원가 탭에서 두 처방안의 원가를 나란히 비교할 수 있어요.</p></div>`;
      }
      condHtml += `<p class="muted small">규제 조회일 ${esc(c.regulatory.checkedAt)} 기준. 다시 조회해도 이 탭의 입력값은 자동으로 덮어쓰지 않아요.</p>`;
    }
    const evidence = (c.country === 'JP' || c.country === 'VN')
      ? `<p class="note">자동 추가 요청 항목: <strong>성분·용량이 일치하는 근거 자료</strong> (${c.country === 'JP' ? 'JP-EVD-01' : 'VN-DOC-EVD'}) — R&D 회신 항목에 들어가요.</p>` : '';
    return card(secTitle('02', '제품 개발 요구사항', '목표 기능성 · 국가 조건'), `
      <div class="grid-2 tight">
        <div>${field('바이어 희망 기능성', 'targetFunction', val(rq, 'targetFunction', product.koreaClaim), { textarea: true, rows: 4 })}
          <p class="muted small">한국 표시: ${esc(product.koreaClaim || '-')}</p></div>
        <div>${field(`${COUNTRIES[c.country].name} 허용 표현 초안`, 'allowedClaimDraft', draft, { textarea: true, rows: 4 })}
          <p class="muted small">규제 확인 탭의 표시 문구 점검으로 다시 확인하세요. 최종 문구는 규제 담당·바이어가 정해요.</p></div>
      </div>${evidence}
      <h4>국가 조건 (규제 확인에서 자동)</h4>${condHtml}`);
  }

  function sec03(c, product, rq, conds) {
    const name = S.products.ingredientName;
    const legalBan = (conds || []).filter(x => x.verdict === 'BLOCK' && x.key !== 'us-claim');
    const base = table(['성분', '1회 함량'], (product.formula || []).map(i => [esc(name(i)), `${esc(i.amountPerServing)} ${esc(i.unit)}`]), { empty: '처방 성분이 없습니다. 규제 확인 탭에서 성분표 파일을 올리세요.' });
    const ingOpts = [{ value: '', label: '(새 원료)' }].concat((product.formula || []).map(i => ({ value: i.ingredientId, label: name(i) })));
    const rows = (rq.countryVariant || []).map((v, i) => [
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
    ])) : '<p class="muted small">같은 제품의 다른 국가 건이 없어요.</p>';
    return card(secTitle('03', '원료 요구사항', '필수·선호 원료 · 금지 원료 · 처방 변형'), `
      ${field('필수·선호 원료', 'ingredientReq', val(rq, 'ingredientReq', ''), { textarea: true, rows: 2, ph: '예: 프로바이오틱스 100억 CFU 이상, 동물성 원료 제외' })}
      <div class="grid-2 tight">
        ${field('바이어 금지 원료', 'buyerBanned', val(rq, 'buyerBanned', ''), { ph: '바이어가 원문에서 금지한 원료' })}
        <div><div class="req-label">법규 금지·확인 원료 (규제 확인에서 자동)</div>
          ${legalBan.length ? `<ul class="req-conds">${legalBan.map(x => `<li>${badge(x.verdict)} ${esc(x.text)}</li>`).join('')}</ul>` : '<p class="muted small">해당 없음 또는 규제 조회 전</p>'}</div>
      </div>
      <div class="grid-2 tight">
        <div><h4>기준 처방 (${esc(product.id)})</h4>${base}</div>
        <div><h4>${esc(COUNTRIES[c.country].name)} 처방 변경점</h4>
          ${table(['대상 원료', '변경', '값', '이유', ''], rows, { empty: '변경점이 없어요 (기준 처방 그대로).' })}
          <button class="btn sm" data-act="cv-add">+ 변경점 추가</button>
          ${S.cases.registrationStarted(c) ? '<p class="note warn">견적이 합의되어 바이어가 현지 등록·신고를 진행 중인 건이에요. 변경하면 처방 변경 경고가 기록돼요.</p>' : ''}
        </div>
      </div>
      <h4>같은 제품의 다른 국가 건</h4>${cmp}`);
  }

  function sec04(rq) {
    const presets = PRESETS().map(p => ({ value: p.id, label: p.label }));
    return card(secTitle('04', '사용 정보', '섭취 방법 · 포장 · 일정'), `
      ${field('섭취 방법·대상', 'usage', val(rq, 'usage', ''), { textarea: true, rows: 2, ph: '예: 1일 1회 1캡슐, 성인' })}
      <div class="form-grid">
        <label class="block">포장<select data-f="packagingPresetId">${options([{ value: '', label: '선택' }].concat(presets), rq.packagingPresetId || '')}</select></label>
        ${field('일정 (샘플·양산 희망일 등)', 'schedule', val(rq, 'schedule', ''), { ph: '예: 샘플 2027-01, 양산 2027-03' })}
      </div>`);
  }

  function sec05(c, rq) {
    const q = rq.quality || {};
    return card(secTitle('05', '품질 확인사항'), `
      <div class="req-quality">${QUALITY.map(x => `<label class="check"><input type="checkbox" data-q="${x.key}"${q[x.key] ? ' checked' : ''}> ${esc(x.label)}</label>`).join('')}</div>
      <h4>프로바이오틱스 안정성 조건</h4>
      ${S.stability.requestFields(rq)}
      ${c.country === 'VN' ? testPlan(c, rq) : ''}`);
  }

  // 등록용 시험 계획 (베트남)
  function testPlan(c, rq) {
    const submit = rq.plannedSubmitDate || (c.registration || {}).plannedSubmitDate || '';
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
    return `<h4>베트남 등록용 시험 계획 <span class="rule-id">VN-DOC-TEST</span></h4>
      <div class="form-grid">
        <label class="block">바이어 등록 서류 제출 예정일<input type="date" data-f="plannedSubmitDate" data-rerender="1" value="${esc(submit)}"></label>
        <div class="req-window">${from ? `시험성적서 발급일이 <strong>${esc(from)} ~ ${esc(submit)}</strong> 사이여야 제출 시점에 ${months}개월 이내예요.` : '<span class="muted">제출 예정일을 넣으면 시험 예정일 범위를 계산해요.</span>'}</div>
      </div>
      ${table(['시험', '시험기관', '시험(발급) 예정일', '판정', ''], rows)}
      <button class="btn sm" data-act="tp-add">+ 시험 추가</button>`;
  }

  function sec06(rq) {
    const files = rq.attachments || [];
    return card(secTitle('06', '참고자료'), `
      ${field('참고 메모', 'referenceNote', val(rq, 'referenceNote', ''), { textarea: true, rows: 2, ph: '예: 바이어 참고 이미지 — 투명 캡슐, 갈색 병' })}
      <div class="row-actions"><label class="btn sm">파일 이름 첨부<input type="file" multiple data-act="attach" hidden></label>
        <span class="muted small">1단계는 파일 이름만 기록해요 (파일 보관은 2단계 서버).</span></div>
      ${files.length ? `<ul class="plain req-files">${files.map((f, i) => `<li>📎 ${esc(f)} <button class="icon-btn" data-act="attach-del" data-i="${i}" aria-label="삭제">✕</button></li>`).join('')}</ul>` : ''}`);
  }

  // ---------- 오른쪽 문서 정보 ----------
  const FILL_KEYS = ['customer', 'productName', 'form', 'priceBand', 'targetFunction', 'ingredientReq', 'usage', 'packagingPresetId', 'schedule', 'quality'];
  function completeness(c, product, buyer, rq) {
    const v = {
      customer: val(rq, 'customer', buyer ? buyer.name : ''), productName: val(rq, 'productName', product.name),
      form: rq.form || product.form, priceBand: rq.priceBand || rq.targetPriceUSD, targetFunction: val(rq, 'targetFunction', product.koreaClaim),
      ingredientReq: rq.ingredientReq, usage: rq.usage, packagingPresetId: rq.packagingPresetId, schedule: rq.schedule,
      quality: Object.values(rq.quality || {}).some(Boolean)
    };
    return { done: FILL_KEYS.filter(k => v[k]).length, total: FILL_KEYS.length, missingRequired: ['customer', 'productName', 'form'].filter(k => !v[k]) };
  }

  function docInfo(c, product, buyer, rq, conds) {
    const cm = completeness(c, product, buyer, rq);
    const check = (conds || []).filter(x => x.verdict === 'UNKNOWN' || x.verdict === 'REVIEW').length;
    const replies = rq.rdReplies || {};
    const items = rdItems(c, product, rq, conds);
    const answered = items.filter(it => (replies[it.key] || {}).status).length;
    return card('문서 정보', `
      <div class="tiles req-tiles">
        <div class="tile"><span class="t-label">입력 완료</span><span class="t-value">${cm.done}/${cm.total}</span></div>
        <div class="tile"><span class="t-label">확인 필요</span><span class="t-value">${conds ? check : '-'}</span></div>
      </div>
      <dl class="kv small">
        <dt>상태</dt><dd>${esc((STATUS.find(s => s.value === (rq.status || 'draft')) || {}).label)}${rq.sentAt ? ` · 발송 ${esc(rq.sentAt)}` : ''}</dd>
        <dt>수출국</dt><dd>${countryBadge(c.country)}</dd>
        <dt>전달 대상</dt><dd>${esc((TARGET.find(t => t.value === (rq.deliverTo || 'lab')) || {}).label)}</dd>
        <dt>R&D 회신</dt><dd>${answered}/${items.length}</dd>
        <dt>판매 희망일</dt><dd>${esc(c.targetLaunchDate || '-')}</dd>
      </dl>
      ${cm.missingRequired.length ? `<p class="note warn">필수값 누락: ${esc(cm.missingRequired.map(k => ({ customer: '고객사', productName: '제품명', form: '유형' })[k]).join(', '))}</p>` : ''}
      <div class="req-side-actions">
        <button class="btn primary" data-act="print">인쇄 · PDF 저장</button>
        <button class="btn" data-act="make-reply">바이어 회신 초안</button>
      </div>
      <p class="muted small">PDF는 브라우저 인쇄 → 'PDF로 저장'을 써요. 수량·MOQ·단가·마진은 연구소용 문서에 넣지 않아요 (원가 탭에서 관리).</p>`);
  }

  // ---------- 국가 조건 (규제 확인 결과에서) ----------
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

  function claimDraftDefault(c) {
    if (c.country === 'US') return `Supports ...*\n\n*${S.rules.forCountry('US').disclaimer}`;
    if (c.country === 'VN') return 'Sản phẩm này không phải là thuốc và không có tác dụng thay thế thuốc chữa bệnh.';
    if (c.country === 'JP') return '본 제품에는 [기능성 관여 성분]이 포함되어 있습니다. [기능성 관여 성분]에는 [기능성]이 보고되어 있습니다. (FFC 표현 초안 — 근거 자료와 일치 확인)';
    return '';
  }

  function variantText(v, product) {
    const ing = (product.formula || []).find(i => i.ingredientId === v.ingredientId);
    const label = (CHANGE.find(x => x.value === v.change) || {}).label || v.change;
    return `${ing ? S.products.ingredientName(ing) : '새 원료'} — ${label}${v.value ? ': ' + v.value : ''}${v.reason ? ` (${v.reason})` : ''}`;
  }

  // ---------- R&D 회신 ----------
  function rdItems(c, product, rq, conds) {
    const items = [
      { key: 'base-form', text: `제형: ${FORMS[rq.form || product.form] || product.form}` },
      { key: 'base-price', text: `목표가: ${rq.targetPriceUSD ? '$' + rq.targetPriceUSD + '/개' : (PRICE_BAND.find(p => p.value === rq.priceBand) || {}).label || '미입력'}` }
    ];
    (rq.stabilityReview?.items || []).forEach((text, i) => items.push({ key: 'stability-' + i, text: '[안정성 사전검토] ' + text }));
    if (rq.ingredientReq) items.push({ key: 'base-ing', text: `원료 요구사항: ${rq.ingredientReq}` });
    if (rq.buyerBanned) items.push({ key: 'base-ban', text: `바이어 금지 원료 제외: ${rq.buyerBanned}` });
    if (rq.packagingPresetId) {
      const p = PRESETS().find(x => x.id === rq.packagingPresetId);
      items.push({ key: 'base-pack', text: `포장: ${p ? p.label : rq.packagingPresetId}` });
    }
    (conds || []).forEach(x => items.push({ key: x.key, text: x.text }));
    if (c.country === 'JP' || c.country === 'VN') items.push({ key: 'evidence-match', text: '성분·용량이 일치하는 근거 자료 제공 가능 여부' });
    if (c.country === 'US' && (rq.ndiPlan === 'notify' || rq.ndiPlan === 'both')) items.push({ key: 'plan-notify', text: 'NDI 통지안 처방 (통지 자료 준비)' });
    if (c.country === 'US' && (rq.ndiPlan === 'alternative' || rq.ndiPlan === 'both')) items.push({ key: 'plan-alt', text: '대체 원료안 처방 (NDI 비해당 원료로 대체)' });
    QUALITY.filter(x => (rq.quality || {})[x.key]).forEach(x => items.push({ key: 'q-' + x.key, text: `품질 확인: ${x.label}` }));
    (rq.countryVariant || []).forEach((v, i) => items.push({ key: 'var-' + i, text: '처방 변형: ' + variantText(v, product) }));
    return items;
  }

  function rdCard(c, product, rq, conds) {
    const replies = rq.rdReplies || {};
    const rows = rdItems(c, product, rq, conds).map(it => {
      const r = replies[it.key] || {};
      return [esc(it.text),
        `<select data-rd="${esc(it.key)}" data-k="status">${options(RD, r.status || '')}</select>`,
        `<input data-rd="${esc(it.key)}" data-k="note" value="${esc(r.note)}" placeholder="메모 / 대안 내용">`];
    });
    return card('R&D 회신 <span class="muted small">항목별 가능·불가·대안</span>', `${table(['항목', '회신', '메모'], rows)}
      ${rq.buyerReplyDraft ? `<label class="block req-reply">바이어 회신 초안 (영문)<textarea data-f="buyerReplyDraft" rows="12">${esc(rq.buyerReplyDraft)}</textarea></label>
        <button class="btn sm" data-act="copy-reply">복사</button>` : '<p class="muted small">회신을 채운 뒤 오른쪽 <strong>바이어 회신 초안</strong>을 누르면 영문 메일 초안이 만들어져요.</p>'}`);
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
      if (t.dataset.stability) {
        if (!t.checkValidity()) { t.reportValidity(); return; }
        rq.stability = { ...rq.stability, [t.dataset.stability]: t.type === 'number' && t.value !== '' ? Number(t.value) : t.value };
        DASH.caseContext.save(c, { silent: true });
        return;
      }
      if (t.dataset.act === 'attach') {
        rq.attachments = (rq.attachments || []).concat(Array.from(t.files).map(f => f.name));
        t.value = '';
        DASH.caseContext.save(c);
      } else if (t.dataset.f) {
        const v = t.type === 'number' ? (t.value === '' ? null : Number(t.value)) : t.value;
        rq[t.dataset.f] = v;
        if (t.dataset.f === 'status' && v === 'sent') rq.sentAt = D.today();
        DASH.caseContext.save(c, { silent: !t.dataset.rerender && t.tagName !== 'SELECT' });
      } else if (t.dataset.q) {
        rq.quality = Object.assign({}, rq.quality, { [t.dataset.q]: t.checked });
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
      if (!t || t.dataset.act === 'attach') return;
      const act = t.dataset.act;
      const c = fresh();
      const rq = c.request;
      if (act === 'mode') { DASH.store.set('ui:reqMode', t.dataset.v); DASH.refresh(); }
      else if (act === 'ack-change') { c.flags.regChanged.request = false; DASH.caseContext.save(c); }
      else if (act === 'reset') DASH.ui.confirmBox('이 건의 개발요청서 입력값을 모두 지우고 새로 작성할까요?', () => {
        const cur = fresh();
        cur.request = { status: 'draft' };
        DASH.caseContext.save(cur);
      }, '새로 작성');
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
      } else if (act === 'attach-del') {
        rq.attachments = (rq.attachments || []).filter((_, i) => i !== Number(t.dataset.i));
        DASH.caseContext.save(c);
      } else if (act === 'make-reply') {
        rq.buyerReplyDraft = makeReply(c);
        DASH.caseContext.save(c);
        setTimeout(() => { const r = document.querySelector('.req-reply'); if (r) r.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 50);
      } else if (act === 'copy-reply') DASH.ui.copyText(rq.buyerReplyDraft || '');
    });
  }

  // 처방 변경 경고 (README 7-3): 견적 합의 후(바이어 등록 진행 중) 처방을 바꾸면 국가별 경고
  function variantChanged(c, silent) {
    if (S.cases.registrationStarted(c)) {
      const first = !c.formulaChangedAfterReg;
      c.formulaChangedAfterReg = { at: D.today(), note: '국가별 처방 변형 변경' };
      DASH.caseContext.save(c, { silent: silent && !first });
      if (first) modal('처방 변경 경고', `<p>바이어가 현지 등록·신고를 진행 중인 건의 처방을 바꿨습니다.</p><p><strong>${esc(S.cases.FORMULA_CHANGE_WARN[c.country])}</strong></p>`);
    } else DASH.caseContext.save(c, { silent });
  }

  function printRequest(c) {
    const product = S.products.get(c.productId);
    const buyer = S.buyers.get(c.buyerId);
    const rq = c.request || {};
    const conds = countryConditions(c, product) || [];
    const name = S.products.ingredientName;
    const pack = PRESETS().find(x => x.id === rq.packagingPresetId);
    const kv = (k, v) => `<tr><th>${esc(k)}</th><td>${esc(v || '미입력')}</td></tr>`;
    const qList = QUALITY.filter(x => (rq.quality || {})[x.key]).map(x => x.label);
    const html = `<div class="print-doc">
      <h1>개발요청서</h1>
      <p class="muted">${esc(c.id)} · 작성일 ${esc(D.today())} · 상태 ${esc((STATUS.find(s => s.value === (rq.status || 'draft')) || {}).label)} · 전달 대상 ${esc((TARGET.find(t => t.value === (rq.deliverTo || 'lab')) || {}).label)}</p>
      <h2>01 기본정보</h2>
      <table class="print-kv">${kv('고객사', val(rq, 'customer', buyer && buyer.name))}${kv('제품명', val(rq, 'productName', product.name))}${kv('제품 유형', FORMS[rq.form || product.form])}
        ${kv('수출 대상국', COUNTRIES[c.country].name)}${kv('목표 가격대', (PRICE_BAND.find(p => p.value === rq.priceBand) || {}).label === '선택' ? '' : (PRICE_BAND.find(p => p.value === rq.priceBand) || {}).label)}${kv('판매 희망일', c.targetLaunchDate)}
        ${kv('제품 설명', rq.description)}${kv('벤치마크', rq.benchmark)}</table>
      <h2>02 제품 개발 요구사항</h2>
      <p><strong>목표 기능성</strong> ${esc(val(rq, 'targetFunction', product.koreaClaim))}</p>
      <p><strong>허용 표현 초안</strong></p><pre>${esc(val(rq, 'allowedClaimDraft', claimDraftDefault(c)))}</pre>
      <p><strong>국가 조건</strong></p><ul>${conds.map(x => `<li>[${esc(DASH.ui.VERDICTS[x.verdict].label)}] ${esc(x.text)} (${esc(x.ruleId)})</li>`).join('') || '<li>규제 조회 전</li>'}</ul>
      ${c.country === 'US' && rq.ndiPlan ? `<p>NDI 처방 방향: ${esc((NDI_PLAN.find(o => o.value === rq.ndiPlan) || {}).label)}</p>` : ''}
      <h2>03 원료 요구사항</h2>
      <table class="print-kv">${kv('필수·선호 원료', rq.ingredientReq)}${kv('바이어 금지 원료', rq.buyerBanned)}</table>
      <table class="print-tbl"><tr><th>성분</th><th>1회 함량</th></tr>${(product.formula || []).map(i => `<tr><td>${esc(name(i))}</td><td>${esc(i.amountPerServing)} ${esc(i.unit)}</td></tr>`).join('')}</table>
      ${(rq.countryVariant || []).length ? `<p><strong>국가별 변경점</strong></p><ul>${rq.countryVariant.map(v => `<li>${esc(variantText(v, product))}</li>`).join('')}</ul>` : ''}
      <h2>04 사용 정보</h2>
      <table class="print-kv">${kv('섭취 방법·대상', rq.usage)}${kv('포장', pack ? pack.label : '')}${kv('일정', rq.schedule)}</table>
      <h2>05 품질 확인사항</h2>
      <p>${esc(qList.join(', ') || '미입력')}</p>
      <table class="print-kv">${S.stability.definitions.map(([key, label]) => kv(label, String((rq.stability || {})[key] ?? ''))).join('')}</table>
      ${(rq.stabilityReview?.items || []).length ? `<h3>안정성 R&D 검토 요청 (저장 시점 기준)</h3><ul>${rq.stabilityReview.items.map(text => `<li>${esc(text)}</li>`).join('')}</ul>` : ''}
      ${c.country === 'VN' && (rq.testPlan || []).length ? `<p><strong>등록용 시험 계획</strong> (제출 예정일 ${esc(rq.plannedSubmitDate || '-')})</p><table class="print-tbl"><tr><th>시험</th><th>기관</th><th>예정일</th></tr>${rq.testPlan.map(t => `<tr><td>${esc(t.test)}</td><td>${esc(t.lab)}</td><td>${esc(t.plannedDate)}</td></tr>`).join('')}</table>` : ''}
      <h2>06 참고자료</h2>
      <p>${esc(rq.referenceNote || '미입력')}</p>
      ${(rq.attachments || []).length ? `<ul>${rq.attachments.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
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
