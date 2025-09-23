document.querySelectorAll('.swiper[data-swiper]').forEach(function (root) {
    // читаем JSON из data-swiper (или пустой объект)
    var opts = {};
    try { opts = JSON.parse(root.getAttribute('data-swiper') || '{}'); } catch(e) { opts = {}; }

    // локальные элементы навигации/пагинации (по желанию)
    var prev = root.querySelector('[data-swiper-prev]');
    var next = root.querySelector('[data-swiper-next]');
    var pag  = root.querySelector('[data-swiper-pagination]');

    if (prev || next) opts.navigation = { prevEl: prev || undefined, nextEl: next || undefined };
    if (pag)          opts.pagination = { el: pag, clickable: true };

    // дефолты + твои опции
    var base = { slidesPerView: 1, spaceBetween: 16 };
    new Swiper(root, Object.assign(base, opts));
  });