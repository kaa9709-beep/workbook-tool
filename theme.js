// Screen mode (자동 / 밝게 / 어둡게) and the side menu's groups and icons, shared by every page.
// Loaded in <head>, so the page is drawn in the right mode from the start.
(function () {
  const KEY = 'screen-mode', root = document.documentElement, system = matchMedia('(prefers-color-scheme: dark)');
  const saved = () => { try { return localStorage.getItem(KEY) || 'auto'; } catch (e) { return 'auto'; } };
  const apply = () => { const m = saved(); root.dataset.theme = m === 'auto' ? (system.matches ? 'dark' : 'light') : m; };
  apply();
  system.addEventListener('change', apply);

  const svg = d => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICONS = {
    'index.html': svg('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
    '어휘.html': svg('<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5"/>'),
    '어법.html': svg('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12.5l2.5 2.5 5-6"/>'),
    '영작.html': svg('<path d="M15 4l5 5L9 20H4v-5z"/><path d="M13 6l5 5"/>'),
    '씨드.html': svg('<path d="M12 20v-8"/><path d="M12 12c0-4 3-7 7-7 0 4-3 7-7 7z"/><path d="M12 14c0-3-2-5-6-5 0 3 2 5 6 5z"/>'),
    '수업.html': svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
    '자료.html': svg('<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>'),
    '문제집.html': svg('<path d="M5 4h11l3 3v13H5z"/><path d="M9 10h6M9 14h6M9 18h3"/>'),
  };
  const MOON = svg('<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>');

  document.addEventListener('DOMContentLoaded', () => {
    const nav = document.querySelector('.topnav');
    if (!nav) return;
    nav.querySelectorAll('a').forEach(a => { const icon = ICONS[a.getAttribute('href')]; if (icon) a.insertAdjacentHTML('afterbegin', icon); });
    const group = (href, name) => { const a = nav.querySelector(`a[href="${href}"]`); if (a) a.insertAdjacentHTML('beforebegin', `<span class="group">${name}</span>`); };
    group('어휘.html', '워크북');
    group('씨드.html', '수업 자료');
    group('문제집.html', '문제집');
    const brand = nav.querySelector('.brand');
    (brand || nav.firstChild).insertAdjacentHTML(brand ? 'afterend' : 'beforebegin',
      `<label class="screen-mode">${MOON}<span>화면 모드</span><select aria-label="화면 모드">
        <option value="auto">자동</option><option value="light">밝게</option><option value="dark">어둡게</option></select></label>`);
    const select = nav.querySelector('.screen-mode select');
    select.value = saved();
    select.addEventListener('change', () => { try { localStorage.setItem(KEY, select.value); } catch (e) {} apply(); });
  });
})();
