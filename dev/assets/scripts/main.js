
"use strict";
function when(selectorOrTest, importer, runner) {
  const ok =
    typeof selectorOrTest === "function"
      ? selectorOrTest()
      : document.querySelector(selectorOrTest);

  if (!ok) return;

  importer()
    .then((m) => (runner ? runner(m) : m.default?.()))
    .catch((e) => console.error("[feature load error]", e));
}

function init() {

  when('[data-module="header"]', () =>
    import("@components/header/header.js")
  ); 
  when("[data-date]", () =>
    import("@components/date/date.js")
  ); 
  when("[data-swiper]", () =>
    import("@components/swiper/swiper.js")
  ); 
  when("[data-tabs]", () =>
    import("@components/tabs/tabs.js")
  ); 
  when('[data-module="header-league"]', () =>
  import("@components/header-league/header-league.js")
  );
  when('[data-calendar]', () => import('@components/calendar/calendar.js'));
  when('[data-pagination]', () =>
  import('@components/pagination/pagination.js')
);

}

// DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}