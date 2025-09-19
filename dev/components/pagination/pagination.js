/**
 * Универсальная пагинация для любых списков (vanilla JS).
 *
 * ✅ Поддерживает НОВЫЕ атрибуты:  data-pagination-*
 * ✅ Поддерживает LEGACY (наследуемые) атрибуты: data-*
 * ✅ Работает с history (Back/Forward), чистит URL на 1-й странице
 * ✅ Скрывает навигацию, если страниц всего одна
 * ✅ Поддерживает Ctrl/⌘/Shift/среднюю кнопку (открытие в новой вкладке)
 * ✅ Опциональная автопрокрутка к началу списка
 *
 * ОСНОВНЫЕ АТРИБУТЫ НА СЕКЦИИ:
 *   data-pagination                       — включить пагинацию (или legacy: data-paginate)
 *   data-pagination-items=".grid"         — контейнер списка (legacy: data-items)
 *   data-pagination-item=".card"          — селектор элементов (legacy: data-item)
 *   data-pagination-size="12"             — элементов на страницу (legacy: data-page-size), по умолчанию 12
 *   data-pagination-window="5"            — ширина «окна» номеров (legacy: data-window), по умолчанию 5
 *   data-pagination-param="npage"         — имя URL-параметра (legacy: data-param). Если не указан — page или {id}-page
 *   data-pagination-pager=".pagination"   — селектор контейнера пагинации (legacy: data-pager). Если нет — создаётся <nav.pagination>
 *   data-pagination-prev="Назад"          — текст кнопки Prev (legacy: data-prev), по умолчанию "Prev"
 *   data-pagination-next="Вперёд"         — текст кнопки Next (legacy: data-next), по умолчанию "Next"
 *   data-pagination-autoscroll            — если указан, после переключения плавно скроллит к началу списка
 *
 * JS-ИНИЦИАЛИЗАЦИЯ:
 *   import { initPaginationAll } from '@components/pagination/pagination.js';
 *   document.addEventListener('DOMContentLoaded', initPaginationAll);
 *   // или через ваш when():
 *   when('[data-pagination],[data-paginate]',
 *     () => import('@components/pagination/pagination.js'),
 *     (m) => m.initPaginationAll()
 *   );
 *
 * РАЗМЕТКА (ПРИМЕР):
 *   <section
 *     data-pagination
 *     data-pagination-items=".news__grid"
 *     data-pagination-item=".main-post"
 *     data-pagination-size="8"
 *     data-pagination-param="npage"
 *     data-pagination-window="7"
 *     data-pagination-autoscroll
 *   >
 *     <div class="news__grid">…</div>
 *     <nav class="pagination" aria-label="News pagination"></nav>
 *   </section>
 *
 * CSS-МИНИМУМ:
 *   [hidden]{ display:none !important; }
 *   /* .pagination__link, .pagination__link.active, .pagination__link.is-disabled — стилизуйте под проект */

"use strict";

export function initPaginationAll() {
  // Реестр инстансов на окне, чтобы не терять их между повторными инициализациями
  const REG = "__paginationInstances";
  if (!window[REG]) window[REG] = [];

  // Создаём инстансы для всех секций
  document
    .querySelectorAll("[data-pagination],[data-paginate]")
    .forEach((root) => {
      const inst = createInstance(root);
      if (inst) window[REG].push(inst);
    });

  // Подписываемся на popstate один раз
  if (!window.__paginationPopstateBound) {
    window.addEventListener("popstate", () => {
      window[REG].forEach((inst) =>
        inst.render(inst.getPageFromUrl(), { push: false })
      );
    });
    window.__paginationPopstateBound = true;
  }
}

