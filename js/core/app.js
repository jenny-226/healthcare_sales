// 탭 등록·전환, 해시 라우팅(#home, #regulatory ...), 상단 건 선택 바, 베트남 규정 배너.
(function () {
  const DASH = window.DASH = window.DASH || {};
  const tabs = [];
  let activeId = null;

  // def: {id, icon, label, order, cssClass, needsCase, admin, render(el, ctx), summary(ctx)}
  DASH.registerTab = function (def) {
    tabs.push(def);
    tabs.sort((a, b) => (a.order || 0) - (b.order || 0));
  };

  DASH.go = function (id) {
    if (location.hash === '#' + id) renderTab();
    else location.hash = '#' + id;
  };

  function tabById(id) { return tabs.find(t => t.id === id); }

  function currentTabId() {
    const h = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (tabById(h)) return h;
    const last = DASH.store.get('ui:lastTab', 'home');
    return tabById(last) ? last : 'home';
  }

  function caseLabel(c) {
    const { COUNTRIES } = DASH.ui;
    const b = DASH.services.buyers.get(c.buyerId);
    const p = DASH.services.products.get(c.productId);
    return `${(COUNTRIES[c.country] || {}).name || c.country} · ${b ? b.name : '바이어 미지정'} · ${p ? p.name : '제품 미지정'}${c.sample ? ' [예시]' : ''}`;
  }
  DASH.caseLabel = caseLabel;

  function renderNav() {
    const { esc } = DASH.ui;
    const ctx = DASH.caseContext.get();
    const item = t => {
      let count = '';
      if (t.summary && ctx) {
        try {
          const s = t.summary(ctx);
          if (s && s.value) count = `<span class="nav-count" title="${esc(s.label)}">${esc(s.value)}</span>`;
        } catch (e) { /* 요약 실패는 무시 */ }
      }
      return `<a href="#${t.id}" class="nav-item${t.id === activeId ? ' active' : ''}" data-tab="${t.id}">
        <span class="nav-icon" aria-hidden="true">${t.icon}</span><span class="nav-label">${esc(t.label)}</span>${count}</a>`;
    };
    document.getElementById('nav').innerHTML = tabs.filter(t => !t.admin).map(item).join('');
    document.getElementById('nav-admin').innerHTML = tabs.filter(t => t.admin).map(item).join('');
  }

  function renderCaseBar() {
    const { esc } = DASH.ui;
    const cases = DASH.services.cases.list();
    const cur = DASH.caseContext.currentId();
    const el = document.getElementById('casebar');
    el.innerHTML = `
      <label class="casebar-label" for="case-select">현재 건</label>
      <select id="case-select" class="casebar-select">
        <option value="">— 건을 선택하세요 —</option>
        ${cases.map(c => `<option value="${esc(c.id)}"${c.id === cur ? ' selected' : ''}>${esc(c.id)} · ${esc(caseLabel(c))}</option>`).join('')}
      </select>
      <button class="btn primary" data-act="new-case">+ 새 건</button>
      <span class="casebar-spacer"></span>
      <span class="casebar-note" title="화면의 모든 판정은 1차 참고용입니다. 최종 판단은 규제 담당과 현지 바이어(명의자)가 합니다.">⚠️ 사전검토 보조 도구</span>`;
    el.querySelector('#case-select').addEventListener('change', e => {
      if (e.target.value) DASH.caseContext.select(e.target.value);
      else DASH.caseContext.clear();
    });
    el.querySelector('[data-act="new-case"]').addEventListener('click', () => {
      DASH.go('home');
      setTimeout(() => document.dispatchEvent(new CustomEvent('case:new')), 0);
    });
  }

  // README 7-0: VN 건을 열면 모든 탭 상단에 VN-LAW-01 배너 고정
  function renderBanner(ctx, def) {
    const { esc } = DASH.ui;
    const el = document.getElementById('banner');
    const parts = [];
    if (ctx && def && def.needsCase) {
      const pack = DASH.services.rules.forCountry(ctx.country);
      if (pack && pack.banner) {
        parts.push(`<div class="banner banner-law"><strong>${esc(pack.banner.ruleId)}</strong> ${esc(pack.banner.text)} <span class="badge b-verify">원문 확인 필요</span></div>`);
      }
    }
    if (!DASH.store.isPersistent()) {
      parts.push('<div class="banner banner-warn">이 브라우저에서는 저장소를 쓸 수 없어 새로고침하면 입력 내용이 사라집니다.</div>');
    }
    el.innerHTML = parts.join('');
  }

  function renderTab() {
    activeId = currentTabId();
    const def = tabById(activeId);
    DASH.store.set('ui:lastTab', activeId);
    const root = document.getElementById('tab-root');
    const ctx = DASH.caseContext.get();
    root.className = 'tab-root ' + (def.cssClass || '');
    renderNav();
    renderBanner(ctx, def);
    document.title = `${def.label} · 건기식 해외영업 대시보드`;
    if (def.needsCase && !ctx) { root.innerHTML = DASH.ui.emptyCase(); return; }
    try {
      def.render(root, ctx);
    } catch (e) {
      console.error(e);
      root.innerHTML = `<div class="empty"><h2>화면을 그리는 중 오류가 났습니다</h2><p class="muted">${DASH.ui.esc(e.message)}</p></div>`;
    }
  }

  function refresh() {
    const main = document.querySelector('.main');
    const y = main ? main.scrollTop : 0;
    renderCaseBar();
    renderTab();
    if (main) main.scrollTop = y;
  }
  DASH.refresh = refresh;

  document.addEventListener('DOMContentLoaded', () => {
    DASH.store.seedIfNeeded();
    window.addEventListener('hashchange', () => { renderTab(); document.querySelector('.main').scrollTop = 0; });
    document.addEventListener('case:changed', e => {
      if (e.detail && e.detail.reason === 'select') { renderCaseBar(); renderTab(); }
      else refresh();
    });
    renderCaseBar();
    renderTab();
  });
})();
