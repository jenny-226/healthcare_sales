// 🔎 바이어 발굴 (README 7-5) — reboot-dashboard '업체 컨택' 화면 짜임을 따른다.
//   상단 현황 띠 → [바이어 찾기 | 제안 작성 | 영업 관리]
//   바이어 찾기 = 기준 제품 하나 + 한 줄 필터 바(검색·국가·유형·세부 카테고리·토글·정렬) + 목록(페이지) + 오른쪽 바이어 카드
// 실무 흐름 ①~⑦ 위치:
//   ① 국가·제품군 선정 = 기준 제품 · 국가 필터    ② 잠재 바이어 검색 = 목록(적합도순)
//   ③ 포트폴리오 분석 · ④ 자사 생산 비교 · ⑤ 우선순위 = 오른쪽 바이어 카드
//   ⑥ 제품 제안 준비 = 제안 작성    ⑦ 첫 연락·후속 관리 = 영업 관리 (보드 + 표)
(function () {
  const DASH = window.DASH;
  const { esc, table, options, toast, modal, seg, pageHead, FORMS, num } = DASH.ui;
  const S = DASH.services;
  const P = () => S.prospects;
  const D = DASH.dates;

  const PAGE = 8;
  const CHANNELS = ['이메일', 'WhatsApp', '전화', '화상 미팅', '전시회·상담회', 'LinkedIn'];
  const POINTS = [
    { key: 'sample', label: '샘플 무상 제공' },
    { key: 'docs', label: '현지 등록·신고 서류 지원' },
    { key: 'moq', label: '소량 MOQ로 테스트 주문' },
    { key: 'custom', label: '맞춤 처방(ODM) 개발' }
  ];
  const SORTS = { score: '적합도 높은 순', name: '이름 순', country: '국가 순' };
  const STATUS_ICON = { found: '⚪', contacted: '🔵', replied: '🟢', sample: '🟣', converted: '✅', hold: '🟤' };

  function ui() {
    return Object.assign({ sub: 'find', mode: 'product', productId: '', ideaCategory: '', ideaForm: '', q: '', country: '', type: '', tag: '',
      onlyMake: false, onlyReg: false, sort: 'score', page: 1, selected: '', points: ['sample', 'docs'] }, DASH.store.get('ui:byr', {}));
  }
  function setUi(patch) { DASH.store.set('ui:byr', Object.assign(ui(), patch)); }

  // 기준 제품(또는 신규 아이디어) → 적합도 계산 조건. 칩 6줄 대신 이것 하나로 점수를 매긴다.
  function criteria(u) {
    if (u.mode === 'idea') return { categories: u.ideaCategory ? [u.ideaCategory] : [], forms: u.ideaForm ? [u.ideaForm] : [], ingredients: [], dealTypes: [] };
    const prod = S.products.get(u.productId) || S.products.list()[0];
    return prod ? Object.assign(P().criteriaFromProduct(prod), { dealTypes: [] }) : {};
  }
  function baseProduct(u) { return u.mode === 'product' ? (S.products.get(u.productId) || S.products.list()[0] || null) : null; }

  function render(el) {
    const u = ui();
    el.innerHTML = `<div class="tab-page">
      ${pageHead('🔎 바이어 발굴', '기준 제품 하나만 고르면 맞는 해외 바이어를 적합도 순으로 보여 줘요. 제안 작성과 후속 연락까지 이어서 관리해요.',
        '<button class="btn" data-act="capability">자사 제조 역량</button>')}
      ${hero()}
      ${seg([{ value: 'find', label: '🔎 바이어 찾기' }, { value: 'mail', label: '✉️ 제안 작성' }, { value: 'manage', label: '🗂️ 영업 관리' }], u.sub, 'sub', { cls: 'block' })}
      <div class="byr-body">${u.sub === 'mail' ? mailView(u) : u.sub === 'manage' ? manageView() : findView(u)}</div>
    </div>`;
    bind(el.firstElementChild);
  }

  // ---------- 현황 띠 ----------
  function hero() {
    const pl = P().pipeline.list();
    const contacted = pl.filter(e => e.status !== 'found').length;
    const active = pl.filter(e => ['replied', 'sample'].includes(e.status)).length;
    const replied = pl.filter(e => ['replied', 'sample', 'converted'].includes(e.status)).length;
    const soon = D.addCalendarDays(D.today(), 7);
    const due = pl.filter(e => e.nextDate && e.nextDate <= soon && !['converted', 'hold'].includes(e.status)).length;
    const pct = contacted ? Math.round(active / contacted * 100) : 0;
    return `<section class="byr-hero" aria-label="영업 현황">
      <div><h3>관리 중인 바이어</h3><div class="byr-num">${pl.length}<small>곳</small></div><p>잠재 바이어 DB ${P().list().length}곳 중 · 연락함 ${contacted}곳</p></div>
      <div><h3>진행 중인 협의</h3><div class="byr-num byr-lime">${active}<small>곳</small></div><p>회신 ${pl.filter(e => e.status === 'replied').length} · 샘플·견적 ${pl.filter(e => e.status === 'sample').length} · 건 전환 ${pl.filter(e => e.status === 'converted').length}</p>
        <div class="byr-track"><i style="width:${pct}%"></i></div></div>
      <div><h3>7일 안 후속 연락</h3><div class="byr-num">${due}<small>곳</small></div><p>${contacted ? `회신율 ${Math.round(replied / contacted * 100)}%` : '아직 연락한 바이어가 없어요'}</p></div>
    </section>`;
  }

  // ---------- 바이어 찾기 ----------
  function tagCounts(list) {
    const out = {};
    list.forEach(p => p.categories.forEach(t => { out[t] = (out[t] || 0) + 1; }));
    return out;
  }
  function filtered(u, cr, ignore) {
    const cap = P().capability();
    const q = u.q.trim().toLowerCase();
    let list = P().list().filter(p =>
      (ignore === 'country' || !u.country || p.country === u.country) &&
      (ignore === 'type' || !u.type || p.type === u.type) &&
      (ignore === 'tag' || !u.tag || p.categories.includes(u.tag)) &&
      (!u.onlyMake || p.forms.some(f => (cap.forms || []).includes(f))) &&
      (!u.onlyReg || !!S.rules.forCountry(p.country)) &&
      (!q || [p.name, p.city, P().countryName(p.country), P().typeLabel(p.type), p.categories.join(' '), p.ingredients.join(' '), p.note].join(' ').toLowerCase().includes(q)));
    list = list.map(p => ({ p, s: P().score(p, cr) }));
    if (u.sort === 'name') list.sort((a, b) => a.p.name.localeCompare(b.p.name));
    else if (u.sort === 'country') list.sort((a, b) => P().countryName(a.p.country).localeCompare(P().countryName(b.p.country)) || b.s.total - a.s.total);
    else list.sort((a, b) => b.s.total - a.s.total);
    return list;
  }

  function baseBar(u) {
    const prods = S.products.list();
    const M = P().masters();
    const cap = P().capability();
    const prod = baseProduct(u);
    const right = u.mode === 'product'
      ? `<select class="byr-cf" data-u="productId" aria-label="기준 제품">${options(prods.map(p => ({ value: p.id, label: p.name })), prod ? prod.id : '')}</select>
         ${prod ? `<span class="byr-base-sum">${esc(FORMS[prod.form] || prod.form)} · ${esc(P().categoryOf(prod) || '카테고리 미지정')}${P().ingredientsOf(prod).length ? ' · ' + esc(P().ingredientsOf(prod).join(', ')) : ''}</span>` : '<span class="muted small">제품이 없어요 — 상단 + 새 건에서 등록하거나 신규 아이디어로 찾으세요.</span>'}`
      : `<select class="byr-cf" data-u="ideaCategory" aria-label="제품 카테고리"><option value="">제품 카테고리</option>${options(M.categories, u.ideaCategory)}</select>
         <select class="byr-cf" data-u="ideaForm" aria-label="희망 제형"><option value="">희망 제형</option>${options(Object.keys(FORMS).map(k => ({ value: k, label: FORMS[k] + ((cap.forms || []).includes(k) ? '' : ' (자사 생산 불가)') })), u.ideaForm)}</select>
         ${u.ideaForm && !(cap.forms || []).includes(u.ideaForm) ? '<span class="byr-warn small">자사 생산 불가 제형 — 외주·설비 검토 필요</span>' : ''}`;
    return `<div class="byr-base"><span class="byr-base-label">① 기준</span>
      ${seg([{ value: 'product', label: '자사 제품' }, { value: 'idea', label: '신규 아이디어' }], u.mode, 'mode')}
      ${right}</div>`;
  }

  function findView(u) {
    const cr = criteria(u);
    const list = filtered(u, cr);
    const M = P().masters();
    const countBy = (key, all) => all.reduce((o, x) => { o[x.p[key]] = (o[x.p[key]] || 0) + 1; return o; }, {});
    const cN = countBy('country', filtered(u, cr, 'country'));
    const tN = countBy('type', filtered(u, cr, 'type'));
    const gN = tagCounts(filtered(u, cr, 'tag').map(x => x.p));
    const sel = (key, all, opts, cur) => `<select class="byr-cf${cur ? ' on' : ''}" data-u="${key}" aria-label="${esc(all)}"><option value="">${esc(all)}</option>${opts.map(([v, l]) => `<option value="${esc(v)}"${cur === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    const tog = (key, label) => `<button type="button" class="byr-cf${u[key] ? ' on' : ''}" data-act="tog" data-k="${key}" aria-pressed="${!!u[key]}">${esc(label)}</button>`;
    const any = u.q || u.country || u.type || u.tag || u.onlyMake || u.onlyReg;
    const bar = `<div class="byr-cfbar">
        <input type="search" class="byr-q" data-u="q" value="${esc(u.q)}" placeholder="기업·국가·제품·원료로 검색" aria-label="바이어 검색">
        ${sel('country', '국가 전체', M.countries.map(c => [c.code, `${c.name} (${cN[c.code] || 0})`]), u.country)}
        ${sel('type', '유형 전체', M.types.map(t => [t.value, `${t.label} (${tN[t.value] || 0})`]), u.type)}
        ${sel('tag', '세부 카테고리', M.categories.filter(c => gN[c]).map(c => [c, `${c} (${gN[c]})`]), u.tag)}
        ${tog('onlyMake', '자사 생산 가능만')}${tog('onlyReg', '규제 규칙 있는 국가만')}
        ${any ? '<button type="button" class="link-btn" data-act="reset">필터 지우기</button>' : ''}
        <span class="byr-gap"></span>
        <select class="byr-cf" data-u="sort" aria-label="정렬">${options(Object.keys(SORTS).map(k => ({ value: k, label: '정렬: ' + SORTS[k] })), u.sort)}</select>
      </div>`;
    const pages = Math.max(1, Math.ceil(list.length / PAGE));
    const cur = Math.min(Math.max(1, u.page), pages);
    const shown = list.slice((cur - 1) * PAGE, cur * PAGE);
    const rows = shown.map(({ p, s }) => {
      const pl = P().pipeline.get(p.id);
      return `<tr class="byr-row${p.id === u.selected ? ' is-sel' : ''}" data-act="select" data-id="${esc(p.id)}" tabindex="0">
        <td><div class="byr-1l">${avatar(p)}<b>${esc(p.name)}</b>${pl ? `<span class="byr-st" title="${esc(statusLabel(pl.status))}">${STATUS_ICON[pl.status]}</span>` : ''}</div></td>
        <td>${esc(P().countryName(p.country))}</td>
        <td>${esc(P().typeLabel(p.type))}</td>
        <td><div class="byr-1l">${p.categories.slice(0, 2).map(t => `<span class="byr-tag">${esc(t)}</span>`).join('')}${p.categories.length > 2 ? `<span class="muted small">+${p.categories.length - 2}</span>` : ''}</div></td>
        <td>${scoreCell(s)}</td>
        <td class="small">${esc(s.reasons.join(' · ') || '-')}</td>
      </tr>`;
    }).join('');
    const pager = pages > 1 ? `<div class="byr-pg"><span class="muted small">${list.length}곳 중 ${(cur - 1) * PAGE + 1}–${(cur - 1) * PAGE + shown.length}</span>
      <nav>${Array.from({ length: pages }, (_, i) => `<button type="button" class="byr-pgb${i + 1 === cur ? ' on' : ''}" data-act="page" data-p="${i + 1}">${i + 1}</button>`).join('')}</nav></div>` : '';
    const selItem = list.find(x => x.p.id === u.selected) || (u.selected && P().get(u.selected) ? { p: P().get(u.selected), s: P().score(P().get(u.selected), cr) } : null);

    return `${baseBar(u)}
      <div class="byr-bench">
        <section class="card byr-list">
          <div class="card-head"><h3>② 바이어 목록 <span class="count">${list.length}곳</span></h3><span class="muted small">적합도 = 기준 제품과 맞는 정도</span></div>
          ${bar}
          <div class="card-body">
            ${list.length ? `<div class="table-wrap"><table class="tbl byr-table"><thead><tr><th>기업</th><th>국가</th><th>유형</th><th>세부 카테고리</th><th>영업 적합도</th><th>확인 근거</th></tr></thead><tbody>${rows}</tbody></table></div>${pager}`
              : '<div class="empty-inline">조건에 맞는 바이어가 없어요. 필터를 줄여 보세요.</div>'}
            <p class="byr-note"><em>기업명과 점수는 화면 기능 설명을 위한 가상 데이터입니다.</em> 적합도 87점은 구매 확률 87%가 아니라 <strong>영업 우선순위 지표</strong>예요. 행을 누르면 오른쪽에 바이어 카드가 열려요.</p>
          </div>
        </section>
        <aside class="byr-detail" aria-live="polite">${selItem ? detail(selItem.p, selItem.s) : '<div class="empty-inline byr-detail-empty">목록에서 바이어를 고르면<br>포트폴리오 · 자사 생산 비교 · 우선순위가 여기에 보여요.</div>'}</aside>
      </div>`;
  }

  function avatar(p) {
    const ini = p.name.replace(/\(.*\)/, '').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const hue = [...p.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 6;
    return `<span class="byr-av av${hue}">${esc(ini)}</span>`;
  }
  function scoreCell(s) {
    return `<div class="byr-score"><span class="byr-pri p-${s.priority}">${s.priority}</span><strong>${s.total}</strong><span class="byr-bar"><span style="width:${s.total}%"></span></span></div>`;
  }
  function statusLabel(v) { return (P().STATUSES.find(x => x.value === v) || {}).label || v; }

  // 오른쪽 바이어 카드: ③ 포트폴리오 · ④ 자사 생산 비교 · ⑤ 우선순위 · 최근 활동
  function detail(p, s) {
    const cap = P().capability();
    const pl = P().pipeline.get(p.id);
    const nt = P().notes(p.id);
    const pack = S.rules.forCountry(p.country);
    const ok = t => `<span class="byr-ok">✓ ${esc(t)}</span>`;
    const ng = t => `<span class="byr-ng">✕ ${esc(t)}</span>`;
    const ck = t => `<span class="byr-ck">? ${esc(t)}</span>`;
    const formsCmp = p.forms.map(f => ((cap.forms || []).includes(f) ? ok : ng)(FORMS[f] || f)).join(' ');
    const certCmp = (p.certsRequired || []).map(c => ((cap.certs || []).some(x => x.toLowerCase() === c.toLowerCase()) ? ok : ck)(c)).join(' ') || '<span class="muted">-</span>';
    const ingCmp = p.ingredients.map(i => ((cap.strengths || []).includes(i) ? ok : ck)(i)).join(' ');
    const deal = p.dealTypes.filter(d => (cap.dealTypes || []).includes(d));
    const best = P().matchProducts(p)[0];
    const log = ((pl && pl.log) || []).slice().reverse().slice(0, 3);
    return `<div class="byr-dhead">${avatar(p)}<div><h2>${esc(p.name)}</h2><p class="muted small">${esc(P().countryName(p.country))} ${esc(p.city)} · ${esc(P().typeLabel(p.type))} · ${esc(p.size)}</p></div></div>
      <div class="byr-stats">
        <div><strong>${s.total}</strong><small>영업 적합도</small></div>
        <div><strong><span class="byr-pri p-${s.priority}">${s.priority}</span></strong><small>우선순위</small></div>
        <div><strong class="is-text">${pl ? STATUS_ICON[pl.status] + ' ' + esc(statusLabel(pl.status)) : '—'}</strong><small>진행 상태</small></div>
      </div>
      <div class="byr-block"><h4>③ 포트폴리오</h4>
        <dl class="kv small"><dt>홈페이지</dt><dd>${p.website ? `<a href="${esc(p.website)}" target="_blank" rel="noopener">${esc(p.website)}</a>` : '<span class="muted">가상 기업 — 없음</span>'}</dd>
        <dt>채널</dt><dd>${esc(p.channels.join(', '))}</dd><dt>제품군</dt><dd>${esc(p.categories.join(', '))}</dd><dt>메모</dt><dd>${esc(p.note || '-')}</dd></dl>
        <input class="byr-memo" data-note="hero" value="${esc(nt.hero || '')}" placeholder="분석 메모 — 주력 제품·가격대, 기존 제조사 등">
      </div>
      <div class="byr-block"><h4>④ 자사 생산 비교</h4>
        <div class="byr-cmp"><span>제형</span><div>${formsCmp}</div><span>원료</span><div>${ingCmp}</div><span>인증</span><div>${certCmp}</div>
          <span>거래</span><div>${deal.length ? ok(deal.join('·')) : ng(p.dealTypes.join('·'))}</div></div>
        <p class="muted small">✓ 가능·보유 · ✕ 불가 · ? 확인 필요 (자사 값은 상단 '자사 제조 역량')</p>
      </div>
      <div class="byr-block"><h4>⑤ 적합도 구성</h4>
        <ul class="byr-parts">${s.parts.map(x => `<li title="${esc(x.why)}"><span>${esc(x.label)}</span><span class="byr-bar"><span style="width:${x.got / x.max * 100}%"></span></span><b>${x.got}/${x.max}</b></li>`).join('')}</ul>
        <p class="muted small">${pack ? `${esc(P().countryName(p.country))}: ${esc(pack.entry)} — 건 전환 후 규제 확인 탭에서 사전검토` : '규제 규칙 미등록 국가 — 진출 전 수동 확인'}${best ? ` · 추천 제안 제품: <strong>${esc(best.prod.name)}</strong>` : ''}</p>
      </div>
      <div class="byr-block"><h4>최근 활동</h4>${log.length ? `<ul class="plain small">${log.map(l => `<li><strong>${esc(l.date)}</strong> ${esc(l.channel)} — ${esc(l.text)}</li>`).join('')}</ul>` : '<p class="muted small">아직 기록이 없어요.</p>'}</div>
      <div class="byr-dactions">
        <button class="btn primary" data-act="compose" data-id="${esc(p.id)}">제안 작성 ↗</button>
        ${pl ? '<button class="btn" data-act="goto-manage">영업 관리에서 보기</button>' : `<button class="btn" data-act="add-pipeline" data-id="${esc(p.id)}">관리 목록에 추가</button>`}
      </div>`;
  }

  // ---------- ⑥ 제안 작성 ----------
  const EN = {
    '장 건강': 'gut health', '뷰티·이너뷰티': 'beauty-from-within', '비타민·미네랄': 'vitamin & mineral', '관절·뼈': 'joint & bone',
    '면역': 'immune support', '수면·스트레스': 'sleep & stress', '체중 관리': 'weight management', '눈 건강': 'eye health', '간 건강': 'liver health',
    capsule: 'capsules', tablet: 'tablets', powder: 'powder sticks', softgel: 'softgels', jelly_stick: 'jelly sticks', liquid: 'liquids',
    OEM: 'OEM', ODM: 'ODM', '완제품 공급': 'finished goods supply', '식약처 GMP': 'MFDS GMP',
    '프로바이오틱스': 'probiotics', '프락토올리고당': 'FOS', '콜라겐': 'collagen', '히알루론산': 'hyaluronic acid', '비타민 C': 'vitamin C',
    '비타민 D': 'vitamin D', '마그네슘': 'magnesium', '아연': 'zinc', '오메가3': 'omega-3', '루테인': 'lutein', 'MSM': 'MSM',
    '글루코사민': 'glucosamine', '홍삼': 'Korean red ginseng', '밀크씨슬': 'milk thistle', '테아닌': 'L-theanine', '가르시니아': 'garcinia'
  };
  const en = v => EN[v] || v;
  const POINT_EN = {
    sample: 'Free samples for your evaluation',
    docs: 'Support with local registration/notification documents (formula data, COA, GMP certificate)',
    moq: 'A small trial order to start',
    custom: 'Custom formulation (ODM) for your brand'
  };

  function draft(p, productId, points, sender) {
    const prod = S.products.get(productId);
    const cap = P().capability();
    const cat = prod ? P().categoryOf(prod) : p.categories[0];
    const offer = prod ? `${en(cat) || 'health'} ${en(prod.form)}` : `${en(p.categories[0])} products`;
    const ings = prod ? P().ingredientsOf(prod) : [];
    const pts = (points || []).map(k => POINT_EN[k] ? (k === 'moq' ? `${POINT_EN[k]} (MOQ from ${num(cap.moq || 0)} units)` : POINT_EN[k]) : '').filter(Boolean).map(t => '- ' + t);
    return {
      subject: `${offer.charAt(0).toUpperCase() + offer.slice(1)} — OEM/ODM proposal from a Korean manufacturer`,
      body: `Dear ${p.name.replace(/\s*\(가상\)/, '')} sourcing team,

I am reaching out from a Korean health functional food manufacturer (${(cap.certs || []).map(en).join(', ')}).
We noticed your ${p.categories.map(en).join(' / ')} line and believe our ${offer}${ings.length ? ` with ${ings.map(en).join(' and ')}` : ''} could fit your portfolio.

What we can offer:
${pts.join('\n') || '- Product sheet and specifications on request'}
- Formats: ${(cap.forms || []).map(en).join(', ')} · Business models: ${(cap.dealTypes || []).map(en).join(', ')}

Would you be open to a short call next week? We are happy to align with your requirements${(p.certsRequired || []).length ? ` (${p.certsRequired.join(', ')})` : ''}.

Best regards,
${sender || '[Name]'}`
    };
  }

  // 표현 점검: 규칙 파일의 문구 점검 표현(질병·의약품 표현 등) — 국가 규칙이 있을 때만
  function claimCheck(country, text) {
    const terms = S.rules.claimTerms(country) || {};
    const low = String(text || '').toLowerCase();
    const hits = [];
    Object.keys(terms).forEach(k => (terms[k] || []).forEach(t => {
      const re = /^[a-z]+$/i.test(t) ? new RegExp(`\\b${t}\\b`, 'i') : null;
      if (re ? re.test(text) : low.includes(t.toLowerCase())) hits.push({ term: t, kind: k });
    }));
    return hits;
  }

  function mailView(u) {
    const pl = P().pipeline.list();
    const ids = Array.from(new Set(pl.map(e => e.prospectId).concat(u.selected ? [u.selected] : []))).filter(id => P().get(id));
    if (!ids.length) return '<div class="card"><div class="card-body"><div class="empty-inline">바이어 찾기에서 바이어를 고른 뒤 <strong>제안 작성 ↗</strong>을 누르세요.</div></div></div>';
    const to = P().get(u.mailTo && ids.includes(u.mailTo) ? u.mailTo : (u.selected && ids.includes(u.selected) ? u.selected : ids[0]));
    const nt = P().notes(to.id);
    const e = P().pipeline.get(to.id);
    const prods = S.products.list();
    const productId = (e && e.productId) || nt.productId || ((P().matchProducts(to)[0] || {}).prod || {}).id || '';
    const d = nt.mailBody ? { subject: nt.mailSubject || '', body: nt.mailBody } : draft(to, productId, u.points, u.sender);
    const hits = S.rules.forCountry(to.country) ? claimCheck(to.country, d.subject + '\n' + d.body) : null;
    return `<div class="byr-mail-grid">
      <section class="card"><div class="card-head"><h3>⑥ 제안 조건</h3></div><div class="card-body">
        <label class="block">받는 바이어<select data-u="mailTo">${options(ids.map(id => ({ value: id, label: `${P().get(id).name} · ${P().countryName(P().get(id).country)}` })), to.id)}</select></label>
        <label class="block">제안 제품<select data-mail="productId">${options([{ value: '', label: '미정' }].concat(prods.map(x => ({ value: x.id, label: x.name }))), productId)}</select></label>
        <div class="block-like"><span class="byr-lbl">제안 포인트</span>${POINTS.map(x => `<label class="check"><input type="checkbox" data-point="${x.key}"${u.points.includes(x.key) ? ' checked' : ''}> ${esc(x.label)}</label>`).join('')}</div>
        <label class="block">보내는 사람<input data-u="sender" value="${esc(u.sender || '')}" placeholder="이름 · 직함"></label>
        <button class="btn primary block-btn" data-act="make-draft" data-id="${esc(to.id)}">영문 초안 만들기</button>
        <p class="muted small">📐 메일 구조: 인사 → 회사 소개 → 바이어를 고른 이유 → 제안 포인트 → 다음 단계. 1단계는 템플릿으로 만들고, 2단계에서 OpenAI로 다듬어요.</p>
        <p class="muted small">바이어 현지 시각 <strong data-localtime="${esc(P().countryTz(to.country))}"></strong></p>
      </div></section>
      <section class="card"><div class="card-head"><h3>메일 초안 <span class="muted small">${esc(to.name)}</span></h3></div><div class="card-body">
        <label class="block">제목<input data-mailtext="mailSubject" value="${esc(d.subject)}"></label>
        <label class="block">본문<textarea class="byr-mail" rows="16" data-mailtext="mailBody">${esc(d.body)}</textarea></label>
        <div class="byr-check">${hits === null ? '<span class="muted small">🛡️ 표현 점검: 이 국가는 규제 규칙이 없어 점검하지 않아요.</span>'
          : hits.length ? `🛡️ 표현 점검: <span class="byr-warn">${hits.map(h => esc(h.term)).join(', ')}</span> — 질병·의약품처럼 보이는 표현이에요. 고쳐 쓰세요.` : '<span class="muted small">🛡️ 표현 점검: 규칙 파일의 주의 표현이 없어요.</span>'}</div>
        <div class="row-actions">
          <button class="btn" data-act="copy-mail">복사</button>
          <button class="btn primary" data-act="log-sent" data-id="${esc(to.id)}">보냈어요 — 연락 기록 저장</button>
          <span class="muted small">실제 발송(Gmail)은 2단계 서버에서 붙여요. 지금은 메일 프로그램에 붙여 넣어 보내고 기록만 남겨요.</span>
        </div>
      </div></section>
    </div>`;
  }

  // ---------- ⑦ 영업 관리 ----------
  function manageView() {
    const items = P().pipeline.list().filter(e => P().get(e.prospectId));
    const cols = P().STATUSES.map(st => {
      const its = items.filter(e => e.status === st.value);
      return `<div class="byr-col"><div class="byr-col-head">${STATUS_ICON[st.value]} ${esc(st.label)} <span class="count">${its.length}</span></div>
        ${its.map(e => { const p = P().get(e.prospectId); return `<button type="button" class="byr-card" data-act="open" data-id="${esc(p.id)}">
          <span class="byr-1l">${avatar(p)}<b>${esc(p.name)}</b></span>
          <span class="muted small">${esc(P().countryName(p.country))} · <span class="byr-pri p-${esc(e.priority)}">${esc(e.priority)}</span></span>
          ${e.nextDate ? `<span class="small">다음 연락 ${esc(e.nextDate)} ${DASH.ui.dday(e.nextDate)}</span>` : ''}</button>`; }).join('') || '<p class="muted small">없음</p>'}
      </div>`;
    }).join('');
    const prods = S.products.list();
    const rows = items.map(e => {
      const p = P().get(e.prospectId);
      const last = (e.log || []).slice(-1)[0];
      const canConvert = !!S.rules.forCountry(p.country) && e.status !== 'converted';
      return [
        `<button class="link-btn byr-name" data-act="open" data-id="${esc(p.id)}">${esc(p.name)}</button><br><span class="muted small">${esc(P().countryName(p.country))} · ${esc(P().typeLabel(p.type))}</span>`,
        `<select data-pl="status" data-id="${esc(p.id)}">${options(P().STATUSES, e.status)}</select>`,
        `<select data-pl="productId" data-id="${esc(p.id)}">${options([{ value: '', label: '미정' }].concat(prods.map(x => ({ value: x.id, label: x.name }))), e.productId || '')}</select>`,
        `<input data-pl="nextAction" data-id="${esc(p.id)}" value="${esc(e.nextAction || '')}" placeholder="예: 샘플 피드백 확인">`,
        `<input type="date" data-pl="nextDate" data-id="${esc(p.id)}" value="${esc(e.nextDate || '')}"> ${e.nextDate ? DASH.ui.dday(e.nextDate) : ''}`,
        last ? `<span class="small">${esc(last.date)} ${esc(last.channel)}</span><br><span class="muted small">${esc(last.text)}</span>` : '<span class="muted small">기록 없음</span>',
        `<div class="byr-1l"><button class="btn sm" data-act="log" data-id="${esc(p.id)}">기록</button>
          ${e.caseId ? `<button class="btn sm" data-act="open-case" data-id="${esc(e.caseId)}">${esc(e.caseId)}</button>` : canConvert ? `<button class="btn sm primary" data-act="convert" data-id="${esc(p.id)}">건으로 전환</button>` : ''}
          <button class="icon-btn" data-act="pl-del" data-id="${esc(p.id)}" aria-label="삭제">✕</button></div>`
      ];
    });
    return `<section class="card"><div class="card-head"><h3>⑦ 영업 보드 <span class="muted small">카드를 누르면 바이어 카드가 열려요</span></h3></div>
        <div class="card-body"><div class="byr-board">${cols}</div></div></section>
      <section class="card"><div class="card-head"><h3>영업 관리 목록 <span class="count">${items.length}</span></h3></div>
        <div class="card-body">${table(['바이어', '단계', '제안 제품', '다음 할 일', '다음 연락일', '마지막 연락', ''], rows, { empty: '바이어 찾기에서 바이어를 관리 목록에 추가하세요.' })}
        <p class="muted small">'건으로 전환'은 규제 규칙이 있는 일본·베트남·미국 바이어만 돼요. 바이어와 건(바이어 × 제품 × 국가)을 만들고 규제 확인 탭으로 이동해요.</p></div></section>`;
  }

  // ---------- 팝업 ----------
  function openLog(id) {
    const p = P().get(id);
    const e = P().pipeline.get(id);
    const history = (e.log || []).slice().reverse().map(l => `<li><strong>${esc(l.date)}</strong> ${esc(l.channel)} — ${esc(l.text)}</li>`).join('');
    modal(`연락 기록 · ${p.name}`, `<div class="form-grid">
        <label>날짜 <input type="date" name="date" value="${esc(D.today())}"></label>
        <label>경로 <select name="channel">${options(CHANNELS, '이메일')}</select></label>
        <label class="full">내용 <textarea name="text" rows="3" placeholder="예: 샘플 발송, 회신 받음"></textarea></label>
        <label>다음 연락일 <input type="date" name="nextDate" value="${esc(e.nextDate || D.addCalendarDays(D.today(), 7))}"></label>
        <label>단계 <select name="status">${options(P().STATUSES, e.status === 'found' ? 'contacted' : e.status)}</select></label>
      </div><h4>지난 기록</h4><ul class="plain small">${history || '<li class="muted">없음</li>'}</ul>`, {
      okLabel: '기록 저장',
      onOk: el => {
        const v = DASH.ui.readForm(el);
        if (!v.text) { toast('내용을 입력하세요.', 'warn'); return false; }
        addLog(id, { date: v.date || D.today(), channel: v.channel, text: v.text }, v.status, v.nextDate);
        toast('연락 기록을 저장했어요.');
        DASH.refresh();
      }
    });
  }

  function ensurePipeline(id) {
    let e = P().pipeline.get(id);
    if (e) return e;
    const p = P().get(id);
    const s = P().score(p, criteria(ui()));
    const nt = P().notes(id);
    e = { prospectId: id, status: 'found', priority: s.priority, score: s.total, productId: nt.productId || ((P().matchProducts(p)[0] || {}).prod || {}).id || '', nextAction: '첫 제안 메일 발송', nextDate: D.today(), log: [], addedAt: D.today() };
    return P().pipeline.save(e);
  }
  function addLog(id, entry, status, nextDate) {
    const e = ensurePipeline(id);
    e.log = (e.log || []).concat([entry]);
    if (status) e.status = status;
    if (nextDate) e.nextDate = nextDate;
    P().pipeline.save(e);
  }

  function convert(id) {
    const p = P().get(id);
    const e = P().pipeline.get(id);
    const products = S.products.list();
    if (!products.length) { toast('먼저 + 새 건에서 제품을 등록하세요.', 'warn'); return; }
    modal('건으로 전환', `<p><strong>${esc(p.name)}</strong> (${esc(P().countryName(p.country))})을 바이어로 등록하고 건을 만들어요.</p>
      <div class="form-grid"><label>제품 <select name="productId">${options(products.map(x => ({ value: x.id, label: x.name })), e.productId || products[0].id)}</select></label>
      <label>판매(출시) 희망일 <input type="date" name="targetLaunchDate"></label></div>`, {
      okLabel: '전환하고 규제 확인으로',
      onOk: el => {
        const v = DASH.ui.readForm(el);
        const b = S.buyers.save({
          country: p.country, name: p.name, type: (P().TYPE_MAP[p.country] || {})[p.type] || '', leadSource: '바이어 발굴 탭',
          contact: { name: '', email: '', timezone: P().countryTz(p.country) },
          holderCapability: { JP: null, VN: null, US: null, [p.country]: {} }, lastContactAt: ((e.log || []).slice(-1)[0] || {}).date || D.today(), awaitingReply: e.status === 'contacted'
        });
        const c = S.cases.create({ country: p.country, buyerId: b.id, productId: v.productId, targetLaunchDate: v.targetLaunchDate });
        Object.assign(e, { status: 'converted', caseId: c.id, productId: v.productId });
        P().pipeline.save(e);
        toast(`${c.id} 건을 만들었어요. 명의자 역량은 건·바이어 관리에서 체크하세요.`);
        DASH.store.set('ui:currentCase', c.id);
        DASH.go('regulatory');
        DASH.caseContext.select(c.id);
      }
    });
  }

  function openCapability() {
    const cap = P().capability();
    const M = P().masters();
    modal('자사 제조 역량', `<p class="muted small">바이어 카드의 '자사 생산 비교'와 적합도 점수에 쓰여요. 2단계에서는 사내 생산·인증 DB(또는 ERP)와 연결합니다.</p>
      <h4>생산 가능 제형</h4><div class="byr-capchk">${Object.keys(FORMS).map(k => `<label class="check"><input type="checkbox" name="form_${k}"${(cap.forms || []).includes(k) ? ' checked' : ''}> ${esc(FORMS[k])}</label>`).join('')}</div>
      <h4>거래 형태</h4><div class="byr-capchk">${M.dealTypes.map(d => `<label class="check"><input type="checkbox" name="deal_${esc(d)}"${(cap.dealTypes || []).includes(d) ? ' checked' : ''}> ${esc(d)}</label>`).join('')}</div>
      <div class="form-grid">
        <label class="full">보유 인증 (쉼표로 구분) <input name="certs" value="${esc((cap.certs || []).join(', '))}" placeholder="예: 식약처 GMP, HACCP, NSF"></label>
        <label class="full">주력 원료 (쉼표로 구분) <input name="strengths" value="${esc((cap.strengths || []).join(', '))}"></label>
        <label>MOQ (개) <input type="number" min="1" name="moq" value="${esc(cap.moq || '')}"></label>
      </div>`, {
      onOk: el => {
        const v = DASH.ui.readForm(el);
        const split = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
        P().setCapability({ forms: Object.keys(FORMS).filter(k => v['form_' + k]), dealTypes: M.dealTypes.filter(d => v['deal_' + d]), certs: split(v.certs), strengths: split(v.strengths), moq: v.moq || 0 });
        toast('자사 제조 역량을 저장했어요.');
        DASH.refresh();
      }
    });
  }

  // ---------- 동작 ----------
  function tickLocal(page) {
    page.querySelectorAll('[data-localtime]').forEach(n => {
      try {
        const parts = new Intl.DateTimeFormat('en-US', { timeZone: n.dataset.localtime, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
        const g = t => (parts.find(x => x.type === t) || {}).value;
        const h = Number(g('hour'));
        const work = !['Sat', 'Sun'].includes(g('weekday')) && h >= 9 && h < 18;
        n.textContent = `${g('hour')}:${g('minute')} (${work ? '업무 중 — 보내기 좋아요' : '업무 외 — 예약 발송 권장'})`;
      } catch (e) { n.textContent = '-'; }
    });
  }

  function bind(page) {
    tickLocal(page);
    let qTimer = 0;
    page.addEventListener('click', e => {
      const t = e.target.closest('[data-act]');
      if (!t) return;
      const act = t.dataset.act;
      const u = ui();
      if (act === 'sub') { setUi({ sub: t.dataset.v }); DASH.refresh(); }
      else if (act === 'mode') { setUi({ mode: t.dataset.v, page: 1 }); DASH.refresh(); }
      else if (act === 'tog') { setUi({ [t.dataset.k]: !u[t.dataset.k], page: 1 }); DASH.refresh(); }
      else if (act === 'reset') { setUi({ q: '', country: '', type: '', tag: '', onlyMake: false, onlyReg: false, page: 1 }); DASH.refresh(); }
      else if (act === 'page') { setUi({ page: Number(t.dataset.p) }); DASH.refresh(); }
      else if (act === 'select') { setUi({ selected: t.dataset.id }); DASH.refresh(); }
      else if (act === 'open') { setUi({ sub: 'find', selected: t.dataset.id }); DASH.refresh(); }
      else if (act === 'goto-manage') { setUi({ sub: 'manage' }); DASH.refresh(); }
      else if (act === 'add-pipeline') { ensurePipeline(t.dataset.id); toast('영업 관리 목록에 추가했어요.'); DASH.refresh(); }
      else if (act === 'compose') { setUi({ sub: 'mail', mailTo: t.dataset.id, selected: t.dataset.id }); DASH.refresh(); }
      else if (act === 'make-draft') {
        const p = P().get(t.dataset.id);
        const pid = page.querySelector('[data-mail="productId"]').value;
        const d = draft(p, pid, ui().points, ui().sender);
        P().setNote(p.id, 'mailSubject', d.subject);
        P().setNote(p.id, 'mailBody', d.body);
        DASH.refresh();
      } else if (act === 'copy-mail') DASH.ui.copyText(`Subject: ${page.querySelector('[data-mailtext="mailSubject"]').value}\n\n${page.querySelector('[data-mailtext="mailBody"]').value}`);
      else if (act === 'log-sent') {
        const subj = page.querySelector('[data-mailtext="mailSubject"]').value;
        const cur = P().pipeline.get(t.dataset.id);
        addLog(t.dataset.id, { date: D.today(), channel: '이메일', text: `제안 메일 발송: ${subj}` }, cur && cur.status !== 'found' ? cur.status : 'contacted', D.addCalendarDays(D.today(), 7));
        const after = P().pipeline.get(t.dataset.id);
        after.nextAction = '회신 확인 · 미회신이면 후속 메일';
        P().pipeline.save(after);
        toast('연락 기록을 저장했어요. 7일 뒤 후속 연락일을 잡았어요.');
        setUi({ sub: 'manage' }); DASH.refresh();
      } else if (act === 'log') openLog(t.dataset.id);
      else if (act === 'convert') convert(t.dataset.id);
      else if (act === 'open-case') { DASH.caseContext.select(t.dataset.id); DASH.go('regulatory'); }
      else if (act === 'pl-del') DASH.ui.confirmBox('영업 관리 목록에서 지울까요? 연락 기록도 함께 지워집니다.', () => { P().pipeline.remove(t.dataset.id); DASH.refresh(); }, '지우기');
      else if (act === 'capability') openCapability();
    });

    page.addEventListener('input', e => {
      const t = e.target;
      if (t.dataset.u === 'q') {
        clearTimeout(qTimer);
        qTimer = setTimeout(() => {
          setUi({ q: t.value, page: 1 });
          DASH.refresh();
          const box = document.querySelector('.tab-byr .byr-q');
          if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
        }, 250);
      }
    });

    page.addEventListener('change', e => {
      const t = e.target;
      const u = ui();
      if (t.dataset.u && t.dataset.u !== 'q') {
        setUi({ [t.dataset.u]: t.value, page: 1 });
        if (t.dataset.u !== 'sender') DASH.refresh();
      } else if (t.dataset.point) {
        setUi({ points: t.checked ? u.points.concat([t.dataset.point]) : u.points.filter(x => x !== t.dataset.point) });
      } else if (t.dataset.mail === 'productId') {
        const to = page.querySelector('[data-u="mailTo"]').value;
        P().setNote(to, 'productId', t.value);
        const pl = P().pipeline.get(to);
        if (pl) { pl.productId = t.value; P().pipeline.save(pl); }
      } else if (t.dataset.mailtext) P().setNote(page.querySelector('[data-u="mailTo"]').value, t.dataset.mailtext, t.value);
      else if (t.dataset.note) P().setNote(u.selected, t.dataset.note, t.value);
      else if (t.dataset.pl) {
        const cur = P().pipeline.get(t.dataset.id);
        cur[t.dataset.pl] = t.value;
        P().pipeline.save(cur);
        if (t.tagName === 'SELECT' || t.type === 'date') DASH.refresh();
      }
    });
  }

  DASH.registerTab({
    id: 'buyers', icon: '🔎', label: '바이어 발굴', order: 15, cssClass: 'tab-byr', needsCase: false,
    render,
    summary: () => {
      const soon = D.addCalendarDays(D.today(), 7);
      const n = P().pipeline.list().filter(e => e.nextDate && e.nextDate <= soon && !['converted', 'hold'].includes(e.status)).length;
      return { label: '7일 안 후속 연락', value: n };
    }
  });
})();
