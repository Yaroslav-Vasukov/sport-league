
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
//   when('[data-module="week-calendar"]', () =>
//   import("@components/calendar/calendar.js")
//   );
//   when('[data-module="smart-list"]', () =>
//   import("@components/smart-list/smart-list.js")
//   );
//   when('[data-module="player-header"]', () =>
//   import('@components/player/player-header.js')
// );

}

// DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}