// 💰 원가 (README 7-4) — COSTD '원가·마진 시뮬레이션' 배치와 계산식을 따른다.
//   왼쪽 입력: ① 견적 조건 ② 제조원가·1차 마진 ③ 물류비(접힘) ④ 등록·시험 비용(접힘) + 현재 견적 요약
//   오른쪽 결과: [견적 계산 | 역제안 분석 | 수량별 단가 | 환율 영향] + 기준 환율
// 계산식 (COSTD margin.md 7.2):
//   P1 = Σ 항목원가/(1−1차마진_k) + 등록비 반영 · L = 개당 FOB 물류비 · P2 = P1 + L/(1−물류마진)
//   P3 = P2/(1−목표 영업마진) · P4 = P3×(1−할인)×(1+할증) · USD = P4/환율 (+ CFR·CIF 해상운임, CIF 보험 1.1×요율)
(function () {
  const DASH = window.DASH;
  const { card, esc, countryBadge, table, options, toast, krw, usd, num, badge, seg, pageHead, COUNTRIES } = DASH.ui;
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
  // 사양 변경(VE) 약식 절감 (개당, 보수적 하한) — 건기식 포장 기준
  const VE_TIPS = [
    { key: 'pack', label: '용기 변경 (병 → 파우치·PTP)', target: 'pack', krw: 30, note: '포장 사양 변경 — 안정성 시험 재확인' },
    { key: 'box', label: '단상자 생략 / 단일도수 인쇄', target: 'pack', krw: 20, note: '라벨 필수 표시 공간 확인' },
    { key: 'raw', label: '원료 등급 대체 (동등 규격 범용 원료)', target: 'raw', krw: 40, note: '국가별 규제 영향 아래 표시' }
  ];
  const TABS = [
    { value: 'quote', label: '견적 계산' }, { value: 'counter', label: '역제안 분석' },
    { value: 'tiers', label: '수량별 단가' }, { value: 'fx', label: '환율 영향' }
  ];

  const n = v => (Number(v) || 0);
  const ap = (base, pct) => base / (1 - Math.min(n(pct), 99) / 100);
  const presets = () => (window.DASH_DATA.packagingPresets || []);
  const ui = { sim: { rates: {}, ve: {} } }; // 화면에만 있는 시뮬레이션 값 (VE·마진 직접 조정)

  // ---------- 기본값 ----------
  function ensureCost(c, product) {
    const cost = c.cost = c.cost || {};
    const L = window.DASH_DATA.logisticsDefaults || { fobPerCBM_KRW: 0, freightPerCBM_KRW: {}, insurancePct: 0 };
    if (!cost.incoterms) cost.incoterms = 'FOB';
    if (!cost.moq) cost.moq = 5000;
    if (!cost.orderQty) cost.orderQty = Math.max(n(cost.moq), 10000);
    if (!cost.packagingPresetId) cost.packagingPresetId = (c.request && c.request.packagingPresetId) || FORM_PRESET[product.form] || presets()[0].id;
    cost.pack = cost.pack || {};
    const pr = presets().find(p => p.id === cost.packagingPresetId) || presets()[0];
    if (!cost.plans || !cost.plans.length) cost.plans = [{ name: '기본안', rawKRW: 0, processKRW: 0, packKRW: pr.packKRW }];
    if (cost.planIdx === undefined || !cost.plans[cost.planIdx]) cost.planIdx = 0;
    cost.itemMargin = Object.assign({ raw: 20, process: 10, pack: 15, logistics: 10 }, cost.itemMargin);
    if (cost.targetSalesPct === undefined) cost.targetSalesPct = 20;
    if (cost.minSalesPct === undefined) cost.minSalesPct = 15;
    if (cost.itemFloorPct === undefined) cost.itemFloorPct = 5;
    cost.logistics = Object.assign({ fobPerCBM: L.fobPerCBM_KRW, freightPerCBM: (L.freightPerCBM_KRW || {})[c.country] || 0, insurancePct: L.insurancePct }, cost.logistics);
    cost.regulatoryCosts = cost.regulatoryCosts || [];
    if (!cost.tiers || !cost.tiers.length) cost.tiers = [{ qty: 20000, discountPct: 3 }, { qty: 50000, discountPct: 5 }];
    if (!cost.underMoq) cost.underMoq = 'surcharge';
    if (cost.surchargePct === undefined) cost.surchargePct = 10;
    cost.extraQtys = cost.extraQtys || [3000];
    if (cost.counterUSD === undefined) cost.counterUSD = (c.request && c.request.targetPriceUSD) || null;
    cost.veIngredients = cost.veIngredients || cost.veCandidates || [];
    if (!cost.quoteStyle) cost.quoteStyle = 'combined';
    return cost;
  }

  function packOf(cost) {
    const pr = presets().find(p => p.id === cost.packagingPresetId) || presets()[0];
    return Object.assign({}, pr, cost.pack || {});
  }

  // COSTD 7.6 물류비 약식: 카톤 수 → CBM → 청구 CBM(최소 1) × 단가
  function logistics(cost, pk, qty) {
    const per = n(pk.unitsPerCarton);
    const cartons = per > 0 ? Math.ceil(n(qty) / per) : 0;
    const cbm = Math.round(cartons * n(pk.cartonCBM) * 100) / 100;
    const billed = cartons ? Math.max(1, cbm) : 0;
    return {
      cartons, cbm, billed,
      fobTotal: Math.round(billed * n(cost.logistics.fobPerCBM) / 10000) * 10000,
      freightTotal: Math.round(billed * n(cost.logistics.freightPerCBM))
    };
  }

  function discountFor(cost, qty) {
    let d = 0;
    cost.tiers.slice().sort((a, b) => n(a.qty) - n(b.qty)).forEach(t => { if (n(qty) >= n(t.qty)) d = n(t.discountPct); });
    return d;
  }

  // o: { qty, planIdx, rates, saving: {raw, pack}, logScale, incoterms }
  function forward(c, product, o) {
    o = o || {};
    const cost = c.cost;
    const pk = packOf(cost);
    const fx = S.settings.fx();
    const qty = n(o.qty !== undefined ? o.qty : cost.orderQty) || 1;
    const plan = cost.plans[o.planIdx !== undefined ? o.planIdx : cost.planIdx] || cost.plans[0];
    const rates = Object.assign({}, cost.itemMargin, o.rates || {});
    const sv = o.saving || {};
    const regs = cost.regulatoryCosts || [];
    const ourShare = regs.reduce((s, r) => s + (r.payer === 'us' ? n(r.amountKRW) : r.payer === 'split' ? n(r.amountKRW) / 2 : 0), 0);
    const amort = cost.amortize && qty > 0 ? ourShare / qty : 0;
    const raw = Math.max(0, n(plan.rawKRW) - n(sv.raw));
    const process = n(plan.processKRW);
    const pack = Math.max(0, n(plan.packKRW) - n(sv.pack));
    const C = raw + process + pack + amort;
    const items = {
      raw: { cost: raw, sup: ap(raw, rates.raw) },
      process: { cost: process, sup: ap(process, rates.process) },
      pack: { cost: pack, sup: ap(pack, rates.pack) }
    };
    const P1 = items.raw.sup + items.process.sup + items.pack.sup + amort;
    const inc = o.incoterms || cost.incoterms;
    const lg = logistics(cost, pk, qty);
    const L = inc === 'EXW' ? 0 : lg.fobTotal / qty * (o.logScale || 1);
    const Lsup = ap(L, rates.logistics);
    const P2 = P1 + Lsup;
    const P3 = ap(P2, cost.targetSalesPct);
    const under = qty < n(cost.moq);
    const blocked = under && cost.underMoq === 'reject';
    const d = discountFor(cost, qty);
    const s = under && cost.underMoq === 'surcharge' ? n(cost.surchargePct) : 0;
    const P4 = P3 * (1 - d / 100) * (1 + s / 100);
    const rate = fx.USD;
    const ins = n(cost.logistics.insurancePct) / 100;
    const freightU = (inc === 'CFR' || inc === 'CIF') && rate > 0 ? lg.freightTotal / qty / rate : 0;
    const toInc = krwFob => rate > 0 ? (krwFob / rate + freightU) * (inc === 'CIF' ? 1 + 1.1 * ins : 1) : NaN;
    const fromInc = u => ((inc === 'CIF' ? u / (1 + 1.1 * ins) : u) - freightU) * rate;
    const U = toInc(P4);
    const perDayCount = (n(product.unitsPerServing) || 1) * (n(product.servingsPerDay) || 1);
    const days = n(pk.countPerUnit) / perDayCount;
    return {
      qty, plan, rates, pk, lg, fx, rate, inc, C, amort, items, P1, L, Lsup, P2, P3, P4, d, s, under, blocked, U, freightU, toInc, fromInc,
      salesMargin: P4 > 0 ? (1 - P2 / P4) * 100 : NaN,
      firstMargin: P2 > 0 ? (1 - (C + L) / P2) * 100 : NaN,
      totalMargin: P4 > 0 ? (P4 - C - L) / P4 * 100 : NaN,
      days, perDayUSD: U / days, perServingUSD: U / (n(pk.countPerUnit) / (n(product.unitsPerServing) || 1)),
      total: U * qty
    };
  }

  // COSTD 7.3 기준가 (원화 FOB 기준)
  function priceLines(c, r) {
    const cost = c.cost;
    const floor = n(cost.itemFloorPct);
    const fr = k => Math.min(floor, n(r.rates[k]));
    const P1f = ap(r.items.raw.cost, fr('raw')) + ap(r.items.process.cost, fr('process')) + ap(r.items.pack.cost, fr('pack')) + r.amort;
    const P2f = P1f + ap(r.L, fr('logistics'));
    return { be: r.C + r.L, maxConcede: ap(P2f, cost.minSalesPct), min: ap(r.P2, cost.minSalesPct), target: ap(r.P2, cost.targetSalesPct) };
  }
  function zoneOf(T, lines) {
    if (T >= lines.target - 0.5) return { key: 'accept', label: '수락 가능', cls: 'z-accept' };
    if (T >= lines.min - 0.5) return { key: 'concede', label: '영업마진 양보', cls: 'z-concede' };
    if (T >= lines.maxConcede - 0.5) return { key: 'adjust', label: '1차·물류 마진 조정', cls: 'z-adjust' };
    return { key: 'reject', label: '마진만으로 불가', cls: 'z-reject' };
  }
  function rnr(m, cost) {
    if (isNaN(m) || m >= n(cost.targetSalesPct)) return '';
    if (m >= n(cost.minSalesPct)) return '<span class="badge cost-rnr-info">팀장 전결 가능 (승인 권장)</span>';
    return '<span class="badge v-block">본부장/임원 특별 승인 필요 (마진 방어 필수)</span>';
  }

  // ---------- 화면 ----------
  function render(el, ctx) {
    const product = S.products.get(ctx.productId);
    if (!product) { el.innerHTML = `<div class="tab-page">${card('제품 없음', '<p>연결된 제품이 없습니다.</p>')}</div>`; return; }
    const c = S.cases.get(ctx.id);
    const cost = ensureCost(c, product);
    DASH.caseContext.save(c, { silent: true });
    if (ui.caseId !== c.id) { ui.caseId = c.id; ui.sim = { rates: {}, ve: {} }; }
    const tab = DASH.store.get('ui:costTab', 'quote');
    const fx = S.settings.fx();

    el.innerHTML = `<div class="tab-page">
      ${pageHead(`💰 원가 · 마진 시뮬레이션 ${countryBadge(c.country)}`, `수량·마진으로 단가를 계산하고 바이어 역제안을 판정해요.<br><span class="muted small">${esc(DASH.caseLabel(c))}</span>`,
        `<button class="btn primary" data-act="agree">견적 합의로 표시</button>`)}
      <div class="cost-layout">
        <aside class="cost-left">${leftPanel(c, product, cost)}</aside>
        <section class="cost-right">
          <div class="card cost-bar">
            ${seg(TABS, tab, 'tab')}
            <span class="casebar-spacer"></span>
            <label class="cost-fx">기준 환율 <span class="badge b-plain" title="${esc(fx.source || '')}">${fx.fromDb ? 'DB 중간값' : '직접 입력'}${fx.date ? ' · ' + esc(fx.date) : ''}</span>
              <input type="number" min="0" step="0.1" data-fx value="${esc(fx.USD ? Math.round(fx.USD * 10) / 10 : '')}"> 원/USD</label>
            ${fx.fromDb ? '' : '<button class="link-btn" data-act="fx-reset">DB값으로</button>'}
          </div>
          ${S.settings.fxReady() ? '' : '<div class="banner banner-warn">환율이 없어 USD 단가를 계산할 수 없습니다. 위 기준 환율을 입력하세요.</div>'}
          <div class="cost-panel">${tabStatic(c, product, cost, tab)}</div>
        </section>
      </div>
    </div>`;
    const page = el.firstElementChild;
    update(page, c.id);
    bind(page, c.id);
  }

  function leftPanel(c, product, cost) {
    const plan = cost.plans[cost.planIdx];
    const rq = c.request || {};
    const pk = packOf(cost);
    const pct = (key, val, label) => `<label class="block">${esc(label)}<span class="cost-unit"><input type="number" min="0" max="99" step="0.1" data-c="${key}" value="${esc(val)}"><i>%</i></span></label>`;
    return `
      ${card('① 견적 조건', `
        <div class="form-grid">
          <label class="block">주문수량<span class="cost-unit"><input type="number" min="1" data-c="orderQty" value="${esc(cost.orderQty)}"><i>개</i></span></label>
          <label class="block">인코텀즈<select data-c="incoterms">${options(INCOTERMS, cost.incoterms)}</select></label>
          ${pct('targetSalesPct', cost.targetSalesPct, '목표 영업마진')}
          <label class="block" title="최종 판매가 기준으로 절대 밑돌면 안 되는 영업마진 한계선">최소 영업마진 (방어선)<span class="cost-unit"><input type="number" min="0" max="99" step="0.1" data-c="minSalesPct" value="${esc(cost.minSalesPct)}"><i>%</i></span></label>
        </div>`, { cls: 'cost-sticky' })}
      ${card('② 제조원가 · 1차 마진', `
        <div class="cost-plan-row">
          <select data-c="planIdx" data-full="1">${options(cost.plans.map((p, i) => ({ value: i, label: p.name })), cost.planIdx)}</select>
          <button class="btn sm" data-act="plan-add">+ 처방안</button>
          ${cost.plans.length > 1 ? '<button class="icon-btn" data-act="plan-del" aria-label="처방안 삭제">✕</button>' : ''}
        </div>
        ${c.country === 'US' && rq.ndiPlan === 'both' ? '<button class="btn sm block-btn" data-act="plan-import">개발요청서의 NDI 통지안·대체 원료안 만들기</button>' : ''}
        <label class="block">처방안 이름<input data-c="plans.${cost.planIdx}.name" value="${esc(plan.name)}"></label>
        <table class="cost-items"><thead><tr><th>항목</th><th>원가 (원/개)</th><th>1차 마진</th></tr></thead><tbody>
          <tr><td>원재료</td><td><input type="number" min="0" data-c="plans.${cost.planIdx}.rawKRW" value="${esc(plan.rawKRW)}"></td><td><input type="number" min="0" max="99" step="0.1" data-c="itemMargin.raw" value="${esc(cost.itemMargin.raw)}"></td></tr>
          <tr><td>임가공</td><td><input type="number" min="0" data-c="plans.${cost.planIdx}.processKRW" value="${esc(plan.processKRW)}"></td><td><input type="number" min="0" max="99" step="0.1" data-c="itemMargin.process" value="${esc(cost.itemMargin.process)}"></td></tr>
          <tr><td>부자재</td><td><input type="number" min="0" data-c="plans.${cost.planIdx}.packKRW" value="${esc(plan.packKRW)}"></td><td><input type="number" min="0" max="99" step="0.1" data-c="itemMargin.pack" value="${esc(cost.itemMargin.pack)}"></td></tr>
        </tbody></table>
        <div class="row-actions"><button class="btn sm" data-act="erp">ERP 연동</button><span class="muted small">ERP 원가 연동은 2단계 — 지금은 직접 입력하거나 예시 원가를 넣어요.</span></div>`)}
      <details class="card fold cost-fold"${cost.openLog ? ' open' : ''} data-fold="openLog">
        <summary class="card-head"><h3>③ 물류비</h3><span class="muted small" data-out="log-sum"></span></summary>
        <div class="card-body">
          <label class="block">단품 포장 형태<select data-c="packagingPresetId" data-full="1">${options(presets().map(p => ({ value: p.id, label: p.label })), cost.packagingPresetId)}</select></label>
          <div class="form-grid three">
            <label class="block">1개당 입수<input type="number" min="1" data-c="pack.countPerUnit" value="${esc(pk.countPerUnit)}"></label>
            <label class="block">카톤당 개수<input type="number" min="1" data-c="pack.unitsPerCarton" value="${esc(pk.unitsPerCarton)}"></label>
            <label class="block">카톤 CBM<input type="number" min="0" step="0.001" data-c="pack.cartonCBM" value="${esc(pk.cartonCBM)}"></label>
            <label class="block">내륙·통관 (원/CBM)<input type="number" min="0" data-c="logistics.fobPerCBM" value="${esc(cost.logistics.fobPerCBM)}"></label>
            <label class="block">해상 운임 (원/CBM)<input type="number" min="0" data-c="logistics.freightPerCBM" value="${esc(cost.logistics.freightPerCBM)}"></label>
            <label class="block">보험료 (%)<input type="number" min="0" step="0.01" data-c="logistics.insurancePct" value="${esc(cost.logistics.insurancePct)}"></label>
          </div>
          ${pct('itemMargin.logistics', cost.itemMargin.logistics, '물류 마진')}
          <p class="muted small" data-out="log-detail"></p>
        </div>
      </details>
      <details class="card fold cost-fold"${cost.openReg ? ' open' : ''} data-fold="openReg">
        <summary class="card-head"><h3>④ 등록·시험 비용</h3><span class="muted small" data-out="reg-sum"></span></summary>
        <div class="card-body">
          ${table(['항목', '금액 (원)', '부담', ''], cost.regulatoryCosts.map((r, i) => [
            `<input data-c="regulatoryCosts.${i}.item" value="${esc(r.item)}">`,
            `<input type="number" min="0" data-c="regulatoryCosts.${i}.amountKRW" value="${esc(r.amountKRW)}">`,
            `<select data-c="regulatoryCosts.${i}.payer">${options(PAYERS, r.payer || 'buyer')}</select>`,
            `<button class="icon-btn" data-act="reg-del" data-i="${i}" aria-label="삭제">✕</button>`
          ]), { empty: '국가별 추천 항목을 불러오거나 직접 추가하세요.' })}
          <div class="row-actions"><button class="btn sm" data-act="reg-add">+ 항목</button><button class="btn sm" data-act="reg-suggest">${esc(COUNTRIES[c.country].name)} 추천 항목</button></div>
          <label class="check"><input type="checkbox" data-c="amortize"${cost.amortize ? ' checked' : ''}> 우리 부담분을 주문수량으로 나눠 원가에 반영</label>
          <p class="muted small">부담 주체는 견적서·커버레터에 자동으로 들어가요.</p>
        </div>
      </details>
      <div class="card cost-now" data-out="now"></div>`;
  }

  // 탭별 입력 부분 (한 번만 그림) + 결과 자리(data-out)
  function tabStatic(c, product, cost, tab) {
    if (tab === 'counter') {
      return `${card('바이어 목표가 위치 및 판정 구간', `
          <div class="cost-rtop">
            <div class="cost-rtop-in">
              <label class="block">바이어 목표가 (${esc(cost.incoterms)})<span class="cost-unit"><input type="number" min="0" step="0.01" data-c="counterUSD" value="${esc(cost.counterUSD === null ? '' : cost.counterUSD)}"><i>$</i></span></label>
              <label class="block" title="원재료·임가공·부자재·물류비 각각의 1차 마진을 최대 어디까지 낮출 수 있는지">1차 마진 양보 한계치 (항목별)<span class="cost-unit"><input type="number" min="0" max="99" step="0.1" data-c="itemFloorPct" value="${esc(cost.itemFloorPct)}"><i>%</i></span></label>
            </div>
            <div class="cost-verdict" data-out="verdict"></div>
          </div>
          <div class="cost-gauge-head"><strong>가격 위치</strong><span class="cost-legend"><i class="z-reject"></i>마진만으로 불가 <i class="z-adjust"></i>1차·물류 마진 조정 <i class="z-concede"></i>영업마진 양보 <i class="z-accept"></i>수락</span></div>
          <div data-out="gauge"></div>`)}
        ${card('대응 방안 <span class="muted small">바이어에게 다시 제안할 수 있는 선택지</span>', '<div data-out="options"></div>')}
        <div class="grid-2">
          ${card('사양 변경(VE) 추천', `<p class="muted small" data-out="ve-desc"></p>
            ${VE_TIPS.map(t => `<label class="cost-ve-row"><input type="checkbox" data-ve="${t.key}"${ui.sim.ve[t.key] ? ' checked' : ''}> <span><strong>${esc(t.label)}</strong><br><span class="muted small">${esc(t.note)}</span></span><b>−${t.krw}원</b></label>`).join('')}
            <div class="cost-ve-ings"${ui.sim.ve.raw ? '' : ' hidden'}>
              <div class="muted small">대체할 원료 (국가별 규제 영향 확인)</div>
              ${(product.formula || []).map(i => `<label class="check"><input type="checkbox" data-veing="${esc(i.ingredientId)}"${cost.veIngredients.includes(i.ingredientId) ? ' checked' : ''}> ${esc(S.products.ingredientName(i))}</label>`).join('')}
              <div data-out="ve-reg"></div>
            </div>
            <p class="small" data-out="ve-sum"></p>`)}
          ${card('마진 직접 조정 <span class="muted small">조정 시 위 판정에 반영</span>', `
            ${[['raw', '원재료'], ['process', '임가공'], ['pack', '부자재'], ['logistics', '물류비']].map(([k, l]) => `<div class="cost-adj-row" data-adjrow="${k}">
              <span>${l}<br><span class="muted small" data-out="adj-${k}"></span></span>
              <span class="cost-unit"><input type="number" min="0" max="99" step="0.1" data-adj="${k}" value="${esc(ui.sim.rates[k] !== undefined ? ui.sim.rates[k] : '')}" placeholder="${esc(cost.itemMargin[k])}"><i>%</i></span></div>`).join('')}
            <div class="row-actions"><button class="btn sm" data-act="adj-reset">현재값으로</button></div>
            <p class="small" data-out="adj-sum"></p>`)}
        </div>`;
    }
    if (tab === 'tiers') {
      return `${card('MOQ · 수량 할인 구간', `
          <div class="cost-moq">
            <label class="block">MOQ<span class="cost-unit"><input type="number" min="1" data-c="moq" value="${esc(cost.moq)}"><i>개</i></span></label>
            <div class="block-like"><span class="lbl">MOQ 미만 주문</span>${seg([{ value: 'surcharge', label: '소량 할증' }, { value: 'reject', label: '주문 불가' }], cost.underMoq, 'under')}</div>
            <label class="block">할증률<span class="cost-unit"><input type="number" min="0" max="99" step="0.1" data-c="surchargePct" value="${esc(cost.surchargePct)}"${cost.underMoq === 'reject' ? ' disabled' : ''}><i>%</i></span></label>
            <label class="block">견적 수량 추가<span class="cost-add"><input type="number" min="1" data-newqty placeholder="수량"><button class="btn sm" data-act="qty-add">추가</button></span></label>
          </div>
          <div class="cost-tier-head"><strong>수량 할인 구간</strong><button class="btn sm ghost" data-act="tier-add">+ 구간 추가</button></div>
          <div class="cost-chips">${cost.tiers.map((t, i) => `<span class="cost-chip"><input type="number" min="1" data-c="tiers.${i}.qty" value="${esc(t.qty)}">개 이상 <input type="number" min="0" max="99" step="0.1" data-c="tiers.${i}.discountPct" value="${esc(t.discountPct)}">% <button class="icon-btn" data-act="tier-del" data-i="${i}" aria-label="삭제">✕</button></span>`).join('')}</div>
          <div class="cost-tier-sum" data-out="tier-sum"></div>`)}
        ${card('수량별 단가표', '<div data-out="tier-table"></div>', { actions: '<button class="btn sm" data-act="copy-pricelist">바이어용 가격표 복사</button><button class="btn sm" data-act="copy-proposal">영문 이메일 제안문 복사</button>' })}`;
    }
    if (tab === 'fx') {
      const r = forward(c, product);
      const base = r.rate || 0;
      const pay = cost.payFx || base;
      return `${card('결제 시점 환율 영향', `
          <div class="form-grid">
            <label class="block">계약 단가 (USD 고정)<span class="cost-unit"><input type="number" min="0" step="0.01" data-c="contractUSD" value="${esc(cost.contractUSD || '')}" placeholder="${esc(isNaN(r.U) ? '' : r.U.toFixed(2))}"><i>$</i></span>
              <span class="muted small">비우면 현재 견적 단가를 써요.</span></label>
            <label class="block">결제 시점 환율 <span data-out="fx-chg"></span>
              <span class="cost-add"><input type="number" min="0" step="1" data-c="payFx" value="${esc(Math.round(pay))}"><button class="btn sm" data-act="pay-reset">견적 환율로</button></span></label>
          </div>
          <input type="range" class="cost-fxrange" data-c="payFx" min="${Math.round(base * 0.85)}" max="${Math.round(base * 1.15)}" step="1" value="${esc(Math.round(pay))}">
          <div class="cost-range-ends"><span>${num(base * 0.85)}원</span><span>${num(base * 1.15)}원</span></div>
          <div data-out="fx-kpi"></div>
          <div data-out="fx-lines"></div>`)}
        ${card('환율 변동 시나리오 <span class="muted small">견적 환율 대비 ±5% · ±10%</span>', '<div data-out="fx-table"></div>')}`;
    }
    // 견적 계산
    const sub = DASH.store.get('ui:costQuoteSub', 'items');
    return `${card('', '<div data-out="quote-head"></div>', { cls: 'cost-quote' })}
      <div class="card">
        <div class="card-head">${seg([{ value: 'items', label: '항목별 원가' }, { value: 'compare', label: '처방안·국가 비교' }, { value: 'doc', label: '견적서' }], sub, 'qsub')}</div>
        <div class="card-body">${sub === 'doc' ? quoteDocStatic(cost) : `<div data-out="${sub}"></div>`}</div>
      </div>`;
  }

  function quoteDocStatic(cost) {
    return `<div class="cost-doc-opts">
        <span class="lbl">견적서 형식</span>${seg([{ value: 'combined', label: '통합형 (단가 하나)' }, { value: 'split', label: '분리형 (제품 + 물류)' }], cost.quoteStyle, 'qstyle')}
        <span class="casebar-spacer"></span>
        <button class="btn primary" data-act="print-quote">견적서 인쇄 · PDF</button>
      </div>
      <div data-out="doc"></div>
      <div class="row-actions"><button class="btn sm" data-act="make-letter">영문 커버레터 만들기</button>${cost.coverLetter ? '<button class="btn sm" data-act="copy-letter">복사</button>' : ''}</div>
      ${cost.coverLetter ? `<textarea class="cost-letter" data-c="coverLetter" rows="14">${esc(cost.coverLetter)}</textarea>` : ''}`;
  }

  // ---------- 결과 다시 그리기 ----------
  function update(page, caseId) {
    const c = S.cases.get(caseId);
    const product = S.products.get(c.productId);
    const cost = c.cost;
    const r = forward(c, product);
    const out = k => page.querySelector(`[data-out="${k}"]`);
    const set = (k, html) => { const e = out(k); if (e) e.innerHTML = html; };

    // 왼쪽 요약
    set('log-sum', r.lg.cartons ? `${num(r.lg.cbm, 2)} CBM (${num(r.lg.cartons)}박스) · ${r.inc === 'EXW' ? 'EXW · 미포함' : `개당 ${krw(r.L)}`}` : '입수·부피를 확인하세요');
    set('log-detail', `청구 CBM ${num(r.lg.billed, 2)} (LCL 최소 1) · 내륙·통관 총액 ${krw(r.lg.fobTotal)} · 해상 운임 총액 ${krw(r.lg.freightTotal)}${r.lg.cbm >= 15 ? ' · 20ft 컨테이너(FCL) 견적과 비교해 보세요.' : ''} · 1통 섭취일수 ${num(r.days, 1)}일`);
    const sums = { us: 0, buyer: 0, split: 0 };
    (cost.regulatoryCosts || []).forEach(x => { sums[x.payer || 'buyer'] += n(x.amountKRW); });
    set('reg-sum', cost.regulatoryCosts.length ? `우리 ${krw(sums.us + sums.split / 2)} · 바이어 ${krw(sums.buyer + sums.split / 2)}` : '없음');
    set('now', `<div class="muted small">현재 견적 · ${esc(r.inc)} ${num(r.qty)}개</div>
      <div class="cost-now-price">${r.blocked ? '주문 불가 (MOQ 미만)' : usd(r.U)}</div>
      <div class="small">주문 총액 ${r.blocked ? '-' : usd(r.total, 0)} · 할인 후 영업마진 ${isNaN(r.salesMargin) ? '-' : num(r.salesMargin, 1) + '%'}</div>`);

    // 견적 결과 저장 (README 5-1 cost.quote)
    c.cost.quote = { unitPriceUSD: isNaN(r.U) ? 0 : Math.round(r.U * 10000) / 10000, perDayUSD: isNaN(r.perDayUSD) ? 0 : Math.round(r.perDayUSD * 10000) / 10000, incoterms: r.inc, qty: r.qty, at: D.today() };
    c.cost.fxRate = { USD: r.fx.USD, JPY: r.fx.JPY, VND: r.fx.VND, date: r.fx.date };
    c.cost.unitCostKRW = Math.round(r.C);
    DASH.caseContext.save(c, { silent: true });

    updateQuote(set, c, product, r);
    updateCounter(page, set, c, product, r);
    updateTiers(set, c, product, r);
    updateFx(page, set, c, product, r);
  }

  function updateQuote(set, c, product, r) {
    const cost = c.cost;
    const parts = [
      { k: '원가', v: r.C, cls: 'p-cost' }, { k: '1차 마진', v: r.P1 - r.C, cls: 'p-first' },
      { k: '물류비', v: r.L, cls: 'p-log' }, { k: '물류 마진', v: r.Lsup - r.L, cls: 'p-logm' }, { k: '영업마진', v: r.P4 - r.P2, cls: 'p-sales' }
    ];
    const total = parts.reduce((s, p) => s + Math.max(0, p.v), 0) || 1;
    set('quote-head', `<div class="cost-qhead">
        <div><div class="muted small">${esc(r.inc)} 단가 · ${num(r.qty)}개 · ${esc(r.plan.name)}</div>
          <div class="cost-big">${r.blocked ? '주문 불가' : usd(r.U)}<small>/ 개</small></div></div>
        <div class="cost-qhead-r small muted">원화 ${krw(r.P4)}${r.freightU ? ` + 해상운임·보험 ${usd(r.U - r.P4 / r.rate)}` : ''}<br>주문 총액 <strong>${usd(r.total, 0)}</strong>${r.d ? ` · 할인 ${r.d}%` : ''}${r.s ? ` · 소량 할증 ${r.s}%` : ''}</div>
      </div>
      <div class="cost-stack">${parts.filter(p => p.v > 0.5).map(p => `<span class="${p.cls}" style="flex:${p.v / total}" title="${esc(p.k)} ${krw(p.v)}">${p.v / total > 0.07 ? num(p.v) : ''}</span>`).join('')}</div>
      <div class="cost-legend">${parts.map(p => `<i class="${p.cls}"></i>${esc(p.k)}`).join(' ')}</div>
      <div class="tiles">
        <div class="tile"><span class="t-label">원가</span><span class="t-value">${krw(r.C)}</span><span class="t-sub">${r.amort ? `등록비 반영 ${krw(r.amort)} 포함` : '원재료+임가공+부자재'}</span></div>
        <div class="tile"><span class="t-label">1차 마진 (물류 포함)</span><span class="t-value">${isNaN(r.firstMargin) ? '-' : num(r.firstMargin, 1) + '%'}</span><span class="t-sub">물류비 개당 ${krw(r.L)}</span></div>
        <div class="tile"><span class="t-label">할인 후 영업마진</span><span class="t-value">${isNaN(r.salesMargin) ? '-' : num(r.salesMargin, 1) + '%'}</span><span class="t-sub">목표 ${num(cost.targetSalesPct, 1)}% · 최소 ${num(cost.minSalesPct, 1)}%</span></div>
        <div class="tile"><span class="t-label">1일분 · 1회분 단가</span><span class="t-value">${usd(r.perDayUSD, 3)}</span><span class="t-sub">1회분 ${usd(r.perServingUSD, 3)} · 총 마진 ${isNaN(r.totalMargin) ? '-' : num(r.totalMargin, 1) + '%'}</span></div>
      </div>`);

    const it = r.items;
    const rows = [
      ['원재료', it.raw.cost, cost.itemMargin.raw, it.raw.sup],
      ['임가공', it.process.cost, cost.itemMargin.process, it.process.sup],
      ['부자재', it.pack.cost, cost.itemMargin.pack, it.pack.sup]
    ];
    if (r.amort) rows.push(['등록·시험 비용 반영', r.amort, 0, r.amort]);
    rows.push(['물류비 (개당)', r.L, cost.itemMargin.logistics, r.Lsup]);
    set('items', table(['항목', '원가', '마진율', '공급가', '마진'], rows.map(x => [esc(x[0]), krw(x[1]), num(x[2], 1) + '%', krw(x[3]), krw(x[3] - x[1])])
      .concat([[`<strong>합계 (영업 전 단가 P2)</strong>`, `<strong>${krw(r.C + r.L)}</strong>`, `<strong>${isNaN(r.firstMargin) ? '-' : num(r.firstMargin, 1) + '%'}</strong>`, `<strong>${krw(r.P2)}</strong>`, `<strong>${krw(r.P2 - r.C - r.L)}</strong>`]]))
      + `<p class="muted small">정가 = P2 ÷ (1 − 목표 영업마진 ${num(cost.targetSalesPct, 1)}%) = ${krw(r.P3)} → 할인·할증 반영 ${krw(r.P4)} → ÷ 환율 ${r.rate ? num(r.rate, 2) : '미입력'}원${r.freightU ? ' + 해상운임' + (r.inc === 'CIF' ? '·보험(1.1×요율)' : '') : ''}.</p>`);

    // 처방안·국가 비교
    const plans = cost.plans.map((p, i) => {
      const cells = INCOTERMS.map(k => { const x = forward(c, product, { planIdx: i, incoterms: k }); return `<span class="${k === cost.incoterms && i === cost.planIdx ? 'cost-sel' : ''}">${usd(x.U)}</span>`; });
      return [`<strong>${esc(p.name)}</strong><br><span class="muted small">원가 ${krw(forward(c, product, { planIdx: i }).C)}</span>`].concat(cells);
    });
    const same = S.cases.list().filter(x => x.productId === c.productId && x.id !== c.id && x.cost && x.cost.quote && x.cost.quote.unitPriceUSD);
    set('compare', `<h4>처방안 × 인코텀즈 (${num(r.qty)}개 기준)</h4>${table(['처방안'].concat(INCOTERMS), plans)}
      <h4>같은 제품의 다른 국가 건</h4>${same.length ? table(['건', '국가', '조건', '단가', '1일분'], same.map(x => [esc(x.id), countryBadge(x.country), esc(`${x.cost.quote.incoterms} ${num(x.cost.quote.qty || 0)}개`), usd(x.cost.quote.unitPriceUSD), usd(x.cost.quote.perDayUSD, 3)])) : '<p class="muted small">같은 제품으로 견적을 낸 다른 국가 건이 없어요.</p>'}`);

    // 견적서 미리보기
    const tm = terms(c);
    set('doc', `<div class="cost-doc">
      <div class="cost-doc-head"><strong>QUOTATION</strong><span class="muted small">${esc(D.today())} · Validity 30 days</span></div>
      ${table(['Description', "Q'ty", `Unit price (${r.inc})`, 'Amount'], quoteLines(c, product, r).map(l => [esc(l.desc), esc(l.qty), l.unit, l.amount]))}
      <p class="small"><strong>Terms</strong> ${esc(r.inc)} · MOQ ${num(cost.moq)} · ${esc(tm.holderEn)}</p>
      <p class="small"><strong>서류 제공 범위</strong> ${esc(tm.docs.join(', ') || '-')}</p>
      <p class="small"><strong>등록·시험 비용 부담</strong> ${esc(tm.costs.map(x => `${x.item}(${x.ko})`).join(', ') || '별도 협의')}</p></div>`);
  }

  function quoteLines(c, product, r) {
    const name = `${product.name.replace(/\s*\(가상\)/, '')} (${r.pk.countPerUnit} units/pack)`;
    if (c.cost.quoteStyle === 'split' && r.inc !== 'EXW' && r.rate) {
      // 영업마진·할인은 제품·물류에 같은 비율로 나눠 싣는다. 해상운임·보험은 물류 줄에 넣는다.
      const prodU = r.P1 * (r.P4 / r.P2) / r.rate;
      const logU = r.U - prodU;
      return [
        { desc: name + ' (EXW)', qty: num(r.qty) + ' pcs', unit: usd(prodU), amount: usd(prodU * r.qty) },
        { desc: `Logistics to ${r.inc} point`, qty: '1 lot', unit: '', amount: usd(logU * r.qty) },
        { desc: 'Total', qty: '', unit: '', amount: `<strong>${usd(r.total)}</strong>` }
      ];
    }
    return [{ desc: name, qty: num(r.qty) + ' pcs', unit: usd(r.U), amount: `<strong>${usd(r.total)}</strong>` }];
  }

  function veSaving(product, cost) {
    const sv = { raw: 0, pack: 0 };
    VE_TIPS.forEach(t => { if (ui.sim.ve[t.key]) sv[t.target] += t.krw; });
    return sv;
  }

  function updateCounter(page, set, c, product, r) {
    if (!page.querySelector('[data-out="verdict"]')) return;
    const cost = c.cost;
    const t = n(cost.counterUSD);
    const sv = veSaving(product, cost);
    const simOn = Object.keys(ui.sim.rates).some(k => ui.sim.rates[k] !== '' && ui.sim.rates[k] !== undefined) || sv.raw || sv.pack;
    const rs = simOn ? forward(c, product, { rates: cleanRates(), saving: sv }) : r;
    const L0 = priceLines(c, r);
    const L1 = priceLines(c, rs);
    if (!(r.rate > 0) || !(r.P2 > 0)) {
      set('verdict', '<p class="muted">원가와 환율을 먼저 입력하세요.</p>');
      set('gauge', ''); set('options', ''); return;
    }
    if (!(t > 0)) {
      set('verdict', '<p class="muted">바이어 목표가를 입력하면 판정해요.</p>');
    } else {
      const T = r.fromInc(t);
      const z0 = zoneOf(T, L0);
      const z1 = zoneOf(T, L1);
      const m0 = (1 - r.P2 / T) * 100;
      const m1 = (1 - rs.P2 / T) * 100;
      const gap = rs.P2 - T * (1 - n(cost.minSalesPct) / 100);
      set('verdict', `<div class="cost-verdict-badges">${simOn && z0.key !== z1.key ? `<span class="badge ${z0.cls}">${z0.label}</span> → ` : ''}<span class="badge ${z1.cls}">${z1.label}</span> ${rnr(m1, cost)}</div>
        <div class="cost-verdict-main">영업마진 ${simOn ? `${num(m0, 1)}% → ` : ''}<strong>${num(m1, 1)}%</strong>
          <span class="${gap > 0 ? 'cost-short' : 'cost-ok'}">${num(Math.abs(gap))}원 ${gap > 0 ? '부족' : '여유'}</span></div>
        <div class="muted small">${simOn ? `VE −${num(sv.raw + sv.pack)}원 · 마진 조정 적용 · 최소 영업마진을 지키는 단가 ${usd(rs.toInc(L1.min))}` : z1.key === 'concede' ? `최소 영업마진(${num(cost.minSalesPct, 1)}%)은 지켜요. 1차·물류 마진은 그대로예요.` : z1.key === 'adjust' ? '영업마진만으로는 부족해요. 1차·물류 마진을 양보 한계치 안에서 낮춰야 해요.' : z1.key === 'reject' ? '마진 조정만으로 맞출 수 없어요. 재역제안·사양 변경(VE)·수량 유도를 검토하세요.' : '목표 영업마진을 지켜요.'}</div>`);
    }
    // 게이지
    const pts = [
      { k: '손익분기', v: rs.toInc(L1.be) }, { k: '최대 양보가', v: rs.toInc(L1.maxConcede) },
      { k: '최소 마진가', v: rs.toInc(L1.min) }, { k: '목표 마진가', v: rs.toInc(L1.target) }
    ];
    const lo = Math.min(pts[0].v, t > 0 ? t : Infinity);
    const hi = Math.max(pts[3].v * 1.04, t > 0 ? t * 1.02 : 0);
    const pos = v => Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100));
    const segs = [
      { from: lo, to: pts[0].v, cls: 'is-loss' }, { from: pts[0].v, to: pts[1].v, cls: 'z-reject' }, { from: pts[1].v, to: pts[2].v, cls: 'z-adjust' },
      { from: pts[2].v, to: pts[3].v, cls: 'z-concede' }, { from: pts[3].v, to: hi, cls: 'z-accept' }
    ].filter(s => s.to > s.from);
    set('gauge', `<div class="cost-gauge">
        <div class="cost-gauge-bar">${segs.map(s => `<span class="${s.cls}" style="left:${pos(s.from)}%;width:${pos(s.to) - pos(s.from)}%"></span>`).join('')}
          ${t > 0 ? `<span class="cost-pin" style="left:${pos(t)}%"><em>바이어 ${usd(t)}</em></span>` : ''}</div>
        <div class="cost-gauge-ticks">${pts.map(p => `<span style="left:${pos(p.v)}%"><b>${usd(p.v)}</b>${esc(p.k)}</span>`).join('')}</div>
      </div>${simOn ? `<p class="muted small">VE·마진 조정 적용 후 기준선 (적용 전 최소 마진가 ${usd(r.toInc(L0.min))})</p>` : ''}`);

    // 대응 방안
    const opts = [];
    opts.push({ t: '재역제안', v: usd(r.toInc(L0.min)), d: '1차·물류 마진은 그대로, 영업마진만 최소선까지 양보', hi: t > 0 && r.fromInc(t) < L0.min });
    if (t > 0) {
      const T = r.fromInc(t);
      const common = (1 - (r.C + r.L) / (T * (1 - n(cost.minSalesPct) / 100))) * 100;
      opts.push(isFinite(common) && common >= 0
        ? { t: '1차·물류 마진 일괄', v: num(common, 1) + '%', d: `${usd(t)}에서 영업마진 ${num(cost.minSalesPct, 1)}%를 지키는 공통 마진율` }
        : { t: '1차·물류 마진 일괄', v: '불가', d: `${usd(t)}에서는 1차·물류 마진을 0%로 해도 영업마진 ${num(cost.minSalesPct, 1)}%를 지킬 수 없어요` });
    }
    if (r.inc !== 'EXW') opts.push({ t: 'EXW로 전환', v: usd(forward(c, product, { incoterms: 'EXW' }).U), d: '물류비·물류 마진을 빼고 바이어가 운송' });
    const next = cost.tiers.slice().sort((a, b) => n(a.qty) - n(b.qty)).find(x => n(x.qty) > r.qty);
    if (next) { const x = forward(c, product, { qty: n(next.qty), logScale: 0.85 }); opts.push({ t: `${num(next.qty)}개 유도`, v: usd(x.U), d: `할인 ${num(next.discountPct, 1)}% 적용, 영업마진 ${num(x.salesMargin, 1)}% · 물류비는 수량 비례의 85% 가정` }); }
    set('options', `<div class="cost-opts">${opts.map(o => `<div class="cost-opt${o.hi ? ' hi' : ''}"><span class="muted small">${esc(o.t)}</span><strong>${o.v}</strong><span class="small muted">${esc(o.d)}</span></div>`).join('')}</div>`);

    // VE
    const zr = t > 0 ? zoneOf(r.fromInc(t), L0).key : '';
    set('ve-desc', zr === 'adjust' || zr === 'reject' ? '마진만으로 맞추기 어려워요. 체크하면 위 판정에 반영돼요.' : '지금은 마진만으로 대응 가능해요. 체크하면 위 판정에 반영돼요.');
    set('ve-sum', sv.raw + sv.pack ? `선택 절감 개당 −${num(sv.raw + sv.pack)}원 · 주문 전체 약 −${krw((sv.raw + sv.pack) * r.qty)} (약식 추정, 공급사 확인 필요)` : '<span class="muted">선택한 사양 변경 없음</span>');
    const ve = (product.formula || []).filter(i => cost.veIngredients.includes(i.ingredientId));
    const sameProduct = S.cases.list().filter(x => x.productId === c.productId);
    set('ve-reg', ve.length ? `<ul class="cost-ve">${ve.map(i => `<li><strong>${esc(S.products.ingredientName(i))}</strong><ul>${sameProduct.map(x => {
      const started = S.cases.registrationStarted(x);
      const msg = x.country === 'VN' ? (started ? '바이어 등록 진행 중 → 처방이 바뀌면 새 등록 필요 (VN-CHG-01)' : '등록 서류(성적서·효능 근거)를 바뀐 처방 기준으로 준비')
        : x.country === 'US' ? '새 원료의 NDI 해당 여부 재확인 (US-NDI-01·02)' : '신고 근거 자료의 성분·함량 일치 재확인 (JP-EVD-01)';
      return `<li>${countryBadge(x.country)} ${esc(x.id)}: ${started ? badge('ACTION') : badge('REVIEW')} ${esc(msg)}</li>`;
    }).join('')}</ul></li>`).join('')}</ul>` : '');

    // 마진 직접 조정 요약
    ['raw', 'process', 'pack', 'logistics'].forEach(k => {
      const v = ui.sim.rates[k];
      const changed = v !== undefined && v !== '';
      const row = page.querySelector(`[data-adjrow="${k}"]`);
      if (row) row.classList.toggle('is-changed', changed);
      let diff = 0;
      if (changed) { const x = forward(c, product, { rates: { [k]: Number(v) } }); diff = x.P2 - r.P2; }
      set('adj-' + k, `현재 ${num(cost.itemMargin[k], 1)}%${changed ? ` · ${diff < 0 ? '−' : '+'}${num(Math.abs(diff))}원` : ' · 변경 없음'}`);
    });
    const anyAdj = Object.values(ui.sim.rates).some(v => v !== '' && v !== undefined);
    set('adj-sum', anyAdj ? (() => { const x = forward(c, product, { rates: cleanRates() }); return `조정 합계 ${x.P2 - r.P2 < 0 ? '−' : '+'}${num(Math.abs(x.P2 - r.P2))}원 · 조정안의 최소 마진 단가 ${usd(x.toInc(ap(x.P2, cost.minSalesPct)))}`; })() : '<span class="muted">마진 조정 없음</span>');
  }
  function cleanRates() {
    const o = {};
    Object.keys(ui.sim.rates).forEach(k => { const v = ui.sim.rates[k]; if (v !== '' && v !== undefined && !isNaN(Number(v))) o[k] = Number(v); });
    return o;
  }

  function tierQtys(cost) {
    const set = new Set([n(cost.moq), n(cost.orderQty)].concat(cost.tiers.map(t => n(t.qty))).concat((cost.extraQtys || []).map(n)));
    return Array.from(set).filter(q => q > 0).sort((a, b) => a - b);
  }

  function updateTiers(set, c, product, r) {
    const cost = c.cost;
    const rows = tierQtys(cost).map(q => ({ q, x: forward(c, product, { qty: q }) }));
    const ok = rows.filter(o => !o.x.blocked);
    if (!rows.length || !(r.rate > 0)) { set('tier-table', '<p class="muted">원가와 환율을 입력하세요.</p>'); return; }
    const min = Math.min.apply(null, ok.map(o => o.x.U));
    const max = Math.max.apply(null, ok.map(o => o.x.U));
    const w = u => max > min ? 35 + (u - min) / (max - min) * 65 : 100;
    const mbadge = m => `<span class="badge ${m >= n(cost.targetSalesPct) - 0.05 ? 'cost-m-ok' : m >= n(cost.minSalesPct) - 0.05 ? 'v-review' : 'v-block'}">${num(m, 1)}%</span>`;
    set('tier-table', `<p class="muted small">영업마진 배지 기준 · 목표 ${num(cost.targetSalesPct, 1)}% · 최소 ${num(cost.minSalesPct, 1)}%</p>
      <div class="table-wrap"><table class="tbl cost-qtable"><thead><tr><th>수량</th><th>물류비 총액</th><th>${esc(r.inc)} 단가</th><th>영업마진</th><th>1일분</th><th></th></tr></thead><tbody>
      ${rows.map(({ q, x }) => {
        const cur = q === n(cost.orderQty);
        const extraIdx = (cost.extraQtys || []).map(n).indexOf(q);
        return `<tr class="${cur ? 'is-cur' : ''}">
          <td><strong>${num(q)}개</strong>${q === n(cost.moq) ? ' <span class="badge b-wait">MOQ</span>' : ''}${cur ? ' <span class="badge b-plain">현재 주문</span>' : ''}</td>
          <td>${krw(x.lg.fobTotal)}<br><span class="muted small">개당 ${krw(x.L)}</span></td>
          <td>${x.blocked ? '<span class="muted">주문 불가</span>' : `<div class="cost-qbar"><span class="${x.under ? 'is-hatch' : cur ? 'is-cur' : 'is-other'}" style="width:${w(x.U)}%"></span><b>${usd(x.U)}</b></div>
            <span class="muted small">${x.d ? `할인 −${x.d}%` : x.s ? `할증 +${x.s}%` : '정가'} · 총 ${usd(x.total, 0)}</span>`}</td>
          <td>${x.blocked ? '-' : mbadge(x.salesMargin)}</td>
          <td>${x.blocked ? '-' : usd(x.perDayUSD, 3)}</td>
          <td>${extraIdx >= 0 ? `<button class="icon-btn" data-act="qty-del" data-i="${extraIdx}" aria-label="삭제">✕</button>` : ''}</td>
        </tr>`;
      }).join('')}</tbody></table></div>`);
    const moqRow = rows.find(o => o.q === n(cost.moq));
    const best = ok.reduce((a, b) => (a && a.x.U <= b.x.U ? a : b), null);
    set('tier-sum', moqRow && best && !moqRow.x.blocked ? `MOQ ${num(cost.moq)}개부터 ${usd(moqRow.x.U)} · ${num(best.q)}개면 ${usd(best.x.U)} — MOQ 단가보다 ${num((1 - best.x.U / moqRow.x.U) * 100, 1)}% 낮고 할인 후 영업마진 ${num(best.x.salesMargin, 1)}%` : '');
  }

  function updateFx(page, set, c, product, r) {
    if (!page.querySelector('[data-out="fx-kpi"]')) return;
    const cost = c.cost;
    const base = r.rate;
    if (!(base > 0) || !(r.P2 > 0)) { set('fx-kpi', '<p class="muted">원가와 환율을 입력하세요.</p>'); return; }
    const pay = n(cost.payFx) || base;
    const contract = n(cost.contractUSD) || r.U;
    const fobU = r.fromInc(contract) / base; // 기준 환율로 FOB 달러 단가 환산
    const rev = f => fobU * f;
    const m2 = f => (1 - r.P2 / rev(f)) * 100;
    const lineFx = pct => r.P2 / (1 - pct / 100) / fobU;
    const zone = m => m >= n(cost.targetSalesPct) - 0.05 ? ['목표 마진 유지', 'cost-m-ok'] : m >= n(cost.minSalesPct) - 0.05 ? ['최소 마진 이상', 'v-review'] : m >= 0 ? ['최소 마진 미달', 'v-action'] : ['영업 손실', 'v-block'];
    const m = m2(pay);
    const z = zone(m);
    const pnl = (rev(pay) - rev(base)) * r.qty;
    const need = (r.P2 / (1 - n(cost.targetSalesPct) / 100) / pay + r.freightU) * (r.inc === 'CIF' ? 1 + 1.1 * n(cost.logistics.insurancePct) / 100 : 1);
    const chg = (pay / base - 1) * 100;
    set('fx-chg', `<span class="${chg < 0 ? 'cost-down' : 'cost-up'}">${chg < 0 ? '▼' : '▲'} ${num(Math.abs(chg), 1)}%</span>`);
    const range = page.querySelector('.cost-fxrange');
    if (range) {
      const lo = Number(range.min), hi = Number(range.max);
      const p = v => Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100));
      range.style.setProperty('--fx-bg', `linear-gradient(90deg, #F97066 0%, #F97066 ${p(lineFx(cost.minSalesPct))}%, #FDB022 ${p(lineFx(cost.minSalesPct))}%, #FDB022 ${p(lineFx(cost.targetSalesPct))}%, #84ADFF ${p(lineFx(cost.targetSalesPct))}%, #84ADFF 100%)`);
    }
    set('fx-kpi', `<div class="tiles cost-fx-tiles">
        <div class="tile"><span class="t-label">실현 영업마진</span><span class="t-value">${num(m, 1)}%</span><span class="t-sub"><span class="badge ${z[1]}">${z[0]}</span></span></div>
        <div class="tile"><span class="t-label">환차손익 (주문 전체)</span><span class="t-value ${pnl < 0 ? 'cost-down' : pnl > 0 ? 'cost-up' : ''}">${pnl > 0 ? '▲ +' : pnl < 0 ? '▼ −' : '±'}${krw(Math.abs(pnl))}</span><span class="t-sub">견적 환율 대비 개당 ${krw(Math.abs(rev(pay) - rev(base)))}</span></div>
        <div class="tile"><span class="t-label">방어 단가</span><span class="t-value">${usd(need)}</span><span class="t-sub">${need <= contract + 0.005 ? '현재 단가로 달성' : `목표 마진 ${num(cost.targetSalesPct, 1)}% 유지 · 현재보다 +${usd(need - contract)}`}</span></div>
      </div>`);
    const chip = (label, v, cls) => `<span class="cost-fxchip"><i class="${cls}"></i>${label} <strong${v > base ? ' class="cost-down"' : ''}>${num(v)}원</strong></span>`;
    set('fx-lines', `<div class="cost-fxchips"><span class="muted small">마지노선 환율</span>
      ${chip('손익분기', (r.C + r.L) / fobU, 'z-reject')}${chip(`최소 마진(${num(cost.minSalesPct, 0)}%)`, lineFx(cost.minSalesPct), 'z-adjust')}${chip(`목표 마진(${num(cost.targetSalesPct, 0)}%)`, lineFx(cost.targetSalesPct), 'z-accept')}</div>`);
    const rows = [-10, -5, 0, 5, 10].map(s => {
      const f = base * (1 + s / 100);
      const mm = m2(f);
      const zz = zone(mm);
      return [s === 0 ? '<strong>견적</strong>' : `${s > 0 ? '+' : ''}${s}%`, num(f), krw(rev(f)), `<span class="badge ${zz[1]}">${num(mm, 1)}%</span>`, krw((rev(f) - r.P2) * r.qty)];
    });
    set('fx-table', table(['변동', '환율', '개당 원화', '영업마진', '주문 영업이익'], rows) + `<p class="muted small">주문 ${num(r.qty)}개 · 계약 단가 ${usd(contract)} (${esc(r.inc)}) 기준. 환율은 참고용 중간값 — 견적 확정 전 은행 고시 환율로 다시 확인하세요.</p>`);
  }

  // ---------- 입력 ----------
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
      if (t.dataset.fx !== undefined) {
        if (e.type !== 'change') return;
        const v = Number(t.value);
        if (!(v > 0)) { toast('USD 환율을 입력하세요.', 'warn'); return; }
        const cur = S.settings.fx();
        S.settings.setFx({ USD: v, JPY: cur.JPY, VND: cur.VND, date: D.today(), source: '직접 입력 (원가 탭)' });
        DASH.refresh();
        return;
      }
      if (t.dataset.adj) { ui.sim.rates[t.dataset.adj] = t.value; update(page, caseId); return; }
      if (t.dataset.ve) {
        ui.sim.ve[t.dataset.ve] = t.checked;
        if (t.dataset.ve === 'raw') page.querySelector('.cost-ve-ings').hidden = !t.checked;
        update(page, caseId); return;
      }
      if (t.dataset.veing) {
        const c = S.cases.get(caseId);
        const s = new Set(c.cost.veIngredients || []);
        if (t.checked) s.add(t.dataset.veing); else s.delete(t.dataset.veing);
        c.cost.veIngredients = Array.from(s);
        DASH.caseContext.save(c, { silent: true });
        update(page, caseId); return;
      }
      if (!t.dataset.c) return;
      const c = S.cases.get(caseId);
      let v;
      if (t.type === 'checkbox') v = t.checked;
      else if (t.type === 'number' || t.type === 'range') v = t.value === '' ? null : Number(t.value);
      else v = t.value;
      if (t.dataset.c === 'planIdx') v = Number(v);
      setPath(c.cost, t.dataset.c, v);
      if (t.dataset.c === 'packagingPresetId') {
        c.cost.pack = {};
        const pr = presets().find(p => p.id === v);
        if (pr && c.cost.plans[c.cost.planIdx]) c.cost.plans[c.cost.planIdx].packKRW = pr.packKRW;
      }
      if (t.dataset.full) { DASH.caseContext.save(c); return; }
      DASH.caseContext.save(c, { silent: true });
      if (t.dataset.c === 'payFx') page.querySelectorAll('[data-c="payFx"]').forEach(x => { if (x !== t) x.value = t.value; });
      if (t.dataset.c.startsWith('plans.') && t.dataset.c.endsWith('.name') && e.type === 'change') { DASH.caseContext.save(c); return; }
      update(page, caseId);
    };
    page.addEventListener('input', onEdit);
    page.addEventListener('change', e => { if (e.target.tagName === 'SELECT' || e.target.type === 'checkbox' || e.target.dataset.fx !== undefined || (e.target.dataset.c || '').endsWith('.name')) onEdit(e); });

    page.addEventListener('toggle', e => {
      const d = e.target;
      if (!d.dataset || !d.dataset.fold) return;
      const c = S.cases.get(caseId);
      c.cost[d.dataset.fold] = d.open;
      DASH.caseContext.save(c, { silent: true });
    }, true);

    page.addEventListener('click', e => {
      const t = e.target.closest('[data-act]');
      if (!t) return;
      const act = t.dataset.act;
      const c = S.cases.get(caseId);
      const cost = c.cost;
      const product = S.products.get(c.productId);
      const i = Number(t.dataset.i);
      if (act === 'tab') { DASH.store.set('ui:costTab', t.dataset.v); DASH.refresh(); }
      else if (act === 'qsub') { DASH.store.set('ui:costQuoteSub', t.dataset.v); DASH.refresh(); }
      else if (act === 'qstyle') { cost.quoteStyle = t.dataset.v; DASH.caseContext.save(c); }
      else if (act === 'under') { cost.underMoq = t.dataset.v; DASH.caseContext.save(c); }
      else if (act === 'fx-reset') { S.settings.resetFx(); toast('DB 기준 환율을 사용합니다.'); DASH.refresh(); }
      else if (act === 'pay-reset') { cost.payFx = null; DASH.caseContext.save(c); }
      else if (act === 'plan-add') { const b = cost.plans[cost.planIdx]; cost.plans.push({ name: `처방안 ${cost.plans.length + 1}`, rawKRW: b.rawKRW, processKRW: b.processKRW, packKRW: b.packKRW }); cost.planIdx = cost.plans.length - 1; DASH.caseContext.save(c); }
      else if (act === 'plan-del') { cost.plans.splice(cost.planIdx, 1); cost.planIdx = 0; DASH.caseContext.save(c); }
      else if (act === 'plan-import') {
        const b = cost.plans[cost.planIdx];
        cost.plans = [Object.assign({}, b, { name: 'NDI 통지안' }), Object.assign({}, b, { name: '대체 원료안' })];
        cost.planIdx = 0;
        DASH.caseContext.save(c);
        toast('두 처방안을 만들었어요. 각 안의 원재료 원가를 입력하세요.');
      } else if (act === 'erp') {
        DASH.ui.confirmBox('ERP 원가 연동은 2단계(서버)에서 붙습니다. 지금은 화면 확인용 예시 원가(원재료 1,200원 · 임가공 450원 · 부자재는 포장 프리셋 값)를 넣을까요?', () => {
          const cur = S.cases.get(caseId);
          const p = cur.cost.plans[cur.cost.planIdx];
          p.rawKRW = 1200; p.processKRW = 450; p.packKRW = packOf(cur.cost).packKRW;
          DASH.caseContext.save(cur);
          toast('예시 원가를 넣었어요. 실제 원가로 바꿔 쓰세요.', 'warn');
        }, '예시 원가 넣기');
      } else if (act === 'reg-add') { cost.regulatoryCosts.push({ item: '', amountKRW: 0, payer: 'buyer' }); cost.openReg = true; DASH.caseContext.save(c); }
      else if (act === 'reg-del') { cost.regulatoryCosts.splice(i, 1); DASH.caseContext.save(c); }
      else if (act === 'reg-suggest') {
        const have = new Set(cost.regulatoryCosts.map(r => r.item));
        let items = REG_COST_SUGGEST[c.country] || [];
        if (c.country === 'US' && !(c.regulatory && c.regulatory.ndiConfirmed)) items = items.filter(x => !x.startsWith('NDI'));
        items.filter(x => !have.has(x)).forEach(x => cost.regulatoryCosts.push({ item: x, amountKRW: 0, payer: 'buyer' }));
        cost.openReg = true;
        DASH.caseContext.save(c);
        toast('추천 항목을 넣었어요. 금액과 부담 주체를 입력하세요.');
      } else if (act === 'tier-add') {
        const last = cost.tiers.slice().sort((a, b) => n(a.qty) - n(b.qty)).pop();
        cost.tiers.push({ qty: last ? n(last.qty) * 2 : n(cost.moq) * 2, discountPct: last ? n(last.discountPct) + 2 : 2 });
        DASH.caseContext.save(c);
      } else if (act === 'tier-del') { cost.tiers.splice(i, 1); DASH.caseContext.save(c); }
      else if (act === 'qty-add') {
        const v = n(page.querySelector('[data-newqty]').value);
        if (!(v > 0)) { toast('수량을 입력하세요.', 'warn'); return; }
        cost.extraQtys = (cost.extraQtys || []).concat([v]);
        DASH.caseContext.save(c);
      } else if (act === 'qty-del') { cost.extraQtys.splice(i, 1); DASH.caseContext.save(c); }
      else if (act === 'adj-reset') { ui.sim.rates = {}; page.querySelectorAll('[data-adj]').forEach(x => { x.value = ''; }); update(page, caseId); }
      else if (act === 'copy-pricelist') DASH.ui.copyText(priceList(c, product));
      else if (act === 'copy-proposal') DASH.ui.copyText(coverLetter(c));
      else if (act === 'print-quote') printQuote(c);
      else if (act === 'make-letter') { cost.coverLetter = coverLetter(c); DASH.caseContext.save(c); }
      else if (act === 'copy-letter') DASH.ui.copyText(cost.coverLetter || '');
      else if (act === 'agree') {
        DASH.ui.confirmBox('이 건을 견적 합의로 표시할까요? 이후 처방을 바꾸면 처방 변경 경고가 기록됩니다 (현지 등록·신고는 바이어가 진행).', () => {
          const cur = S.cases.get(caseId);
          cur.stage = 'agreed';
          DASH.caseContext.save(cur);
          toast('견적 합의로 표시했어요.');
        }, '표시');
      }
    });
  }

  // ---------- 견적서 · 문구 ----------
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

  function priceList(c, product) {
    const cost = c.cost;
    const lines = tierQtys(cost).map(q => forward(c, product, { qty: q })).filter(x => !x.blocked)
      .map(x => `${num(x.qty)} pcs+\t${usd(x.U)} / pack (${x.inc})`);
    return `${product.name.replace(/\s*\(가상\)/, '')} — Price list (${D.today()})\n${lines.join('\n')}\nMOQ ${num(cost.moq)} pcs${cost.underMoq === 'surcharge' ? ` (below MOQ: +${cost.surchargePct}%)` : ''}`;
  }

  function printQuote(c) {
    const product = S.products.get(c.productId);
    const r = forward(c, product);
    const tm = terms(c);
    const cost = c.cost;
    const buyer = S.buyers.get(c.buyerId);
    const html = `<div class="print-doc">
      <h1>QUOTATION</h1>
      <p class="muted">${esc(c.id)} · ${esc(D.today())} · Valid 30 days · To: ${esc(buyer ? buyer.name : '-')}</p>
      <table class="print-tbl"><tr><th>Description</th><th>Q'ty</th><th>Unit price (${esc(r.inc)})</th><th>Amount</th></tr>
        ${quoteLines(c, product, r).map(l => `<tr><td>${esc(l.desc)}</td><td>${esc(l.qty)}</td><td>${l.unit}</td><td>${l.amount}</td></tr>`).join('')}</table>
      <p>Approx. ${usd(r.perDayUSD, 3)} per day of use · MOQ ${num(cost.moq)} pcs</p>
      <h3>Volume pricing</h3>
      <table class="print-tbl"><tr><th>Quantity</th><th>Unit price</th></tr>${tierQtys(cost).map(q => forward(c, product, { qty: q })).filter(x => !x.blocked).map(x => `<tr><td>${num(x.qty)}+</td><td>${usd(x.U)}</td></tr>`).join('')}</table>
      <h2>등록·서류 조건</h2>
      <p><strong>등록 명의</strong> — ${esc(tm.holder)}. 우리는 처방 정보와 아래 서류를 제공합니다.</p>
      <p><strong>서류 제공 범위</strong></p><ul>${tm.docs.map(d => `<li>${esc(d)}</li>`).join('')}</ul>
      <p><strong>등록·시험 비용 부담</strong></p>
      ${tm.costs.length ? `<table class="print-tbl"><tr><th>항목</th><th>금액</th><th>부담</th></tr>${tm.costs.map(x => `<tr><td>${esc(x.item)}</td><td>${krw(x.amount)}</td><td>${esc(x.ko)}</td></tr>`).join('')}</table>` : '<p>별도 협의</p>'}
      <p class="muted small">환율 ${r.rate ? num(r.rate, 2) + '원/USD' : '미입력'} ${esc(r.fx.date || '')} 기준. 환율 변동 시 재견적할 수 있습니다.</p>
      <p class="print-foot">규제 관련 내용은 사전검토 결과이며 최종 판단은 규제 담당과 현지 바이어(명의자)가 합니다.</p>
    </div>`;
    DASH.ui.printHtml(html);
  }

  function coverLetter(c) {
    const product = S.products.get(c.productId);
    const buyer = S.buyers.get(c.buyerId);
    const r = forward(c, product);
    const tm = terms(c);
    const cost = c.cost;
    const tiers = tierQtys(cost).map(q => forward(c, product, { qty: q })).filter(x => !x.blocked && x.qty > r.qty);
    return `Dear ${(buyer && buyer.contact && buyer.contact.name) || 'Sir/Madam'},

Please find attached our quotation for ${product.name.replace(/\s*\(가상\)/, '')} (${r.pk.countPerUnit} units per pack).

- Price: ${usd(r.U)} per pack, ${r.inc}, for ${num(r.qty)} packs (approx. ${usd(r.perDayUSD, 3)} per day of use)
- MOQ: ${num(cost.moq)} packs
${tiers.length ? '- Volume pricing: ' + tiers.map(x => `${num(x.qty)}+ ${usd(x.U)}`).join(' / ') + '\n' : ''}
Registration terms:
- ${tm.holderEn}
- Documents we will provide: ${tm.docsEn.join(', ') || 'to be agreed'}
${tm.costs.length ? '- Registration/testing costs: ' + tm.costs.map(x => `${x.item} (${x.en})`).join('; ') + '\n' : ''}
The exchange rate basis is ${r.rate ? num(r.rate, 2) + ' KRW/USD' : 'to be confirmed'}${r.fx.date ? ' as of ' + r.fx.date : ''}.
Regulatory comments are based on our preliminary review; the final decision rests with your regulatory team.

Best regards,`;
  }

  DASH.registerTab({
    id: 'cost', icon: '💰', label: '원가', order: 40, cssClass: 'tab-cost', needsCase: true,
    render,
    summary: ctx => ({ label: '견적 단가', value: ctx.cost && ctx.cost.quote && ctx.cost.quote.unitPriceUSD ? '$' + ctx.cost.quote.unitPriceUSD.toFixed(2) : 0 })
  });
})();
