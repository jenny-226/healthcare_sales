// 건·바이어·제품 관리 (상단 바의 '+ 새 건' · '건·바이어 관리').
// 관리자 메뉴를 없애면서 제품 등록·바이어 수정·데이터 백업을 여기로 옮겼다.
(function () {
  const DASH = window.DASH;
  const S = DASH.services;
  const D = DASH.dates;
  const ui = () => DASH.ui;

  const TIMEZONES = [
    { value: 'Asia/Tokyo', label: '도쿄 (Asia/Tokyo)' },
    { value: 'Asia/Ho_Chi_Minh', label: '하노이·호찌민 (Asia/Ho_Chi_Minh)' },
    { value: 'America/New_York', label: '미국 동부 (America/New_York)' },
    { value: 'America/Chicago', label: '미국 중부 (America/Chicago)' },
    { value: 'America/Denver', label: '미국 산악 (America/Denver)' },
    { value: 'America/Los_Angeles', label: '미국 서부 (America/Los_Angeles)' }
  ];
  const DEFAULT_TZ = { JP: 'Asia/Tokyo', VN: 'Asia/Ho_Chi_Minh', US: 'America/New_York' };

  function countryOptions(sel) {
    const { options, COUNTRIES } = ui();
    return options(['JP', 'VN', 'US'].map(c => ({ value: c, label: `${COUNTRIES[c].name} ${c}` })), sel);
  }

  // ---------- 새 건 ----------
  function buyerOptions(country) {
    const { esc } = ui();
    return S.buyers.list().filter(b => b.country === country)
      .map(b => `<option value="${esc(b.id)}">${esc(b.name)}${b.sample ? ' [예시]' : ''}</option>`).join('') +
      '<option value="__new">+ 새 바이어 등록</option>';
  }
  function productOptions() {
    const { esc } = ui();
    return S.products.list().map(p => `<option value="${esc(p.id)}">${esc(p.name)}${p.sample ? ' [예시]' : ''}</option>`).join('') +
      '<option value="__new">+ 새 제품 등록</option>';
  }

  function openNewCase() {
    const { options, modal, toast, FORMS } = ui();
    const country = 'VN';
    const body = `<div class="form-grid">
      <label>국가 <select name="country">${countryOptions(country)}</select></label>
      <label>바이어 <select name="buyerId">${buyerOptions(country)}</select></label>
      <fieldset class="full new-buyer" hidden>
        <legend>새 바이어</legend>
        <div class="form-grid">
          <label>회사명 <input name="nbName" placeholder="예: B Pharma JSC"></label>
          <label>유형 <select name="nbType">${options(S.buyers.TYPES[country], '')}</select></label>
          <label>리드 출처 <input name="nbLead" placeholder="예: 2026 KOTRA 상담회"></label>
          <label>담당자 <input name="nbContact"></label>
          <label>이메일 <input name="nbEmail" type="email"></label>
          <label>시간대 <select name="nbTz">${options(TIMEZONES, DEFAULT_TZ[country])}</select></label>
        </div>
        <p class="muted small">명의자 역량은 저장 후 '건·바이어 관리 → 바이어'에서 체크합니다.</p>
      </fieldset>
      <label>제품 <select name="productId">${productOptions()}</select></label>
      <label>판매(출시) 희망일 <input type="date" name="targetLaunchDate"></label>
      <fieldset class="full new-product" hidden>
        <legend>새 제품</legend>
        <div class="form-grid">
          <label>제품명 <input name="npName" placeholder="예: 비타민 D 연질캡슐"></label>
          <label>제형 <select name="npForm">${options(Object.keys(FORMS).map(k => ({ value: k, label: FORMS[k] })), 'capsule')}</select></label>
          <label>1회 섭취 개수 <input type="number" min="1" name="npUnits" value="1"></label>
          <label>1일 섭취 횟수 <input type="number" min="1" name="npServings" value="1"></label>
          <label class="full">한국 기능성 표시 <input name="npClaim" placeholder="예: 뼈 건강에 도움을 줄 수 있음"></label>
        </div>
        <p class="muted small">처방(성분·함량)은 저장 후 규제 확인 탭의 '성분표 확인·수정'에서 입력하거나 파일로 올립니다.</p>
      </fieldset>
    </div>`;
    const m = modal('새 건 만들기', body, {
      okLabel: '저장하고 규제 확인으로',
      onOk: el => {
        const v = ui().readForm(el);
        let buyerId = v.buyerId;
        let productId = v.productId;
        if (buyerId === '__new' && !v.nbName) { toast('새 바이어 회사명을 입력하세요.', 'warn'); return false; }
        if (productId === '__new' && !v.npName) { toast('새 제품명을 입력하세요.', 'warn'); return false; }
        if (!buyerId) { toast('바이어를 선택하세요.', 'warn'); return false; }
        if (v.targetLaunchDate && !D.isValid(v.targetLaunchDate)) { toast('판매 희망일 형식을 확인하세요.', 'warn'); return false; }
        if (buyerId === '__new') {
          const hc = { JP: null, VN: null, US: null };
          hc[v.country] = {};
          buyerId = S.buyers.save({
            country: v.country, name: v.nbName, type: v.nbType, leadSource: v.nbLead,
            contact: { name: v.nbContact, email: v.nbEmail, timezone: v.nbTz },
            holderCapability: hc, lastContactAt: D.today(), awaitingReply: false
          }).id;
        }
        if (productId === '__new') {
          productId = S.products.save({
            name: v.npName, form: v.npForm, koreaStatus: 'none', koreaClaim: v.npClaim,
            unitsPerServing: v.npUnits || 1, servingsPerDay: v.npServings || 1, formula: []
          }).id;
        }
        const c = S.cases.create({ country: v.country, buyerId, productId, targetLaunchDate: v.targetLaunchDate });
        DASH.store.set('ui:currentCase', c.id);
        toast(`${c.id} 건을 만들었습니다.`);
        DASH.go('regulatory');
        DASH.caseContext.select(c.id);
      }
    });
    const el = m.el;
    const toggle = () => {
      el.querySelector('.new-buyer').hidden = el.querySelector('[name="buyerId"]').value !== '__new';
      el.querySelector('.new-product').hidden = el.querySelector('[name="productId"]').value !== '__new';
    };
    el.querySelector('[name="country"]').addEventListener('change', () => {
      const c = el.querySelector('[name="country"]').value;
      el.querySelector('[name="buyerId"]').innerHTML = buyerOptions(c);
      el.querySelector('[name="nbType"]').innerHTML = options(S.buyers.TYPES[c], '');
      el.querySelector('[name="nbTz"]').value = DEFAULT_TZ[c];
      toggle();
    });
    el.querySelector('[name="buyerId"]').addEventListener('change', toggle);
    el.querySelector('[name="productId"]').addEventListener('change', toggle);
    toggle();
  }

  // ---------- 바이어 등록·수정 ----------
  function capFields(country, hc) {
    const { esc } = ui();
    hc = hc || {};
    return (S.buyers.CAPABILITIES[country] || []).map(d => d.type === 'number'
      ? `<label>${esc(d.label)} <input type="number" min="0" name="cap_${d.key}" value="${esc(hc[d.key] === undefined || hc[d.key] === null ? '' : hc[d.key])}"></label>`
      : `<label class="check"><input type="checkbox" name="cap_${d.key}"${hc[d.key] === true ? ' checked' : ''}> ${esc(d.label)}</label>`
    ).join('');
  }

  function openBuyer(b, onDone) {
    const { esc, options, modal, toast } = ui();
    const isNew = !b;
    b = b || { country: 'VN', name: '', type: '', leadSource: '', contact: { name: '', email: '', timezone: DEFAULT_TZ.VN }, holderCapability: { JP: null, VN: null, US: null }, lastContactAt: D.today(), awaitingReply: false };
    const hc = (b.holderCapability || {})[b.country];
    const inUse = !isNew && S.cases.list().some(c => c.buyerId === b.id);
    const body = `<div class="form-grid">
      <label>국가 <select name="country"${inUse ? ' disabled' : ''}>${countryOptions(b.country)}</select></label>
      <label>회사명 <input name="name" value="${esc(b.name)}"></label>
      <label>유형 <select name="type">${options(S.buyers.TYPES[b.country], b.type)}</select></label>
      <label>리드 출처 <input name="leadSource" value="${esc(b.leadSource)}"></label>
      <label>담당자 <input name="contactName" value="${esc(b.contact && b.contact.name)}"></label>
      <label>이메일 <input name="contactEmail" type="email" value="${esc(b.contact && b.contact.email)}"></label>
      <label>시간대 (홈 현지 시각) <select name="timezone">${options(TIMEZONES, b.contact && b.contact.timezone)}</select></label>
      <label>마지막 연락일 <input type="date" name="lastContactAt" value="${esc(b.lastContactAt)}"></label>
      <label class="check full"><input type="checkbox" name="awaitingReply"${b.awaitingReply ? ' checked' : ''}> 바이어 회신 대기 중</label>
      <fieldset class="full"><legend>명의자 역량 체크</legend><div class="form-grid caps">${capFields(b.country, hc)}</div>
        <p class="muted small">베트남은 현지 법인이 아니면 VN-APP-01이 '사용 불가'로 판정됩니다.</p></fieldset>
    </div>`;
    const m = modal(isNew ? '바이어 등록' : '바이어 수정', body, {
      extraButtons: !isNew && !inUse ? '<button class="btn danger" data-act="del-buyer">삭제</button>' : '',
      onOk: el => {
        const v = ui().readForm(el);
        const country = inUse ? b.country : v.country;
        if (!v.name) { toast('회사명을 입력하세요.', 'warn'); return false; }
        const cap = {};
        (S.buyers.CAPABILITIES[country] || []).forEach(d => { cap[d.key] = v['cap_' + d.key]; });
        S.buyers.save(Object.assign({}, b, {
          country, name: v.name, type: v.type, leadSource: v.leadSource,
          contact: { name: v.contactName, email: v.contactEmail, timezone: v.timezone },
          lastContactAt: v.lastContactAt, awaitingReply: v.awaitingReply,
          holderCapability: Object.assign({ JP: null, VN: null, US: null }, b.holderCapability, { [country]: cap })
        }));
        toast('바이어를 저장했습니다.');
        DASH.caseContext.notify();
        if (onDone) onDone();
      }
    });
    const el = m.el;
    el.querySelector('[name="country"]').addEventListener('change', e => {
      const c = e.target.value;
      el.querySelector('[name="type"]').innerHTML = options(S.buyers.TYPES[c], '');
      el.querySelector('.caps').innerHTML = capFields(c, (b.holderCapability || {})[c]);
      el.querySelector('[name="timezone"]').value = DEFAULT_TZ[c];
    });
    const del = el.querySelector('[data-act="del-buyer"]');
    if (del) del.addEventListener('click', () => { S.buyers.remove(b.id); m.close(); toast('삭제했습니다.'); DASH.caseContext.notify(); if (onDone) onDone(); });
  }

  // ---------- 건·바이어 관리 ----------
  function managerBody() {
    const { esc, table, countryBadge, sampleBadge, tag, options } = ui();
    const cur = DASH.caseContext.currentId();
    const stages = S.cases.STAGES.map(s => ({ value: s.id, label: s.label }));
    const cases = table(['건', '국가', '바이어 · 제품', '단계', ''], S.cases.list().map(c => {
      const b = S.buyers.get(c.buyerId);
      const p = S.products.get(c.productId);
      return [
        `<strong>${esc(c.id)}</strong> ${sampleBadge(c)}${c.id === cur ? ' ' + tag('선택됨', 'b-wait') : ''}`,
        countryBadge(c.country),
        `${esc(b ? b.name : '바이어 미지정')}<br><span class="muted small">${esc(p ? p.name : '제품 미지정')}</span>`,
        `<select data-stage="${esc(c.id)}">${options(stages, c.stage)}</select>`,
        `<button class="btn sm" data-act="pick-case" data-id="${esc(c.id)}">열기</button> <button class="icon-btn" data-act="del-case" data-id="${esc(c.id)}" aria-label="삭제">✕</button>`
      ];
    }), { empty: '건이 없습니다.' });
    const buyers = table(['바이어', '국가', '명의자 역량', ''], S.buyers.list().map(b => {
      const gaps = S.buyers.capabilityGaps(b);
      return [
        `<strong>${esc(b.name)}</strong> ${sampleBadge(b)} ${b.awaitingReply ? tag('회신 대기', 'b-wait') : ''}<br><span class="muted small">${esc(S.buyers.typeLabel(b.country, b.type))} · 마지막 연락 ${esc(b.lastContactAt || '-')}</span>`,
        countryBadge(b.country),
        gaps.length ? `<span class="small" style="color:#93370D">부족: ${esc(gaps.join(' · '))}</span>` : '<span class="muted small">체크 항목 모두 표시됨</span>',
        `<button class="btn sm" data-act="edit-buyer" data-id="${esc(b.id)}">수정</button>`
      ];
    }), { empty: '바이어가 없습니다.' });
    const counts = ['cases', 'buyers', 'products'].map(k => `${({ cases: '건', buyers: '바이어', products: '제품' })[k]} ${DASH.store.get(k, []).length}개`).join(' · ');
    return `<h4>건</h4>${cases}
      <h4>바이어 <button class="btn sm" data-act="new-buyer">+ 바이어</button></h4>${buyers}
      <h4>데이터 백업</h4>
      <p class="muted small">${esc(counts)} · 저장 위치: 이 브라우저 localStorage (hsd:*). 여러 사람이 함께 쓰려면 2단계(Flask + SQLite)로 옮깁니다.</p>
      <div class="row-actions">
        <button class="btn sm" data-act="export">JSON 내보내기</button>
        <label class="btn sm">JSON 가져오기<input type="file" accept=".json,application/json" data-act="import" hidden></label>
        <button class="btn sm" data-act="clear-sample">예시 데이터 지우기</button>
        <button class="btn sm danger" data-act="reset-all">전체 초기화</button>
      </div>`;
  }

  function openManager() {
    const { modal, toast, confirmBox } = ui();
    const m = modal('건·바이어 관리', managerBody(), { wide: true });
    const el = m.el;
    const body = el.querySelector('.modal-body');
    const redraw = () => { if (document.body.contains(el)) body.innerHTML = managerBody(); };
    el.addEventListener('click', e => {
      const t = e.target.closest('[data-act]');
      if (!t) return;
      const act = t.dataset.act;
      if (act === 'pick-case') { m.close(); DASH.caseContext.select(t.dataset.id); }
      else if (act === 'del-case') confirmBox(`${t.dataset.id} 건을 지울까요? 되돌릴 수 없습니다.`, () => {
        S.cases.remove(t.dataset.id);
        if (DASH.caseContext.currentId() === t.dataset.id) DASH.caseContext.clear(); else DASH.caseContext.notify();
        redraw();
      }, '지우기');
      else if (act === 'edit-buyer') openBuyer(S.buyers.get(t.dataset.id), redraw);
      else if (act === 'new-buyer') openBuyer(null, redraw);
      else if (act === 'export') ui().download(`hsd-backup-${D.today()}.json`, JSON.stringify(DASH.store.exportAll(), null, 2));
      else if (act === 'clear-sample') confirmBox('예시 데이터(건·바이어·제품·서류)를 모두 지울까요?', () => {
        ['cases', 'buyers', 'products', 'docs'].forEach(k => DASH.store.set(k, DASH.store.get(k, []).filter(x => !x.sample)));
        const cur = DASH.caseContext.currentId();
        if (cur && !S.cases.get(cur)) DASH.store.remove('ui:currentCase');
        toast('예시 데이터를 지웠습니다.');
        DASH.caseContext.notify();
        redraw();
      }, '지우기');
      else if (act === 'reset-all') confirmBox('저장된 모든 데이터를 지우고 예시 데이터를 다시 불러옵니다. 되돌릴 수 없습니다. 계속할까요?', () => {
        DASH.store.clearAll();
        DASH.store.seedIfNeeded();
        toast('초기화했습니다.');
        DASH.caseContext.notify();
        redraw();
      }, '초기화');
    });
    el.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.stage) {
        const c = S.cases.get(t.dataset.stage);
        c.stage = t.value;
        DASH.caseContext.save(c);
        return;
      }
      if (t.dataset.act !== 'import' || !t.files[0]) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const payload = JSON.parse(String(reader.result));
          confirmBox('가져오면 지금 저장된 데이터를 모두 바꿉니다. 계속할까요?', () => {
            DASH.store.importAll(payload);
            toast('가져왔습니다.');
            DASH.caseContext.notify();
            redraw();
          }, '가져오기');
        } catch (err) { toast('JSON을 읽지 못했습니다: ' + err.message, 'warn'); }
        t.value = '';
      };
      reader.readAsText(t.files[0]);
    });
  }

  DASH.manager = { TIMEZONES, DEFAULT_TZ, openNewCase, openBuyer, openManager };
})();
