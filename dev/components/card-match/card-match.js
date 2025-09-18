export default function initCardMatchCountdown() {
  const fmt = (ms) => {
    if (ms <= 0) return 'Starts soon';
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return d > 0 ? `${d}d ${h}h ${m}m` : `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${ss.toString().padStart(2,'0')}`;
  };

  const nodes = document.querySelectorAll('[data-countdown-ts]');
  if (!nodes.length) return;

  const tick = () => {
    const now = Date.now();
    nodes.forEach((el) => {
      const ts = Number(el.getAttribute('data-countdown-ts')) * 1000;
      el.textContent = fmt(ts - now);
    });
  };

  tick();
  const id = setInterval(tick, 1000);
  // останавливаем, если ушли со страницы (по желанию можно доработать)
  window.addEventListener('pagehide', () => clearInterval(id));
}
