// calendar.js
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW    = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]; // неделя с понедельника
const pad2   = (n) => String(n).padStart(2,"0");
const iso    = (y,m,d) => `${y}-${pad2(m+1)}-${pad2(d)}`;

// 🔹 форматтер даты (аналог Date.render(..., { variant:'short_no_year' }))
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDateShortNoYear(dt) {
  // "22 Sep, 18:45"
  const dd  = String(dt.getDate()).padStart(2,"0");
  const mon = MONTHS_SHORT[dt.getMonth()];
  const hh  = String(dt.getHours()).padStart(2,"0");
  const mm  = String(dt.getMinutes()).padStart(2,"0");
  return `${dd} ${mon}, ${hh}:${mm}`;
}

function initCalendar(root){
  const grid        = root.querySelector('[data-el="grid"]');
  const monthEl     = root.querySelector('[data-el="month"]');
  const yearEl      = root.querySelector('[data-el="year"]');
  const matchesWrap = root.querySelector('[data-el="matches"]');
  const matchesDate = root.querySelector('[data-el="matches-date"]');

  // данные матчей из атрибута
  let matchesByDate = {};
  try { matchesByDate = JSON.parse(root.dataset.matches || "{}"); } catch(e){ matchesByDate = {}; }

  // состояние
  const today = new Date(); today.setHours(0,0,0,0);
  let view = new Date(today.getFullYear(), today.getMonth(), 1);
  let selected = new Date(today);

  // навигация
  const prevBtn = root.querySelector("[data-prev-month]");
  const nextBtn = root.querySelector("[data-next-month]");
  if (prevBtn) prevBtn.addEventListener("click", () => { view = new Date(view.getFullYear(), view.getMonth()-1, 1); render(); });
  if (nextBtn) nextBtn.addEventListener("click", () => { view = new Date(view.getFullYear(), view.getMonth()+1, 1); render(); });

  // стартовый рендер
  render();

  function render(){
    renderTitle();
    renderGrid();
    renderMatches();
  }

  function renderTitle(){
    monthEl.textContent = MONTHS[view.getMonth()];
    yearEl.textContent  = view.getFullYear();
  }

  function renderGrid(){
    grid.innerHTML = "";

    // строка дней недели
    const dow = document.createElement("div");
    dow.className = "calendar__dow";
    DOW.forEach(d => {
      const s = document.createElement("span");
      s.textContent = d;
      dow.appendChild(s);
    });
    grid.appendChild(dow);

    const y = view.getFullYear();
    const m = view.getMonth();
    const first = new Date(y, m, 1);
    const daysInMonth = new Date(y, m+1, 0).getDate();

    // индекс старта (Mon=0)
    const startIndex = (first.getDay() + 6) % 7;

    // хвост прошлого месяца
    const prevMonthDays = new Date(y, m, 0).getDate();
    for (let i = 0; i < startIndex; i++) {
      const d = prevMonthDays - startIndex + 1 + i;
      grid.appendChild(dayCell(new Date(y, m-1, d), true));
    }

    // текущий месяц
    for (let d = 1; d <= daysInMonth; d++) {
      grid.appendChild(dayCell(new Date(y, m, d), false));
    }

    // хвост следующего месяца
    const totalCells = startIndex + daysInMonth;
    const tail = (7 - (totalCells % 7)) % 7;
    for (let d = 1; d <= tail; d++) {
      grid.appendChild(dayCell(new Date(y, m+1, d), true));
    }
  }

  function dayCell(dateObj, muted){
    const y = dateObj.getFullYear();
    const m = dateObj.getMonth();
    const d = dateObj.getDate();
    const key = iso(y,m,d);

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "calendar__cell" + (muted ? " calendar__cell--muted" : "");
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-selected", String(isSameDay(dateObj, selected)));
    cell.dataset.date = key;

    if (isSameDay(dateObj, today)) cell.classList.add("calendar__today");

    const num = document.createElement("div");
    num.className = "calendar__daynum";
    num.textContent = d;
    cell.appendChild(num);

    // бейдж: количество матчей в день
    const n = matchesByDate[key]?.length || 0;
    if (n) {
      const badge = document.createElement("div");
      badge.className = "calendar__badge";
      badge.textContent = n; // можно оставить пустым кружком, если так задумано
      cell.appendChild(badge);
    }

    cell.addEventListener("click", () => {
      selected = new Date(y, m, d);
      if (muted) {
        view = new Date(y, m, 1);
        render();
      } else {
        grid.querySelectorAll('.calendar__cell[aria-selected="true"]').forEach(el => el.setAttribute("aria-selected","false"));
        cell.setAttribute("aria-selected","true");
        renderMatches();
      }
    });

    return cell;
  }

  function isSameDay(a,b){
    return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
  }

  function renderMatches(){
    const k = iso(selected.getFullYear(), selected.getMonth(), selected.getDate());
    if (matchesDate) matchesDate.textContent = k;
    const data = matchesByDate[k] || [];
    matchesWrap.innerHTML = "";

    if (!data.length){
      matchesWrap.innerHTML = `<p class="muted">No matches scheduled.</p>`;
      return;
    }

    // заполняем готовый <template id="tpl-card-match">
    const tpl = document.getElementById("tpl-card-match");
    if (!tpl) {
      console.warn("[calendar] Missing #tpl-card-match");
      return;
    }

    data.forEach(m => {
      const node = tpl.content.cloneNode(true);

      // home
      node.querySelector('[data-el="home-link"]').href         = m.home.href;
      node.querySelector('[data-el="home-logo"]').src          = m.home.logo;
      node.querySelector('[data-el="home-logo"]').alt          = m.home.name;
      node.querySelector('[data-el="home-name"]').textContent  = m.home.name;
      node.querySelector('[data-el="score-home"]').textContent = m.score_home ?? "—";

      // away
      node.querySelector('[data-el="away-link"]').href         = m.away.href;
      node.querySelector('[data-el="away-logo"]').src          = m.away.logo;
      node.querySelector('[data-el="away-logo"]').alt          = m.away.name;
      node.querySelector('[data-el="away-name"]').textContent  = m.away.name;
      node.querySelector('[data-el="score-away"]').textContent = m.score_away ?? "—";

      // meta
      const d = m.date_value ? new Date(m.date_value) : null;
      node.querySelector('[data-el="date"]').textContent       = d ? fmtDateShortNoYear(d) : "";
      node.querySelector('[data-el="status"]').textContent     = m.status || "Scheduled";

      const leagueA = node.querySelector('[data-el="league-link"]');
      if (m.league) { leagueA.href = m.league.href; leagueA.textContent = m.league.name; } else { leagueA.removeAttribute("href"); leagueA.textContent = ""; }

      // optional button
      const btn = node.querySelector('[data-el="button"]');
      if (m.button && m.button.url && m.button.label) {
        btn.href = m.button.url;
        btn.textContent = m.button.label;
        btn.hidden = false;
      } else {
        btn.hidden = true;
      }

      matchesWrap.appendChild(node);
    });
  }
}

function bootAllCalendars() {
  document.querySelectorAll('[data-calendar]').forEach(initCalendar);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootAllCalendars, { once: true });
} else {
  bootAllCalendars();
}

export default bootAllCalendars;
