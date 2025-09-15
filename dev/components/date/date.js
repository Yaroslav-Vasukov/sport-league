  (function () {
    const fmt = new Intl.RelativeTimeFormat(document.documentElement.lang || 'ru', { numeric: 'auto' });
    const units = [
      ['second', 1],
      ['minute', 60],
      ['hour', 3600],
      ['day', 86400],
      ['week', 604800],
      ['month', 2592000],
      ['year', 31536000],
    ];
    function diffToBestUnit(seconds) {
      for (let i = units.length - 1; i >= 0; i--) {
        const [u, s] = units[i];
        if (Math.abs(seconds) >= s || i === 0) {
          return [u, Math.round(seconds / s)];
        }
      }
    }
    function tick() {
      document.querySelectorAll('time[data-timeago]').forEach(el => {
        const ts = Date.parse(el.getAttribute('data-timeago'));
        if (!isNaN(ts)) {
          const seconds = Math.round((ts - Date.now()) / 1000); // отрицательное = в прошлом
          const [unit, value] = diffToBestUnit(seconds);
          el.querySelector('.ui-date__text')?.replaceChildren(document.createTextNode(fmt.format(value, unit)));
        }
      });
    }
    tick();
    setInterval(tick, 30_000); 
  })();

