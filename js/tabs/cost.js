// 💰 원가 (README 7-4): 원가·마진 → 인코텀즈별 USD 단가, 포장 프리셋, 등록·시험 비용(부담 주체),
// 1회분·1일분 단가, 수량별 단가표, 환율 영향, 역제안 판정, 원료 대체(VE) 경고, 변형 원가 비교, 견적서 출력
(function () {
  const DASH = window.DASH;
  const { card, esc, countryBadge, table, options, toast, krw, usd, num, COUNTRIES, badge } = DASH.ui;
  const S = DASH.services;
  const D = DASH.dates;

  const INCOTERMS = ['EXW', 'FOB', 'CFR', 'CIF'];
  const PAYERS = [{ value: 'us', label: '우리' }, { value: 'buyer', label: '바이어' }, { value: 'split', label: '분담 (50:50)' }];
  const FORM_PRESET = { capsule: 'bottle-60cap', softgel: 'bottle-60cap', tablet: 'bottle-90tab', powder: 'stick-30', jelly_stick: 'jelly-pouch', liquid: 'stick-30' };
  const REG_COST_SUGGEST = {
    JP: ['FFC 근거 자료 작성 지원', 'GMP 증명서 발급·번역'],
    VN: ['시험성적서 재시험', 'CFS 발급·아포스티유', '효능 근거 자료 정리', '베트남어 라벨 검토'],
    US: ['NDI 통지 자료 작성', 'FDA 식품시설 등록·갱신', 'cGMP 자료 정리']
  };

  const DOC_EN = {
    TEST_REPORT: 'Test report (COA)', CFS: 'Certificate of Free Sale', GMP: 'GMP certificate', EFFICACY: 'Efficacy evidence',
    LOA: 'Letter of Authorization', LABEL: 'Label draft', FDA_FACILITY: 'FDA food facility registration',
    CGMP: 'cGMP compliance documents', NDI_NOTICE: 'NDI notification dossier', FFC_EVIDENCE: 'FFC scientific evidence'
  };

  const presets = () => (window.DASH_DATA.packagingPresets || []);

  // 기본값 채우기 (금액·마진은 0 — 사용자가 입력)
  function ensureCost(c, product) {
    const cost = c.cost = c.cost || {};
    const L = window.DASH_DATA.logisticsDefaults || { fobPerCBM_KRW: 0, freightPerCBM_KRW: {}, insurancePct: 0 };
    if (!cost.incoterms) cost.incoterms = 'FOB';
    if (!cost.moq) cost.moq = 10000;
    if (!cost.packagingPresetId) cost.packagingPresetId = (c.request && c.request.packagingPresetId) || FORM_PRESET[product.form] || presets()[0].id;
    cost.pack = cost.pack || {};
    const pr = presets().find(p => p.id === cost.packagingPresetId) || presets()[0];
    if (!cost.plans || !cost.plans.length) cost.plans = [{ name: '기본안', rawKRW: 0, processKRW: 0, packKRW: pr.packKRW }];
    cost.marginPct = Object.assign({ first: 0, logistics: 0, sales: 0 }, cost.marginPct);
    cost.logistics = Object.assign({ fobPerCBM: L.fobPerCBM_KRW, freightPerCBM: (L.freightPerCBM_KRW || {})[c.country] || 0, insurancePct: L.insurancePct }, cost.logistics);
    cost.regulatoryCosts = cost.regulatoryCosts || [];
    if (!cost.tiers || !cost.tiers.length) cost.tiers = [{ qty: cost.moq, discountPct: 0 }, { qty: cost.moq * 2, discountPct: 0 }, { qty: cost.moq * 5, discountPct: 0 }];
    if (cost.minMarginPct === undefined) cost.minMarginPct = 10;
    if (cost.fxShift === undefined) cost.fxShift = 0;
    if (cost.counterUSD === undefined) cost.counterUSD = (c.request && c.request.targetPriceUSD) || null;
    cost.veCandidates = cost.veCandidates || [];
    return cost;
  }

  function packOf(cost) {
    const pr = presets().find(p => p.id === cost.packagingPresetId) || presets()[0];
    return Object.assign({}, pr, cost.pack || {});
  }

  const n = v => (Number(v) || 0);

  // 핵심 계산. 마진은 판매가 기준(가격 = 원가 ÷ (1 − 마진%))
  function compute(c, product, planIdx) {
    const cost = c.cost;
    const plan = cost.plans[planIdx || 0] || cost.plans[0];
    const pk = packOf(cost);
    const fx = S.settings.fx();
    const m = cost.marginPct;
    const regs = cost.regulatoryCosts || [];
    const ourShare = regs.reduce((s, r) => s + (r.payer === 'us' ? n(r.amountKRW) : r.payer === 'split' ? n(r.amountKRW) / 2 : 0), 0);
    const amort = cost.amortize && n(cost.moq) > 0 ? ourShare / n(cost.moq) : 0;
    const manuf = n(plan.rawKRW) + n(plan.processKRW) + n(plan.packKRW);
    const base = manuf + amort;
    const div = p => (1 - Math.min(n(p), 99) / 100);
    const perUnitCBM = n(pk.unitsPerCarton) > 0 ? n(pk.cartonCBM) / n(pk.unitsPerCarton) : 0;
    const fobLog = perUnitCBM * n(cost.logistics.fobPerCBM);
    const freight = perUnitCBM * n(cost.logistics.freightPerCBM);
    const ins = n(cost.logistics.insurancePct) / 100;
    const logMul = 1 / div(m.logistics);

    const price = {};
    price.EXW = base / div(m.first) / div(m.sales);
    price.FOB = price.EXW + fobLog * logMul;
    price.CFR = price.FOB + freight * logMul;
    price.CIF = price.CFR * (1 + ins);
    const costAt = {
      EXW: base, FOB: base + fobLog, CFR: base + fobLog + freight,
      CIF: (base + fobLog + freight) + price.CFR * ins
    };
    const inc = cost.incoterms;
    const priceKRW = price[inc];
    const totalCost = costAt[inc];
    const unitUSD = fx.USD > 0 ? priceKRW / fx.USD : NaN;
    const perServingCount = n(product.unitsPerServing) || 1;
    const perDayCount = perServingCount * (n(product.servingsPerDay) || 1);
    const days = n(pk.countPerUnit) / perDayCount;
    return {
      plan, pk, fx, manuf, amort, ourShare, base, fobLog, freight, price, costAt, inc, priceKRW, totalCost, unitUSD,
      priceUSD: k => (fx.USD > 0 ? price[k] / fx.USD : NaN),
      days, perDayUSD: unitUSD / days, perServingUSD: unitUSD / (n(pk.countPerUnit) / perServingCount),
      marginPct: priceKRW > 0 ? (priceKRW - totalCost) / priceKRW * 100 : NaN
    };
  }

  function render(el, ctx) {
    const product = S.products.get(ctx.productId);
    if (!product) { el.innerHTML = `<div class="tab-page">${card('제품 없음', '<p>연결된 제품이 없습니다.</p>')}</div>`; return; }
    const c = S.cases.get(ctx.id);
    const cost = ensureCost(c, product);
    DASH.caseContext.save(c, { silent: true });
    const pk = packOf(cost);
    const rq = c.request || {};

    el.innerHTML = `<div class="tab-page">
      <div class="page-head">
        <div><h1>💰 원가 · 견적 ${countryBadge(c.country)}</h1><p class="muted">${esc(DASH.caseLabel(c))}</p></div>
        <div class="head-actions">
          <button class="btn" data-act="print-quote">견적서 인쇄</button>
          <button class="btn primary" data-act="to-registration">견적 합의 → 등록·신고로</button>
        </div>
      </div>
      ${S.settings.fxReady() ? '' : '<div class="banner banner-warn">환율이 입력되지 않아 USD 단가를 계산할 수 없습니다. <a href="#admin">관리자 메뉴에서 입력</a></div>'}
      <div class="grid-2">
        ${card('원가 입력 <span class="muted small">원/개 (1통·1박스 기준)</span>', `
          <div class="form-grid">
            <label class="block">인코텀즈<select data-c="incoterms">${options(INCOTERMS, cost.incoterms)}</select></label>
            <label class="block">MOQ (개)<input type="number" min="1" data-c="moq" value="${esc(cost.moq)}"></label>
          </div>
          <h4>처방안별 원가</h4>
          ${table(['처방안', '원재료', '임가공', '부자재', ''], cost.plans.map((p, i) => [
            `<input data-c="plans.${i}.name" value="${esc(p.name)}">`,
            `<input type="number" min="0" data-c="plans.${i}.rawKRW" value="${esc(p.rawKRW)}">`,
            `<input type="number" min="0" data-c="plans.${i}.processKRW" value="${esc(p.processKRW)}">`,
            `<input type="number" min="0" data-c="plans.${i}.packKRW" value="${esc(p.packKRW)}">`,
            cost.plans.length > 1 ? `<button class="icon-btn" data-act="plan-del" data-i="${i}" aria-label="삭제">✕</button>` : ''
          ]))}
          <div class="row-actions">
            <button class="btn sm" data-act="plan-add">+ 처방안</button>
            ${c.country === 'US' && rq.ndiPlan === 'both' ? '<button class="btn sm" data-act="plan-import">개발요청서의 NDI 통지안·대체 원료안 가져오기</button>' : ''}
          </div>
          <h4>마진 (%)</h4>
          <div class="form-grid three">
            <label class="block">1차 마진<input type="number" min="0" max="99" step="0.1" data-c="marginPct.first" value="${esc(cost.marginPct.first)}"></label>
            <label class="block">물류 마진<input type="number" min="0" max="99" step="0.1" data-c="marginPct.logistics" value="${esc(cost.marginPct.logistics)}"></label>
            <label class="block">영업 마진<input type="number" min="0" max="99" step="0.1" data-c="marginPct.sales" value="${esc(cost.marginPct.sales)}"></label>
          </div>
          <label class="check"><input type="checkbox" data-c="amortize"${cost.amortize ? ' checked' : ''}> 우리 부담 등록·시험 비용을 MOQ로 나눠 단가에 반영</label>`)}
        ${card('포장 · 물류 <span class="muted small">프리셋 값은 예시 — 직접 수정</span>', `
          <label class="block">포장 프리셋<select data-c="packagingPresetId" data-full="1">${options(presets().map(p => ({ value: p.id, label: p.label })), cost.packagingPresetId)}</select></label>
          <div class="form-grid three">
            <label class="block">1개당 입수<input type="number" min="1" data-c="pack.countPerUnit" value="${esc(pk.countPerUnit)}"></label>
            <label class="block">카톤당 개수<input type="number" min="1" data-c="pack.unitsPerCarton" value="${esc(pk.unitsPerCarton)}"></label>
            <label class="block">카톤 CBM<input type="number" min="0" step="0.001" data-c="pack.cartonCBM" value="${esc(pk.cartonCBM)}"></label>
          </div>
          <div class="form-grid three">
            <label class="block">FOB 비용 (원/CBM)<input type="number" min="0" data-c="logistics.fobPerCBM" value="${esc(cost.logistics.fobPerCBM)}"></label>
            <label class="block">해상 운임 (원/CBM)<input type="number" min="0" data-c="logistics.freightPerCBM" value="${esc(cost.logistics.freightPerCBM)}"></label>
            <label class="block">보험료 (%)<input type="number" min="0" step="0.01" data-c="logistics.insurancePct" value="${esc(cost.logistics.insurancePct)}"></label>
          </div>
          <div data-out="logistics"></div>`)}
      </div>
      ${card('견적 단가', '<div data-out="quote"></div>')}
      <div class="grid-2">
        ${card('등록·시험 비용 <span class="muted small">부담 주체는 견적서에 자동 포함</span>', `
          ${table(['항목', '금액 (원)', '부담', ''], cost.regulatoryCosts.map((r, i) => [
            `<input data-c="regulatoryCosts.${i}.item" value="${esc(r.item)}">`,
            `<input type="number" min="0" data-c="regulatoryCosts.${i}.amountKRW" value="${esc(r.amountKRW)}">`,
            `<select data-c="regulatoryCosts.${i}.payer">${options(PAYERS, r.payer || 'buyer')}</select>`,
            `<button class="icon-btn" data-act="reg-del" data-i="${i}" aria-label="삭제">✕</button>`
          ]), { empty: '항목이 없습니다. 국가별 추천 항목을 불러오거나 직접 추가하세요.' })}
          <div class="row-actions"><button class="btn sm" data-act="reg-add">+ 항목</button><button class="btn sm" data-act="reg-suggest">${esc(COUNTRIES[c.country].name)} 추천 항목 불러오기</button></div>
          <div data-out="regsum"></div>`)}
        ${card('수량별 단가표', `
          ${table(['수량 (개 이상)', '할인 (%)', ''], cost.tiers.map((t, i) => [
            `<input type="number" min="1" data-c="tiers.${i}.qty" value="${esc(t.qty)}">`,
            `<input type="number" min="0" max="99" step="0.1" data-c="tiers.${i}.discountPct" value="${esc(t.discountPct)}">`,
            cost.tiers.length > 1 ? `<button class="icon-btn" data-act="tier-del" data-i="${i}" aria-label="삭제">✕</button>` : ''
          ]))}
          <button class="btn sm" data-act="tier-add">+ 구간</button>
          <div data-out="tiers"></div>`)}
      </div>
      <div class="grid-2">
        ${card('환율 영향 <span class="muted small">USD 견적가 고정 시 원화 마진 변화</span>', `
          <label class="block">기준 환율 대비 <strong data-out="fxShiftLabel">${esc(cost.fxShift)}%</strong>
            <input type="range" min="-20" max="20" step="1" data-c="fxShift" value="${esc(cost.fxShift)}"></label>
          <div data-out="fx"></div>`)}
        ${card('역제안 판정', `
          <div class="form-grid">
            <label class="block">바이어 목표가 (USD/개)<input type="number" min="0" step="0.01" data-c="counterUSD" value="${esc(cost.counterUSD === null ? '' : cost.counterUSD)}"></label>
            <label class="block">최소 마진 (%)<input type="number" min="0" max="99" step="0.1" data-c="minMarginPct" value="${esc(cost.minMarginPct)}"></label>
          </div>
          <div data-out="counter"></div>`)}
      </div>
      <div class="grid-2">
        ${card('원료 대체(VE) 경고', `
          <p class="muted small">원가를 낮추려고 바꿀 원료를 체크하면 국가별 규제 영향을 보여 줍니다.</p>
          ${(product.formula || []).map(i => `<label class="check"><input type="checkbox" data-ve="${esc(i.ingredientId)}"${cost.veCandidates.includes(i.ingredientId) ? ' checked' : ''}> ${esc(S.products.ingredientName(i))}</label>`).join('')}
          <div data-out="ve"></div>`)}
        ${card('처방안·국가별 변형 원가 비교', '<div data-out="variants"></div>')}
      </div>
      ${card('영문 커버레터', `<div class="row-actions"><button class="btn sm" data-act="make-letter">커버레터 만들기</button>${cost.coverLetter ? '<button class="btn sm" data-act="copy-letter">복사</button>' : ''}</div>
        ${cost.coverLetter ? `<textarea class="cost-letter" data-c="coverLetter" rows="14">${esc(cost.coverLetter)}</textarea>` : ''}`)}
    </div>`;

    const page = el.firstElementChild;
    updateOutputs(page, c.id);
    bind(page, c.id);
  }

  // ---------- 결과 영역만 다시 그리기 ----------
  function updateOutputs(page, caseId) {
    const c = S.cases.get(caseId);
    const product = S.products.get(c.productId);
    const cost = c.cost;
    const r = compute(c, product, 0);
    const out = k => page.querySelector(`[data-out="${k}"]`);

    out('logistics').innerHTML = `<p class="muted small">1개당 CBM ${num(r.pk.unitsPerCarton ? r.pk.cartonCBM / r.pk.unitsPerCarton : 0, 5)} · FOB 비용 ${krw(r.fobLog)}/개 · 운임 ${krw(r.freight)}/개 · 1통 섭취일수 ${num(r.days, 1)}일</p>`;

    // 견적 단가: 처방안 × 인코텀즈
    const rows = cost.plans.map((p, i) => {
      const x = compute(c, product, i);
      return [`<strong>${esc(p.name)}</strong><br><span class="muted small">제조원가 ${krw(x.manuf)}${x.amort ? ` + 비용 반영 ${krw(x.amort)}` : ''}</span>`]
        .concat(INCOTERMS.map(k => `<div class="${k === cost.incoterms ? 'cost-sel' : ''}">${usd(x.priceUSD(k))}<br><span class="muted small">${krw(x.price[k])}</span></div>`));
    });
    out('quote').innerHTML = `${table(['처방안'].concat(INCOTERMS), rows)}
      <div class="cost-kpis">
        <div><span class="muted small">견적 단가 (${esc(cost.incoterms)}, ${esc(cost.plans[0].name)})</span><strong>${usd(r.unitUSD)}</strong></div>
        <div><span class="muted small">1일분 단가</span><strong>${usd(r.perDayUSD, 3)}</strong></div>
        <div><span class="muted small">1회분 단가</span><strong>${usd(r.perServingUSD, 3)}</strong></div>
        <div><span class="muted small">원가 대비 마진</span><strong>${isNaN(r.marginPct) ? '-' : num(r.marginPct, 1) + '%'}</strong></div>
      </div>
      <p class="muted small">계산: EXW = (제조원가 + 비용 반영) ÷ (1−1차 마진) ÷ (1−영업 마진) · FOB = EXW + FOB 비용 ÷ (1−물류 마진) · CFR = FOB + 운임 ÷ (1−물류 마진) · CIF = CFR × (1+보험료). 환율 ${r.fx.USD ? num(r.fx.USD, 2) + '원/USD' : '미입력'}${r.fx.date ? ' (' + esc(r.fx.date) + (r.fx.source ? ' · ' + esc(r.fx.source) : '') + ')' : ''}.</p>`;

    // 견적 결과 저장 (README 5-1 cost.quote)
    c.cost.quote = { unitPriceUSD: isNaN(r.unitUSD) ? 0 : Math.round(r.unitUSD * 10000) / 10000, perDayUSD: isNaN(r.perDayUSD) ? 0 : Math.round(r.perDayUSD * 10000) / 10000, incoterms: cost.incoterms, at: D.today() };
    c.cost.fxRate = { USD: r.fx.USD, JPY: r.fx.JPY, VND: r.fx.VND, date: r.fx.date };
    c.cost.unitCostKRW = Math.round(r.manuf);
    DASH.caseContext.save(c, { silent: true });

    // 등록 비용 합계
    const sums = { us: 0, buyer: 0, split: 0 };
    (cost.regulatoryCosts || []).forEach(x => { sums[x.payer || 'buyer'] += n(x.amountKRW); });
    out('regsum').innerHTML = `<p class="small">우리 ${krw(sums.us)} · 바이어 ${krw(sums.buyer)} · 분담 ${krw(sums.split)} → 우리 실부담 ${krw(r.ourShare)}${cost.amortize ? ` (개당 ${krw(r.amort)} 반영)` : ''}</p>`;

    // 수량별 단가
    out('tiers').innerHTML = table(['수량', '단가 (USD)', '1일분'], cost.tiers.slice().sort((a, b) => n(a.qty) - n(b.qty)).map(t => {
      const p = r.unitUSD * (1 - n(t.discountPct) / 100);
      return [`${num(t.qty)}개 이상`, usd(p), usd(p / r.days, 3)];
    }));

    // 환율 영향
    const shiftRow = s => {
      const rate = r.fx.USD * (1 + s / 100);
      const rev = r.unitUSD * rate;
      const mg = rev > 0 ? (rev - r.totalCost) / rev * 100 : NaN;
      return [`${s > 0 ? '+' : ''}${s}%`, rate ? num(rate, 2) + '원' : '-', krw(rev), isNaN(mg) ? '-' : num(mg, 1) + '%'];
    };
    const shifts = Array.from(new Set([-10, -5, 0, 5, 10, n(cost.fxShift)])).sort((a, b) => a - b);
    out('fxShiftLabel').textContent = `${n(cost.fxShift) > 0 ? '+' : ''}${n(cost.fxShift)}%`;
    out('fx').innerHTML = r.fx.USD > 0
      ? table(['환율 변화', 'USD 환율', '개당 원화 매출', '마진'], shifts.map(shiftRow)).replace(`<td>${n(cost.fxShift) > 0 ? '+' : ''}${n(cost.fxShift)}%</td>`, `<td><strong>▶ ${n(cost.fxShift) > 0 ? '+' : ''}${n(cost.fxShift)}%</strong></td>`)
      : '<p class="muted">환율을 입력하면 계산합니다.</p>';

    // 역제안
    const t = n(cost.counterUSD);
    let cHtml = '<p class="muted">바이어 목표가를 입력하세요.</p>';
    if (t > 0 && r.fx.USD > 0 && r.unitUSD > 0) {
      const rev = t * r.fx.USD;
      const mg = (rev - r.totalCost) / rev * 100;
      const minM = n(cost.minMarginPct);
      const reoffer = r.totalCost / (1 - Math.min(minM, 99) / 100) / r.fx.USD;
      if (t >= r.unitUSD) cHtml = `<div class="decision d-ok"><strong>수락 가능</strong> — 목표가 ${usd(t)} ≥ 견적가 ${usd(r.unitUSD)} (마진 ${num(mg, 1)}%)</div>`;
      else if (mg >= minM) cHtml = `<div class="decision d-mid"><strong>마진 양보로 검토</strong> — 목표가 ${usd(t)}에서 마진 ${num(mg, 1)}% (최소 ${num(minM, 1)}% 이상)</div>`;
      else cHtml = `<div class="decision d-no"><strong>불가</strong> — 목표가 ${usd(t)}에서 마진 ${num(mg, 1)}% (최소 ${num(minM, 1)}% 미만) · 재제안가 <strong>${usd(reoffer)}</strong></div>`;
      cHtml += `<p class="muted small">${esc(cost.incoterms)} 기준, 처방안 '${esc(cost.plans[0].name)}'. 판매가 기준 마진.</p>`;
    }
    out('counter').innerHTML = cHtml;

    // VE 경고
    const ve = (product.formula || []).filter(i => cost.veCandidates.includes(i.ingredientId));
    const sameProduct = S.cases.list().filter(x => x.productId === c.productId);
    out('ve').innerHTML = ve.length ? `<ul class="cost-ve">${ve.map(i => {
      const lines = sameProduct.map(x => {
        const started = S.cases.registrationStarted(x);
        let msg = '';
        if (x.country === 'VN') msg = started ? '등록 단계 이후 → 처방이 바뀌면 새 등록 필요 (VN-CHG-01)' : '등록 서류(성적서·효능 근거)를 바뀐 처방 기준으로 준비';
        if (x.country === 'US') msg = '새 원료의 NDI 해당 여부 재확인 (US-NDI-01·02)';
        if (x.country === 'JP') msg = '신고 근거 자료의 성분·함량 일치 재확인 (JP-EVD-01)';
        return `<li>${countryBadge(x.country)} ${esc(x.id)}: ${started ? badge('ACTION') : badge('REVIEW')} ${esc(msg)}</li>`;
      }).join('');
      return `<li><strong>${esc(S.products.ingredientName(i))}</strong><ul>${lines}</ul></li>`;
    }).join('')}</ul>` : '';

    // 변형 원가 비교
    const vrows = [];
    cost.plans.forEach((p, i) => { const x = compute(c, product, i); vrows.push([esc(c.id) + ' (현재)', countryBadge(c.country), esc(p.name), esc(cost.incoterms), usd(x.unitUSD), usd(x.perDayUSD, 3)]); });
    sameProduct.filter(x => x.id !== c.id && x.cost && x.cost.plans).forEach(x => {
      x.cost.plans.forEach((p, i) => { const y = compute(x, product, i); vrows.push([esc(x.id), countryBadge(x.country), esc(p.name), esc(x.cost.incoterms), usd(y.unitUSD), usd(y.perDayUSD, 3)]); });
    });
    out('variants').innerHTML = table(['건', '국가', '처방안', '조건', '단가', '1일분'], vrows) +
      (sameProduct.length === 1 ? '<p class="muted small">같은 제품의 다른 국가 건이 생기면 여기에서 나란히 비교됩니다.</p>' : '');
  }

  function setPath(obj, path, value) {
    const keys = path.split('.');
    let o = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (o[k] === undefined || o[k] === null) o[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
      o = o[k];
    }
    o[keys[keys.length - 1]] = value;
  }

  function bind(page, caseId) {
    const onEdit = e => {
      const t = e.target;
      if (t.dataset.c) {
        const c = S.cases.get(caseId);
        let v;
        if (t.type === 'checkbox') v = t.checked;
        else if (t.type === 'number' || t.type === 'range') v = t.value === '' ? null : Number(t.value);
        else v = t.value;
        setPath(c.cost, t.dataset.c, v);
        if (t.dataset.full) {
          // 프리셋을 바꾸면 수정값을 지우고 프리셋 부자재 단가를 첫 처방안에 넣는다
          c.cost.pack = {};
          const pr = presets().find(p => p.id === v);
          if (pr && c.cost.plans[0]) c.cost.plans[0].packKRW = pr.packKRW;
          DASH.caseContext.save(c);
          return;
        }
        DASH.caseContext.save(c, { silent: true });
        updateOutputs(page, caseId);
      } else if (t.dataset.ve && e.type === 'change') {
        const c = S.cases.get(caseId);
        const set = new Set(c.cost.veCandidates || []);
        if (t.checked) set.add(t.dataset.ve); else set.delete(t.dataset.ve);
        c.cost.veCandidates = Array.from(set);
        DASH.caseContext.save(c, { silent: true });
        updateOutputs(page, caseId);
      }
    };
    page.addEventListener('input', onEdit);
    page.addEventListener('change', e => { if (e.target.tagName === 'SELECT' || e.target.type === 'checkbox') onEdit(e); });

    page.addEventListener('click', e => {
      const t = e.target.closest('[data-act]');
      if (!t) return;
      const act = t.dataset.act;
      const c = S.cases.get(caseId);
      const cost = c.cost;
      const i = Number(t.dataset.i);
      if (act === 'plan-add') { cost.plans.push({ name: `처방안 ${cost.plans.length + 1}`, rawKRW: 0, processKRW: 0, packKRW: cost.plans[0].packKRW }); DASH.caseContext.save(c); }
      else if (act === 'plan-del') { cost.plans.splice(i, 1); DASH.caseContext.save(c); }
      else if (act === 'plan-import') {
        const b = cost.plans[0];
        const mk = name => Object.assign({}, b, { name });
        cost.plans = [mk('NDI 통지안'), mk('대체 원료안')];
        DASH.caseContext.save(c);
        toast('두 처방안을 만들었습니다. 각 안의 원재료 원가를 입력하세요.');
      } else if (act === 'reg-add') { cost.regulatoryCosts.push({ item: '', amountKRW: 0, payer: 'buyer' }); DASH.caseContext.save(c); }
      else if (act === 'reg-del') { cost.regulatoryCosts.splice(i, 1); DASH.caseContext.save(c); }
      else if (act === 'reg-suggest') {
        const have = new Set(cost.regulatoryCosts.map(r => r.item));
        let items = REG_COST_SUGGEST[c.country] || [];
        if (c.country === 'US' && !(c.regulatory && c.regulatory.ndiConfirmed)) items = items.filter(x => !x.startsWith('NDI'));
        items.filter(x => !have.has(x)).forEach(x => cost.regulatoryCosts.push({ item: x, amountKRW: 0, payer: 'buyer' }));
        DASH.caseContext.save(c);
        toast('추천 항목을 넣었습니다. 금액과 부담 주체를 입력하세요.');
      } else if (act === 'tier-add') { const last = cost.tiers[cost.tiers.length - 1]; cost.tiers.push({ qty: n(last && last.qty) * 2 || cost.moq, discountPct: 0 }); DASH.caseContext.save(c); }
      else if (act === 'tier-del') { cost.tiers.splice(i, 1); DASH.caseContext.save(c); }
      else if (act === 'print-quote') printQuote(c);
      else if (act === 'make-letter') { cost.coverLetter = coverLetter(c); DASH.caseContext.save(c); }
      else if (act === 'copy-letter') DASH.ui.copyText(cost.coverLetter || '');
      else if (act === 'to-registration') {
        if (['regulatory', 'request', 'cost'].includes(c.stage)) c.stage = 'registration';
        S.cases.ensureSteps(c);
        DASH.caseContext.save(c, { silent: true });
        DASH.go('registration');
      }
    });
  }

  // 견적서 조건: 등록 명의 · 서류 제공 범위 · 비용 부담
  function terms(c) {
    const buyer = S.buyers.get(c.buyerId);
    const req = DASH.engine.requiredDocs(c);
    const payerEn = { us: 'Manufacturer', buyer: 'Buyer', split: 'Shared 50:50' };
    const payerKo = { us: '우리(제조사)', buyer: '바이어', split: '분담 50:50' };
    return {
      holder: `${COUNTRIES[c.country].name} 등록·신고 명의: 현지 바이어 (${buyer ? buyer.name : '-'})`,
      holderEn: `Registration/notification holder in ${{ JP: 'Japan', VN: 'Vietnam', US: 'the U.S.' }[c.country]}: ${buyer ? buyer.name : 'the buyer'} (local holder)`,
      docs: req.map(r => r.label),
      docsEn: req.map(r => DOC_EN[r.type] || r.type),
      costs: (c.cost.regulatoryCosts || []).map(r => ({ item: r.item, amount: n(r.amountKRW), ko: payerKo[r.payer || 'buyer'], en: payerEn[r.payer || 'buyer'] }))
    };
  }

  function printQuote(c) {
    const product = S.products.get(c.productId);
    const r = compute(c, product, 0);
    const tm = terms(c);
    const cost = c.cost;
    const html = `<div class="print-doc">
      <h1>견적서 (Quotation)</h1>
      <p class="muted">${esc(c.id)} · ${esc(D.today())} · ${esc(DASH.caseLabel(c))}</p>
      <h2>1. 견적</h2>
      <table class="print-tbl"><tr><th>제품</th><th>조건</th><th>단가</th><th>1일분</th><th>MOQ</th></tr>
        <tr><td>${esc(product.name)} (${esc(r.pk.label)}, ${esc(r.pk.countPerUnit)}입)</td><td>${esc(cost.incoterms)}</td><td>${usd(r.unitUSD)}</td><td>${usd(r.perDayUSD, 3)}</td><td>${num(cost.moq)}개</td></tr></table>
      <h3>수량별 단가</h3>
      <table class="print-tbl"><tr><th>수량</th><th>단가</th></tr>${cost.tiers.slice().sort((a, b) => n(a.qty) - n(b.qty)).map(t => `<tr><td>${num(t.qty)}개 이상</td><td>${usd(r.unitUSD * (1 - n(t.discountPct) / 100))}</td></tr>`).join('')}</table>
      ${cost.plans.length > 1 ? `<h3>처방안별 단가 (${esc(cost.incoterms)})</h3><table class="print-tbl"><tr><th>처방안</th><th>단가</th></tr>${cost.plans.map((p, i) => `<tr><td>${esc(p.name)}</td><td>${usd(compute(c, product, i).unitUSD)}</td></tr>`).join('')}</table>` : ''}
      <h2>2. 등록·서류 조건</h2>
      <p><strong>등록 명의</strong> — ${esc(tm.holder)}. 우리는 처방 정보와 아래 서류를 제공합니다.</p>
      <p><strong>서류 제공 범위</strong></p><ul>${tm.docs.map(d => `<li>${esc(d)}</li>`).join('')}</ul>
      <p><strong>등록·시험 비용 부담</strong></p>
      ${tm.costs.length ? `<table class="print-tbl"><tr><th>항목</th><th>금액</th><th>부담</th></tr>${tm.costs.map(x => `<tr><td>${esc(x.item)}</td><td>${krw(x.amount)}</td><td>${esc(x.ko)}</td></tr>`).join('')}</table>` : '<p>별도 협의</p>'}
      <p class="muted small">환율 ${r.fx.USD ? num(r.fx.USD, 2) + '원/USD' : '미입력'} ${esc(r.fx.date || '')} 기준. 환율 변동 시 재견적할 수 있습니다.</p>
      <p class="print-foot">규제 관련 내용은 사전검토 결과이며 최종 판단은 규제 담당과 현지 바이어(명의자)가 합니다.</p>
    </div>`;
    DASH.ui.printHtml(html);
  }

  function coverLetter(c) {
    const product = S.products.get(c.productId);
    const buyer = S.buyers.get(c.buyerId);
    const r = compute(c, product, 0);
    const tm = terms(c);
    const cost = c.cost;
    return `Dear ${(buyer && buyer.contact && buyer.contact.name) || 'Sir/Madam'},

Please find attached our quotation for ${product.name.replace(/\s*\(가상\)/, '')} (${r.pk.countPerUnit} units per pack).

- Price: ${usd(r.unitUSD)} per pack, ${cost.incoterms} (approx. ${usd(r.perDayUSD, 3)} per day of use)
- MOQ: ${num(cost.moq)} packs
${cost.tiers.length > 1 ? '- Volume pricing: ' + cost.tiers.slice().sort((a, b) => n(a.qty) - n(b.qty)).map(t => `${num(t.qty)}+ ${usd(r.unitUSD * (1 - n(t.discountPct) / 100))}`).join(' / ') + '\n' : ''}
Registration terms:
- ${tm.holderEn}
- Documents we will provide: ${tm.docsEn.join(', ') || 'to be agreed'}
${tm.costs.length ? '- Registration/testing costs: ' + tm.costs.map(x => `${x.item} (${x.en})`).join('; ') + '\n' : ''}
The exchange rate basis is ${r.fx.USD ? num(r.fx.USD, 2) + ' KRW/USD' : 'to be confirmed'}${r.fx.date ? ' as of ' + r.fx.date : ''}.
Regulatory comments are based on our preliminary review; the final decision rests with your regulatory team.

Best regards,`;
  }

  DASH.registerTab({
    id: 'cost', icon: '💰', label: '원가', order: 40, cssClass: 'tab-cost', needsCase: true,
    render,
    summary: ctx => ({ label: '견적 단가', value: ctx.cost && ctx.cost.quote && ctx.cost.quote.unitPriceUSD ? '$' + ctx.cost.quote.unitPriceUSD.toFixed(2) : 0 })
  });
})();