function createInstance(root) {
  // helper: читаем новый ключ -> старый -> undefined
  const d = root.dataset;
  const get = (newKey, oldKey) => d[newKey] ?? d[oldKey];

  // Где искать карточки
  const itemsSel = get("paginationItems", "items");
  const grid = itemsSel ? root.querySelector(itemsSel) : root;
  if (!grid) return null;

  // Селектор карточек
  const itemSel = get("paginationItem", "item") || "> *";
  const items = Array.from(grid.querySelectorAll(itemSel));
  if (!items.length) return null;

  // Параметры
  const pageSize = toInt(get("paginationSize", "pageSize"), 12);
  const winSize = toInt(get("paginationWindow", "window"), 5); // ширина окна номеров
  const param =
    get("paginationParam", "param") || (root.id ? `${root.id}-page` : "page");
  const prevLabel = get("paginationPrev", "prev") || "Prev";
  const nextLabel = get("paginationNext", "next") || "Next";

  // Контейнер для ссылок пагинации
  let pager =
    root.querySelector(get("paginationPager", "pager") || ".pagination") ||
    createPager(root);

  function toInt(v, def) {
    const n = parseInt(v || "", 10);
    return Number.isFinite(n) && n > 0 ? n : def;
  }

  function clamp(n, a, b) {
    return Math.min(Math.max(n, a), b);
  }

  function totalPages() {
    return Math.max(1, Math.ceil(items.length / pageSize));
  }

  function getPageFromUrl() {
    const p = parseInt(
      new URLSearchParams(location.search).get(param) || "1",
      10
    );
    return clamp(p, 1, totalPages());
  }

  function render(n, { push = true } = {}) {
    n = clamp(n, 1, totalPages());
    const start = (n - 1) * pageSize;
    const end = start + pageSize;

    // Скрываем/показываем карточки
    items.forEach((el, i) => {
      el.hidden = i < start || i >= end;
    });

    // Рисуем пагинацию
    drawPager(n, totalPages());

    // Обновляем URL
    if (push) {
      const url = new URL(location.href);
      if (n === 1) url.searchParams.delete(param);
      else url.searchParams.set(param, String(n));

      const nextHref = url.pathname + url.search;
      const currHref = location.pathname + location.search;
      if (nextHref !== currHref) {
        history.pushState({ [param]: n }, "", nextHref);
      }
    }

    // Автопрокрутка к началу списка (по желанию)
    if (root.hasAttribute("data-pagination-autoscroll")) {
      (grid || root).scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function createPager(rootEl) {
    const nav = document.createElement("nav");
    nav.className = "pagination";
    nav.setAttribute("aria-label", "Pagination");
    rootEl.appendChild(nav);
    return nav;
  }

  function makeHref(page) {
    const url = new URL(location.href);
    if (page === 1) url.searchParams.delete(param);
    else url.searchParams.set(param, String(page));
    return url.pathname + url.search;
  }

  function link(
    label,
    page,
    { disabled = false, active = false, className = "" } = {}
  ) {
    const a = document.createElement("a");
    a.href = makeHref(page);
    a.className = `pagination__link${className ? ` ${className}` : ""}`;
    if (disabled) a.classList.add("is-disabled");
    if (active) {
      a.classList.add("active");
      a.setAttribute("aria-current", "page");
    }
    a.textContent = label;

    // Поддержка Ctrl/⌘/Shift/средняя кнопка — не перехватываем
    a.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      if (!disabled) render(page);
    });

    return a;
  }

  function ellipsis() {
    const s = document.createElement("span");
    s.className = "pagination__ellipsis";
    s.textContent = "…";
    return s;
  }

  function pageList(curr, total, win) {
    const range = new Set([1, total]);
    const half = Math.floor(win / 2);
    const start = clamp(curr - half, 2, Math.max(2, total - 1));
    const stop = clamp(curr + half, 2, Math.max(2, total - 1));
    for (let i = start; i <= stop; i++) range.add(i);
    return Array.from(range).sort((a, b) => a - b);
  }

  function drawPager(curr, total) {
    // Скрываем навигацию, если страниц всего одна
    pager.style.display = total > 1 ? "" : "none";
    if (total <= 1) {
      pager.innerHTML = "";
      return;
    }

    pager.innerHTML = "";

    // Prev
    pager.append(
      link(prevLabel, Math.max(1, curr - 1), {
        disabled: curr === 1,
        className: "pagination__prev",
      })
    );

    // Номера страниц
    const pages = pageList(curr, total, winSize);
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      if (i > 0 && p - pages[i - 1] > 1) pager.append(ellipsis());
      pager.append(link(String(p), p, { active: p === curr }));
    }

    // Next
    pager.append(
      link(nextLabel, Math.min(total, curr + 1), {
        disabled: curr === total,
        className: "pagination__next",
      })
    );
  }

  // старт
  render(getPageFromUrl(), { push: false });

  return { render, getPageFromUrl };
}

// Экспорт по умолчанию для удобства lazy-импорта через when(...).default()
export default initPaginationAll;
