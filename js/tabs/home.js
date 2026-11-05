// 🏠 홈: 건 칸반 · 새 건 · 오늘 할 일 · 현지 시각 · 환율 · 바이어 카드 · 규제 변화 알림 · 국가 요약 (README 7-1)
(function () {
  const DASH = window.DASH;
  const { card, esc, countryBadge, sampleBadge, tag, modal, toast, options, dday, COUNTRIES, num } = DASH.ui;
  const S = DASH.services;
  const D = DASH.dates;
  let clockTimer = null;

  const TIMEZONES = [
    { value: 'Asia/Tokyo', label: '도쿄 (Asia/Tokyo)' },
    { value: 'Asia/Ho_Chi_Minh', label: '하노이·호찌민 (Asia/Ho_Chi_Minh)' },
    { value: 'America/New_York', label: '미국 동부 (America/New_York)' },
    { value: 'America/Chicago', label: '미국 중부 (America/Chicago)' },
    { value: 'America/Denver', label: '미국 산악 (America/Denver)' },
    { value: 'America/Los_Angeles', label: '미국 서부 (America/Los_Angeles)' }
  ];
  const DEFAULT_TZ = { JP: 'Asia/Tokyo', VN: 'Asia/Ho_Chi_Minh', US: 'America/New_York' };
  const STATUS_LABEL = { draft: '초안', grace: '유예 중', effective: '시행', suspended: '정지' };

  function render(el) {
    const filter = DASH.store.get('ui:homeFilter', 'ALL');
    el.innerHTML = `<div class="tab-page">
      <div class="page-head">
        <div><h1>🏠 홈</h1><p class="muted">진행 중인 건, 마감, 바이어를 한눈에 봅니다. 오늘 ${esc(D.today())}</p></div>
      </div>
      ${kanbanCard(filter)}
      <div class="grid-2-1">
        ${todoCard()}
        <div class="stack">${clockCard()}${fxCard()}</div>
      </div>
      <div class="grid-2-1">
        ${buyersCard()}
        ${alertsCard()}
      </div>
      ${marketsCard()}
    </div>`;
    const page = el.firstElementChild;
    page.addEventListener('click', onClick);
    startClock(page);
  }

  // ---------- 건 칸반 ----------
  function kanbanCard(filter) {
    const cur = DASH.caseContext.currentId();
    const cases = S.cases.list().filter(c => c.stage !== 'closed' && (filter === 'ALL' || c.country === filter));
    const cols = S.cases.STAGES.map(st => {
      const items = cases.filter(c => c.stage === st.id);
      return `<div class="home-col">
        <div class="home-col-head">${esc(st.label)} <span class="count">${items.length}</span></div>
        ${items.map(c => caseCard(c, cur)).join('') || '<p class="muted small home-col-empty">없음</p>'}
      </div>`;
    }).join('');
    const chips = ['ALL', 'JP', 'VN', 'US'].map(f =>
      `<button class="chip${f === filter ? ' active' : ''}" data-act="filter" data-v="${f}">${f === 'ALL' ? '전체' : COUNTRIES[f].name + ' ' + f}</button>`
    ).join('');
    return card('건 목록 <span class="muted small">카드를 누르면 해당 건의 현재 단계 탭으로 이동</span>', `<div class="home-kanban">${cols}</div>`, {
      actions: `<div class="chips">${chips}</div><button class="btn primary sm" data-act="new-case">+ 새 건</button>`
    });
  }

  function caseCard(c, cur) {
    const b = S.buyers.get(c.buyerId);
    const p = S.products.get(c.productId);
    return `<button class="home-case${c.id === cur ? ' selected' : ''}" data-act="open-case" data-id="${esc(c.id)}">
      <div class="home-case-top">${countryBadge(c.country)} ${sampleBadge(c)}</div>
      <div class="home-case-title">${esc(p ? p.name : '제품 미지정')}</div>
      <div class="muted small">${esc(b ? b.name : '바이어 미지정')}</div>
      <div class="home-case-foot"><span class="small muted">${esc(c.id)}</span>
        ${c.targetLaunchDate ? `<span class="small">판매 ${esc(c.targetLaunchDate)} ${dday(c.targetLaunchDate)}</span>` : '<span class="small muted">판매 희망일 미입력</span>'}
      </div>
    </button>`;
  }

  // ---------- 오늘 할 일 ----------
  function todoCard() {
    const tasks = DASH.engine.collectTasks();
    const today = D.today();
    const noHol = ['JP', 'VN'].filter(c => !D.hasHolidays(c) && S.cases.list().some(x => x.country === c));
    const rows = tasks.map(t => {
      const left = D.daysUntil(t.date, today);
      const urgency = t.waiting ? 'wait' : left < 0 ? 'over' : left <= 7 ? 'soon' : 'later';
      return `<button class="home-task t-${urgency}" data-act="open-task" data-case="${esc(t.caseId)}" data-tab="${esc(t.tab)}">
        <span class="home-task-date">${esc(t.date)}<br>${t.waiting ? '<span class="dday dd-far">대기</span>' : dday(t.date, today)}</span>
        <span class="home-task-main">
          <span class="home-task-label">${countryBadge(t.country)} ${esc(t.label)} ${t.sample ? '<span class="badge b-sample">예시</span>' : ''}</span>
          <span class="muted small">${esc(t.caseName)}${t.ruleId ? ' · ' + esc(t.ruleId) : ''}</span>
        </span>
      </button>`;
    }).join('');
    const note = noHol.length ? `<p class="note warn">공휴일 미반영 (${noHol.join(', ')}) — 실제 마감은 더 이를 수 있습니다. <a href="#admin">관리자 메뉴에서 입력</a></p>` : '';
    return card(`오늘 할 일 <span class="count">${tasks.length}</span>`, `${note}<div class="home-tasks">${rows || '<p class="muted">모아 볼 마감이 없습니다.</p>'}</div>`);
  }

  // ---------- 현지 시각 ----------
  function clockZones() {
    const zones = [
      { tz: 'Asia/Seoul', label: '서울' },
      { tz: 'Asia/Tokyo', label: '도쿄' },
      { tz: 'Asia/Ho_Chi_Minh', label: '하노이' }
    ];
    const us = new Set();
    S.buyers.list().filter(b => b.country === 'US').forEach(b => us.add((b.contact && b.contact.timezone) || DEFAULT_TZ.US));
    if (!us.size) us.add(DEFAULT_TZ.US);
    us.forEach(tz => {
      const t = TIMEZONES.find(x => x.value === tz);
      zones.push({ tz, label: '미국 ' + (t ? t.label.replace(/^미국\s*/, '').replace(/\s*\(.*\)$/, '') : tz) + ' (바이어)' });
    });
    return zones;
  }

  function clockCard() {
    const rows = clockZones().map(z => `<div class="home-clock" data-tz="${esc(z.tz)}">
      <span class="home-clock-city">${esc(z.label)}</span><span class="home-clock-time">--:--</span><span class="home-clock-status"></span></div>`).join('');
    return card('현지 시각 <span class="muted small">업무 시간 월~금 09–18</span>', rows);
  }

  function tzInfo(tz) {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const get = t => (parts.find(p => p.type === t) || {}).value;
    const hour = parseInt(get('hour'), 10) % 24;
    const weekend = get('weekday') === 'Sat' || get('weekday') === 'Sun';
    const status = weekend ? 'weekend' : (hour >= 9 && hour < 18 ? 'work' : 'off');
    const label = new Intl.DateTimeFormat('ko-KR', { timeZone: tz, month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
    return { label, status };
  }

  function startClock(page) {
    if (clockTimer) clearInterval(clockTimer);
    const tick = () => {
      const nodes = page.querySelectorAll('.home-clock');
      if (!document.body.contains(page)) { clearInterval(clockTimer); clockTimer = null; return; }
      nodes.forEach(n => {
        try {
          const info = tzInfo(n.dataset.tz);
          n.querySelector('.home-clock-time').textContent = info.label;
          const st = n.querySelector('.home-clock-status');
          st.className = 'home-clock-status s-' + info.status;
          st.textContent = { work: '업무 중', off: '업무 외', weekend: '주말' }[info.status];
        } catch (e) { n.querySelector('.home-clock-time').textContent = '시간대 오류'; }
      });
    };
    tick();
    clockTimer = setInterval(tick, 30000);
  }

  // ---------- 환율 ----------
  function fxCard() {
    const fx = S.settings.fx();
    if (!S.settings.fxReady()) {
      return card('환율', '<p class="muted">환율이 입력되지 않았습니다. 원가 계산에 필요합니다.</p><a class="btn sm" href="#admin">관리자 메뉴에서 입력</a>');
    }
    return card(`환율 <span class="muted small">${esc(fx.date || '기준일 미입력')} · ${esc(fx.source || '직접 입력')}</span>`, `
      <div class="home-fx">
        <div><span class="muted small">USD</span><strong>${num(fx.USD, 2)}원</strong></div>
        <div><span class="muted small">JPY 100</span><strong>${num(fx.JPY * 100, 2)}원</strong></div>
        <div><span class="muted small">VND 1,000</span><strong>${num(fx.VND * 1000, 2)}원</strong></div>
      </div>`, { actions: '<a class="btn sm ghost" href="#admin">수정</a>' });
  }

  // ---------- 바이어 ----------
  function buyersCard() {
    const buyers = S.buyers.list();
    const cards = buyers.map(b => {
      const gaps = S.buyers.capabilityGaps(b);
      const caseCount = S.cases.list().filter(c => c.buyerId === b.id).length;
      return `<div class="home-buyer">
        <div class="home-buyer-top">${countryBadge(b.country)} ${sampleBadge(b)} ${b.awaitingReply ? tag('회신 대기', 'b-wait') : ''}</div>
        <div class="home-buyer-name">${esc(b.name)}</div>
        <dl class="kv small">
          <dt>유형</dt><dd>${esc(S.buyers.typeLabel(b.country, b.type))}</dd>
          <dt>리드 출처</dt><dd>${esc(b.leadSource || '-')}</dd>
          <dt>담당자</dt><dd>${esc((b.contact && b.contact.name) || '-')} ${b.contact && b.contact.email ? `<span class="muted">${esc(b.contact.email)}</span>` : ''}</dd>
          <dt>마지막 연락</dt><dd>${esc(b.lastContactAt || '-')}</dd>
          <dt>진행 건</dt><dd>${caseCount}건</dd>
        </dl>
        ${gaps.length ? `<div class="warn-box"><strong>명의자 역량 부족</strong> ${esc(gaps.join(' · '))}</div>` : '<div class="muted small">명의자 역량 체크 항목 모두 표시됨 (사람 확인 기준)</div>'}
        <button class="btn sm ghost" data-act="edit-buyer" data-id="${esc(b.id)}">수정</button>
      </div>`;
    }).join('');
    return card('바이어', `<div class="home-buyers">${cards || '<p class="muted">등록된 바이어가 없습니다.</p>'}</div>`, {
      actions: '<button class="btn sm" data-act="new-buyer">+ 바이어</button>'
    });
  }

  // ---------- 규제 변화 알림 ----------
  function alertsCard() {
    const active = S.cases.list().filter(c => c.stage !== 'closed');
    const items = S.rules.timeline().filter(t => t.alert).reverse().map(t => {
      const n = active.filter(c => c.country === t.country).length;
      return `<li class="home-alert">
        <div>${countryBadge(t.country)} ${tag(STATUS_LABEL[t.status] || t.status, 'st-' + t.status)} <span class="muted small">${esc(t.date)}</span></div>
        <div>${esc(t.title)}</div>
        <div class="muted small">${esc(t.ruleId)} · 영향받는 진행 건 ${n}건</div>
      </li>`;
    }).join('');
    return card('규제 변화 알림 <span class="muted small">규칙 파일 날짜 기준</span>', `<ul class="home-alerts">${items || '<li class="muted">없음</li>'}</ul>`);
  }

  // ---------- 국가 요약 ----------
  function usdKorean(n) {
    const eok = Math.floor(n / 1e8);
    const man = Math.round((n % 1e8) / 1e4);
    return `${eok ? eok + '억 ' : ''}${man ? num(man) + '만 ' : ''}달러`;
  }

  function marketsCard() {
    const m = (window.DASH_DATA && window.DASH_DATA.markets) || { countries: {} };
    const cols = ['JP', 'VN', 'US'].map(c => {
      const x = m.countries[c];
      if (!x) return '';
      const pack = S.rules.forCountry(c);
      return `<div class="home-market">
        <div>${countryBadge(c)} <span class="muted small">${esc(pack ? pack.entry : '')}</span></div>
        <div class="home-market-num">${esc(usdKorean(x.exportUSD))} <span class="muted">(${x.sharePct}%)</span></div>
        <div class="muted small">통계 기준: ${esc(x.basis)}</div>
        <dl class="kv small"><dt>주요 채널</dt><dd>${esc(x.channels)}</dd><dt>진입 절차</dt><dd>${esc(x.entry)}</dd></dl>
      </div>`;
    }).join('');
    const src = m.source ? `<a href="${esc(m.source.url)}" target="_blank" rel="noopener">${esc(m.source.label)}</a>` : '';
    return card('국가 요약', `<div class="home-markets">${cols}</div><p class="note">${esc(m.note || '')} 출처 ${src}</p>`);
  }

  // ---------- 이벤트 ----------
  function onClick(e) {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    if (act === 'filter') { DASH.store.set('ui:homeFilter', t.dataset.v); DASH.refresh(); }
    else if (act === 'new-case') openNewCase();
    else if (act === 'open-case') {
      const c = S.cases.get(t.dataset.id);
      if (!c) return;
      DASH.store.set('ui:currentCase', c.id);
      const st = S.cases.STAGES.find(s => s.id === c.stage);
      DASH.caseContext.select(c.id);
      DASH.go(st ? st.tab : 'regulatory');
    } else if (act === 'open-task') {
      DASH.caseContext.select(t.dataset.case);
      DASH.go(t.dataset.tab || 'registration');
    } else if (act === 'edit-buyer') openBuyer(S.buyers.get(t.dataset.id));
    else if (act === 'new-buyer') openBuyer(null);
  }

  // ---------- 새 건 ----------
  function buyerOptions(country) {
    const list = S.buyers.list().filter(b => b.country === country);
    return list.map(b => `<option value="${esc(b.id)}">${esc(b.name)}${b.sample ? ' [예시]' : ''}</option>`).join('') +
      '<option value="__new">+ 새 바이어 등록</option>';
  }

  function openNewCase() {
    const products = S.products.list();
    if (!products.length) { toast('먼저 관리자 메뉴에서 제품을 등록하세요.', 'warn'); DASH.go('admin'); return; }
    const country = 'VN';
    const body = `<div class="form-grid">
      <label>국가 <select name="country">${options(['JP', 'VN', 'US'].map(c => ({ value: c, label: `${COUNTRIES[c].name} ${c}` })), country)}</select></label>
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
        <p class="muted small">명의자 역량은 저장 후 바이어 카드의 '수정'에서 체크합니다.</p>
      </fieldset>
      <label>제품 <select name="productId">${options(products.map(p => ({ value: p.id, label: p.name + (p.sample ? ' [예시]' : '') })), '')}</select></label>
      <label>판매(출시) 희망일 <input type="date" name="targetLaunchDate"></label>
    </div>`;
    const m = modal('새 건 만들기', body, {
      okLabel: '저장하고 규제 확인으로',
      onOk: el => {
        const v = DASH.ui.readForm(el);
        let buyerId = v.buyerId;
        if (buyerId === '__new') {
          if (!v.nbName) { toast('새 바이어 회사명을 입력하세요.', 'warn'); return false; }
          const hc = { JP: null, VN: null, US: null };
          hc[v.country] = {};
          const b = S.buyers.save({
            country: v.country, name: v.nbName, type: v.nbType, leadSource: v.nbLead,
            contact: { name: v.nbContact, email: v.nbEmail, timezone: v.nbTz },
            holderCapability: hc, lastContactAt: D.today(), awaitingReply: false
          });
          buyerId = b.id;
        }
        if (!buyerId) { toast('바이어를 선택하세요.', 'warn'); return false; }
        if (v.targetLaunchDate && !D.isValid(v.targetLaunchDate)) { toast('판매 희망일 형식을 확인하세요.', 'warn'); return false; }
        const c = S.cases.create({ country: v.country, buyerId, productId: v.productId, targetLaunchDate: v.targetLaunchDate });
        DASH.store.set('ui:currentCase', c.id);
        toast(`${c.id} 건을 만들었습니다.`);
        DASH.go('regulatory');
        DASH.caseContext.select(c.id);
      }
    });
    const el = m.el;
    const sync = () => {
      const c = el.querySelector('[name="country"]').value;
      const bSel = el.querySelector('[name="buyerId"]');
      bSel.innerHTML = buyerOptions(c);
      el.querySelector('[name="nbType"]').innerHTML = options(S.buyers.TYPES[c], '');
      el.querySelector('[name="nbTz"]').value = DEFAULT_TZ[c];
      toggleNew();
    };
    const toggleNew = () => { el.querySelector('.new-buyer').hidden = el.querySelector('[name="buyerId"]').value !== '__new'; };
    el.querySelector('[name="country"]').addEventListener('change', sync);
    el.querySelector('[name="buyerId"]').addEventListener('change', toggleNew);
    toggleNew();
  }
  document.addEventListener('case:new', openNewCase);

  // ---------- 바이어 수정 ----------
  function capFields(country, hc) {
    hc = hc || {};
    return (S.buyers.CAPABILITIES[country] || []).map(d => d.type === 'number'
      ? `<label>${esc(d.label)} <input type="number" min="0" name="cap_${d.key}" value="${esc(hc[d.key] === undefined || hc[d.key] === null ? '' : hc[d.key])}"></label>`
      : `<label class="check"><input type="checkbox" name="cap_${d.key}"${hc[d.key] === true ? ' checked' : ''}> ${esc(d.label)}</label>`
    ).join('');
  }

  function openBuyer(b) {
    const isNew = !b;
    b = b || { country: 'VN', name: '', type: '', leadSource: '', contact: { name: '', email: '', timezone: DEFAULT_TZ.VN }, holderCapability: { JP: null, VN: null, US: null }, lastContactAt: D.today(), awaitingReply: false };
    const hc = (b.holderCapability || {})[b.country];
    const inUse = !isNew && S.cases.list().some(c => c.buyerId === b.id);
    const body = `<div class="form-grid">
      <label>국가 <select name="country"${inUse ? ' disabled' : ''}>${options(['JP', 'VN', 'US'].map(c => ({ value: c, label: `${COUNTRIES[c].name} ${c}` })), b.country)}</select></label>
      <label>회사명 <input name="name" value="${esc(b.name)}"></label>
      <label>유형 <select name="type">${options(S.buyers.TYPES[b.country], b.type)}</select></label>
      <label>리드 출처 <input name="leadSource" value="${esc(b.leadSource)}"></label>
      <label>담당자 <input name="contactName" value="${esc(b.contact && b.contact.name)}"></label>
      <label>이메일 <input name="contactEmail" type="email" value="${esc(b.contact && b.contact.email)}"></label>
      <label>시간대 <select name="timezone">${options(TIMEZONES, b.contact && b.contact.timezone)}</select></label>
      <label>마지막 연락일 <input type="date" name="lastContactAt" value="${esc(b.lastContactAt)}"></label>
      <label class="check full"><input type="checkbox" name="awaitingReply"${b.awaitingReply ? ' checked' : ''}> 바이어 회신 대기 중</label>
      <fieldset class="full"><legend>명의자 역량 체크</legend><div class="form-grid caps">${capFields(b.country, hc)}</div>
        <p class="muted small">부족하면 바이어 카드에 주황 경고가 뜹니다. 베트남은 현지 법인이 아니면 VN-APP-01이 '사용 불가'로 판정됩니다.</p></fieldset>
    </div>`;
    const m = modal(isNew ? '바이어 등록' : '바이어 수정', body, {
      extraButtons: !isNew && !inUse ? '<button class="btn danger" data-act="del-buyer">삭제</button>' : '',
      onOk: el => {
        const v = DASH.ui.readForm(el);
        const country = inUse ? b.country : v.country;
        if (!v.name) { toast('회사명을 입력하세요.', 'warn'); return false; }
        const cap = {};
        (S.buyers.CAPABILITIES[country] || []).forEach(d => { cap[d.key] = v['cap_' + d.key]; });
        const next = Object.assign({}, b, {
          country, name: v.name, type: v.type, leadSource: v.leadSource,
          contact: { name: v.contactName, email: v.contactEmail, timezone: v.timezone },
          lastContactAt: v.lastContactAt, awaitingReply: v.awaitingReply,
          holderCapability: Object.assign({ JP: null, VN: null, US: null }, b.holderCapability, { [country]: cap })
        });
        S.buyers.save(next);
        toast('바이어를 저장했습니다.');
        DASH.caseContext.notify();
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
    if (del) del.addEventListener('click', () => { S.buyers.remove(b.id); m.close(); toast('삭제했습니다.'); DASH.caseContext.notify(); });
  }

  DASH.registerTab({
    id: 'home', icon: '🏠', label: '홈', order: 10, cssClass: 'tab-home', needsCase: false,
    render,
    summary: () => {
      const n = DASH.engine.collectTasks().filter(t => !t.waiting && D.daysUntil(t.date) <= 7).length;
      return { label: '7일 안 마감', value: n || 0 };
    }
  });
})();
