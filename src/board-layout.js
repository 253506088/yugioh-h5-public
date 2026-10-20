(function (root) {
  'use strict';
  function create({ prefs, save, engine, screen }) {
    const $ = selector => document.querySelector(selector);
    const desktop = matchMedia('(min-width:1081px)');
    const top = document.createElement('div'); top.id = 'duel-topbar'; $('.site-header').insertBefore(top, $('.header-tools'));
    const anchors = new Map();
    const drawer = $('.right-column'); drawer.id = 'duel-drawer';
    const drawerAnchor=document.createComment('duel-drawer');drawer.before(drawerAnchor);
    const veil = document.createElement('button'); veil.className = 'drawer-veil'; veil.setAttribute('aria-label', '收起面板'); veil.hidden = true; document.body.append(veil);
    const rail = document.createElement('nav'); rail.className = 'duel-panel-rail'; rail.setAttribute('aria-label', '决斗面板');
    rail.innerHTML = '<button data-panel="turn" aria-controls="duel-drawer" title="回合控制">◷<b class="rail-turn"></b></button><button data-panel="response" title="连锁响应">↔<small class="rail-response"></small></button><button data-panel="chain" title="连锁轨迹">∞<b class="rail-chain"></b></button><button data-panel="log" title="决斗记录">☷</button>';
    $('.duel-layout').append(rail);
    let focusBefore;
    function apply() {
      const active = desktop.matches && screen() === 'duel';
      // Escape the arena's stacking context so the veil cannot cover the drawer.
      if(active&&drawer.parentElement!==document.body)document.body.append(drawer);
      else if(!active&&drawer.parentElement===document.body)drawerAnchor.after(drawer);
      document.body.classList.toggle('duel-desktop', active);
      document.body.dataset.cardSize = ['compact', 'large'].includes(prefs.cardSize) ? prefs.cardSize : 'standard';
      document.body.classList.toggle('drawer-open', active && !prefs.rightCollapsed);
      veil.hidden = !active || prefs.rightCollapsed;
      drawer.inert = active && !!prefs.rightCollapsed;
      for (const button of rail.querySelectorAll('button')) button.setAttribute('aria-expanded', String(active && !prefs.rightCollapsed));
      for (const selector of ['#duel-turn-hud', '#local-match-bar', '#pvp-duel-bar', '#tournament-viewer-bar', '#fate-duel-bar', '.arena-caption']) {
        const node = $(selector); if (!node) continue;
        if (active && node.parentElement !== top) { const marker = document.createComment(selector); node.before(marker); anchors.set(node, marker); top.append(node); }
        else if (!active && anchors.has(node)) { const marker = anchors.get(node); marker.replaceWith(node); anchors.delete(node); }
      }
      const state = engine()?.state;
      if (state) { rail.querySelector('.rail-turn').textContent = state.turn; rail.querySelector('.rail-chain').textContent = state.chain.length; rail.querySelector('.rail-response').textContent = prefs.responseMode.toUpperCase(); }
    }
    function toggle(open = !!prefs.rightCollapsed, panel = 'turn') {
      if (open) focusBefore = document.activeElement;
      prefs.rightCollapsed = !open; save(); apply();
      if (open) { const target = drawer.querySelector({ turn: '#turn-panel', response: '.response-control', chain: '.chain-panel', log: '.log-panel' }[panel]); target?.scrollIntoView({ block: 'nearest' }); target?.querySelector('button')?.focus({ preventScroll: true }); }
      else focusBefore?.focus({ preventScroll: true });
    }
    rail.addEventListener('click', event => { const b = event.target.closest('[data-panel]'); if (b) toggle(true, b.dataset.panel); });
    veil.addEventListener('click', () => toggle(false));
    document.addEventListener('keydown', event => {
      if (!desktop.matches || screen() !== 'duel' || event.target.closest('input,textarea,select,[contenteditable=true]') || $('#modal').open) return;
      if (event.key === '\\' || event.key === 'Escape' && !prefs.rightCollapsed) { event.preventDefault(); toggle(event.key === 'Escape' ? false : undefined); }
    });
    desktop.addEventListener('change', apply);
    return { apply, toggle };
  }
  root.DuelBoardLayout = { create };
})(globalThis);
