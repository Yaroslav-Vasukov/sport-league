const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]; // неделя с понедельника
const pad2 = (n) => String(n).padStart(2,"0");
const iso = (y,m,d) => `${y}-${pad2(m+1)}-${pad2(d)}`;

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

  // события навигации
  root.querySelector("[data-prev-month]").addEventListener("click", () => {
    view = new Date(view.getFullYear(), view.getMonth()-1, 1);
    render();
  });
  root.querySelector("[data-next-month]").addEventListener("click", () => {
    view = new Date(view.getFullYear(), view.getMonth()+1, 1);
    render();
  });

  // рендер
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

    // индекс старта (понедельник = 0)
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

    // бейдж: есть матчи
    const n = matchesByDate[key]?.length || 0;
    if (n) {
      const badge = document.createElement("div");
      badge.className = "calendar__badge";
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
    matchesDate.textContent = k;
    const data = matchesByDate[k] || [];
    matchesWrap.innerHTML = ""; // очищаем

    if (!data.length){
      matchesWrap.innerHTML = `<p class="muted">No matches scheduled.</p>`;
      return;
    }

    // рендер любой компонент через <template>
    const tpl = document.getElementById("tpl-card-match");
    data.forEach(m => {
      const node = tpl.content.cloneNode(true);
      // заполняем поля
      node.querySelector('[data-el="home-link"]').href = m.home.href;
      node.querySelector('[data-el="home-logo"]').src  = m.home.logo;
      node.querySelector('[data-el="home-logo"]').alt  = m.home.name;
      node.querySelector('[data-el="home-name"]').textContent = m.home.name;

      node.querySelector('[data-el="away-link"]').href = m.away.href;
      node.querySelector('[data-el="away-logo"]').src  = m.away.logo;
      node.querySelector('[data-el="away-logo"]').alt  = m.away.name;
      node.querySelector('[data-el="away-name"]').textContent = m.away.name;

      node.querySelector('[data-el="time"]').textContent = m.time;
      const leagueLink = node.querySelector('[data-el="league-link"]');
      leagueLink.href = m.league.href; leagueLink.textContent = m.league.name;

      node.querySelector('[data-el="match-link"]').href = m.href;

      matchesWrap.appendChild(node);
    });
  }
}

function bootAllCalendars() {
  document.querySelectorAll('[data-calendar]').forEach(initCalendar);
}

// Запускаем в любом случае — и при обычном подключении, и при ленивом import()
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootAllCalendars, { once: true });
} else {
  // DOM уже готов (например, модуль подгрузили через when() позже)
  bootAllCalendars();
}

export default bootAllCalendars;