// 탭 등록·전환, 해시 라우팅(#home, #regulatory ...), 베트남 규정 배너.
(function () {
  const DASH = window.DASH = window.DASH || {};
  const tabs = [];
  let activeId = null;

  // def: {id, icon, label, order, cssClass, needsCase, render(el, ctx), summary(ctx)}
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
    document.getElementById('nav').innerHTML = tabs.map(item).join('');
  }

  // 상단 건 선택 바는 없앴다. 건은 바이어 발굴 탭에서 열고, 건이 필요한 탭은 마지막으로 연 건을 보여준다.
  // 선택된 건이 없으면 가장 최근 건을 자동으로 고른다.
  function ensureCase() {
    let ctx = DASH.caseContext.get();
    if (ctx) return ctx;
    const cases = DASH.services.cases.list();
    if (!cases.length) return null;
    ctx = cases[cases.length - 1];
    DASH.store.set('ui:currentCase', ctx.id);
    return ctx;
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
    const ctx = def.needsCase ? ensureCase() : DASH.caseContext.get();
    root.className = 'tab-root ' + (def.cssClass || '');
    renderNav();
    renderBanner(ctx, def);
    document.title = `${def.label} · 건기식 해외영업 대시보드`;
    if (def.needsCase && !ctx) {
      root.innerHTML = DASH.ui.emptyCase();
      root.querySelector('[data-act="empty-to-buyers"]').addEventListener('click', () => DASH.go('buyers'));
      return;
    }
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
    renderTab();
    if (main) main.scrollTop = y;
  }
  DASH.refresh = refresh;

  document.addEventListener('DOMContentLoaded', () => {
    DASH.store.seedIfNeeded();
    window.addEventListener('hashchange', () => { renderTab(); document.querySelector('.main').scrollTop = 0; });
    document.addEventListener('case:changed', e => {
      if (e.detail && e.detail.reason === 'select') renderTab();
      else refresh();
    });
    document.querySelector('[data-act="open-manager"]').addEventListener('click', () => DASH.manager.openManager());
    renderTab();
  });
})();
