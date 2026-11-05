// localStorage 래퍼. 모든 키는 'hsd:' 접두사. 탭 파일은 이 파일을 직접 쓰지 않고 services/*를 쓴다.
// localStorage를 쓸 수 없는 환경(사생활 보호 모드 등)에서는 메모리에만 보관한다.
(function () {
  const DASH = window.DASH = window.DASH || {};
  const P = 'hsd:';
  const memory = {};
  let persistent = true;

  try {
    localStorage.setItem(P + '__test', '1');
    localStorage.removeItem(P + '__test');
  } catch (e) {
    persistent = false;
  }

  function rawGet(k) { return persistent ? localStorage.getItem(P + k) : (k in memory ? memory[k] : null); }
  function rawSet(k, v) { if (persistent) localStorage.setItem(P + k, v); else memory[k] = v; }
  function rawRemove(k) { if (persistent) localStorage.removeItem(P + k); else delete memory[k]; }

  function get(key, fallback) {
    try {
      const raw = rawGet(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function set(key, value) {
    try {
      rawSet(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('[store] 저장 실패', key, e);
      return false;
    }
  }

  function remove(key) { try { rawRemove(key); } catch (e) { /* 무시 */ } }

  function keys() {
    if (!persistent) return Object.keys(memory);
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(P)) out.push(k.slice(P.length));
    }
    return out;
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // 첫 실행 시 예시 데이터 불러오기 (README 2-3)
  function seedIfNeeded() {
    if (get('meta:seeded', false)) return false;
    const d = window.DASH_DATA || {};
    set('products', clone(d.sampleProducts || []));
    set('buyers', clone(d.sampleBuyers || []));
    set('cases', clone(d.sampleCases || []));
    set('docs', clone(d.sampleDocs || []));
    set('meta:seeded', true);
    return true;
  }

  function exportAll() {
    const out = {};
    keys().forEach(k => { out[k] = get(k, null); });
    return { app: 'health-supplement-dashboard', exportedAt: new Date().toISOString(), data: out };
  }

  function importAll(payload) {
    if (!payload || typeof payload.data !== 'object') throw new Error('대시보드에서 내보낸 JSON 파일이 아닙니다.');
    keys().forEach(remove);
    Object.keys(payload.data).forEach(k => set(k, payload.data[k]));
    set('meta:seeded', true);
  }

  function clearAll() { keys().forEach(remove); }

  DASH.store = { get, set, remove, keys, clone, seedIfNeeded, exportAll, importAll, clearAll, isPersistent: () => persistent };
})();
