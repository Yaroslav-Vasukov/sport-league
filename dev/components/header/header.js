export default function initHeader() {
  document.querySelectorAll('[data-module="header"]').forEach((root) => {
    if (root.__header_inited) return;
    root.__header_inited = true;

    const nav = root.querySelector("#main-nav");
    const items = [...nav.querySelectorAll(".nav__item")];
    const burger = root.querySelector(".header__burger");

    const getBtn = (li) => li.querySelector(".nav__link");
    const getPanel = (li) => {
      const id = getBtn(li).getAttribute("aria-controls");
      return id ? root.querySelector("#" + id) : null;
    };

    const openItem = (li) => {
      const btn = getBtn(li);
      const panel = getPanel(li);
      if (!btn || !panel) return;
      li.classList.add("is-open");
      btn.setAttribute("aria-expanded", "true");
      panel.hidden = false;
    };
    const closeItem = (li) => {
      const btn = getBtn(li);
      const panel = getPanel(li);
      li.classList.remove("is-open");
      if (btn) btn.setAttribute("aria-expanded", "false");
      if (panel) panel.hidden = true;
    };
    const closeAll = () => items.forEach(closeItem);

    // ADD: оверлей
    const htmlEl = document.documentElement;
    let lastFocus = null;
    let overlay = null;
    const getSBW = () =>
      `${Math.max(
        window.innerWidth - document.documentElement.clientWidth,
        0
      )}px`;

    function addOverlay() {
      if (overlay) return;
      overlay = document.createElement("div");
      overlay.className = "nav-overlay";
      overlay.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        closeMenu();
      }); // клик по фону закрывает
      document.body.appendChild(overlay);
    }
    function removeOverlay() {
      if (!overlay) return;
      overlay.removeEventListener("click", closeMenu);
      overlay.remove();
      overlay = null;
    }

    function openMenu() {
      lastFocus = document.activeElement;
      htmlEl.style.setProperty("--sbw", getSBW());
      htmlEl.classList.add("menu-open");
      burger.setAttribute("aria-expanded", "true");
      nav.setAttribute("aria-hidden", "false");
      addOverlay();

      const first = nav.querySelector(
        'button, a, [tabindex]:not([tabindex="-1"])'
      );
      if (first) first.focus();

      document.addEventListener("keydown", onEsc);
    }

    function closeMenu() {
      htmlEl.classList.remove("menu-open");
      htmlEl.style.removeProperty("--sbw");
      burger.setAttribute("aria-expanded", "false");
      nav.setAttribute("aria-hidden", "true");
      closeAll();
      removeOverlay();
      if (lastFocus && lastFocus.focus) lastFocus.focus();
      document.removeEventListener("keydown", onEsc);
    }

    function onEsc(e) {
      if (e.key === "Escape") closeMenu();
    }

    // Burger (mobile)
    burger?.addEventListener("click", (e) => {
      e.stopPropagation();
      const expanded = burger.getAttribute("aria-expanded") === "true";
      expanded ? closeMenu() : openMenu();
    });

    // Desktop hover
    let hoverTimer = null;
    items.forEach((li) => {
      li.addEventListener("pointerenter", () => {
        if (window.matchMedia("(max-width:1024px)").matches) return;
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => {
          closeAll();
          openItem(li);
        }, 80);
      });
      li.addEventListener("pointerleave", () => {
        if (window.matchMedia("(max-width:1024px)").matches) return;
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => closeItem(li), 120);
      });
    });

    // Click toggles (mobile + fallback)
    nav.addEventListener("click", (e) => {
      const btn = e.target.closest(".nav__link");
      if (!btn) return;
      const li = btn.closest(".nav__item");
      const expanded = btn.getAttribute("aria-expanded") === "true";
      closeAll();
      if (!expanded) openItem(li);
    });

    // Keyboard support
    nav.addEventListener("keydown", (e) => {
      const currentBtn = e.target.closest(".nav__link");
      if (!currentBtn) return;

      switch (e.key) {
        case "Enter":
        case " ":
          e.preventDefault();
          currentBtn.click();
          break;
        case "Escape":
          if (currentBtn.getAttribute("aria-expanded") === "true") {
            closeAll();
          } else {
            closeMenu();
          }
          currentBtn.focus();
          break;
        case "ArrowRight":
        case "ArrowLeft": {
          e.preventDefault();
          const arr = [...nav.querySelectorAll(".nav__link")];
          const idx = arr.indexOf(currentBtn);
          const next =
            e.key === "ArrowRight"
              ? (idx + 1) % arr.length
              : (idx - 1 + arr.length) % arr.length;
          arr[next].focus();
          break;
        }
      }
    });

    document.addEventListener("pointerdown", (e) => {
      if (htmlEl.classList.contains("menu-open")) {
        // меню открыто: ничего не делаем — оверлей сам закроет
        return;
      }
      // десктоп: закрываем мегапанели кликом вне хедера
      if (!root.contains(e.target)) closeAll();
    });

    // Reset при ресайзе
    const mq = window.matchMedia("(min-width:1025px)");
    const onChange = () => {
      if (mq.matches) closeMenu();
    };
    mq.addEventListener?.("change", onChange);
  });
}
