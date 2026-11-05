(function () {
  const D = window.DASH, S = D.services.stability;
  const { esc, card, table, options, pageHead } = D.ui;
  const labels = Object.fromEntries(S.definitions.map(d => [d[0], d[1]]));
  Object.assign(labels, { product: '제품', form: '제형', packaging: '포장', registeredStrain: '사내 균주 등록', initialCFU: '제조 후 초기 균수 (CFU/1회)', lossRate: '가정 월별 감소량 (log10 CFU/월)' });
  const fmt = n => Number(n).toLocaleString('ko-KR', { maximumSignificantDigits: 4 });
  function control(k, v, attr) {
    const def = S.definitions.find(d => d[0] === k);
    const select = list => `<select ${attr}="${k}">${options(list, v ?? '')}</select>`;
    if (k === 'strainId') {
      const list = [{ value: '', label: '균주 선택 (사내 자료 등록 필요)' }].concat(S.library().strains.map(s => ({ value: s.id, label: `${s.name} · ${s.id}` })));
      if (v && !list.some(s => s.value === v)) list.push({ value: v, label: `${v} (DB 미등록)` });
      return select(list);
    }
    if (k === 'form') return select([{ value: '', label: '미입력' }].concat(Object.entries(D.ui.FORMS).map(([value, label]) => ({ value, label }))));
    if (k === 'awSource') return select([{ value: '', label: '근거 선택' }, { value: 'measured', label: '사내 실측값' }, { value: 'scenario', label: '가정 시나리오 값' }]);
    const num = def?.[2] === 'number' || ['initialCFU', 'lossRate'].includes(k);
    return `<input ${attr}="${k}" value="${esc(v)}" type="${num ? 'number' : 'text'}" ${num ? `step="${k === 'months' ? '1' : 'any'}" min="${def?.[3] ?? (k === 'lossRate' ? 0 : 1)}" max="${def?.[4] ?? (k === 'lossRate' ? 10 : 1e15)}"` : ''} placeholder="미입력">`;
  }
  // 개발요청서와 시뮬레이터는 동일한 저장 필드를 사용한다.
  S.requestFields = function (r) {
    const v = r.stability || {};
    return `<div class="form-grid">${S.definitions.map(([k, label]) => `<label class="block">${esc(label)}${control(k, v[k], 'data-stability')}</label>`).join('')}</div>
      <p class="muted small">저장한 조건은 <a href="#stability">AI 안정형 시뮬레이터</a>에 자동 연동됩니다. 문장에만 기재된 조건도 시뮬레이터에서 추출 후보로 확인할 수 있습니다.</p>`;
  };
  function chart(points, target) {
    if (!points.length) return '';
    const max = Math.max(...points.map(p => p.cfu), Number(target) || 0), end = points[points.length - 1].month || 1;
    const xy = p => `${50 + p.month / end * 470},${180 - p.cfu / max * 150}`;
    const y = 180 - Number(target) / max * 150;
    return `<svg class="stability-chart" viewBox="0 0 560 215" role="img" aria-label="가정 기반 보관기간별 균수 변화. 아래 표에서 수치를 확인하세요.">
      <path d="M50 25V180H525" fill="none" stroke="#98a2b3"/>
      ${target ? `<path d="M50 ${y}H525" stroke="#d97706" stroke-dasharray="5 4"/><text x="55" y="${Math.max(15, y - 6)}">목표 ${esc(fmt(target))} CFU</text>` : ''}
      <polyline points="${points.map(xy).join(' ')}" fill="none" stroke="#2f6feb" stroke-width="3"/>
      <text x="50" y="205">0개월</text><text x="475" y="205">${end}개월</text><text x="50" y="15">${esc(fmt(max))} CFU/1회 · 선형 축</text></svg>`;
  }
  function render(el, c) {
    const a = S.analyze(c), v = a.values, lib = S.library();
    const fields = ['product', 'strainId', 'targetCFU', 'form', 'months', 'temperature', 'packaging', 'aw', 'awSource'];
    const related = D.services.cases.list().filter(x => x.id !== c.id && (x.request?.form || D.services.products.get(x.productId)?.form) === v.form);
    el.innerHTML = `<div class="tab-page">
      ${pageHead('AI 안정형 시뮬레이터', '프로바이오틱스 안정성 · 개발요청서 기반 사전검토', '<a class="btn" href="#request">개발요청서 보기</a>')}
      <div class="stability-banner"><strong>개발요청서 자동 연동</strong><span>${esc(c.id)} · ${esc(v.product)}${c.sample ? ' · 예시 건' : ''}</span><small>현재 분석은 규칙 기반입니다. AI 모델 및 검증된 균주별 예측 모델은 연결되지 않았습니다.</small></div>
      <div class="stability-layout"><aside class="stack">
        ${card('개발 조건', `<p class="muted small">요청서 저장값을 매번 불러옵니다. 여기서 변경하면 현재 건의 시나리오로 저장됩니다.</p>
          <form id="stability-conditions" class="stability-fields">${fields.map(k => `<label class="block"><span>${esc(labels[k])}</span>${control(k, v[k], 'data-sim')}<small class="muted">${esc(a.sources[k] || '미입력')}</small></label>`).join('')}
          <button class="btn primary" type="submit">조건 저장 · 다시 분석</button><button class="btn" type="button" data-action="reset">요청서 조건으로 복원</button></form>`)}
        ${card('사내 균주·시험자료', `<p>균주 <strong>${lib.strains.length}</strong>개 · 시험 <strong>${lib.studies.length}</strong>건</p><p class="muted small">실제 자료를 등록하면 균주 선택과 조건별 시험자료 조회에 반영됩니다. 동일 ID는 갱신됩니다.</p><label class="btn">JSON 자료 등록<input type="file" id="stability-import" accept=".json,application/json" hidden></label><p><a href="data/stability-library.example.json" download>등록 양식 다운로드</a></p><p class="muted small">양식의 예시 균주는 실제 시험 근거가 아닙니다.</p>`)}
      </aside><div class="stack" aria-live="polite">
        ${card('분석 결과', `<div class="stability-status">${a.errors.length ? '입력값 확인 필요' : 'R&D 검토 필요 · 안정성 확정 보류'}</div><p>균주 시험 ${a.studies.length}건 · 입력 조건 일치 ${a.matched.length}건</p>
          ${a.errors.length ? `<ul>${a.errors.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
          ${a.missing.length ? `<p class="note warn">추가 확인: ${esc(a.missing.map(k => labels[k]).join(', '))}</p>` : ''}
          <p class="muted small">조건 일치는 제형·온도·aw·포장 기준이며, 동일 처방·제조공정의 검증을 의미하지 않습니다. 추가 안정성 시험 범위는 R&D가 확정해야 합니다.</p>`)}
        ${card('균주별 과거 안정성 시험자료', a.studies.length ? a.studies.map(s => `<details><summary>${esc(s.id)} · ${esc(s.source)} · ${a.matched.includes(s) ? '입력 조건 일치' : '참고 조건'}</summary><p>${esc(D.ui.FORMS[s.form] || s.form)} / ${esc(s.temperature)}°C / aw ${esc(s.aw)} / ${esc(s.packaging)}</p><p class="muted small">CFU/1회 기준 · 다른 조건으로 외삽하지 않습니다.</p>${table(['보관기간', '실측 균수 (CFU/1회)'], s.points.slice().sort((x, y) => x.month - y.month).map(p => [esc(p.month + '개월'), esc(fmt(p.cfu))]))}</details>`).join('') : '<p class="muted">선택 균주의 등록된 시험자료가 없습니다. 사내 자료를 등록하세요.</p>')}
        ${card('동일 제형의 기존 개발 사례', table(['건', '제품', '개발 상태'], related.map(x => [esc(x.id), esc(x.request?.productName || D.services.products.get(x.productId)?.name), esc((x.sample ? '[예시] ' : '') + (x.request?.status || 'draft'))]), { empty: '동일 제형의 다른 개발 건이 없습니다.' }) + '<p class="muted small">개발 이력은 안정성 성공 사례 또는 시험 근거를 의미하지 않습니다.</p>')}
        ${card('온도·수분활성도·포장 검토사항', `<ul>${a.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC6463069/" target="_blank" rel="noopener">문헌: The Production and Delivery of Probiotics (2019)</a>`)}
        ${card('보관기간별 균수 변화 · 가정 시나리오', `<p class="muted small">검증된 감소계수가 없어 자동 예측하지 않습니다. 초기 균수와 월별 log10 감소량을 입력하면 N(t) = N₀ × 10<sup>−kt</sup>로 계산합니다. 온도·aw 효과를 추정하는 모델이 아니며, 조건 변경 시 계수를 다시 검토하세요.</p>
          <form id="stability-model" class="form-grid">${['initialCFU', 'lossRate'].map(k => `<label class="block">${esc(labels[k])}${control(k, v[k], 'data-model')}</label>`).join('')}<button class="btn" type="submit">가정 계산</button></form>
          ${a.curve.length ? chart(a.curve, v.targetCFU) + `<p class="note">${v.months}개월 가정 계산값: ${esc(fmt(a.curve.at(-1).cfu))} CFU/1회${v.targetCFU ? ` · 목표 ${a.curve.at(-1).cfu >= Number(v.targetCFU) ? '이상' : '미달'} (가정상 비교)` : ''} · 실측 및 보장값 아님</p>` + table(['개월', '가정 균수 (CFU/1회)'], a.curve.filter(p => p.month % 3 === 0 || p.month === Number(v.months)).map(p => [esc(p.month), esc(fmt(p.cfu))])) : '<p class="muted">보관기간·초기 균수·감소량을 입력하면 그래프와 기간별 표가 표시됩니다.</p>'}`)}
        ${card('R&D 검토 요청사항', `<ul>${a.rd.map(n => `<li>${esc(n)}</li>`).join('')}</ul><button class="btn primary" data-action="rd">개발요청서에 검토사항 저장</button><p class="muted small">현재 건의 R&D 회신 항목에 추가합니다. 외부로 발송하지 않습니다.</p>`)}
      </div></div></div>`;
    function saveForm(form, attr) {
      form.addEventListener('submit', e => {
        e.preventDefault();
        const fresh = D.services.cases.get(c.id);
        const overrides = { ...(fresh.stabilityScenario || {}) };
        form.querySelectorAll(`[${attr}]`).forEach(input => {
          const k = input.getAttribute(attr), next = input.type === 'number' && input.value !== '' ? Number(input.value) : input.value;
          if (String(next) !== String(v[k] ?? '')) overrides[k] = next;
        });
        const errors = S.validate({ ...v, ...overrides });
        if (errors.length) return D.ui.toast(errors.join(' '));
        fresh.stabilityScenario = overrides;
        D.caseContext.save(fresh);
      });
    }
    saveForm(el.querySelector('#stability-conditions'), 'data-sim');
    saveForm(el.querySelector('#stability-model'), 'data-model');
    el.querySelector('[data-action="reset"]').onclick = () => { const fresh = D.services.cases.get(c.id); delete fresh.stabilityScenario; D.caseContext.save(fresh); };
    el.querySelector('[data-action="rd"]').onclick = () => {
      const fresh = D.services.cases.get(c.id);
      fresh.request = fresh.request || {};
      // 조건이 바뀐 요청을 이전 회신의 '가능' 상태로 보여주지 않는다.
      if (JSON.stringify(fresh.request.stabilityReview?.conditions) !== JSON.stringify(v)) {
        Object.keys(fresh.request.rdReplies || {}).filter(k => k.startsWith('stability-')).forEach(k => delete fresh.request.rdReplies[k]);
      }
      fresh.request.stabilityReview = { items: a.rd, conditions: v, savedAt: new Date().toISOString() };
      fresh.request.quality = { ...fresh.request.quality, stability: true };
      D.caseContext.save(fresh);
      D.ui.toast('개발요청서 R&D 검토 항목에 저장했습니다.');
    };
    el.querySelector('#stability-import').onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        if (file.size > 2 * 1024 * 1024) throw new Error('2MB 이하 JSON 파일을 선택하세요.');
        S.importLibrary(JSON.parse(await file.text()));
        D.refresh();
        D.ui.toast('사내 자료를 등록했습니다.');
      } catch (err) { D.ui.toast(err.message); e.target.value = ''; }
    };
  }
  D.registerTab({ id: 'stability', icon: '🔬', label: 'AI 안정형 시뮬레이터', order: 35, cssClass: 'tab-stability', needsCase: true, render });
})();
