export default function initHeaderLeague() {
  document.querySelectorAll('[data-module="header-league"]').forEach((root) => {
    if (root.__league_inited) return;
    root.__league_inited = true;

    const burger   = root.querySelector('.header-league__burger');
    const offc     = root.querySelector('.header-league__offcanvas');
    const overlay  = root.querySelector('.header-league__overlay');
    const closeBtn = root.querySelector('.header-league__close');
    const focusableSelectors =
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

    let lastFocused = null;

    const open = () => {
      lastFocused = document.activeElement;
      root.classList.add('is-open');
      overlay.hidden = false;
      offc.setAttribute('aria-hidden', 'false');
      burger.setAttribute('aria-expanded', 'true');

      // trap focus (простая версия)
      const first = offc.querySelector(focusableSelectors);
      offc.removeAttribute('tabindex');
      (first || offc).focus();
      document.addEventListener('keydown', onKeydown);
      document.addEventListener('click', onDocClick);
    };

    const close = () => {
      root.classList.remove('is-open');
      overlay.hidden = true;
      offc.setAttribute('aria-hidden', 'true');
      offc.setAttribute('tabindex', '-1');
      burger.setAttribute('aria-expanded', 'false');
      document.removeEventListener('keydown', onKeydown);
      document.removeEventListener('click', onDocClick);
      (lastFocused || burger).focus();
    };

    const onKeydown = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab' && root.classList.contains('is-open')) {
        // простая ловушка таба
        const focusables = offc.querySelectorAll(focusableSelectors);
        if (!focusables.length) return;
        const first = focusables[0];
        const last  = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          last.focus(); e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus(); e.preventDefault();
        }
      }
    };

    const onDocClick = (e) => {
      if (!root.classList.contains('is-open')) return;
      const withinOff = offc.contains(e.target);
      const onBurger  = burger.contains(e.target);
      if (!withinOff && !onBurger) close();
    };

    // list item click closes
    offc.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (link) close();
    });

    burger.addEventListener('click', () => {
      root.classList.contains('is-open') ? close() : open();
    });
    overlay.addEventListener('click', close);
    closeBtn?.addEventListener('click', close);
  });
}
