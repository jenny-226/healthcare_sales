// 🏠 홈 (README 7-1) — COSTD 홈 배치를 따른다.
//   인사말 → [환율 띠 2/3 | 바이어 현지 시각 1/3] → [수출입 카드 3개 | 최신 뉴스 + 규제 업데이트]
// 외부 API(환율·수출입·뉴스)는 서버가 없는 1단계에서는 DB 사본(data/*.js)을 보여 주고, 없으면 '연동 필요'로 표시한다.
(function () {
  const DASH = window.DASH;
  const { card, esc, countryBadge, tag, modal, toast, seg, num, COUNTRIES } = DASH.ui;
  const S = DASH.services;
  const D = DASH.dates;
  let clockTimer = null;

  const STATUS_LABEL = { draft: '초안', grace: '유예 중', effective: '시행', suspended: '정지' };
  const MAX_CITIES = 4;
  // '내가 선택'에서 고를 수 있는 도시
  const CITIES = [
    { tz: 'Asia/Tokyo', city: '도쿄', country: '일본' },
    { tz: 'Asia/Ho_Chi_Minh', city: '하노이·호찌민', country: '베트남' },
    { tz: 'America/New_York', city: '뉴욕', country: '미국 동부' },
    { tz: 'America/Chicago', city: '시카고', country: '미국 중부' },
    { tz: 'America/Denver', city: '덴버', country: '미국 산악' },
    { tz: 'America/Los_Angeles', city: 'LA', country: '미국 서부' },
    { tz: 'Asia/Shanghai', city: '상하이', country: '중국' },
    { tz: 'Asia/Taipei', city: '타이베이', country: '대만' },
    { tz: 'Asia/Bangkok', city: '방콕', country: '태국' },
    { tz: 'Asia/Singapore', city: '싱가포르', country: '싱가포르' },
    { tz: 'Asia/Jakarta', city: '자카르타', country: '인도네시아' },
    { tz: 'Asia/Kuala_Lumpur', city: '쿠알라룸푸르', country: '말레이시아' },
    { tz: 'Asia/Manila', city: '마닐라', country: '필리핀' },
    { tz: 'Australia/Sydney', city: '시드니', country: '호주' },
    { tz: 'Europe/London', city: '런던', country: '영국' },
    { tz: 'Europe/Berlin', city: '베를린', country: '독일' },
    { tz: 'Asia/Dubai', city: '두바이', country: 'UAE' }
  ];
  // 업계 뉴스를 볼 수 있는 곳 (뉴스 자동 수집은 2단계 서버에서)
  const NEWS_SOURCES = [
    { label: '식약처 보도자료', url: 'https://www.mfds.go.kr/brd/m_99/list.do' },
    { label: '한국건강기능식품협회', url: 'https://www.khsa.or.kr/' },
    { label: 'NutraIngredients-Asia', url: 'https://www.nutraingredients-asia.com/' },
    { label: 'NutraIngredients-USA', url: 'https://www.nutraingredients-usa.com/' },
    { label: 'KOTRA 해외시장뉴스', url: 'https://dream.kotra.or.kr/kotranews/index.do' }
  ];

  function greeting() {
    const h = new Date().getHours();
    if (h < 11) return '좋은 아침이에요';
    if (h < 17) return '오늘도 힘내세요';
    return '수고 많으셨어요';
  }

  function render(el) {
    const today = D.today();
    const dayLabel = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date());
    el.innerHTML = `<div class="tab-page home">
      <header class="home-top">
        <h1 class="page-title">${esc(greeting())}</h1>
        <p class="page-desc">${esc(dayLabel)} · ${esc(today)}</p>
      </header>
      <section class="home-strip">
        ${ratesCard()}
        ${clockCard()}
      </section>
      <section class="home-body">
        <div class="home-col-left">
          ${tradeSummaryCard()}
          ${topCountriesCard()}
          ${productCard()}
        </div>
        <div class="home-col-right">
          ${newsCard()}
          ${regCard()}
        </div>
      </section>
    </div>`;
    const page = el.firstElementChild;
    page.addEventListener('click', onClick);
    page.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-act="trade"]')) openTrade(); });
    startClock(page);
  }

  // ---------- 환율 띠 ----------
  function ratesCard() {
    const fx = S.settings.fx();
    // 무역 결제 통화만 보인다. 베트남 거래도 보통 달러로 결제하므로 VND는 띠에서 뺐다.
    // 원가 탭 직접 입력값에는 CNY·EUR이 없으므로 그때는 DB 기준 환율을 쓴다.
    const db = S.settings.dbFx() || {};
    const pick = code => fx[code] || db[code] || 0;
    const items = [
      { code: 'USD', unit: '', v: pick('USD') },
      { code: 'CNY', unit: '', v: pick('CNY') },
      { code: 'JPY', unit: '(100)', v: pick('JPY') * 100 },
      { code: 'EUR', unit: '', v: pick('EUR') }
    ];
    const body = S.settings.fxReady()
      ? items.map(i => `<div class="home-rate"><span class="home-rate-code">${esc(i.code)} <small>${esc(i.unit)}</small></span>
          <strong>${num(i.v, 2)}</strong><span class="home-rate-chg">전일 대비 —</span></div>`).join('')
      : '<span class="muted">환율이 없습니다. 원가 탭 상단에서 직접 입력하거나 수출입은행 API를 연동하세요.</span>';
    return `<div class="card home-rates">
      <div class="home-rates-head"><span><strong>환율</strong> <small class="muted">${fx.fromDb ? '중간값' : '직접 입력'} · 원</small></span>
        <span class="muted small">${esc(fx.source || '')}${fx.date ? ' · ' + esc(fx.date) + ' 기준' : ''}</span></div>
      <div class="home-rates-items">${body}</div>
      <p class="home-hint">전일 대비 등락률·매매기준율은 한국수출입은행 API(KOREAEXIM_API_KEY) 연동 후 표시됩니다.</p>
    </div>`;
  }

  // ---------- 바이어 현지 시각 ----------
  function activeBuyerZones() {
    const seen = new Map();
    S.cases.list().filter(c => c.stage !== 'agreed').forEach(c => {
      const b = S.buyers.get(c.buyerId);
      const tz = (b && b.contact && b.contact.timezone) || DASH.manager.DEFAULT_TZ[c.country];
      if (!seen.has(tz)) {
        const city = CITIES.find(x => x.tz === tz);
        seen.set(tz, { tz, label: city ? city.city : tz, sub: b ? b.name : COUNTRIES[c.country].name });
      }
    });
    if (!seen.size) ['JP', 'VN', 'US'].forEach(c => {
      const tz = DASH.manager.DEFAULT_TZ[c];
      const city = CITIES.find(x => x.tz === tz);
      seen.set(tz, { tz, label: city.city, sub: COUNTRIES[c].name });
    });
    return Array.from(seen.values()).slice(0, MAX_CITIES);
  }
  function customZones() {
    return DASH.store.get('ui:homeCities', ['Asia/Tokyo', 'Asia/Ho_Chi_Minh', 'America/New_York'])
      .map(tz => CITIES.find(x => x.tz === tz)).filter(Boolean).map(x => ({ tz: x.tz, label: x.city, sub: x.country }));
  }

  function clockCard() {
    const mode = DASH.store.get('ui:clockMode', 'buyers');
    const zones = mode === 'custom' ? customZones() : activeBuyerZones();
    const list = zones.map((z, i) => `<li class="home-clock" data-tz="${esc(z.tz)}">
        <span class="home-clock-city">${i + 1} ${esc(z.label)}</span>
        <span class="home-clock-time">--:--</span>
        <span class="home-clock-sub" title="${esc(z.sub)}">${esc(z.sub)}</span>
      </li>`).join('');
    return `<article class="card home-clock-card">
      <header class="home-clock-head">
        <strong>바이어 현지 시각</strong>
        <span class="home-clock-tools">
          ${seg([{ value: 'buyers', label: '진행 건 바이어' }, { value: 'custom', label: '내가 선택' }], mode, 'clock-mode')}
          ${mode === 'custom' ? '<button class="btn sm ghost" data-act="edit-cities">편집</button>' : ''}
        </span>
      </header>
      <ul class="home-clock-list">${list || '<li class="muted small">도시를 고르세요.</li>'}</ul>
      <p class="home-hint"><span class="dot dot-work"></span>초록 = 현지 업무 시간(월~금 09–18) · 검정 = 업무 외</p>
    </article>`;
  }

  function tzInfo(tz) {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const get = t => (parts.find(p => p.type === t) || {}).value;
    const hour = parseInt(get('hour'), 10) % 24;
    const weekend = get('weekday') === 'Sat' || get('weekday') === 'Sun';
    return { time: `${get('hour')}:${get('minute')}`, work: !weekend && hour >= 9 && hour < 18, weekend };
  }

  function startClock(page) {
    if (clockTimer) clearInterval(clockTimer);
    const tick = () => {
      if (!document.body.contains(page)) { clearInterval(clockTimer); clockTimer = null; return; }
      page.querySelectorAll('.home-clock').forEach(n => {
        const t = n.querySelector('.home-clock-time');
        try {
          const info = tzInfo(n.dataset.tz);
          t.textContent = info.time;
          t.className = 'home-clock-time' + (info.work ? ' is-work' : '');
          t.title = info.weekend ? '주말' : info.work ? '업무 중' : '업무 외';
        } catch (e) { t.textContent = '오류'; }
      });
    };
    tick();
    clockTimer = setInterval(tick, 30000);
  }

  function openCities() {
    const picked = DASH.store.get('ui:homeCities', ['Asia/Tokyo', 'Asia/Ho_Chi_Minh', 'America/New_York']);
    const body = `<input type="search" class="block" data-city-search placeholder="국가명 · 도시명 검색">
      <ul class="home-city-options">${CITIES.map(c => `<li data-name="${esc(c.city + ' ' + c.country)}"><label class="check">
        <input type="checkbox" value="${esc(c.tz)}"${picked.includes(c.tz) ? ' checked' : ''}> ${esc(c.city)} <span class="muted small">${esc(c.country)} · ${esc(c.tz)}</span></label></li>`).join('')}</ul>
      <p class="muted small">최대 ${MAX_CITIES}곳까지 고를 수 있어요. 서머타임은 브라우저 시간대 정보로 자동 반영됩니다.</p>`;
    const m = modal('현지 시각 도시 선택', body, {
      onOk: el => {
        const list = Array.from(el.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.value);
        if (!list.length) { toast('한 곳 이상 고르세요.', 'warn'); return false; }
        if (list.length > MAX_CITIES) { toast(`최대 ${MAX_CITIES}곳까지 고를 수 있어요.`, 'warn'); return false; }
        DASH.store.set('ui:homeCities', list);
        DASH.refresh();
      }
    });
    m.el.querySelector('[data-city-search]').addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      m.el.querySelectorAll('.home-city-options li').forEach(li => { li.hidden = q && !li.dataset.name.toLowerCase().includes(q); });
    });
  }

  // ---------- 수출입 카드 3개 ----------
  function markets() { return (window.DASH_DATA && window.DASH_DATA.markets) || { countries: {} }; }
  function usdM(n) { return '$' + num(n / 1e6, 1) + 'M'; }

  function tradeSummaryCard() {
    const m = markets();
    const list = ['JP', 'VN', 'US'].map(c => m.countries[c]).filter(Boolean);
    const total = list.reduce((s, x) => s + x.exportUSD, 0);
    const share = list.reduce((s, x) => s + x.sharePct, 0);
    const year = list.length ? list[0].year : '';
    return `<article class="card home-panel home-tcard" data-act="trade" role="button" tabindex="0" title="누르면 국가별 상세를 볼 수 있어요">
      <header class="home-panel-head"><h2>건기식 수출 <span class="home-sub">${esc(year)}년 · 대상 3개국</span></h2><span class="home-meta">관세청 · 미분류 조제식품</span></header>
      <div class="home-tsum">
        <div><span class="muted small">3개국 수출 합계</span><strong>${usdM(total)}</strong></div>
        <div><span class="muted small">전체 수출 중 비중</span><strong>${num(share, 1)}%</strong></div>
        <div><span class="muted small">월별 추이·전년 동기 대비</span><span class="home-pending">API 연동 필요</span></div>
      </div>
      <p class="home-hint">${esc(m.note || '')}</p>
    </article>`;
  }

  function topCountriesCard() {
    const m = markets();
    const rows = ['JP', 'VN', 'US'].map(c => Object.assign({ c }, m.countries[c])).filter(x => x.exportUSD)
      .sort((a, b) => b.exportUSD - a.exportUSD);
    const max = rows.length ? rows[0].exportUSD : 1;
    return `<article class="card home-panel home-tcard" data-act="trade" role="button" tabindex="0">
      <header class="home-panel-head"><h2>수출 상위국 <span class="home-sub">대상 3개국</span></h2><span class="home-meta">${esc(rows.length ? rows[0].year + '년' : '')} · 비중</span></header>
      <ol class="home-rank">${rows.map((x, i) => `<li>
        <span class="home-rank-name">${i + 1} ${esc(COUNTRIES[x.c].name)} <small class="muted">${esc(x.c)}</small></span>
        <span class="home-bar"><span style="width:${Math.round(x.exportUSD / max * 100)}%"></span></span>
        <span class="home-rank-val">${usdM(x.exportUSD)}</span><span class="home-rank-share">${num(x.sharePct, 1)}%</span>
      </li>`).join('')}</ol>
    </article>`;
  }

  function productCard() {
    return `<article class="card home-panel home-tcard" data-act="trade" role="button" tabindex="0">
      <header class="home-panel-head"><h2>품목별 수출 <span class="home-sub">HS 6단위 · 최근 12개월</span></h2><span class="home-meta">관세청 품목별 국가별 수출입실적</span></header>
      <div class="empty-inline">관세청 수출입실적 API(<code>export_api</code>)로 <code>db/csv/api_export_stats.csv</code>를 채우면 HS 2106.90 등 품목별 순위가 표시됩니다.</div>
    </article>`;
  }

  function openTrade() {
    const m = markets();
    const rows = ['JP', 'VN', 'US'].map(c => {
      const x = m.countries[c];
      if (!x) return '';
      const pack = S.rules.forCountry(c);
      return `<div class="home-market">
        <div>${countryBadge(c)} <span class="muted small">${esc(pack ? pack.entry : '')}</span></div>
        <div class="home-market-num">${usdM(x.exportUSD)} <span class="muted">(${x.sharePct}%)</span></div>
        <div class="muted small">통계 기준: ${esc(x.basis)}</div>
        <dl class="kv small"><dt>주요 채널</dt><dd>${esc(x.channels)}</dd><dt>진입 절차</dt><dd>${esc(x.entry)}</dd></dl>
      </div>`;
    }).join('');
    const src = m.source ? `<a href="${esc(m.source.url)}" target="_blank" rel="noopener">${esc(m.source.label)}</a>` : '';
    modal('건기식 수출 상세', `<div class="home-markets">${rows}</div>
      <p class="note">${esc(m.note || '')} 출처 ${src}</p>
      <p class="muted small">월별·품목별 상세 조회는 관세청 API 연동 후 제공합니다. 지금은 <a href="https://stat.kita.net/" target="_blank" rel="noopener">K-stat</a>에서 확인하세요.</p>`, { wide: true });
  }

  // ---------- 최신 뉴스 ----------
  function newsCard() {
    return `<article class="card home-panel home-news">
      <header class="home-panel-head"><h2>건기식 최신 뉴스</h2><span class="home-meta">RSS 수집 · 2단계</span></header>
      <div class="empty-inline">뉴스 자동 수집(RSS·크롤링)은 서버가 필요해 2단계에서 붙입니다. 지금은 아래 출처에서 바로 확인하세요.</div>
      <ul class="home-links">${NEWS_SOURCES.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)} ↗</a></li>`).join('')}</ul>
    </article>`;
  }

  // ---------- 규제 업데이트 (규칙 파일 타임라인) ----------
  function regItems() {
    const today = D.today();
    const active = S.cases.list().filter(c => c.stage !== 'agreed');
    return S.rules.timeline().slice().reverse().map(t => {
      const age = -D.daysUntil(t.date, today);
      return Object.assign({}, t, { isNew: age >= 0 && age <= 90, affected: active.filter(c => c.country === t.country).length });
    });
  }
  function regRow(t) {
    return `<li class="home-reg-item">
      <div class="home-reg-top">${countryBadge(t.country)} ${tag(STATUS_LABEL[t.status] || t.status, 'st-' + t.status)} ${t.isNew ? '<span class="badge home-new">NEW</span>' : ''}</div>
      <div class="home-reg-title">${esc(t.title)}</div>
      <div class="muted small">${esc(t.date)} · <span class="rule-id">${esc(t.ruleId || '')}</span>${t.affected ? ` · 진행 건 ${t.affected}건 영향` : ''}</div>
    </li>`;
  }
  function regCard() {
    const items = regItems();
    const top = items.filter(t => t.alert).concat(items.filter(t => !t.alert)).slice(0, 4);
    return `<article class="card home-panel home-reg">
      <header class="home-panel-head"><h2>규제 업데이트</h2>
        <span class="home-panel-tools"><span class="home-meta">규칙 파일 기준</span><button class="link-btn" data-act="reg-more">더보기 →</button></span></header>
      <ol class="home-reg-list">${top.map(regRow).join('') || '<li class="muted">없음</li>'}</ol>
      <p class="home-hint">KOTRA·식약처 실시간 규제 소식은 공공데이터포털 API(2단계) 연동 후 함께 표시됩니다.</p>
    </article>`;
  }

  // ---------- 이벤트 ----------
  function onClick(e) {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    if (act === 'clock-mode') { DASH.store.set('ui:clockMode', t.dataset.v); DASH.refresh(); }
    else if (act === 'edit-cities') openCities();
    else if (act === 'trade') openTrade();
    else if (act === 'reg-more') modal('규제 업데이트 전체', `<ol class="home-reg-list">${regItems().map(regRow).join('')}</ol>`, { wide: true });
  }

  DASH.registerTab({
    id: 'home', icon: '🏠', label: '홈', order: 10, cssClass: 'tab-home', needsCase: false,
    render,
    summary: () => ({ label: '최근 90일 규제 변화', value: regItems().filter(t => t.isNew).length })
  });
})();
