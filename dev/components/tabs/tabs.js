// @components/tabs/tabs.js
/* eslint-disable no-param-reassign */
function qsa(root, sel) { return Array.from(root.querySelectorAll(sel)); }
function genId(prefix = 'id') { return `${prefix}-${Math.random().toString(36).slice(2, 9)}`; }

export function initStandingsTabs(root = document) {
  const widgets = qsa(root, '[data-tabs]');

  widgets.forEach((widget) => {
    const tabs   = qsa(widget, '[role="tab"], .tabs__tab');
    const panels = qsa(widget, '[role="tabpanel"], .tabs__panel');
    if (!tabs.length || !panels.length) return;

    // Ensure roles/ids are valid and linked
    tabs.forEach((tab, i) => {
      if (!tab.id) tab.id = genId('tab');
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', 'false');
      tab.tabIndex = -1;

      let pid = tab.getAttribute('aria-controls');
      if (!pid) {
        const panel = panels[i] || panels[0];
        if (panel) {
          if (!panel.id) panel.id = genId('panel');
          tab.setAttribute('aria-controls', panel.id);
        }
      }
    });

    panels.forEach((p, i) => {
      if (!p.id) p.id = genId('panel');
      p.setAttribute('role', 'tabpanel');
      const owner = tabs[i] || tabs[0];
      if (owner) p.setAttribute('aria-labelledby', owner.id);
      // start hidden by default; class cleanup
      p.hidden = true;
      p.removeAttribute('hidden'); // reset attribute to avoid SSR leftovers
      p.hidden = true;             // then hide via property (source of truth)
      p.classList.remove('is-active');
    });

    const setActive = (tab) => {
      if (!tab) return;

      // reset all
      tabs.forEach((t) => {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
        t.tabIndex = -1;
      });

      panels.forEach((p) => {
        p.classList.remove('is-active');
        p.hidden = true;            // hide via property
        p.setAttribute('hidden', ''); // and attribute (CSS safety)
      });

      // activate tab
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');
      tab.tabIndex = 0;

      // show linked panel (double insurance against SSR/CSS)
      const panelId = tab.getAttribute('aria-controls');
      const panel = panelId ? widget.querySelector('#' + panelId) : null;
      if (panel) {
        panel.hidden = false;             // unhide via property
        panel.removeAttribute('hidden');  // and remove attribute
        panel.classList.add('is-active');
      }

      // persist value for widget
      const val = tab.dataset.tab || tab.id;
      widget.dataset.active = val;

      // optional hash sync
      if (widget.dataset.tabsSync === 'hash' && widget.id) {
        const pairs = new URLSearchParams(window.location.hash.slice(1));
        pairs.set(widget.id, val);
        window.history.replaceState(null, '', '#' + pairs.toString());
      }

      widget.dispatchEvent(new CustomEvent('tabs:change', {
        detail: { value: val, tab, panel },
        bubbles: true
      }));
    };

    // initial: hash → data-active → .is-active → first
    const pickInitial = () => {
      if (widget.dataset.tabsSync === 'hash' && widget.id) {
        const pairs = new URLSearchParams(window.location.hash.slice(1));
        const want = pairs.get(widget.id);
        if (want) {
          const byHash = tabs.find(t => (t.dataset.tab || t.id) === want);
          if (byHash) return byHash;
        }
      }
      if (widget.dataset.active) {
        const byData = tabs.find(t => (t.dataset.tab || t.id) === widget.dataset.active);
        if (byData) return byData;
      }
      const byClass = widget.querySelector('.tabs__tab.is-active');
      if (byClass) return byClass;
      return tabs[0];
    };

    // init
    const initialTab = pickInitial();
    setActive(initialTab);

    // hard-fix in case SSR left hidden="" on the active panel
    const activePanelId = initialTab?.getAttribute('aria-controls');
    const activePanel = activePanelId ? widget.querySelector('#' + activePanelId) : null;
    if (activePanel) {
      activePanel.hidden = false;
      activePanel.removeAttribute('hidden');
      activePanel.classList.add('is-active');
    }

    // listeners
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => setActive(tab));
      tab.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setActive(tab);
        }
      });
    });

    const tablist = widget.querySelector('[role="tablist"]') || widget;
    tablist.addEventListener('keydown', (e) => {
      const list = tabs;
      const current = list.findIndex(t => t.getAttribute('aria-selected') === 'true');
      if (current < 0) return;

      let i = current;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') i = (current + 1) % list.length;
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   i = (current - 1 + list.length) % list.length;
      if (e.key === 'Home') i = 0;
      if (e.key === 'End')  i = list.length - 1;

      if (i !== current) {
        e.preventDefault();
        list[i].focus();
        setActive(list[i]);
      }
    });

    if (widget.dataset.tabsSync === 'hash' && widget.id) {
      window.addEventListener('hashchange', () => {
        const pairs = new URLSearchParams(window.location.hash.slice(1));
        const want = pairs.get(widget.id);
        if (!want) return;
        const tab = tabs.find(t => (t.dataset.tab || t.id) === want);
        if (tab && tab !== widget.querySelector('.tabs__tab.is-active')) {
          setActive(tab);
        }
      });
    }

    // tiny API
    widget.switchTo = (value) => {
      const tab = tabs.find(t => (t.dataset.tab || t.id) === value);
      if (tab) setActive(tab);
    };
  });
}

// auto-init for lazy import
export default function () {
  initStandingsTabs(document);
}
