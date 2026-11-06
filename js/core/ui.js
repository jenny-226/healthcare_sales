// 공통 UI 조각: card(), badge(), table(), modal(), toast(), esc() ...
// 모든 함수는 HTML 문자열을 돌려준다. 사용자 입력은 반드시 esc()를 거친다.
(function () {
  const DASH = window.DASH = window.DASH || {};

  // README 4-4: 판정 5단계. 초록색 없음.
  const VERDICTS = {
    BLOCK: { label: '사용 불가', cls: 'v-block' },
    ACTION: { label: '조치 필요', cls: 'v-action' },
    REVIEW: { label: '검토 필요', cls: 'v-review' },
    NOTED: { label: '규칙 확인됨', cls: 'v-noted' },
    UNKNOWN: { label: '규칙 미등록', cls: 'v-unknown' }
  };
  const RANK = { BLOCK: 5, ACTION: 4, REVIEW: 3, UNKNOWN: 2, NOTED: 1 };

  const COUNTRIES = {
    JP: { name: '일본', city: '도쿄', tz: 'Asia/Tokyo' },
    VN: { name: '베트남', city: '하노이', tz: 'Asia/Ho_Chi_Minh' },
    US: { name: '미국', city: '', tz: 'America/New_York' }
  };

  const FORMS = {
    capsule: '캡슐', tablet: '정제', powder: '분말', softgel: '연질캡슐', jelly_stick: '젤리 스틱', liquid: '액상'
  };

  function esc(v) {
    return String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function badge(code) {
    const v = VERDICTS[code] || VERDICTS.UNKNOWN;
    return `<span class="badge ${v.cls}">${v.label}</span>`;
  }

  function countryBadge(c) {
    const info = COUNTRIES[c];
    return `<span class="badge c-${esc(c)}">${info ? info.name : esc(c)} ${esc(c)}</span>`;
  }

  function sampleBadge(obj) { return obj && obj.sample ? '<span class="badge b-sample">예시</span>' : ''; }
  function verifyBadge(f) { return f && f.needsVerification ? '<span class="badge b-verify">원문 확인 필요</span>' : ''; }
  function tag(text, cls) { return `<span class="badge ${cls || 'b-plain'}">${esc(text)}</span>`; }

  // title·actions는 호출하는 쪽에서 이미 안전한 HTML
  function card(title, body, opts) {
    opts = opts || {};
    const head = title ? `<header class="card-head"><h3>${title}</h3>${opts.actions ? `<div class="card-actions">${opts.actions}</div>` : ''}</header>` : '';
    return `<section class="card ${opts.cls || ''}"${opts.id ? ` id="${esc(opts.id)}"` : ''}>${head}<div class="card-body">${body}</div></section>`;
  }

  // headers: 문자열 배열(이스케이프됨), rows: 셀 HTML 배열의 배열(호출 쪽에서 이스케이프)
  function table(headers, rows, opts) {
    opts = opts || {};
    if (!rows.length) return `<p class="muted">${esc(opts.empty || '항목이 없습니다.')}</p>`;
    return `<div class="table-wrap${opts.scroll ? ' scroll' : ''}"><table class="tbl ${opts.cls || ''}">
      <thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`;
  }

  function sourceLine(f) {
    if (!f.source) return `<div class="src">출처 없음 · 검증일 ${esc(f.verifiedAt || '-')}</div>`;
    const link = f.source.url
      ? `<a href="${esc(f.source.url)}" target="_blank" rel="noopener">${esc(f.source.label)}</a>`
      : esc(f.source.label);
    return `<div class="src">출처 ${link} · 마지막 검증일 ${esc(f.verifiedAt || '-')}</div>`;
  }

  // 결과 카드: 판정 배지 → 메시지 → 상세 → 수정 제안 → 출처·검증일 → 원문 확인 필요
  function findingCard(f) {
    const v = VERDICTS[f.verdict] || VERDICTS.UNKNOWN;
    return `<div class="finding ${v.cls}-box">
      <div class="finding-head">${badge(f.verdict)} <span class="rule-id">${esc(f.ruleId || '')}</span> <strong>${esc(f.title)}</strong></div>
      <p class="finding-msg">${esc(f.message)}</p>
      ${f.detail ? `<p class="finding-detail">${esc(f.detail)}</p>` : ''}
      ${f.suggestion ? `<div class="finding-sugg"><span>수정 제안</span><pre>${esc(f.suggestion)}</pre></div>` : ''}
      <div class="finding-foot">${sourceLine(f)} ${verifyBadge(f)}</div>
    </div>`;
  }

  function worst(verdicts) {
    let best = null;
    verdicts.forEach(v => { if (!best || (RANK[v] || 0) > (RANK[best] || 0)) best = v; });
    return best;
  }

  function options(list, selected) {
    return list.map(o => {
      const value = typeof o === 'object' ? o.value : o;
      const label = typeof o === 'object' ? o.label : o;
      return `<option value="${esc(value)}"${String(value) === String(selected) ? ' selected' : ''}>${esc(label)}</option>`;
    }).join('');
  }

  function emptyCase() {
    return `<div class="empty">
      <div class="empty-icon">📂</div>
      <h2>아직 진행 중인 건이 없습니다</h2>
      <p>바이어 발굴 탭의 영업 관리에서 바이어를 <strong>건으로 전환</strong>하면 여기에 내용이 나옵니다.</p>
      <button class="btn primary" type="button" data-act="empty-to-buyers">바이어 발굴로 가기</button>
    </div>`;
  }

  // ---------- 모달 ----------
  function modal(title, bodyHtml, opts) {
    opts = opts || {};
    const root = document.getElementById('modal-root');
    const wrap = document.createElement('div');
    wrap.className = 'modal-overlay';
    wrap.innerHTML = `<div class="modal${opts.wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-act="modal-close" aria-label="닫기">✕</button></header>
      <div class="modal-body">${bodyHtml}</div>
      <footer class="modal-foot">
        ${opts.extraButtons || ''}
        <button class="btn" data-act="modal-close">${esc(opts.cancelLabel || (opts.onOk ? '취소' : '닫기'))}</button>
        ${opts.onOk ? `<button class="btn primary" data-act="modal-ok">${esc(opts.okLabel || '저장')}</button>` : ''}
      </footer>
    </div>`;
    root.appendChild(wrap);
    const el = wrap.querySelector('.modal');
    function close() { wrap.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', e => {
      if (e.target === wrap || e.target.closest('[data-act="modal-close"]')) close();
      if (e.target.closest('[data-act="modal-ok"]')) {
        const keep = opts.onOk(el, close) === false;
        if (!keep) close();
      }
    });
    const first = el.querySelector('input, select, textarea');
    if (first) setTimeout(() => first.focus(), 30);
    return { el, close };
  }

  function confirmBox(message, onYes, okLabel) {
    modal('확인', `<p>${esc(message)}</p>`, { okLabel: okLabel || '확인', onOk: () => { onYes(); } });
  }

  function toast(msg, kind) {
    const root = document.getElementById('toast-root');
    const t = document.createElement('div');
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.textContent = msg;
    root.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3000);
  }

  // ---------- 숫자·날짜 ----------
  function num(n, digits) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    return Number(n).toLocaleString('ko-KR', { maximumFractionDigits: digits === undefined ? 0 : digits, minimumFractionDigits: 0 });
  }
  function krw(n) { return n === null || isNaN(n) ? '-' : num(Math.round(n)) + '원'; }
  function usd(n, d) { return n === null || isNaN(n) || !isFinite(n) ? '-' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: d === undefined ? 2 : d, maximumFractionDigits: d === undefined ? 2 : d }); }

  function dday(iso, from) {
    if (!iso) return '';
    const d = DASH.dates.daysUntil(iso, from);
    const cls = d < 0 ? 'dd-over' : d <= 7 ? 'dd-soon' : d <= 30 ? 'dd-near' : 'dd-far';
    const label = d === 0 ? 'D-day' : d > 0 ? `D-${d}` : `D+${-d}`;
    return `<span class="dday ${cls}">${label}</span>`;
  }

  // ---------- 인쇄·파일 ----------
  function printHtml(html) {
    const root = document.getElementById('print-root');
    root.innerHTML = html;
    document.body.classList.add('is-printing');
    const done = () => { document.body.classList.remove('is-printing'); root.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(done, 1500);
  }

  function download(name, text, mime) {
    const blob = new Blob([text], { type: mime || 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  }

  function copyText(text) {
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('복사했습니다.'); } catch (e) { toast('복사에 실패했습니다. 직접 선택해 복사하세요.', 'warn'); }
      ta.remove();
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => toast('복사했습니다.'), fallback);
    } else fallback();
  }

  // 폼 값 읽기: [name] 요소들 → 객체 (checkbox는 boolean, type=number는 숫자)
  function readForm(scope) {
    const out = {};
    scope.querySelectorAll('[name]').forEach(el => {
      if (el.type === 'checkbox') out[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
      else if (el.type === 'number') out[el.name] = el.value === '' ? null : Number(el.value);
      else out[el.name] = el.value.trim();
    });
    return out;
  }

  // COSTD식 구분 탭: items = [{value,label}], act = data-act 이름
  function seg(items, active, act, opts) {
    opts = opts || {};
    return `<div class="seg${opts.cls ? ' ' + opts.cls : ''}" role="tablist">${items.map(i =>
      `<button type="button" role="tab" class="seg-btn${i.value === active ? ' active' : ''}" aria-selected="${i.value === active}" data-act="${esc(act)}" data-v="${esc(i.value)}">${esc(i.label)}</button>`).join('')}</div>`;
  }

  // 페이지 제목 + 설명 (COSTD .page-title / .page-description)
  function pageHead(title, desc, actions) {
    return `<div class="page-head"><div><h1 class="page-title">${title}</h1>${desc ? `<p class="page-desc">${desc}</p>` : ''}</div>${actions ? `<div class="head-actions">${actions}</div>` : ''}</div>`;
  }

  DASH.ui = {
    VERDICTS, RANK, COUNTRIES, FORMS,
    esc, badge, countryBadge, sampleBadge, verifyBadge, tag, card, table, sourceLine, findingCard, worst, options,
    emptyCase, seg, pageHead, modal, confirmBox, toast, num, krw, usd, dday, printHtml, download, copyText, readForm
  };
})();
