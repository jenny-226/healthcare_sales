// 📜 규제 확인 (README 7-2) — 확인용 화면. 실무자가 값을 일일이 입력하지 않는다.
//   ① 성분 의약품 해당 여부: 성분명 + 국가 → DB 사본 전체(일본 목록·식약처 원료·FDA 리콜·대조표)를 한 번에 대조
//   ② 이 제품 성분 판정: 처방 성분을 자동 판정 (처방은 성분표 파일로 불러옴)
//   ③ 판단 항목: 클릭으로만 고르는 조건 (분류·NDI·체크리스트) + 점검한 표시 문구(개발요청서에서 가져옴)
//   ④ 조회 결과: 규칙 엔진을 자동 실행 → 요약 → 영역별 판정 → 필요 서류·주요 마감
//   ⑤ 참고: 세 나라 비교표 · 규제 변화 타임라인 (접힘)
(function () {
  const DASH = window.DASH;
  const { card, esc, badge, countryBadge, tag, table, findingCard, worst, options, toast, modal, pageHead, COUNTRIES, FORMS, VERDICTS, num } = DASH.ui;
  const S = DASH.services;
  const D = DASH.dates;
  const E = () => DASH.engine;
  const STATUS_LABEL = { draft: '초안', grace: '유예 중', effective: '시행', suspended: '정지' };
  const KR_LABEL = { individual: '개별인정형', notified: '고시형', both: '고시형·개별인정형', none: '' };

  // 화면에만 있는 작업 상태 (검색어·업로드 파일·저장 전 추출값)
  const work = { caseId: null, search: null, draft: null, draftFrom: '', sheets: null, fileName: '', sheet: '', map: null };

  // DB 사본은 바뀌지 않으므로 이름별 대조 결과를 기억해 둔다
  const memo = new Map();
  function look(ing) {
    const key = typeof ing === 'string' ? ing : `${ing.nameKo || ''}|${ing.nameEn || ''}`;
    if (!memo.has(key)) memo.set(key, S.reference.lookup(ing));
    return memo.get(key);
  }

  function render(el, ctx) {
    let c = ctx;
    const product = S.products.get(c.productId);
    if (work.caseId !== c.id) { work.caseId = c.id; work.search = null; work.draft = null; work.sheets = null; }

    if (!product) {
      el.innerHTML = `<div class="tab-page">${card('제품 없음', '<p>이 건에 연결된 제품이 없습니다. 상단 <strong>+ 새 건</strong>에서 제품을 함께 등록하세요.</p>')}</div>`;
      return;
    }
    syncFormula(product);
    c = ensureFresh(c, product);
    const pack = S.rules.forCountry(c.country);

    el.innerHTML = `<div class="tab-page">
      ${pageHead(`📜 규제 확인 ${countryBadge(c.country)}`,
        `성분명과 국가를 고르면 의약품 해당 여부를 바로 보여줘요. 이 제품의 성분과 서류·마감은 자동으로 판정돼요. 제품 전체의 적법성이나 수출 가능 여부를 확정하지는 않아요.<br><span class="muted small">${esc(DASH.caseLabel(c))} · 규칙 버전 ${esc(pack.version)}</span>`,
        `<button class="btn primary" data-act="to-request">개발요청서로 보내기 →</button>`)}
      <div class="info-note">일본 의약품 전용 성분·식약처 원료·FDA 리콜·국가 규칙을 한 번에 대조해요. '목록에 없음'·'규칙 확인됨'은 등록된 목록·규칙에 걸린 것이 없다는 뜻이며 승인이 아닙니다.</div>

      ${searchCard(c, product)}
      ${formulaCard(c, product)}
      ${conditionCard(c, product, pack)}
      ${resultsSection(c, product, pack)}
      ${referenceSection(c, product)}
    </div>`;
    bind(el.firstElementChild, c, product);
  }

  // ---------- 자동 판정: 처방 성분 플래그 ----------
  // 일본 의약품 전용(jpPharmaOnly)·한국 개별인정형(koreaIndividual)을 DB 대조로 채운다.
  // 부위 조건이 있는 일본 목록 성분은 담당자가 '사용 부위'를 한 번 클릭해 정한다(jpPharmaBy: 'user').
  function syncFormula(product) {
    let changed = false;
    (product.formula || []).forEach(i => {
      const r = look(i);
      if (i.jpPharmaBy !== 'user') {
        const v = r.jp === 'listed' ? true : (r.jp === 'none' && r.recognized) ? false : undefined;
        if (i.jpPharmaOnly !== v) { if (v === undefined) delete i.jpPharmaOnly; else i.jpPharmaOnly = v; changed = true; }
      }
      const kv = r.krStatus === 'individual' ? true : r.krStatus === 'notified' ? false : !!i.koreaIndividual;
      if (i.koreaIndividual !== kv) { i.koreaIndividual = kv; changed = true; }
    });
    if (changed) S.products.save(product);
  }

  // ---------- 자동 판정: 표시 문구 ----------
  // 문구는 이 탭에서 입력하지 않는다. 개발요청서 '허용 표현 초안' → 예전에 저장된 문구 → 제품의 한국 표시 문구 순으로 쓴다.
  function claimSource(c, product) {
    const rq = c.request || {};
    const old = (c.regulatory && c.regulatory.claimInputs) || {};
    if (rq.allowedClaimDraft && rq.allowedClaimDraft.trim()) return { text: rq.allowedClaimDraft.trim(), from: '개발요청서 허용 표현 초안' };
    if ((old.main || old.vnRegistered || '').trim()) return { text: (old.main || old.vnRegistered).trim(), from: '이전에 저장된 문구' };
    if (product.koreaClaim && product.koreaClaim.trim()) return { text: product.koreaClaim.trim(), from: '제품의 한국 표시 문구' };
    return { text: '', from: '' };
  }
  function evalCase(c, product) {
    const reg = c.regulatory || {};
    const old = reg.claimInputs || {};
    const src = claimSource(c, product);
    const ci = Object.assign({}, old, { main: src.text, vnRegistered: src.text });
    return Object.assign({}, c, { regulatory: Object.assign({}, reg, { claimInputs: ci }) });
  }

  // 규칙 엔진을 자동으로 돌려 결과가 바뀌었을 때만 건에 저장한다 (다시 그리지 않도록 조용히 저장)
  function ensureFresh(c, product) {
    const pack = S.rules.forCountry(c.country);
    const ec = evalCase(c, product);
    const findings = E().evaluate(ec, product, S.documents.forProduct(product.id), c.country);
    const sig = E().signature(findings);
    const prev = c.regulatory || {};
    if (prev.findings && prev.signature === sig) return c;
    const cur = S.cases.get(c.id) || c;
    cur.regulatory = Object.assign({}, prev, {
      checkedAt: D.today(),
      category: prev.category || pack.defaultCategory || null,
      findings,
      ingredientFindings: findings.filter(f => f.area === 'ingredient'),
      claimFindings: findings.filter(f => f.area === 'claim'),
      dailyIntake: S.products.dailyIntake(product),
      requiredDocs: E().requiredDocs(ec).map(d => d.type),
      estimatedLead: pack.lead,
      ruleVersion: { [c.country]: pack.version },
      signature: sig
    });
    delete cur.regulatory.dirty;
    // README 8장: 결과가 바뀌면 개발요청서에 확인 배지 (자동 덮어쓰기 금지)
    if (prev.signature && prev.signature !== sig) {
      cur.flags = Object.assign({}, cur.flags, { regChanged: { request: true, at: D.today() } });
      setTimeout(() => toast('규제 결과가 바뀌었습니다 — 개발요청서 탭에 확인 배지를 띄웠습니다.', 'warn'), 0);
    }
    DASH.caseContext.save(cur, { silent: true });
    return cur;
  }

  // ---------- ① 성분 의약품 해당 여부 ----------
  function searchCard(c, product) {
    const s = work.search || { q: '', market: c.country };
    const chips = (product.formula || []).map((i, idx) => `<button type="button" class="chip" data-act="pick-ing" data-i="${idx}">${esc(i.nameKo || i.nameEn)}</button>`).join('');
    return card('성분 의약품 해당 여부', `
      <div class="reg-searchbar">
        <label class="block reg-q"><span>성분명</span>
          <input data-s="q" value="${esc(s.q)}" placeholder="한글명·영문명·학명 (예: 타우린, 녹용, Ashwagandha)" autocomplete="off">
          <ul class="reg-suggest" data-out="suggest" hidden></ul>
        </label>
        <label class="block"><span>국가</span>
          <select data-s="market">${options(['JP', 'VN', 'US'].map(x => ({ value: x, label: `${COUNTRIES[x].name} ${x}` })), s.market)}</select>
        </label>
        <button class="btn primary" data-act="search">확인</button>
      </div>
      ${chips ? `<div class="reg-chips"><span class="muted small">이 제품 성분 바로 확인</span>${chips}</div>` : ''}
      <div data-out="search-result">${s.done ? pharmaResult(s) : ''}</div>`);
  }

  // 국가별 '의약품 해당 여부' 판정 (목록 데이터가 있는 나라만 판정하고, 없으면 미등록으로 표시)
  function pharmaVerdict(r, market) {
    if (market === 'JP') {
      if (r.jp === 'listed') return { v: 'block', label: '의약품 해당', text: '일본 「의약품으로만 쓰는 성분(専ら医薬品)」 목록에 있어요. 식품(FFC)에 넣으면 의약품으로 취급될 수 있어요. (JP-ING-01)' };
      if (r.jp === 'partial') return { v: 'review', label: '부위에 따라 의약품', text: '목록에 적힌 부위만 의약품 전용이에요. 원료 규격서에서 사용 부위를 확인하세요. (JP-ING-01)' };
      if (r.recognized) return { v: 'noted', label: '의약품 전용 목록에 없음', text: '일본 의약품 전용 성분 목록에 걸리지 않았어요. 목록에 없음 ≠ 사용 허용 — 함량·표시 기준은 따로 확인하세요.' };
      return { v: 'unknown', label: '대조 불가', text: '이 한국어 이름은 일본 목록(일본어·학명)과 대조할 수 없었어요. 영문명이나 학명으로 다시 확인하거나 이름 대조표(data/ingredient-aliases.js)에 추가하세요.' };
    }
    const name = COUNTRIES[market].name;
    return { v: 'unknown', label: '규칙 미등록', text: `${name}의 의약품 성분 목록은 아직 DB에 없어요 — 수동 확인 필요. 아래 참고 정보를 함께 보세요.` };
  }

  function pharmaResult(s) {
    const r = look(s.ing || s.q);
    const m = s.market;
    const pv = pharmaVerdict(r, m);
    const title = s.ing ? S.products.ingredientName(s.ing) : s.q;

    const points = [];
    if (m !== 'JP' && r.jp === 'listed') points.push(`${tag('참고', 'b-plain')} 일본에서는 의약품 전용 성분이에요. 일본 건으로 확장할 때 원료 교체가 필요할 수 있어요.`);
    if (m !== 'JP' && r.jp === 'partial') points.push(`${tag('참고', 'b-plain')} 일본에서는 일부 부위가 의약품 전용이에요.`);
    if (r.krStatus === 'individual' || r.krStatus === 'both') {
      const rule = m === 'US' ? 'NDI(신규 원료) 통지 대상인지 확인 — US-NDI-01·02' : m === 'JP' ? '기능성 근거 자료가 이 원료·함량과 맞는지 확인 — JP-EVD-01' : '이 원료·용량에 맞는 효능 근거 자료 확인 — VN-DOC-EVD';
      points.push(`${tag('확인 필요', 'v-review')} 한국 ${KR_LABEL[r.krStatus]} 원료예요 → ${rule}`);
    }
    if (m === 'US' && r.drugRecalls.length) points.push(`${tag('참고', 'b-plain')} 이 이름이 들어간 FDA 리콜 중 의약품 성분 관련 사유가 ${r.drugRecalls.length}건 있어요 (다른 성분 때문일 수 있음).`);

    const jpBlock = r.jpHits.length ? `<h4>일본 의약품 전용 성분 목록</h4>${jpRows(r.jpHits)}${jpNote()}` : '';
    const krList = r.kr.length ? r.kr.map(x => `${tag(x.type === 'individual' ? '개별인정형' : '고시형', 'b-plain')} ${esc(x.name)}${x.type !== 'individual' && (x.min || x.max) ? ` <span class="muted small">1일 ${esc(x.min || '')}~${esc(x.max || '')}${esc(x.unit || '')}</span>` : ''}`).join('<br>') : '<span class="muted">목록에서 찾지 못함</span>';
    const fda = r.recalls.length
      ? `<details class="fold reg-fold"${m === 'US' ? ' open' : ''}><summary>FDA 리콜 사례 ${r.recalls.length}건 (영문 '${esc(r.enTerms.slice(0, 3).join(', '))}' 대조)</summary>${fdaRows(r.recalls)}</details>`
      : `<p class="muted small">FDA 리콜 사례: ${r.enTerms.length ? '없음' : '영문 이름을 몰라 대조하지 못함'}</p>`;

    return `<div class="reg-verdict v-${pv.v}-box">
        <div class="reg-verdict-head">${tag(pv.label, 'v-' + pv.v)} <strong>${esc(title)}</strong> <span class="muted small">· ${esc(COUNTRIES[m].name)}</span></div>
        <p>${esc(pv.text)}</p>
      </div>
      ${points.length ? `<ul class="plain reg-flags">${points.map(p => `<li>${p}</li>`).join('')}</ul>` : ''}
      <div class="reg-evidence">
        ${jpBlock}
        <dl class="kv"><dt>한국 식약처 원료</dt><dd>${krList}</dd>
          ${r.aliases.length ? `<dt>대조한 이름</dt><dd class="small">${esc(Array.from(new Set([].concat(...r.aliases.map(a => a.ko.concat(a.en, a.ja ? [a.ja] : []))))).join(' · '))}</dd>` : ''}</dl>
        ${fda}
      </div>`;
  }

  // ---------- ② 이 제품 성분 판정 ----------
  function pharmaCell(i, r, country) {
    if (country !== 'JP') {
      const jpNote = r.jp === 'listed' ? `<div class="small muted">일본: 의약품 전용</div>` : r.jp === 'partial' ? `<div class="small muted">일본: 부위 확인</div>` : '';
      return `${tag('목록 미등록', 'v-unknown')}${jpNote}`;
    }
    const names = r.jpHits.map(x => `${x.name}${x.parts ? ` (${x.parts})` : ''}`).join(', ');
    if (r.jp === 'listed') return `${tag('의약품 해당', 'v-block')}<div class="small">${esc(names)}</div>`;
    if (r.jp === 'partial') {
      const by = i.jpPharmaBy === 'user';
      const state = by ? (i.jpPharmaOnly ? tag('해당 부위 사용', 'v-block') : tag('다른 부위 사용', 'v-noted')) : tag('부위 확인', 'v-review');
      return `${state}<div class="small">${esc(names)}</div>`;
    }
    return r.recognized ? tag('목록에 없음', 'v-noted') : tag('대조 불가', 'v-unknown');
  }
  function todoCell(i, r, country, idx) {
    const out = [];
    if (country === 'JP' && r.jp === 'partial') {
      out.push(`<div class="reg-part-btns"><span class="small">사용 부위가 목록 부위인가요?</span>
        <button class="btn sm${i.jpPharmaBy === 'user' && i.jpPharmaOnly ? ' active' : ''}" data-act="jp-part" data-i="${idx}" data-v="yes">예</button>
        <button class="btn sm${i.jpPharmaBy === 'user' && i.jpPharmaOnly === false ? ' active' : ''}" data-act="jp-part" data-i="${idx}" data-v="no">아니요</button></div>`);
    }
    if (country === 'JP' && r.jp === 'listed') out.push('일본 판매 시 원료 교체 검토 (JP-ING-01)');
    if (country === 'JP' && r.jp === 'none' && !r.recognized) out.push('영문명·학명 확인 필요');
    if (i.koreaIndividual) out.push(country === 'US' ? 'NDI 해당 여부 확인 (US-NDI-02)' : country === 'JP' ? '근거 자료 일치 확인 (JP-EVD-01)' : '효능 근거 자료 확인 (VN-DOC-EVD)');
    if (r.krStatus === 'both') out.push('고시형·개별인정형 이름이 겹침 — 원료 공급처 규격서 확인');
    return out.length ? out.map(x => x.startsWith('<') ? x : `<div class="small">${esc(x)}</div>`).join('') : '<span class="muted small">-</span>';
  }

  function ingredientRows(list, country, product, withActions) {
    const spd = Number(product.servingsPerDay) || 1;
    return list.map((i, idx) => {
      const r = look(i);
      return [
        withActions ? `<button type="button" class="link-btn" data-act="pick-ing" data-i="${idx}"><strong>${esc(S.products.ingredientName(i))}</strong></button>` : `<strong>${esc(S.products.ingredientName(i))}</strong>`,
        `${esc(i.amountPerServing)} ${esc(i.unit)}`,
        `${esc(num((Number(i.amountPerServing) || 0) * spd, 3))} ${esc(i.unit)}`,
        pharmaCell(i, r, country),
        r.krStatus !== 'none' ? tag(KR_LABEL[r.krStatus], 'b-plain') : (r.kr.length ? `<span class="small muted">비슷한 이름: ${esc(r.kr.map(x => x.name).join(', '))}</span>` : '<span class="muted small">목록에 없음</span>'),
        withActions ? todoCell(i, r, country, idx) : ''
      ];
    });
  }

  function formulaCard(c, product) {
    const formula = product.formula || [];
    const meta = `${esc(FORMS[product.form] || product.form)} · 1회 ${esc(product.unitsPerServing || 1)}개 × 1일 ${esc(product.servingsPerDay || 1)}회`;
    const heads = ['성분', '1회 함량', '1일 섭취량', `의약품 해당 (${COUNTRIES[c.country].name})`, '한국 원료 구분', '확인할 것'];
    const body = formula.length
      ? table(heads, ingredientRows(formula, c.country, product, true), { cls: 'reg-ing' })
      : '<div class="empty-inline">처방 성분이 없어요. 아래에 성분표 파일(XLSX·CSV)을 올리면 자동으로 판정해요.</div>';
    return card(`이 제품 성분 판정 <span class="muted small">${esc(product.name)} · ${meta}</span>`, `
      ${body}
      <p class="muted small">의약품 해당·한국 원료 구분은 DB 사본과 이름 대조로 자동 판정해요. 이름 대조 결과는 후보이므로 최종 판단은 규제 담당이 합니다. 처방은 같은 제품을 쓰는 다른 건에도 적용됩니다.</p>
      ${uploadBlock(c, product, !formula.length)}`);
  }

  // 성분표 파일 → 열 자동 인식 → 미리보기 → 처방으로 저장
  function uploadBlock(c, product, prominent) {
    if (work.draft) {
      const names = work.sheets ? Object.keys(work.sheets) : [];
      return `<div class="reg-sheet">
        <div class="reg-sheet-head"><strong>📄 ${esc(work.draftFrom)}</strong> <span class="muted small">아직 처방에 저장되지 않았어요</span></div>
        ${table(['성분', '1회 함량', '1일 섭취량', `의약품 해당 (${COUNTRIES[c.country].name})`, '한국 원료 구분', ''], ingredientRows(work.draft, c.country, product, false), { cls: 'reg-ing' })}
        ${names.length ? `<details class="fold reg-fold"><summary>성분이 이상하게 읽혔나요? 시트·열 바꾸기</summary>
          <div class="form-grid three">
            <label class="block">시트<select data-map="sheet">${options(names, work.sheet)}</select></label>
            <label class="block">성분명 열<select data-map="colName"></select></label>
            <label class="block">함량 열<select data-map="colAmount"></select></label>
            <label class="block">단위 열<select data-map="colUnit"></select></label>
            <label class="block">영문명 열<select data-map="colEn"></select></label>
            <label class="check"><input type="checkbox" data-map="hasHeader"${work.map && work.map.hasHeader === false ? '' : ' checked'}> 첫 행은 머리글</label>
          </div>
          <button class="btn sm" data-act="extract">이 열로 다시 읽기</button></details>` : ''}
        <div class="row-actions">
          <button class="btn sm" data-act="draft-cancel">취소</button>
          <span class="casebar-spacer"></span>
          ${(product.formula || []).length ? '<button class="btn sm" data-act="draft-append">기존 처방 뒤에 추가</button>' : ''}
          <button class="btn primary" data-act="draft-apply">${(product.formula || []).length ? '이 성분표로 처방 바꾸기' : '처방으로 저장'}</button>
        </div>
      </div>`;
    }
    const zone = `<label class="dropzone${prominent ? '' : ' compact'}" data-drop>
        ${prominent ? '<span class="dropzone-icon">⤒</span>' : ''}
        <strong>${prominent ? '성분표 파일을 끌어다 놓거나 클릭해서 선택' : '성분표 파일로 처방 바꾸기 (XLSX·CSV 끌어다 놓기 또는 클릭)'}</strong>
        ${prominent ? '<span class="small">XLSX / XLS / CSV · 성분명·함량·단위 열을 자동으로 찾아요 · 브라우저 안에서만 읽어요</span>' : ''}
        <input type="file" accept=".csv,.xlsx,.xls" data-act="upload" hidden>
      </label>`;
    return prominent ? zone : `<div class="reg-upload-inline">${zone}</div>`;
  }

  // ---------- ③ 판단 항목 (클릭만) · 점검한 표시 문구 ----------
  function conditionCard(c, product, pack) {
    const reg = c.regulatory || {};
    let cat = '';
    if (c.country === 'JP') {
      const isFfc = (reg.category || pack.defaultCategory) === 'ffc';
      const checks = reg.jpLabelChecks || {};
      const done = pack.labelChecklist.filter((_, i) => checks[i]).length;
      cat = `<label class="block">분류 경로<select data-field="category">${options(pack.categories.map(x => ({ value: x.code, label: x.label + (x.supported ? '' : ' — 규칙 미등록') })), reg.category || pack.defaultCategory)}</select></label>
        <label class="check"><input type="checkbox" data-field="newIngredient"${reg.newIngredient ? ' checked' : ''}> 신규 성분 등 확인에 시간이 걸리는 성분 포함 (신고 마감 120영업일 전)</label>
        ${isFfc ? `<details class="fold reg-checklist"><summary>JP-LBL-01 필수 표시 체크리스트 (${done}/${pack.labelChecklist.length})</summary>
          ${pack.labelChecklist.map((t, i) => `<label class="check"><input type="checkbox" data-check="${i}"${checks[i] ? ' checked' : ''}> ${esc(t)}</label>`).join('')}</details>` : ''}`;
    } else if (c.country === 'VN') {
      cat = '<p><strong>건강보호식품 (health supplement)</strong> — 자기공표가 아닌 <strong>등록</strong> 대상</p><p class="muted small">미량영양소 함량 기준(Circular 17/2023) 수치는 미확인 → VN-ING-01 규칙 미등록.</p>';
    } else {
      const auto = (product.formula || []).filter(i => i.koreaIndividual).map(i => i.nameKo || i.nameEn);
      cat = `<p><strong>Dietary Supplement</strong> — FDA 시판 전 승인 없음, 통지 중심</p>
        ${auto.length ? `<p class="small">${tag('자동', 'b-plain')} 한국 개별인정형 원료: ${esc(auto.join(', '))} → NDI 검토 대상</p>` : ''}
        <label class="check"><input type="checkbox" data-field="ndiConfirmed"${reg.ndiConfirmed ? ' checked' : ''}> 규제 담당이 NDI 해당으로 판단함 → 판매 75일 전 통지 마감 계산</label>`;
    }
    const src = claimSource(c, product);
    const claim = src.text
      ? `<blockquote class="reg-claim">${esc(src.text)}</blockquote><p class="muted small">출처: ${esc(src.from)} · 문구는 <button class="link-btn" data-act="to-request-tab">개발요청서</button>에서 고치면 여기서 자동으로 다시 점검해요.</p>`
      : `<div class="empty-inline">점검할 문구가 없어요. <button class="link-btn" data-act="to-request-tab">개발요청서</button>의 허용 표현 초안을 채우면 자동으로 점검해요.</div>`;
    return card('판단 항목 · 점검한 표시 문구 <span class="muted small">바꾸면 아래 결과에 바로 반영돼요</span>', `
      <div class="grid-2 tight"><div><h4>제품 분류</h4>${cat}</div><div><h4>점검한 표시 문구</h4>${claim}</div></div>`);
  }

  // ---------- ④ 조회 결과 ----------
  function findingsOf(findings, areas) {
    const order = ['BLOCK', 'ACTION', 'REVIEW', 'UNKNOWN', 'NOTED'];
    const list = findings.filter(f => areas.includes(f.area)).sort((a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict));
    return list.length ? `<div class="findings">${list.map(findingCard).join('')}</div>` : '<p class="muted small">이 영역 판정 없음</p>';
  }

  function resultsSection(c, product, pack) {
    const reg = c.regulatory || {};
    const findings = reg.findings || [];
    const n = E().countBy(findings);
    const summary = `<div class="reg-summary">${['BLOCK', 'ACTION', 'REVIEW', 'UNKNOWN', 'NOTED'].map(v => `<div class="reg-sum-item">${badge(v)} <strong>${n[v] || 0}</strong></div>`).join('')}
      <span class="muted small">자동 조회 · ${esc(reg.checkedAt || '-')}</span></div>`;
    const cond = `<dl class="kv reg-cond">
      <dt>국가/시장</dt><dd>${countryBadge(c.country)} ${esc(pack.entry)}</dd>
      <dt>제품</dt><dd>${esc(product.name)} · ${esc(FORMS[product.form] || product.form)} · 1회 ${esc(product.unitsPerServing || 1)}개 × 1일 ${esc(product.servingsPerDay || 1)}회</dd>
      <dt>규칙 버전</dt><dd>${esc(pack.version)}</dd>
      <dt>판매 희망일</dt><dd>${esc(c.targetLaunchDate || '미입력')}</dd></dl>`;

    const docRows = E().docChecklist(c, product, S.documents.forProduct(product.id)).map(r => [
      esc(r.req.label), badge(r.verdict), esc(r.message), `<span class="rule-id">${esc(r.req.ruleId)}</span>`
    ]);
    const dl = E().deadlinesFor(c, product, S.documents.forProduct(product.id)).filter(d => !d.info);
    const dlHtml = dl.length ? table(['마감', '날짜', '근거'], dl.map(d => [esc(d.label), `${esc(d.date)} ${DASH.ui.dday(d.date)}`, `<span class="rule-id">${esc(d.ruleId || '')}</span> ${esc(d.basis || '')}`]))
      : '<p class="muted small">판매 희망일이 있으면 신고·통지 마감을 계산해요 (공휴일은 data/holidays.js 기준).</p>';

    return `<section class="reg-results">
      <div class="reg-results-head"><h2>조회 결과</h2></div>
      ${summary}
      <div class="reg-grid">
        ${card('원료', findingsOf(findings, ['ingredient']))}
        ${card('조회 조건', cond)}
        ${card('제품 분류', findingsOf(findings, ['category']))}
        ${card('표시 문구', findingsOf(findings, ['claim']))}
        ${card('신청자 · 제조 · 판매 후 의무', findingsOf(findings, ['applicant', 'manufacturing', 'post_market']), { cls: 'span-2' })}
        ${card('필요 서류 · 예상 기간', `${table(['서류', '판정', '내용', '규칙'], docRows, { empty: '규칙에 등록된 필수 서류가 없습니다.' })}
          <dl class="kv"><dt>법정·규칙 기간</dt><dd>${esc(pack.lead.legal)}</dd><dt>실무 기간</dt><dd>${esc(pack.lead.practical)}</dd></dl>
          <h4>주요 마감</h4>${dlHtml}
          ${findingsOf(findings, ['document', 'schedule'])}`, { cls: 'span-2' })}
      </div>
    </section>`;
  }

  // ---------- ⑤ 참고 ----------
  function referenceSection(c, product) {
    return `<details class="card fold reg-ref"><summary class="card-head"><h3>세 나라 비교표 <span class="muted small">같은 제품을 JP·VN·US 규칙에 동시에 적용</span></h3></summary>
        <div class="card-body">${compareTable(c, product)}</div></details>
      <details class="card fold reg-ref"><summary class="card-head"><h3>규제 변화 타임라인 <span class="muted small">초안 / 유예 중 / 시행 / 정지</span></h3></summary>
        <div class="card-body">${timeline()}</div></details>`;
  }

  function compareTable(c, product) {
    const docs = S.documents.forProduct(product.id);
    const buyer = S.buyers.get(c.buyerId);
    const main = claimSource(c, product).text;
    const per = S.rules.COUNTRY_CODES.map(cc => {
      const same = cc === c.country;
      const tmp = {
        id: c.id, country: cc, targetLaunchDate: c.targetLaunchDate, request: c.request,
        regulatory: same ? evalCase(c, product).regulatory : { claimInputs: { main, vnRegistered: main } }
      };
      return { cc, same, pack: S.rules.forCountry(cc), f: E().evaluate(tmp, product, docs, cc, { buyer: same ? buyer : null }), tmp };
    });
    const cell = list => {
      if (!list.length) return '<span class="muted">-</span>';
      const w = worst(list.map(f => f.verdict));
      const items = list.filter(f => f.verdict !== 'NOTED').map(f => `<li><span class="rule-id">${esc(f.ruleId || '—')}</span> ${esc(VERDICTS[f.verdict].label)}</li>`).join('');
      return `${badge(w)}${items ? `<ul class="mini">${items}</ul>` : ''}`;
    };
    const row = (label, fn) => [`<strong>${esc(label)}</strong>`].concat(per.map(fn));
    const rows = [
      row('진입 방식', p => esc(p.pack.entry)),
      row('분류', p => cell(p.f.filter(f => f.area === 'category'))),
      row('원료 경고', p => cell(p.f.filter(f => f.area === 'ingredient'))),
      row('문구 제약', p => cell(p.f.filter(f => f.area === 'claim'))),
      row('필요 서류', p => `<ul class="mini">${E().requiredDocs(p.tmp, p.cc).map(r => `<li>${esc(r.label)}</li>`).join('')}</ul>`),
      row('기간', p => `${esc(p.pack.lead.legal)}<br><span class="muted small">${esc(p.pack.lead.practical)}</span>`)
    ];
    const headers = ['항목'].concat(per.map(p => `${COUNTRIES[p.cc].name} ${p.cc}${p.same ? ' (현재 건)' : ''}`));
    return table(headers, rows, { cls: 'reg-compare' }) + '<p class="muted small">현재 건이 아닌 나라는 바이어 정보 없이, 같은 표시 문구로 계산했습니다.</p>';
  }

  function timeline() {
    return `<ol class="reg-timeline">${S.rules.timeline().map(t => `<li class="reg-tl-item st-${esc(t.status)}">
      <span class="reg-tl-date">${esc(t.date)}</span>
      <span>${countryBadge(t.country)} ${tag(STATUS_LABEL[t.status] || t.status, 'st-' + t.status)}</span>
      <span>${esc(t.title)} <span class="rule-id">${esc(t.ruleId || '')}</span></span>
    </li>`).join('')}</ol>`;
  }

  // 일본 목록·FDA 리콜 표
  const JP_CAT = { plant: '식물', animal: '동물', chemical: '화학물질' };
  function jpRows(list) {
    return table(['구분', '名称', '他名等', '의약품 전용 부위(部位等)', '備考'], list.map(x => [
      esc(JP_CAT[x.cat] || x.cat), `<strong>${esc(x.name)}</strong>`, esc(x.other), esc(x.parts || '전체'), esc(x.note)
    ]), { scroll: true });
  }
  function jpNote() {
    const src = S.reference.jpSource();
    return `<p class="muted small">部位等에 적힌 부위만 의약품 전용입니다. 備考의 「非医」는 그 부위·원료는 의약품으로 보지 않는다는 뜻입니다.
      ${src ? `원문 <a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.label)}</a>` : ''}</p>`;
  }
  function fdaRows(list) {
    const src = S.reference.fdaSource();
    return table(['보고일', '등급', '회사', '제품', '리콜 사유'], list.slice(0, 30).map(r => [
      esc(r.date), esc(r.cls), esc(r.firm), esc(r.product), esc(r.reason)
    ]), { scroll: true }) + (list.length > 30 ? `<p class="muted small">${list.length}건 중 30건만 표시</p>` : '') +
      `<p class="muted small">openFDA 데이터는 검증되지 않은 자료입니다. ${src ? `출처 <a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.label)}</a>` : ''}</p>`;
  }

  // ---------- 동작 ----------
  function doSearch(page, s) {
    work.search = Object.assign({ market: page.querySelector('[data-s="market"]').value, done: true }, s);
    page.querySelector('[data-out="search-result"]').innerHTML = pharmaResult(work.search);
    page.querySelector('[data-out="suggest"]').hidden = true;
  }

  function bind(page, c, product) {
    page.addEventListener('click', e => {
      const t = e.target.closest('[data-act]');
      if (!t) return;
      const act = t.dataset.act;
      if (act === 'search') {
        const q = page.querySelector('[data-s="q"]').value.trim();
        if (q.length < 2) { toast('성분명을 2글자 이상 입력하세요.', 'warn'); return; }
        doSearch(page, { q, ing: null });
      } else if (act === 'pick-suggest') {
        page.querySelector('[data-s="q"]').value = t.dataset.v;
        doSearch(page, { q: t.dataset.v, ing: null });
      } else if (act === 'pick-ing') {
        const ing = (product.formula || [])[Number(t.dataset.i)];
        if (!ing) return;
        page.querySelector('[data-s="q"]').value = ing.nameKo || ing.nameEn;
        doSearch(page, { q: ing.nameKo || ing.nameEn, ing: { nameKo: ing.nameKo, nameEn: ing.nameEn } });
        page.querySelector('[data-out="search-result"]').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (act === 'jp-part') setPart(product.id, Number(t.dataset.i), t.dataset.v);
      else if (act === 'extract') { readMap(page); extract(product); }
      else if (act === 'draft-cancel') { work.draft = null; work.sheets = null; DASH.refresh(); }
      else if (act === 'draft-apply') applyDraft(c.id, 'replace');
      else if (act === 'draft-append') applyDraft(c.id, 'append');
      else if (act === 'to-request-tab') DASH.go('request');
      else if (act === 'to-request') {
        const cur = S.cases.get(c.id);
        if (cur.stage === 'regulatory') cur.stage = 'request';
        DASH.caseContext.save(cur, { silent: true });
        DASH.go('request');
      }
    });

    // 자동완성
    const q = page.querySelector('[data-s="q"]');
    q.addEventListener('input', () => {
      const out = page.querySelector('[data-out="suggest"]');
      const extra = (product.formula || []).map(i => i.nameKo || i.nameEn).filter(Boolean);
      const list = S.reference.suggest(q.value, extra);
      out.innerHTML = list.map(x => `<li><button type="button" data-act="pick-suggest" data-v="${esc(x.label)}">${esc(x.label)} <span class="muted small">${esc(x.kind)}</span></button></li>`).join('');
      out.hidden = !list.length;
    });
    q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); page.querySelector('[data-act="search"]').click(); } });

    // 업로드 (클릭·끌어다 놓기)
    const drop = page.querySelector('[data-drop]');
    if (drop) {
      drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('over'));
      drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0], product); });
    }
    if (work.draft && work.sheets) fillCols(page);

    page.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.act === 'upload') { if (t.files[0]) readFile(t.files[0], product); t.value = ''; return; }
      if (t.dataset.map) { if (t.dataset.map === 'sheet' || t.dataset.map === 'hasHeader') { work.sheet = page.querySelector('[data-map="sheet"]').value; work.map = null; fillCols(page); } return; }
      if (t.dataset.s === 'market' && work.search && work.search.done) { doSearch(page, { q: work.search.q, ing: work.search.ing }); return; }
      if (t.dataset.s) return;
      const cur = S.cases.get(c.id);
      cur.regulatory = cur.regulatory || {};
      if (t.dataset.field) cur.regulatory[t.dataset.field] = t.type === 'checkbox' ? t.checked : t.value;
      else if (t.dataset.check !== undefined) {
        cur.regulatory.jpLabelChecks = Object.assign({}, cur.regulatory.jpLabelChecks, { [t.dataset.check]: t.checked });
      } else return;
      DASH.caseContext.save(cur);
    });
  }

  // 부위 조건 성분: 담당자가 '예/아니요'를 한 번 고른다 (다시 누르면 자동 판정으로 되돌림)
  function setPart(productId, idx, v) {
    const p = S.products.get(productId);
    const ing = (p.formula || [])[idx];
    if (!ing) return;
    const want = v === 'yes';
    if (ing.jpPharmaBy === 'user' && ing.jpPharmaOnly === want) { delete ing.jpPharmaBy; delete ing.jpPharmaOnly; }
    else { ing.jpPharmaBy = 'user'; ing.jpPharmaOnly = want; }
    S.products.save(p);
    DASH.caseContext.notify();
  }

  // 추출한 성분표를 처방으로 저장 → 다시 그리면 자동 판정·조회가 돈다
  function applyDraft(caseId, mode) {
    if (!work.draft || !work.draft.length) { toast('저장할 성분이 없어요. 시트·열을 바꿔 다시 읽어 보세요.', 'warn'); return; }
    const c = S.cases.get(caseId);
    const p = S.products.get(c.productId);
    const old = p.formula || [];
    const built = [];
    work.draft.forEach(r => {
      const prev = old.find(o => (r.nameKo && o.nameKo === r.nameKo) || (r.nameEn && o.nameEn === r.nameEn));
      built.push(Object.assign({}, prev || {}, r, { ingredientId: (prev && prev.ingredientId) || S.products.newIngredientId(old.concat(built)) }));
    });
    const next = mode === 'append' ? old.concat(built.filter(b => !old.some(o => o.ingredientId === b.ingredientId))) : built;
    if (JSON.stringify(old) !== JSON.stringify(next)) {
      p.formula = next;
      S.products.save(p);
      const affected = S.cases.flagFormulaChange(p.id, work.draftFrom || '성분표 변경');
      if (affected.length) modal('처방 변경 경고', `<p>견적이 합의되어 바이어가 현지 등록·신고를 진행 중인 건의 처방이 바뀌었습니다.</p><ul>${affected.map(a => `<li><strong>${esc(a.caseId)}</strong> — ${esc(a.message)}</li>`).join('')}</ul>`);
    }
    work.draft = null;
    work.sheets = null;
    toast('처방을 저장하고 규제 조회를 다시 했습니다.');
    DASH.caseContext.notify();
  }

  // ---------- 파일 읽기 ----------
  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    const rows = [];
    let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (ch !== '\r') cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(x => String(x).trim() !== ''));
  }

  function readFile(file, product) {
    if (!/\.(csv|xlsx|xls)$/i.test(file.name)) { toast('XLSX·XLS·CSV 파일만 읽을 수 있어요. PDF·이미지는 2단계(서버 OCR)에서 지원합니다.', 'warn'); return; }
    const isCsv = /\.csv$/i.test(file.name);
    const reader = new FileReader();
    reader.onerror = () => toast('파일을 읽지 못했습니다.', 'warn');
    reader.onload = () => {
      try {
        let sheets;
        if (isCsv) sheets = { [file.name]: parseCSV(String(reader.result)) };
        else {
          if (!window.XLSX) { toast('엑셀 읽기 라이브러리가 없습니다. CSV로 저장해 올리세요.', 'warn'); return; }
          const wb = window.XLSX.read(new Uint8Array(reader.result), { type: 'array' });
          sheets = {};
          wb.SheetNames.forEach(n => { sheets[n] = window.XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' }); });
        }
        const names = Object.keys(sheets);
        if (!names.length) { toast('시트가 없습니다.', 'warn'); return; }
        work.sheets = sheets;
        work.fileName = file.name;
        // 성분명 머리글이 있는 시트를 먼저 고른다
        work.sheet = names.find(n => guessMap(sheets[n]).colName !== null) || names[0];
        work.map = null;
        extract(product);
      } catch (e) {
        console.error(e);
        toast('파일을 해석하지 못했습니다: ' + e.message, 'warn');
      }
    };
    if (isCsv) reader.readAsText(file, 'utf-8'); else reader.readAsArrayBuffer(file);
  }

  function guessCol(header, re) {
    const i = header.findIndex(h => re.test(String(h)));
    return i >= 0 ? i : null;
  }
  function guessMap(rows) {
    const header = rows[0] || [];
    const width = rows.reduce((w, r) => Math.max(w, r.length), 0);
    const g = {
      colName: guessCol(header, /성분|원료|ingredient|name|名/i),
      colAmount: guessCol(header, /함량|amount|qty|content|量/i),
      colUnit: guessCol(header, /단위|unit/i),
      colEn: guessCol(header, /영문|english|inci|latin|학명/i),
      hasHeader: true
    };
    if (g.colEn !== null && g.colEn === g.colName) g.colName = guessCol(header.map((h, i) => i === g.colEn ? '' : h), /성분|원료|ingredient|name|名/i);
    if (g.colName === null) { g.colName = 0; g.colAmount = width > 1 ? 1 : null; g.colUnit = width > 2 ? 2 : null; g.hasHeader = false; g.guessed = false; }
    return g;
  }

  function fillCols(page) {
    const rows = work.sheets[work.sheet] || [];
    const width = rows.reduce((w, r) => Math.max(w, r.length), 0);
    const m = work.map || guessMap(rows);
    const hh = page.querySelector('[data-map="hasHeader"]');
    if (!hh) return;
    const header = hh.checked ? (rows[0] || []) : [];
    const opts = [{ value: '', label: '(없음)' }].concat(Array.from({ length: width }, (_, i) => ({ value: i, label: `${String.fromCharCode(65 + (i % 26))}열${header[i] ? ' · ' + header[i] : ''}` })));
    ['colName', 'colAmount', 'colUnit', 'colEn'].forEach(k => {
      const sel = page.querySelector(`[data-map="${k}"]`);
      sel.innerHTML = options(opts, m[k] === null || m[k] === undefined ? '' : m[k]);
    });
  }

  function readMap(page) {
    const v = k => { const x = page.querySelector(`[data-map="${k}"]`).value; return x === '' ? null : Number(x); };
    work.sheet = page.querySelector('[data-map="sheet"]').value;
    work.map = { colName: v('colName'), colAmount: v('colAmount'), colUnit: v('colUnit'), colEn: v('colEn'), hasHeader: page.querySelector('[data-map="hasHeader"]').checked };
  }

  function extract(product) {
    const rows = work.sheets[work.sheet] || [];
    const m = work.map || guessMap(rows);
    work.map = m;
    if (m.colName === null) { toast('성분명 열을 지정하세요.', 'warn'); return; }
    const body = m.hasHeader ? rows.slice(1) : rows;
    const pick = (r, k) => (m[k] === null || m[k] === undefined ? '' : String(r[m[k]] === undefined ? '' : r[m[k]]).trim());
    const items = body.map(r => ({
      nameKo: pick(r, 'colName'), nameEn: pick(r, 'colEn'),
      amountPerServing: Number(pick(r, 'colAmount').replace(/,/g, '')) || 0, unit: pick(r, 'colUnit') || 'mg'
    })).filter(x => x.nameKo);
    if (!items.length) { toast('성분을 찾지 못했어요. 시트·열을 바꿔 다시 읽어 보세요.', 'warn'); work.draft = []; }
    const old = product.formula || [];
    work.draft = items.map(x => {
      const prev = old.find(o => o.nameKo === x.nameKo || (x.nameEn && o.nameEn === x.nameEn));
      return prev ? Object.assign({}, prev, { amountPerServing: x.amountPerServing, unit: x.unit || prev.unit, nameEn: x.nameEn || prev.nameEn }) : x;
    });
    work.draftFrom = `${work.fileName}${Object.keys(work.sheets).length > 1 ? ' · ' + work.sheet : ''} — 성분 ${items.length}개`;
    if (items.length) toast(`${items.length}개 성분을 읽었어요. 판정을 확인하고 저장하세요.`);
    DASH.refresh();
    setTimeout(() => { const t = document.querySelector('.reg-sheet'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 50);
  }

  DASH.registerTab({
    id: 'regulatory', icon: '📜', label: '규제 확인', order: 20, cssClass: 'tab-reg', needsCase: true,
    render,
    summary: ctx => {
      const f = (ctx.regulatory && ctx.regulatory.findings) || [];
      return { label: '사용 불가·조치 필요', value: f.filter(x => x.verdict === 'BLOCK' || x.verdict === 'ACTION').length };
    }
  });
})();
