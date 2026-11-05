// README 12장 시나리오 A·B·C 규칙 판정 검증. 저장소를 쓰지 않도록 객체를 직접 만들어 넘긴다.
(function () {
  const E = DASH.engine;
  const P = window.DASH_DATA.sampleProducts;
  const B = window.DASH_DATA.sampleBuyers;
  const clone = o => JSON.parse(JSON.stringify(o));
  const TODAY = '2026-11-04';
  const find = (fs, id) => fs.find(f => f.ruleId === id) || {};

  function commonChecks(fs, label) {
    TEST.ok(fs.every(f => !/수출 가능|규제 통과|승인됨/.test(f.message + f.detail + f.title)), `${label}: '수출 가능·규제 통과·승인됨' 문구 없음`);
    TEST.ok(fs.filter(f => f.ruleId).every(f => f.source && f.source.label && f.verifiedAt), `${label}: 규칙 판정마다 출처·검증일 있음`);
    TEST.ok(fs.every(f => ['BLOCK', 'ACTION', 'REVIEW', 'NOTED', 'UNKNOWN'].includes(f.verdict)), `${label}: 판정은 5단계만 사용`);
  }

  TEST.suite('시나리오 A — 일본 · 유통 체인 × 콜라겐 젤리 스틱 (FFC)', function () {
    const product = clone(P.find(p => p.id === 'P-002'));
    const c = { id: 'T-A', country: 'JP', buyerId: 'B-001', productId: 'P-002', targetLaunchDate: '2027-06-01',
      regulatory: { category: 'ffc', claimInputs: { main: '임산부에게도 좋은 피부 보습' } }, registration: {} };
    const fs = E.evaluate(c, product, [], 'JP', { buyer: B[0], today: TODAY });
    TEST.eq(find(fs, 'JP-ING-01').verdict, 'UNKNOWN', 'jpPharmaOnly 데이터 없음 → JP-ING-01 규칙 미등록');
    TEST.eq(find(fs, 'JP-CLM-01').verdict, 'BLOCK', '"임산부" 표현 → JP-CLM-01 사용 불가');
    TEST.eq(find(fs, 'JP-SCH-01').deadline, '2027-02-23', 'JP-SCH-01 자료 제공 마감 2027-02-23 (신고 마감 2027-03-09 − 10영업일)');
    TEST.ok(/2027-03-09/.test(find(fs, 'JP-SCH-01').detail), 'JP-SCH-01 상세에 신고 마감 2027-03-09');
    TEST.ok(/공휴일 미반영/.test(find(fs, 'JP-SCH-01').detail), '공휴일 미입력 → "공휴일 미반영" 경고');
    TEST.eq(find(fs, 'JP-SCH-02').verdict, 'NOTED', '신규 성분 미체크 → JP-SCH-02 해당 없음');
    TEST.eq(find(fs, 'JP-MFG-01').verdict, 'ACTION', 'GMP 서류 없음 → JP-MFG-01 조치 필요');
    TEST.eq(find(fs, 'JP-LBL-01').verdict, 'REVIEW', 'FFC → 필수 표시 체크리스트 검토 필요');
    TEST.ok(fs.some(f => f.verdict === 'UNKNOWN' && /일본 광고 규제/.test(f.title)), '확인 안 된 일본 광고 규제 → 규칙 미등록 표시');

    const c2 = clone(c); c2.regulatory.newIngredient = true;
    const fs2 = E.evaluate(c2, product, [], 'JP', { buyer: B[0], today: TODAY });
    TEST.ok(/2026-12-15/.test(find(fs2, 'JP-SCH-02').detail), '신규 성분 체크 → JP-SCH-02 신고 마감 2026-12-15');
    TEST.eq(find(fs2, 'JP-SCH-01').verdict, 'NOTED', '신규 성분 체크 → JP-SCH-01 대신 JP-SCH-02 적용');

    product.formula[0].jpPharmaOnly = true;
    product.formula.slice(1).forEach(i => { i.jpPharmaOnly = false; });
    TEST.eq(find(E.evaluate(c, product, [], 'JP', { buyer: B[0], today: TODAY }), 'JP-ING-01').verdict, 'BLOCK', '의약품 전용 성분 표시 → JP-ING-01 사용 불가');
    commonChecks(fs, 'A');
  });

  TEST.suite('시나리오 B — 베트남 · 약국 체인 납품사 × 유산균 캡슐', function () {
    const product = clone(P.find(p => p.id === 'P-001'));
    const buyer = clone(B.find(b => b.id === 'B-002'));
    const docs = [
      { id: 'D-1', productId: 'P-001', type: 'TEST_REPORT', issuedAt: '2025-09-10', lab: { iso17025: true, mohDesignated: false }, legalization: 'none' },
      { id: 'D-2', productId: 'P-001', type: 'CFS', issuedAt: '2026-08-20', legalization: 'none' }
    ];
    const c = { id: 'T-B', country: 'VN', buyerId: 'B-002', productId: 'P-001', targetLaunchDate: '2027-04-01', stage: 'registration',
      regulatory: { claimInputs: {} },
      registration: { plannedSubmitDate: '2026-12-01', queries: [{ id: 'Q', receivedAt: '2026-12-10', answeredAt: null }] } };
    const fs = E.evaluate(c, product, docs, 'VN', { buyer, today: TODAY });
    TEST.eq(find(fs, 'VN-APP-01').verdict, 'BLOCK', 'localEntity = false → VN-APP-01 사용 불가');
    TEST.eq(DASH.services.buyers.capabilityGaps(buyer).length > 0, true, '바이어 카드 명의자 역량 부족');
    TEST.eq(find(fs, 'VN-DOC-TEST').verdict, 'ACTION', '성적서 2025-09-10, 제출 2026-12-01 → VN-DOC-TEST 조치 필요');
    TEST.eq(find(fs, 'VN-DOC-CFS').verdict, 'ACTION', "CFS legalization 'none' → VN-DOC-CFS 조치 필요");
    TEST.eq(find(fs, 'VN-SCH-02').deadline, '2026-12-21', '보완 요청 2026-12-10 → 회신 기한 2026-12-21');
    TEST.eq(find(fs, 'VN-ING-01').verdict, 'UNKNOWN', '미량영양소 기준 수치 없음 → VN-ING-01 규칙 미등록');
    TEST.ok(fs.some(f => f.area === 'manufacturing' && f.verdict === 'UNKNOWN'), '제조 영역 규칙 없음 → UNKNOWN 추가');
    TEST.ok(fs.filter(f => f.ruleId).every(f => f.needsVerification), '베트남 규칙은 전부 원문 확인 필요');

    const dl = E.deadlinesFor(c, product, docs, TODAY);
    TEST.ok(dl.some(d => d.key === 'test-expiry' && d.flagged && /재시험/.test(d.label)), '마감 목록에 "재시험" 항목');

    TEST.eq(find(fs, 'VN-CHG-01').verdict, 'NOTED', '처방 변경 전 → VN-CHG-01 해당 없음');
    const c2 = clone(c); c2.formulaChangedAfterReg = { at: TODAY, note: '원료 변경' };
    TEST.eq(find(E.evaluate(c2, product, docs, 'VN', { buyer, today: TODAY }), 'VN-CHG-01').verdict, 'ACTION', '등록 단계 이후 처방 변경 → 새 등록 필요 경고');

    const c3 = clone(c); c3.regulatory.claimInputs = { vnRegistered: 'Hỗ trợ tiêu hóa.', vnLabel: 'Hỗ trợ tiêu hóa. Sản phẩm này không phải là thuốc và không có tác dụng thay thế thuốc chữa bệnh.', vnAd: 'Hỗ trợ tiêu hóa.' };
    const lbl = find(E.evaluate(c3, product, docs, 'VN', { buyer, today: TODAY }), 'VN-LBL-01');
    TEST.ok(!/의약품처럼/.test(lbl.detail), "필수 문구 자체는 '약' 표현으로 잡지 않음");
    commonChecks(fs, 'B');
  });

  TEST.suite('시나리오 C — 미국 · 브랜드사 × 개별인정형 원료 포함', function () {
    const product = clone(P.find(p => p.id === 'P-003'));
    const buyer = clone(B.find(b => b.id === 'B-003'));
    const base = { id: 'T-C', country: 'US', buyerId: 'B-003', productId: 'P-003', targetLaunchDate: '2027-03-01', registration: {} };

    let c = Object.assign(clone(base), { regulatory: { claimInputs: {} } });
    let fs = E.evaluate(c, product, [], 'US', { buyer, today: TODAY });
    TEST.eq(find(fs, 'US-NDI-02').verdict, 'REVIEW', 'koreaIndividual 원료 → US-NDI-02 검토 필요');
    TEST.eq(find(fs, 'US-NDI-03').verdict, 'REVIEW', 'US-NDI-03 안내');
    TEST.eq(find(fs, 'US-NDI-01').verdict, 'NOTED', 'NDI 미체크 → US-NDI-01 해당 없음');

    c = Object.assign(clone(base), { regulatory: { ndiConfirmed: true, claimInputs: { main: 'Prevents joint disease' } } });
    fs = E.evaluate(c, product, [], 'US', { buyer, today: TODAY });
    TEST.eq(find(fs, 'US-NDI-01').verdict, 'ACTION', 'NDI 체크 → US-NDI-01 조치 필요');
    TEST.eq(find(fs, 'US-NDI-01').deadline, '2026-12-16', 'NDI 통지 마감 2026-12-16 (출시 75일 전)');
    TEST.eq(find(fs, 'US-CLM-01').verdict, 'BLOCK', '"Prevents joint disease" → US-CLM-01 사용 불가');

    c = Object.assign(clone(base), { regulatory: { claimInputs: { main: 'Supports joint comfort' } } });
    fs = E.evaluate(c, product, [], 'US', { buyer, today: TODAY });
    TEST.eq(find(fs, 'US-CLM-01').verdict, 'NOTED', '"Supports joint comfort" → 질병 표현 없음');
    TEST.eq(find(fs, 'US-CLM-02').verdict, 'ACTION', '면책 문구 없음 → US-CLM-02 조치 필요');
    TEST.ok(/not been evaluated by the Food and Drug Administration/.test(find(fs, 'US-CLM-02').suggestion), '면책 문구 삽입 제안');
    TEST.eq(find(fs, 'US-CLM-03').deadline, '2027-03-31', '문구 통지 마감 2027-03-31 (출시 + 30일)');
    TEST.eq(find(fs, 'US-FAC-01').verdict, 'ACTION', 'FDA 시설 등록 서류 없음 → US-FAC-01 조치 필요');
    TEST.ok(fs.some(f => f.area === 'post_market' && f.verdict === 'UNKNOWN'), '판매 후 의무 영역 규칙 없음 → UNKNOWN 추가');

    c.regulatory.claimInputs.main += '*\n\n*' + window.DASH_DATA.rules.US.disclaimer;
    TEST.eq(find(E.evaluate(c, product, [], 'US', { buyer, today: TODAY }), 'US-CLM-02').verdict, 'NOTED', '면책 문구를 넣으면 US-CLM-02 규칙 확인됨');

    const dl = E.deadlinesFor(Object.assign(clone(base), { regulatory: { ndiConfirmed: true } }), product, [], TODAY);
    TEST.ok(dl.some(d => d.key === 'ndi' && d.date === '2026-12-16'), '마감 목록에 NDI 통지 마감');
    TEST.ok(dl.some(d => d.key === 'claim' && d.date === '2027-03-31'), '마감 목록에 문구 통지 마감');
    commonChecks(fs, 'C');
  });
})();
