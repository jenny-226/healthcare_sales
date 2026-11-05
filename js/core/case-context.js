// 현재 선택된 건 관리. 건이 바뀌거나 저장되면 document에 'case:changed' 이벤트를 보낸다.
(function () {
  const DASH = window.DASH;
  const KEY = 'ui:currentCase';

  function currentId() { return DASH.store.get(KEY, null); }

  function get() {
    const id = currentId();
    return id ? DASH.services.cases.get(id) : null;
  }

  function emit(reason) {
    document.dispatchEvent(new CustomEvent('case:changed', { detail: { id: currentId(), reason: reason || 'save' } }));
  }

  function select(id) {
    DASH.store.set(KEY, id);
    emit('select');
  }

  function clear() {
    DASH.store.remove(KEY);
    emit('select');
  }

  // opts.silent: 저장만 하고 다시 그리지 않음 (입력 중인 텍스트 칸 등)
  function save(c, opts) {
    DASH.services.cases.save(c);
    if (!(opts && opts.silent)) emit('save');
    return c;
  }

  // 제품·서류·바이어처럼 건 밖의 데이터가 바뀌었을 때 화면 갱신용
  function notify() { emit('data'); }

  DASH.caseContext = { currentId, get, select, clear, save, notify };
})();
