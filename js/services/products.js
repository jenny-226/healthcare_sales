// 제품·처방 데이터 접근
(function () {
  const DASH = window.DASH;
  const store = DASH.store;
  DASH.services = DASH.services || {};

  function list() { return store.get('products', []); }
  function get(id) { return list().find(p => p.id === id) || null; }
  function save(p) {
    const all = list();
    if (!p.id) {
      let max = 0;
      all.forEach(x => { const n = parseInt(String(x.id).replace('P-', ''), 10); if (n > max) max = n; });
      p.id = 'P-' + String(max + 1).padStart(3, '0');
    }
    const i = all.findIndex(x => x.id === p.id);
    if (i >= 0) all[i] = p; else all.push(p);
    store.set('products', all);
    return p;
  }
  function remove(id) { store.set('products', list().filter(p => p.id !== id)); }

  function newIngredientId(extra) {
    let max = 0;
    const scan = i => {
      const n = parseInt(String(i.ingredientId).replace('ING-', ''), 10);
      if (n > max) max = n;
    };
    list().forEach(p => (p.formula || []).forEach(scan));
    (extra || []).forEach(scan);
    return 'ING-' + String(max + 1).padStart(3, '0');
  }

  // 1일 섭취량 = 1회 함량 × 1일 횟수 (README 7-2 ③)
  function dailyIntake(product) {
    const spd = Number(product.servingsPerDay) || 1;
    return (product.formula || []).map(i => ({
      ingredientId: i.ingredientId,
      name: ingredientName(i),
      amountPerServing: Number(i.amountPerServing) || 0,
      unit: i.unit || '',
      servingsPerDay: spd,
      daily: Math.round((Number(i.amountPerServing) || 0) * spd * 1000) / 1000
    }));
  }

  function ingredientName(i) {
    if (i.nameKo && i.nameEn) return `${i.nameKo} (${i.nameEn})`;
    return i.nameKo || i.nameEn || i.ingredientId;
  }

  DASH.services.products = { list, get, save, remove, newIngredientId, dailyIntake, ingredientName };
})();
