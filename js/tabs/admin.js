// ⚙️ 관리자 메뉴 (README 7-6, 탭 아님): 제품 마스터 · 규칙 보기 · 공휴일 · 환율 · 데이터 관리
(function () {
  const DASH = window.DASH;
  const { card, esc, badge, countryBadge, tag, table, options, toast, modal, confirmBox, sourceLine, verifyBadge, COUNTRIES, FORMS } = DASH.ui;
  const S = DASH.services;
  const D = DASH.dates;
  const KOREA_STATUS = [{ value: 'notified', label: '고시형' }, { value: 'individual', label: '개별인정형' }, { value: 'none', label: '해당 없음' }];

  function render(el) {
    const ruleCountry = DASH.store.get('ui:adminRuleCountry', 'JP');
    el.innerHTML = `<div class="tab-page">
      <div class="page-head"><div><h1>⚙️ 관리자 메뉴</h1><p class="muted">제품 마스터 · 규칙 보기 · 공휴일 · 환율 · 데이터 관리</p></div></div>
      ${productsCard()}
      <div class="grid-2">${fxCard()}${holidaysCard()}</div>
      ${rulesCard(ruleCountry)}
      ${dataCard()}
    </div>`;
    bind(el.firstElementChild);
  }

  // ---------- 제품 마스터 ----------
  function productsCard() {
    const rows = S.products.list().map(p => [
      `${esc(p.id)} ${p.sample ? '<span class="badge b-sample">예시</span>' : ''}`,
      `<strong>${esc(p.name)}</strong>`,
      esc(FORMS[p.form] || p.form),
      esc((KOREA_STATUS.find(k => k.value === p.koreaStatus) || {}).label || '-'),
      `${(p.formula || []).length}개${(p.formula || []).some(i => i.koreaIndividual) ? ' ' + tag('개별인정형 원료', 'b-plain') : ''}`,
      `1회 ${esc(p.unitsPerServing || 1)}개 × 1일 ${esc(p.servingsPerDay || 1)}회`,
      `<button class="btn sm ghost" data-act="edit-product" data-id="${esc(p.id)}">수정</button>`
    ]);
    return card('제품 마스터', table(['ID', '제품명', '제형', '한국 기능성 구분', '성분', '섭취', ''], rows, { empty: '제품이 없습니다.' }),
      { actions: '<button class="btn sm" data-act="new-product">+ 제품</button>' });
  }

  function ingRow(i, idx) {
    const jp = i.jpPharmaOnly === true ? 'yes' : i.jpPharmaOnly === false ? 'no' : '';
    return `<tr class="ing-row" data-idx="${idx}" data-id="${esc(i.ingredientId || '')}">
      <td><input data-k="nameKo" value="${esc(i.nameKo || '')}" placeholder="국문명"></td>
      <td><input data-k="nameEn" value="${esc(i.nameEn || '')}" placeholder="영문명"></td>
      <td><input data-k="amountPerServing" type="number" step="any" value="${esc(i.amountPerServing === undefined ? '' : i.amountPerServing)}"></td>
      <td><input data-k="unit" value="${esc(i.unit || '')}" placeholder="mg"></td>
      <td class="center"><input type="checkbox" data-k="koreaIndividual"${i.koreaIndividual ? ' checked' : ''}></td>
      <td><select data-k="jpPharmaOnly">${options([{ value: '', label: '미입력' }, { value: 'yes', label: '해당' }, { value: 'no', label: '비해당' }], jp)}</select></td>
      <td><button class="icon-btn" data-act="ing-del" aria-label="삭제">✕</button></td>
    </tr>`;
  }

  function openProduct(p) {
    const isNew = !p;
    p = p || { name: '', form: 'capsule', koreaStatus: 'none', koreaClaim: '', servingsPerDay: 1, unitsPerServing: 1, formula: [] };
    const inUse = !isNew && S.cases.list().some(c => c.productId === p.id);
    const body = `<div class="form-grid">
        <label>제품명 <input name="name" value="${esc(p.name)}"></label>
        <label>제형 <select name="form">${options(Object.keys(FORMS).map(k => ({ value: k, label: FORMS[k] })), p.form)}</select></label>
        <label>한국 기능성 원료 구분 <select name="koreaStatus">${options(KOREA_STATUS, p.koreaStatus)}</select></label>
        <label>한국 기능성 표시 <input name="koreaClaim" value="${esc(p.koreaClaim || '')}"></label>
        <label>1회 섭취 개수 <input type="number" min="1" name="unitsPerServing" value="${esc(p.unitsPerServing || 1)}"></label>
        <label>1일 섭취 횟수 <input type="number" min="1" name="servingsPerDay" value="${esc(p.servingsPerDay || 1)}"></label>
      </div>
      <h4>처방 (1회 기준)</h4>
      <div class="table-wrap"><table class="tbl ing-table"><thead><tr><th>국문명</th><th>영문명</th><th>1회 함량</th><th>단위</th><th>한국 개별인정형</th><th>일본 의약품 전용</th><th></th></tr></thead>
        <tbody>${(p.formula || []).map(ingRow).join('')}</tbody></table></div>
      <button class="btn sm" data-act="ing-add">+ 성분</button>
      <p class="muted small">개별인정형 체크 → 미국 US-NDI-02 자동 경고. 일본 의약품 전용 '미입력'이면 JP-ING-01은 규칙 미등록(UNKNOWN)으로 표시됩니다.</p>`;
    const m = modal(isNew ? '제품 등록' : `제품 수정 · ${p.id}`, body, {
      wide: true,
      extraButtons: !isNew && !inUse ? '<button class="btn danger" data-act="del-product">삭제</button>' : '',
      onOk: el => {
        const v = DASH.ui.readForm(el.querySelector('.form-grid'));
        if (!v.name) { toast('제품명을 입력하세요.', 'warn'); return false; }
        const formula = [];
        el.querySelectorAll('.ing-row').forEach(tr => {
          const get = k => tr.querySelector(`[data-k="${k}"]`);
          const nameKo = get('nameKo').value.trim(), nameEn = get('nameEn').value.trim();
          if (!nameKo && !nameEn) return;
          const jp = get('jpPharmaOnly').value;
          const item = {
            ingredientId: tr.dataset.id || S.products.newIngredientId(formula),
            nameKo, nameEn,
            amountPerServing: Number(get('amountPerServing').value) || 0,
            unit: get('unit').value.trim(),
            koreaIndividual: get('koreaIndividual').checked
          };
          if (jp) item.jpPharmaOnly = jp === 'yes';
          formula.push(item);
        });
        const before = JSON.stringify((p.formula || []).map(i => [i.ingredientId, i.amountPerServing, i.unit, i.nameKo, i.nameEn]));
        const after = JSON.stringify(formula.map(i => [i.ingredientId, i.amountPerServing, i.unit, i.nameKo, i.nameEn]));
        const saved = S.products.save(Object.assign({}, p, v, { formula }));
        let affected = [];
        if (!isNew && before !== after) affected = S.cases.flagFormulaChange(saved.id, '제품 마스터에서 처방 변경');
        DASH.caseContext.notify();
        if (affected.length) {
          setTimeout(() => modal('처방 변경 경고', `<p>등록·신고 단계가 시작된 건의 처방이 바뀌었습니다.</p><ul>${affected.map(a => `<li><strong>${esc(a.caseId)}</strong> — ${esc(a.message)}</li>`).join('')}</ul>`), 0);
        } else toast('제품을 저장했습니다.');
      }
    });
    const el = m.el;
    el.addEventListener('click', e => {
      const t = e.target.closest('[data-act]');
      if (!t) return;
      if (t.dataset.act === 'ing-add') {
        el.querySelector('.ing-table tbody').insertAdjacentHTML('beforeend', ingRow({ unit: 'mg', koreaIndividual: false }, el.querySelectorAll('.ing-row').length));
      } else if (t.dataset.act === 'ing-del') t.closest('tr').remove();
      else if (t.dataset.act === 'del-product') { S.products.remove(p.id); m.close(); toast('삭제했습니다.'); DASH.caseContext.notify(); }
    });
  }

  // ---------- 환율 ----------
  function fxCard() {
    const fx = S.settings.fx();
    const db = S.settings.dbFx();
    const dbLine = db
      ? `<p class="muted small">DB 기준 환율: USD ${esc(db.USD)} · JPY ${esc(db.JPY)} · VND ${esc(db.VND)} (${esc(db.date)} · ${esc(db.source)})${fx.fromDb ? ' — <strong>지금 사용 중</strong>' : ''}. 견적 확정 전 은행 고시 환율로 다시 확인하세요.</p>`
      : '<p class="muted small">DB 기준 환율이 없습니다. 직접 입력하세요.</p>';
    return card('환율 입력 <span class="muted small">외화 1단위당 원화 · 원가 탭과 공유</span>', `
      <div class="form-grid">
        <label class="block">USD (원/1달러)<input type="number" step="0.01" min="0" data-fx="USD" value="${esc(fx.USD || '')}" placeholder="예: 1380"></label>
        <label class="block">JPY (원/1엔)<input type="number" step="0.0001" min="0" data-fx="JPY" value="${esc(fx.JPY || '')}" placeholder="예: 9.2"></label>
        <label class="block">VND (원/1동)<input type="number" step="0.00001" min="0" data-fx="VND" value="${esc(fx.VND || '')}" placeholder="예: 0.055"></label>
        <label class="block">기준일<input type="date" data-fx="date" value="${esc(fx.date || '')}"></label>
      </div>
      <button class="btn primary sm" data-act="save-fx">환율 저장</button>
      ${fx.fromDb ? '' : '<button class="btn sm" data-act="reset-fx">DB 기준 환율로 되돌리기</button>'}
      ${dbLine}`);
  }

  // ---------- 공휴일 ----------
  function holidaysCard() {
    const base = (window.DASH_DATA && window.DASH_DATA.holidays) || {};
    const meta = (window.DASH_DATA && window.DASH_DATA.holidayMeta) || null;
    const f = c => {
      const all = S.settings.holidays(c);
      const fromDb = (base[c] || []).length;
      return `<label class="block">${esc(COUNTRIES[c].name)} 공휴일 (한 줄에 하나, YYYY-MM-DD)
      <textarea data-hol="${c}" rows="6" placeholder="2027-01-01">${esc(all.join('\n'))}</textarea></label>
      <p class="muted small">${all.length ? `${all.length}일 반영 중 (DB ${fromDb}일 + 직접 추가 ${all.length - fromDb}일)` : '비어 있음 → 화면에 "공휴일 미반영" 경고 표시'}</p>`;
    };
    const src = meta ? `<p class="muted small">DB 공휴일 ${esc(meta.years)} · 출처 ${meta.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join(', ')}</p>
      <ul class="plain small">${meta.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : '';
    return card('공휴일 <span class="muted small">영업일 계산용 · DB 공휴일 + 직접 추가</span>', `<div class="grid-2 tight">${f('JP')}${f('VN')}</div>
      <button class="btn primary sm" data-act="save-hol">공휴일 저장</button>${src}`);
  }

  // ---------- 규칙 보기 ----------
  function rulesCard(country) {
    const pack = S.rules.forCountry(country);
    const chips = S.rules.COUNTRY_CODES.map(c => `<button class="chip${c === country ? ' active' : ''}" data-act="rule-country" data-v="${c}">${COUNTRIES[c].name} ${c}</button>`).join('');
    const rows = pack.rules.map(r => [
      `<span class="rule-id">${esc(r.id)}</span>`,
      esc(DASH.engine.AREA_LABELS[r.area] || r.area),
      `${esc(r.title)} <button class="link-btn" data-act="rule-detail" data-id="${esc(r.id)}">상세</button>`,
      badge(r.verdictIfFail),
      `${sourceLine(r)}`,
      r.needsVerification ? verifyBadge(r) : '<span class="muted small">원문 확인됨</span>'
    ]);
    const unreg = (pack.unregistered || []).map(u => `<li>${badge('UNKNOWN')} ${esc(DASH.engine.AREA_LABELS[u.area])} — ${esc(u.title)}</li>`).join('');
    return card(`규칙 보기 <span class="muted small">읽기 전용 · 수정은 data/rules-${country.toLowerCase()}.js 파일에서</span>`,
      `<p class="muted small">규칙 버전 ${esc(pack.version)} · 판정은 규칙에 걸렸을 때의 판정입니다.</p>
      ${table(['ID', '영역', '규칙', '걸렸을 때', '출처 · 검증일', '원문'], rows, { cls: 'admin-rules', scroll: true })}
      ${unreg ? `<h4>규칙 미등록 항목</h4><ul class="plain">${unreg}</ul>` : ''}`,
      { actions: `<div class="chips">${chips}</div>` });
  }

  function ruleDetail(id) {
    const r = S.rules.rule(id);
    if (!r) return;
    modal(`${r.id} 상세`, `
      <p><strong>${esc(r.title)}</strong></p>
      <p>${esc(r.message)}</p>
      ${r.suggestion ? `<p class="muted">수정 제안: ${esc(r.suggestion)}</p>` : ''}
      <dl class="kv"><dt>국가</dt><dd>${countryBadge(r.country)}</dd><dt>영역</dt><dd>${esc(DASH.engine.AREA_LABELS[r.area])}</dd>
        <dt>검사 함수</dt><dd><code>${esc(r.check)}</code></dd><dt>params</dt><dd><code>${esc(JSON.stringify(r.params))}</code></dd>
        <dt>걸렸을 때</dt><dd>${badge(r.verdictIfFail)}</dd></dl>
      ${sourceLine(r)} ${verifyBadge(r)}`, { wide: true });
  }

  // ---------- 데이터 관리 ----------
  function dataCard() {
    const counts = ['cases', 'buyers', 'products', 'docs'].map(k => {
      const list = DASH.store.get(k, []);
      return `${({ cases: '건', buyers: '바이어', products: '제품', docs: '서류' })[k]} ${list.length}개 (예시 ${list.filter(x => x.sample).length})`;
    }).join(' · ');
    return card('데이터 관리', `
      <p class="muted small">${esc(counts)} · 저장 위치: 이 브라우저 localStorage (hsd:*)</p>
      <div class="row-actions">
        <button class="btn" data-act="export">JSON 내보내기</button>
        <label class="btn">JSON 가져오기<input type="file" accept=".json,application/json" data-act="import" hidden></label>
        <button class="btn" data-act="clear-sample">예시 데이터 지우기</button>
        <button class="btn danger" data-act="reset-all">전체 초기화 (예시 다시 불러오기)</button>
      </div>
      <p class="muted small">여러 사람이 함께 쓰려면 2단계(Flask + SQLite)로 옮깁니다. 그 전에는 JSON 내보내기로 백업하세요.</p>`);
  }

  function clearSamples() {
    ['cases', 'buyers', 'products', 'docs'].forEach(k => DASH.store.set(k, DASH.store.get(k, []).filter(x => !x.sample)));
    const cur = DASH.caseContext.currentId();
    if (cur && !S.cases.get(cur)) DASH.store.remove('ui:currentCase');
    toast('예시 데이터를 지웠습니다.');
    DASH.caseContext.notify();
  }

  function bind(page) {
    page.addEventListener('click', e => {
      const t = e.target.closest('[data-act]');
      if (!t) return;
      const act = t.dataset.act;
      if (act === 'new-product') openProduct(null);
      else if (act === 'edit-product') openProduct(S.products.get(t.dataset.id));
      else if (act === 'rule-country') { DASH.store.set('ui:adminRuleCountry', t.dataset.v); DASH.refresh(); }
      else if (act === 'rule-detail') ruleDetail(t.dataset.id);
      else if (act === 'save-fx') {
        const v = {};
        page.querySelectorAll('[data-fx]').forEach(i => { v[i.dataset.fx] = i.type === 'number' ? (Number(i.value) || 0) : i.value; });
        if (!(v.USD > 0)) { toast('USD 환율을 입력하세요. 비워 두려면 "DB 기준 환율로 되돌리기"를 누르세요.', 'warn'); return; }
        S.settings.setFx(v);
        toast('환율을 저장했습니다.');
        DASH.refresh();
      } else if (act === 'reset-fx') {
        S.settings.resetFx();
        toast('DB 기준 환율을 사용합니다.');
        DASH.refresh();
      } else if (act === 'save-hol') {
        const bad = [];
        page.querySelectorAll('[data-hol]').forEach(ta => {
          const lines = ta.value.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
          lines.filter(s => !D.isValid(s)).forEach(s => bad.push(s));
          const base = ((window.DASH_DATA.holidays || {})[ta.dataset.hol]) || [];
          S.settings.setHolidays(ta.dataset.hol, lines.filter(s => D.isValid(s) && !base.includes(s)));
        });
        toast(bad.length ? `형식이 틀린 날짜는 빼고 저장했습니다: ${bad.join(', ')}` : '공휴일을 저장했습니다.', bad.length ? 'warn' : '');
        DASH.refresh();
      } else if (act === 'export') {
        DASH.ui.download(`hsd-backup-${D.today()}.json`, JSON.stringify(DASH.store.exportAll(), null, 2));
      } else if (act === 'clear-sample') confirmBox('예시 데이터(건·바이어·제품·서류)를 모두 지울까요?', clearSamples, '지우기');
      else if (act === 'reset-all') confirmBox('저장된 모든 데이터를 지우고 예시 데이터를 다시 불러옵니다. 되돌릴 수 없습니다. 계속할까요?', () => {
        DASH.store.clearAll();
        DASH.store.seedIfNeeded();
        toast('초기화했습니다.');
        DASH.caseContext.notify();
      }, '초기화');
    });

    page.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.act !== 'import' || !t.files[0]) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const payload = JSON.parse(String(reader.result));
          confirmBox('가져오면 지금 저장된 데이터를 모두 바꿉니다. 계속할까요?', () => {
            DASH.store.importAll(payload);
            toast('가져왔습니다.');
            DASH.caseContext.notify();
          }, '가져오기');
        } catch (err) { toast('JSON을 읽지 못했습니다: ' + err.message, 'warn'); }
        t.value = '';
      };
      reader.readAsText(t.files[0]);
    });
  }

  DASH.registerTab({ id: 'admin', icon: '⚙️', label: '관리자', order: 90, cssClass: 'tab-admin', needsCase: false, admin: true, render });
})();
