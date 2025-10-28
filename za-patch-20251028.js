// za-patch-20251028.js
// ZA MAPS 런타임 안전패치 (2025-10-28)
// - 누락된 함수로 인한 ReferenceError 방지
// - 메인 스크립트 초기화 실패 시 임시 지도 표시
// - 에러 오버레이로 오류 메시지 가시화

(() => {
  const g = globalThis;
  const noop = () => {};

  // 1) 누락 가능 함수들 안전 스텁
  if (typeof g.wireAdminMessenger !== 'function') g.wireAdminMessenger = noop;
  if (typeof g.tryOpenDeepLink   !== 'function') g.tryOpenDeepLink   = noop;
  if (typeof g.matchText         !== 'function') g.matchText         = () => true;
  if (typeof g.confirmedCountForCat !== 'function') g.confirmedCountForCat = () => 0;
  if (typeof g.openInfoWithSeq   !== 'function') {
    g.openInfoWithSeq = (m) => {
      try {
        const info = document.getElementById('info');
        const t = document.getElementById('infoTitle');
        const id = document.getElementById('infoId');
        if (t) t.textContent = (m && (m.title || m.name)) || '(제목)';
        if (id) id.textContent = '#-';
        if (info) info.style.display = 'block';
      } catch {}
    };
  }

  // 2) CSS.escape 폴리필(혹시 없을 때)
  if (!g.CSS) g.CSS = {};
  if (!g.CSS.escape) {
    g.CSS.escape = (s) => String(s).replace(/["'\\\s]/g, (m) => '\\' + m);
  }

  // 3) 에러 오버레이 (디버깅 도우미)
  function showOverlay(title, detail) {
    if (document.getElementById('za-error-overlay')) return;
    const el = document.createElement('div');
    el.id = 'za-error-overlay';
    el.style.cssText =
      'position:fixed;inset:0;z-index:5000;background:#0b0f;backdrop-filter:blur(3px);color:#fff;padding:16px;font:13px/1.5 system-ui,Segoe UI,Apple SD Gothic Neo,Malgun Gothic';
    el.innerHTML = `
      <div style="max-width:880px;margin:20px auto;background:#111a;border:1px solid #333;border-radius:12px;padding:16px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <strong>ZA MAPS 런타임 패치</strong>
          <button id="za-err-x" style="background:#2a2a2a;border:0;color:#fff;padding:4px 8px;border-radius:8px">닫기</button>
        </div>
        <div style="margin-top:8px;white-space:pre-wrap">${title}\n${detail || ''}</div>
      </div>`;
    document.body.appendChild(el);
    document.getElementById('za-err-x').onclick = () => el.remove();
  }

  // 전역 에러 표시
  window.addEventListener('error', (e) => {
    try {
      const msg = (e?.error?.stack || e?.message || '').toString();
      showOverlay('스크립트 오류가 감지되었습니다.', msg);
    } catch {}
  });

  // 4) 메인 초기화 실패 시 임시 지도 표시 (Leaflet 이미 로드되어 있다는 가정)
  function initFallback() {
    try {
      const mapEl = document.getElementById('map');
      if (!mapEl) return;
      const hasLeaflet = !!window.L;
      const hasMap = !!document.querySelector('#map .leaflet-container');
      if (!hasLeaflet || hasMap) return;

      // 간단한 이미지 오버레이 맵(읽기 전용)
      const map = L.map('map', { crs: L.CRS.Simple, minZoom: -2, maxZoom: 4, zoomControl: false });
      const IMG_URL = 'za_world_map_clean_fixed.png';
      const W = 2048, H = 2048;
      const bounds = [[0, 0], [H, W]];
      L.imageOverlay(IMG_URL, bounds).addTo(map);
      map.fitBounds(bounds);

      showOverlay(
        '메인 스크립트가 일부 실패하여 임시 지도를 표시합니다.',
        '핵심 기능은 축소된 상태로 동작합니다. 메인 스크립트를 복구하면 이 메시지는 사라집니다.'
      );
    } catch {}
  }

  // 메인 모듈이 먼저/나중에 로드돼도 안전하게 1.6초 뒤 체크
  setTimeout(initFallback, 1600);
})();