// 규칙 판정 공통 함수 (README 6장).
// evaluate(case, product, documents, country) → 해당 국가 규칙 전부 실행 → [{ruleId, verdict, message, source, needsVerification, ...}]
// 규칙이 없는 영역은 UNKNOWN 결과를 추가한다. 규칙 수치는 params에서 읽는다.
(function () {
  const DASH = window.DASH;
  const D = DASH.dates;

  const AREAS = ['category', 'ingredient', 'claim', 'document', 'schedule', 'manufacturing', 'post_market', 'applicant'];
  const AREA_LABELS = {
    category: '제품 분류', ingredient: '원료', claim: '표시 문구', document: '서류',
    schedule: '일정·마감', manufacturing: '제조', post_market: '판매 후 의무', applicant: '신청자·명의자'
  };
  const DOC_CHECKS = ['docRequired', 'docAgeMonthsMax', 'docLegalization'];

  const R = () => DASH.services.rules;
  const docLabel = t => (DASH.services.documents.TYPES[t] || t);

  function claimText(reg, fields) {
    const ci = (reg && reg.claimInputs) || {};
    return (fields || ['main']).map(f => ci[f] || '').join('\n').trim();
  }

  function findTerms(text, terms) {
    const t = String(text).toLowerCase();
    return terms.filter(w => t.includes(String(w).toLowerCase()));
  }

  function holidayNote(country) {
    return D.hasHolidays(country) ? '' : ' · 공휴일 미반영 — 실제 마감은 더 이를 수 있음';
  }

  function ddayText(date, today) {
    const n = D.daysUntil(date, today);
    return n > 0 ? `D-${n}` : n === 0 ? 'D-day' : `${-n}일 지남`;
  }

  function findDoc(docs, type) {
    return (docs || []).filter(d => d.type === type)
      .sort((a, b) => String(b.issuedAt || '').localeCompare(String(a.issuedAt || '')))[0] || null;
  }

  // 화면 입력값 + 파생 플래그 (params.when / params.unless 에서 사용)
  function flagsOf(c) {
    const reg = c.regulatory || {};
    return Object.assign({}, reg, { hasClaim: !!claimText(reg, ['main']) });
  }

  // ---------- 검사 함수 ----------
  // 반환: {status: 'pass'|'fail'|'unknown'|'input', verdict?, detail?, suggestion?, deadline?}
  const CHECKS = {
    always: () => ({ status: 'fail' }),

    dataMissing: rule => ({ status: 'unknown', detail: rule.message }),

    categoryChoice(rule, x) {
      const pack = R().forCountry(x.country);
      const code = x.reg.category || pack.defaultCategory;
      const cat = (pack.categories || []).find(c => c.code === code);
      if (!cat) return { status: 'input', detail: '분류를 선택하세요.' };
      if (!(rule.params.supported || []).includes(code)) {
        return { status: 'unknown', detail: `선택: ${cat.label} — 이 경로의 규칙은 아직 등록되어 있지 않습니다.` };
      }
      return { status: 'fail', detail: `선택: ${cat.label}` };
    },

    ingredientFlag(rule, x) {
      const p = rule.params;
      const f = (x.product && x.product.formula) || [];
      if (!f.length) return { status: 'input', detail: '처방(성분) 정보가 없습니다.' };
      const name = DASH.services.products.ingredientName;
      const hit = f.filter(i => i[p.flag] === true);
      if (hit.length) return { status: 'fail', detail: '해당 성분: ' + hit.map(name).join(', ') };
      const unset = p.unsetAsFalse ? [] : f.filter(i => i[p.flag] !== true && i[p.flag] !== false);
      if (unset.length) {
        return { status: 'unknown', detail: '목록 대조로 판단하지 못한 성분: ' + unset.map(name).join(', ') + ' — 이름 대조 불가 또는 사용 부위 확인 필요 (규제 확인 탭의 성분 판정 표 참고)' };
      }
      return { status: 'pass', detail: '입력된 성분 플래그 기준으로 해당 성분 없음' };
    },

    deadlineBusiness(rule, x) {
      const p = rule.params;
      const base = x.c[p.from];
      if (!base || !D.isValid(base)) return { status: 'input', detail: '판매 희망일이 입력되지 않았습니다.' };
      const due = D.addBusinessDays(base, p.days, x.country);
      let detail = `신고 마감 ${due} (판매 희망일 ${base} − ${Math.abs(p.days)}영업일, ${ddayText(due, x.today)})`;
      let deadline = due;
      if (p.bufferDays) {
        const prep = D.addBusinessDays(due, -p.bufferDays, x.country);
        detail += ` · 우리 자료 제공 마감 ${prep} (신고 마감 − ${p.bufferDays}영업일, ${ddayText(prep, x.today)})`;
        deadline = prep;
      }
      return { status: 'fail', detail: detail + holidayNote(x.country), deadline };
    },

    deadlineCalendar(rule, x) {
      const p = rule.params;
      const base = x.c[p.from];
      if (!base || !D.isValid(base)) return { status: 'input', detail: '판매(출시) 희망일이 입력되지 않았습니다.' };
      const due = D.addCalendarDays(base, p.days);
      const how = p.days < 0 ? `기준일 ${base} − ${-p.days}일` : `기준일 ${base} + ${p.days}일`;
      return { status: 'fail', detail: `마감 ${due} (${how}, 달력일 · ${ddayText(due, x.today)}) — 달력일 기준인지는 원문 확인 필요`, deadline: due };
    },

    queryDeadline(rule, x) {
      const qs = (((x.c.registration || {}).queries) || []).filter(q => q.receivedAt && !q.answeredAt);
      if (!qs.length) return { status: 'pass', detail: '현재 회신 대기 중인 보완 요청이 없습니다.' };
      const items = qs.map(q => ({ q, due: D.addBusinessDays(q.receivedAt, rule.params.days, x.country) }))
        .sort((a, b) => a.due.localeCompare(b.due));
      return {
        status: 'fail',
        detail: items.map(i => `접수 ${i.q.receivedAt} → 회신 기한 ${i.due} (${ddayText(i.due, x.today)})`).join(' / ') + holidayNote(x.country),
        deadline: items[0].due
      };
    },

    docRequired(rule, x) {
      const p = rule.params;
      const doc = findDoc(x.docs, p.docType);
      const form = x.product && x.product.form;
      const formNote = p.forms && form && !p.forms.includes(form)
        ? ` (제형 '${DASH.ui.FORMS[form] || form}'이 의무 대상 형태인지 확인 필요)` : '';
      if (!doc) return { status: 'fail', detail: `${docLabel(p.docType)} 없음${formNote}` };
      if (p.renewMonths) {
        if (!doc.issuedAt) return { status: 'fail', detail: '등록·갱신일이 입력되지 않았습니다.' };
        const due = D.addMonths(doc.issuedAt, p.renewMonths);
        if (due < x.today) return { status: 'fail', detail: `마지막 등록·갱신 ${doc.issuedAt} → 갱신 기한 ${due} 지남`, deadline: due };
        return { status: 'pass', detail: `보유 (${doc.fileName || doc.id}) · 다음 갱신 기한 ${due} (${ddayText(due, x.today)})`, deadline: due };
      }
      return { status: 'pass', detail: `보유: ${doc.fileName || doc.id}${formNote} — 내용은 사람이 확인` };
    },

    docAgeMonthsMax(rule, x) {
      const p = rule.params;
      const doc = findDoc(x.docs, p.docType);
      if (!doc) return { status: 'fail', detail: `${docLabel(p.docType)} 없음` };
      if (!doc.issuedAt) return { status: 'fail', detail: '발급일이 입력되지 않았습니다.' };
      const planned = (x.c.request || {}).plannedSubmitDate || (x.c.registration || {}).plannedSubmitDate;
      const submit = planned || x.today;
      const m = D.monthsBetween(doc.issuedAt, submit);
      const limit = D.addMonths(doc.issuedAt, p.months);
      const problems = [];
      if (m > p.months) problems.push(`발급일 ${doc.issuedAt} → 제출 예정일 ${submit} 기준 ${m.toFixed(1)}개월 (기준 ${p.months}개월 이내)`);
      const lab = doc.lab || {};
      if (p.requireLab && !p.requireLab.some(k => lab[k])) problems.push('시험기관이 ISO/IEC 17025 또는 MOH 지정으로 표시되지 않음');
      const note = planned ? '' : ' (제출 예정일 미입력 → 오늘 기준)';
      if (problems.length) return { status: 'fail', detail: problems.join(' · ') + note, deadline: limit };
      return { status: 'pass', detail: `제출 예정일 기준 ${m.toFixed(1)}개월 · 인정 기관 표시됨 · 12개월 기한 ${limit}${note}`, deadline: limit };
    },

    docLegalization(rule, x) {
      const p = rule.params;
      const doc = findDoc(x.docs, p.docType);
      if (!doc) return { status: 'fail', detail: `${docLabel(p.docType)} 없음` };
      const lg = doc.legalization || 'none';
      if (!p.allowed.includes(lg)) {
        return { status: 'fail', detail: `현재 합법화 방식: ${DASH.services.documents.LEGALIZATION[lg] || lg} → 아포스티유 또는 대사관 합법화 필요` };
      }
      return { status: 'pass', detail: `합법화: ${DASH.services.documents.LEGALIZATION[lg]}` };
    },

    holderCapability(rule, x) {
      if (!x.buyer) return { status: 'unknown', detail: '바이어 정보 없음' };
      const hc = x.buyer.holderCapability && x.buyer.holderCapability[rule.params.country];
      if (!hc) return { status: 'unknown', detail: '명의자 역량 정보 미입력 — 홈의 바이어 카드에서 입력하세요.' };
      if (hc.localEntity !== true) {
        return { status: 'fail', verdict: 'BLOCK', detail: '바이어가 베트남 현지 법인이 아닙니다 → 이 바이어 명의로는 등록 신청을 할 수 없습니다. 현지 등록 법인 확보가 필요합니다.' };
      }
      if (hc.canAcceptLoA !== true) return { status: 'fail', detail: '제조사 위임장(LoA) 수령 구조가 확인되지 않았습니다.' };
      return { status: 'pass', detail: `현지 법인 · 등록 경험 ${hc.pastRegistrations || 0}건 · 위임장 수령 가능` };
    },

    claimTerms(rule, x) {
      const text = claimText(x.reg, rule.params.fields);
      if (!text) return { status: 'input', detail: '점검할 표시 문구가 없습니다 — 개발요청서의 허용 표현 초안을 채우면 자동으로 점검해요.' };
      const terms = R().claimTerms(x.country)[rule.params.list] || [];
      const hits = findTerms(text, terms);
      if (hits.length) {
        return {
          status: 'fail',
          detail: '걸린 표현: ' + hits.map(h => `"${h}"`).join(', ') + ' — 단어 기준 1차 점검이므로 문맥은 담당자가 확인',
          suggestion: rule.suggestion
        };
      }
      return { status: 'pass', detail: '표현 목록에 걸린 단어 없음 (목록은 출발점일 뿐)' };
    },

    checklist(rule, x) {
      const pack = R().forCountry(x.country);
      const items = pack.labelChecklist || [];
      const checks = x.reg[rule.params.key] || {};
      if ((x.reg.category || pack.defaultCategory) !== 'ffc') return { status: 'unknown', detail: 'FFC가 아닌 분류의 표시 체크리스트는 등록되어 있지 않습니다.' };
      const missing = items.filter((_, i) => !checks[i]);
      if (missing.length) return { status: 'fail', detail: `확인 ${items.length - missing.length}/${items.length} · 남은 항목: ${missing.join(', ')}` };
      return { status: 'pass', detail: `${items.length}개 항목을 담당자가 모두 체크함` };
    },

    disclaimer(rule, x) {
      const text = claimText(x.reg, rule.params.fields);
      if (!text) return { status: 'input', detail: '점검할 표시 문구가 없습니다 — 개발요청서의 허용 표현 초안을 채우면 자동으로 점검해요.' };
      if (text.toLowerCase().includes('not been evaluated by the food and drug administration')) {
        return { status: 'pass', detail: '면책 문구 포함됨 — 라벨에서 굵게 표시되는지 확인' };
      }
      return { status: 'fail', suggestion: `${text}*\n\n*${rule.params.text}` };
    },

    vnLabel(rule, x) {
      const p = rule.params;
      const ci = x.reg.claimInputs || {};
      const [reg, label, ad] = p.fields.map(f => (ci[f] || '').trim());
      if (!reg && !label && !ad) return { status: 'input', detail: '점검할 표시 문구가 없습니다 — 개발요청서의 허용 표현 초안을 채우면 자동으로 점검해요.' };
      const norm = s => s.replace(/\s+/g, ' ').trim().toLowerCase();
      const problems = [];
      if (!reg) problems.push('등록 문구 미입력');
      if (reg && label && norm(reg) !== norm(label)) problems.push('라벨 문구가 등록 문구와 다름');
      if (reg && ad && norm(reg) !== norm(ad)) problems.push('광고 문구가 등록 문구와 다름');
      if (!p.requiredPhrases.some(ph => norm(label).includes(ph.toLowerCase()))) problems.push("라벨에 '의약품이 아님' 문구 없음");
      let all = norm([reg, label, ad].join(' '));
      (p.ignorePhrases || p.requiredPhrases).forEach(ph => { all = all.split(ph.toLowerCase()).join(' '); });
      const hits = findTerms(all, R().claimTerms(x.country)[p.list] || []);
      if (hits.length) problems.push('의약품처럼 보이는 표현: ' + hits.map(h => `"${h}"`).join(', '));
      if (problems.length) return { status: 'fail', detail: problems.join(' · '), suggestion: rule.suggestion };
      return { status: 'pass', detail: '세 문구 일치 · 의약품 아님 문구 있음' };
    },

    changeAfterRegistration(rule, x) {
      const ch = x.c.formulaChangedAfterReg;
      if (ch) return { status: 'fail', detail: `처방 변경 기록: ${ch.at || ''} ${ch.note || ''}`.trim() };
      return { status: 'pass', detail: '등록 단계 이후 처방 변경 기록 없음. 처방·제조소·문구·라벨을 바꾸면 새 등록이 필요합니다.' };
    }
  };

  function toFinding(rule, r) {
    let verdict, message;
    if (r.status === 'fail') { verdict = r.verdict || rule.verdictIfFail; message = rule.message; }
    else if (r.status === 'pass') { verdict = 'NOTED'; message = '등록된 규칙에 걸린 항목이 없습니다. (승인 아님 — 최종 판단은 규제 담당·바이어)'; }
    else if (r.status === 'input') { verdict = 'REVIEW'; message = '점검할 정보가 없어 확인하지 못했습니다.'; }
    else { verdict = 'UNKNOWN'; message = '규칙 미등록 — 수동 확인 필요'; }
    return {
      ruleId: rule.id, country: rule.country, area: rule.area, title: rule.title,
      verdict, message, detail: r.detail || '', suggestion: r.suggestion || '', deadline: r.deadline || null,
      source: rule.source, verifiedAt: rule.verifiedAt, needsVerification: !!rule.needsVerification
    };
  }

  function unknownFinding(country, area, title) {
    return {
      ruleId: '', country, area, title, verdict: 'UNKNOWN',
      message: '규칙 미등록 — 수동 확인 필요', detail: '', suggestion: '', deadline: null,
      source: null, verifiedAt: '-', needsVerification: false
    };
  }

  function evaluate(caseObj, product, documents, country, opts) {
    opts = opts || {};
    country = country || caseObj.country;
    const pack = R().forCountry(country);
    if (!pack) return [unknownFinding(country, 'category', '이 국가의 규칙 파일 없음')];
    const buyer = opts.buyer !== undefined ? opts.buyer
      : (caseObj.buyerId ? DASH.services.buyers.get(caseObj.buyerId) : null);
    const x = {
      c: caseObj, reg: caseObj.regulatory || {}, product, buyer,
      docs: documents || [], country, today: opts.today || D.today()
    };
    const flags = flagsOf(caseObj);
    const out = [];

    pack.rules.forEach(rule => {
      const p = rule.params || {};
      let r;
      if (p.when && !flags[p.when]) r = { status: 'pass', detail: `'${p.whenLabel || p.when}' 해당 없음으로 표시됨` };
      else if (p.unless && flags[p.unless]) r = { status: 'pass', detail: `'${p.unless === 'newIngredient' ? '신규 성분 포함' : p.unless}'으로 표시되어 다른 규칙이 적용됩니다.` };
      else {
        const fn = CHECKS[rule.check];
        r = fn ? fn(rule, x) : { status: 'unknown', detail: `검사 함수 '${rule.check}'가 구현되지 않았습니다.` };
      }
      out.push(toFinding(rule, r));
    });

    AREAS.forEach(a => {
      if (!pack.rules.some(r => r.area === a)) out.push(unknownFinding(country, a, `${AREA_LABELS[a]} — 이 영역에 등록된 규칙 없음`));
    });
    (pack.unregistered || []).forEach(u => out.push(unknownFinding(country, u.area, u.title)));
    return out;
  }

  function countBy(findings) {
    const c = { BLOCK: 0, ACTION: 0, REVIEW: 0, NOTED: 0, UNKNOWN: 0 };
    findings.forEach(f => { c[f.verdict] = (c[f.verdict] || 0) + 1; });
    return c;
  }

  // 결과가 바뀌었는지 비교용 서명
  function signature(findings) {
    return findings.map(f => `${f.ruleId}|${f.title}|${f.verdict}|${f.detail}`).sort().join('\n');
  }

  function requiredDocs(caseObj, country) {
    const pack = R().forCountry(country || caseObj.country);
    if (!pack) return [];
    const flags = flagsOf(caseObj);
    return (pack.requiredDocs || []).filter(d => !d.when || flags[d.when]);
  }

  // 서류함 체크리스트 행: 서류 종류 · 보유 여부 · 유효성 판정 · 출처
  function docChecklist(caseObj, product, docs, opts) {
    const findings = evaluate(caseObj, product, docs, caseObj.country, opts);
    return requiredDocs(caseObj).map(req => {
      const rule = R().rule(req.ruleId);
      const f = findings.find(x => x.ruleId === req.ruleId);
      const doc = findDoc(docs, req.type);
      let verdict, message;
      if (rule && DOC_CHECKS.includes(rule.check) && f) { verdict = f.verdict; message = f.detail; }
      else if (!doc) { verdict = 'ACTION'; message = '서류 없음'; }
      else if (req.type === 'FFC_EVIDENCE' || req.type === 'EFFICACY') {
        verdict = doc.matchChecked ? 'NOTED' : 'REVIEW';
        message = doc.matchChecked ? '성분·함량 일치를 담당자가 체크함' : '근거 자료의 성분·함량이 처방과 일치하는지 확인 필요';
      } else { verdict = 'NOTED'; message = '보유 — 내용은 사람이 확인'; }
      return { req, rule, doc, verdict, message, source: rule ? rule.source : null, verifiedAt: rule ? rule.verifiedAt : '-', needsVerification: rule ? rule.needsVerification : false };
    });
  }

  // 건 하나의 마감 목록 (규제 확인 ⑤ 주요 마감에 사용)
  function deadlinesFor(c, product, docs, today) {
    today = today || D.today();
    const rs = R();
    const out = [];
    const reg = c.regulatory || {};
    const regi = c.registration || {};
    const steps = regi.steps || [];
    const step = k => steps.find(s => s.key === k);
    const isDone = k => { const s = step(k); return !!(s && s.status === 'done'); };
    const target = c.targetLaunchDate && D.isValid(c.targetLaunchDate) ? c.targetLaunchDate : null;

    if (c.country === 'JP' && target) {
      const id = reg.newIngredient ? 'JP-SCH-02' : 'JP-SCH-01';
      const days = rs.param(id, 'days', null);
      const buf = rs.param(id, 'bufferDays', 0);
      if (days !== null) {
        const notify = D.addBusinessDays(target, days, 'JP');
        const provide = D.addBusinessDays(notify, -buf, 'JP');
        out.push({ key: 'provide', label: '우리 자료 제공 마감', date: provide, ruleId: id, done: isDone('provide'), basis: `신고 마감 − ${buf}영업일`, business: true });
        out.push({ key: 'notify', label: '바이어 신고 마감', date: notify, ruleId: id, done: isDone('notify'), basis: `판매 희망일 − ${-days}영업일`, business: true });
        out.push({ key: 'sellable', label: '판매 희망일', date: target, ruleId: '', done: isDone('sellable'), basis: '', info: true });
      }
    }

    if (c.country === 'VN') {
      const qDays = rs.param('VN-SCH-02', 'days', null);
      (regi.queries || []).filter(q => q.receivedAt && !q.answeredAt).forEach(q => {
        if (qDays === null) return;
        out.push({ key: 'query', queryId: q.id, label: `보완 요청 회신 기한 (접수 ${q.receivedAt})`, date: D.addBusinessDays(q.receivedAt, qDays, 'VN'), ruleId: 'VN-SCH-02', done: false, basis: `접수일 + ${qDays}영업일`, business: true });
      });
      const months = rs.param('VN-DOC-TEST', 'months', null);
      if (months !== null) {
        (docs || []).filter(d => d.type === 'TEST_REPORT' && d.issuedAt).forEach(d => {
          const exp = D.addMonths(d.issuedAt, months);
          const submit = regi.plannedSubmitDate;
          const over = !!(submit && submit > exp);
          out.push({
            key: 'test-expiry', docId: d.id, date: exp, ruleId: 'VN-DOC-TEST', done: isDone('submit') && !over,
            label: over ? `시험성적서 ${months}개월 초과 (제출 예정일 ${submit} 기준) — 재시험` : `시험성적서 ${months}개월 기한`,
            basis: `발급일 ${d.issuedAt} + ${months}개월`, flagged: over, alertDays: 30
          });
        });
      }
    }

    if (c.country === 'US') {
      if (target && reg.ndiConfirmed) {
        const days = rs.param('US-NDI-01', 'days', null);
        if (days !== null) out.push({ key: 'ndi', label: `NDI 통지 마감 (판매 ${-days}일 전)`, date: D.addCalendarDays(target, days), ruleId: 'US-NDI-01', done: isDone('ndi'), basis: `출시일 − ${-days}일 (달력일)` });
      }
      const launchStep = step('launch');
      const launch = launchStep && launchStep.status === 'done' && launchStep.doneAt ? launchStep.doneAt : target;
      if (launch) {
        const days = rs.param('US-CLM-03', 'days', null);
        if (days !== null) out.push({ key: 'claim', label: `구조·기능 표현 FDA 통지 마감 (출시 후 ${days}일)`, date: D.addCalendarDays(launch, days), ruleId: 'US-CLM-03', done: isDone('claim'), basis: `출시일 ${launch} + ${days}일 (달력일)` });
      }
      const renew = rs.param('US-FAC-01', 'renewMonths', null);
      const fac = findDoc(docs, 'FDA_FACILITY');
      if (fac && fac.issuedAt && renew) {
        out.push({ key: 'facility', label: 'FDA 식품시설 등록 갱신 기한', date: D.addMonths(fac.issuedAt, renew), ruleId: 'US-FAC-01', done: false, basis: `마지막 등록·갱신 ${fac.issuedAt} + ${renew}개월`, alertDays: 60 });
      } else {
        out.push({ key: 'facility', label: 'FDA 식품시설 등록 자료 없음 — 확인 필요', date: today, ruleId: 'US-FAC-01', done: false, basis: '서류함에 FDA_FACILITY 미등록', missing: true });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }

  // 홈 '오늘 할 일': 모든 진행 중인 건의 마감을 모아 날짜순
  function collectTasks(today) {
    today = today || D.today();
    const S = DASH.services;
    const tasks = [];
    const cases = S.cases.list().filter(c => c.stage !== 'closed');
    cases.forEach(c => {
      const product = S.products.get(c.productId);
      const buyer = S.buyers.get(c.buyerId);
      const docs = S.documents.forProduct(c.productId);
      const name = `${buyer ? buyer.name : '바이어 미지정'} · ${product ? product.name : '제품 미지정'}`;
      deadlinesFor(c, product, docs, today).forEach(d => {
        if (d.done || d.info) return;
        if (d.alertDays && !d.flagged && D.daysUntil(d.date, today) > d.alertDays) return;
        tasks.push({ date: d.date, label: d.label, caseId: c.id, country: c.country, tab: 'regulatory', caseName: name, ruleId: d.ruleId, sample: c.sample });
      });
      if (c.request && c.request.status === 'sent') {
        tasks.push({ date: c.request.sentAt || today, label: 'R&D 회신 대기 (개발요청서 발송됨)', caseId: c.id, country: c.country, tab: 'request', caseName: name, waiting: true, sample: c.sample });
      }
    });
    const seen = {};
    cases.forEach(c => {
      const b = S.buyers.get(c.buyerId);
      if (b && b.awaitingReply && !seen[b.id]) {
        seen[b.id] = true;
        tasks.push({ date: b.lastContactAt || today, label: `바이어 회신 대기 — ${b.name}`, caseId: c.id, country: c.country, tab: 'home', caseName: '마지막 연락일 기준', waiting: true, sample: b.sample });
      }
    });
    return tasks.sort((a, b) => a.date.localeCompare(b.date));
  }

  DASH.engine = {
    AREAS, AREA_LABELS, CHECKS,
    evaluate, countBy, signature, requiredDocs, docChecklist, deadlinesFor, collectTasks, findDoc, claimText
  };
})();
