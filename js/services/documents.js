// 서류 데이터 접근. productId가 null이면 회사(공장) 공통 서류 → 모든 제품에 적용
(function () {
  const DASH = window.DASH;
  const store = DASH.store;
  DASH.services = DASH.services || {};

  const TYPES = {
    TEST_REPORT: '시험성적서',
    CFS: '자유판매증명서 (CFS)',
    GMP: 'GMP 증명서',
    EFFICACY: '효능 근거 자료',
    LOA: '제조사 위임장 (LoA)',
    LABEL: '라벨 시안',
    FDA_FACILITY: 'FDA 식품시설 등록',
    CGMP: 'cGMP 준수 자료',
    NDI_NOTICE: 'NDI 통지 자료',
    FFC_EVIDENCE: 'FFC 근거 자료'
  };
  const LEGALIZATION = { none: '없음', apostille: '아포스티유', embassy: '대사관 합법화' };

  function list() { return store.get('docs', []); }
  function get(id) { return list().find(d => d.id === id) || null; }
  function forProduct(productId) { return list().filter(d => !d.productId || d.productId === productId); }
  function save(d) {
    const all = list();
    if (!d.id) {
      let max = 0;
      all.forEach(x => { const n = parseInt(String(x.id).replace('D-', ''), 10); if (n > max) max = n; });
      d.id = 'D-' + String(max + 1).padStart(3, '0');
    }
    const i = all.findIndex(x => x.id === d.id);
    if (i >= 0) all[i] = d; else all.push(d);
    store.set('docs', all);
    return d;
  }
  function remove(id) { store.set('docs', list().filter(d => d.id !== id)); }

  DASH.services.documents = { TYPES, LEGALIZATION, list, get, forProduct, save, remove };
})();
