// za-safe-patch.js  — 모듈 실패/지연 시 세이프모드로 지도라도 띄워준다.


// za-safe-patch.js
(() => {
  // 초반 자동 모달 뜨는 현상 방지 + 제스처 없으면 차단
  let userGesture = false;
  const START = performance.now();
  const GATE_MS = 2000;

  // 사용자 제스처 감지
  ['pointerdown', 'touchstart', 'keydown'].forEach(evt => {
    window.addEventListener(evt, () => { userGesture = true; }, { capture: true });
  });

  // 모달 선택자 (필요시 수정: id/class 다 훑음)
  const pickModal = () =>
    document.querySelector('#placeModal, .place-modal, [data-modal="place"], .modal.place');

  function guardModal() {
    const modal = pickModal();
    if (!modal) return;

    const tooEarly = (performance.now() - START) < GATE_MS;
    const opened = getComputedStyle(modal).display !== 'none' && !modal.hasAttribute('hidden');

    // 초기 로드 직후 or 제스처 없이 열리면 닫아버림
    if (opened && (tooEarly || !userGesture)) {
      modal.style.display = 'none';
      modal.setAttribute('hidden', '');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  // 모달 열림 감시 (class/style/attr 변경 감지)
  window.addEventListener('DOMContentLoaded', () => {
    const modal = pickModal();
    if (modal) {
      new MutationObserver(guardModal)
        .observe(modal, { attributes: true, attributeFilter: ['style', 'class', 'open', 'hidden', 'aria-hidden'] });
    }
    // 초기 2초간 주기적으로 한 번 더 감시
    const t = setInterval(() => {
      guardModal();
      if (performance.now() - START > GATE_MS) clearInterval(t);
    }, 120);
  });

  // 전역 열기 함수가 있으면(예: openPlaceModal/showPlaceModal) 가드 래핑
  ['openPlaceModal', 'showPlaceModal'].forEach(name => {
    const fn = window[name];
    if (typeof fn === 'function') {
      window[name] = function (...args) {
        if ((performance.now() - START) < GATE_MS || !userGesture) return; // 차단
        return fn.apply(this, args);
      };
    }
  });
})();

// 외부: 앱 준비 전엔 그냥 대기(폴백) — mode 변수 절대 만들지 말 것
if (!window.setMode) window.setmode = ()=>{};
(function () {
  // 1) 전역 에러 캐처: 어디서 터졌는지 즉시 화면에 띄워줌
  const showError = (msg) => {
    try {
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;inset:0;z-index:4000;background:#112; color:#e6f1ff; ' +
                          'padding:16px; font:14px/1.45 system-ui, sans-serif; overflow:auto';
      box.innerHTML =
        '<h3 style="margin:0 0 8px 0">⚠️ 자바스크립트 오류로 안전모드 진입</h3>' +
        '<pre style="white-space:pre-wrap">' + (msg || 'Unknown error') + '</pre>' +
        '<div style="opacity:.8;margin-top:6px">* 이 화면은 임시 안전모드 알림입니다. 모듈 오류를 고치면 사라집니다.</div>';
      document.body.appendChild(box);
    } catch {}
  };
  window.__ZA_SAFE_ERR = (e) => showError((e && (e.stack || e.message)) || String(e));

  // 2) 모듈이 정상 부팅됐는지 감시
  let gaveFallback = false;
  function bootFallback() {
    if (gaveFallback) return;
    gaveFallback = true;

    // Leaflet 없는 환경이면 안내만
    if (!window.L) {
      showError('Leaflet이 로드되지 않았습니다. (네트워크/차단 확인)\n' +
                '→ unpkg CDN 차단, 보안DNS/광고차단 해제, 또는 오프라인 가능성 점검');
      return;
    }

    // 기본 지도라도 띄워서 '하얀 화면'을 없앤다
    try {
      const mapEl = document.getElementById('map') || (function () {
        const el = document.createElement('div'); el.id = 'map';
        el.style.cssText = 'position:fixed;inset:0;background:#e9eaec'; document.body.appendChild(el);
        return el;
      })();

      const IMG_URL = "za_world_map_clean_fixed.png";
      const IMG_W = 2048, IMG_H = 2048;

      const map = L.map(mapEl, { crs: L.CRS.Simple, minZoom: -2, maxZoom: 4, zoomControl: false });
      const bounds = [[0, 0], [IMG_H, IMG_W]];
      L.imageOverlay(IMG_URL, bounds).addTo(map);
      map.fitBounds(bounds);

      // 상단에 조그맣게 안전모드 뱃지
      const badge = document.createElement('div');
      badge.style.cssText = 'position:fixed;right:10px;top:10px;z-index:4100;background:#0b3a70;' +
                            'color:#e6f1ff;padding:6px 10px;border-radius:999px;font:12px/1 system-ui';
      badge.textContent = 'SAFE MODE (모듈 미부팅)';
      document.body.appendChild(badge);
    } catch (e) {
      showError('Fallback도 실패: ' + (e && (e.stack || e.message) || e));
    }
  }

  // 3) 모듈 부팅 감시 타임아웃
  //    - 1.2초 내에 window.__ZA_APP_BOOTED__ 가 안 올라오면 안전모드
  //    - 3초 내에도 안 올라오면 강제 안전모드
  setTimeout(() => { if (!window.__ZA_APP_BOOTED__) bootFallback(); }, 1200);
  setTimeout(() => { if (!window.__ZA_APP_BOOTED__) bootFallback(); }, 3000);

  // 4) 전역 에러/언핸들드 리젝션 캐치
  window.addEventListener('error', (e) => { if (!window.__ZA_APP_BOOTED__) window.__ZA_SAFE_ERR(e.error || e.message); }, true);
  window.addEventListener('unhandledrejection', (e) => { if (!window.__ZA_APP_BOOTED__) window.__ZA_SAFE_ERR(e.reason); }, true);
})();


  // ... initializeApp(...) 등 Firebase 설정이 끝난 직후에:
  window.firebaseOk = true;
  document.dispatchEvent(new Event('firebase-ready'));
