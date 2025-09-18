
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
  when('[data-countdown-ts]', () => import('@components/card-match/card-match.js'));

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