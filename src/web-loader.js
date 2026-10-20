(function (root) {
  'use strict';
  let manifest;
  const imports = new Map(), languages = new Map(), readyLanguages = new Set();
  const url = path => new URL(path, document.baseURI).href;
  const script = path => { if (!imports.has(path)) imports.set(path, import(url(path))); return imports.get(path); };
  const json = async path => { const r = await fetch(url(path)); if (!r.ok) throw Error('Resource ' + r.status + ': ' + path); return r.json(); };
  const pause = () => new Promise(resolve => setTimeout(resolve, 0));
  async function entries(paths, receive) {
    // Bounded fetches and separate parsing tasks keep cancellation/input responsive.
    for (let n = 0; n < paths.length; n += 4) {
      const parts = await Promise.all(paths.slice(n, n + 4).map(json));
      for (const rows of parts) { receive(rows); await pause(); }
    }
  }
  async function loadLanguage(language) {
    if (!Object.hasOwn(manifest.languages,language)) return;
    if (!languages.has(language)) languages.set(language, entries(manifest.languages[language], rows => {
      for (const [id, text] of rows) if (root.DuelCardLocales[id]) Object.assign(root.DuelCardLocales[id].locales[language], text);
    }).then(() => { readyLanguages.add(language);root.DuelI18n?.invalidateSearch(); }).catch(error => { languages.delete(language); throw error; }));
    return languages.get(language);
  }
  function lazy(global, feature) {
    root[global] = { create(config) {
      let instance, pending;
      const idle = new Set(['hide', 'closeViewer', 'exitSiding', 'updateClocks']);
      const fields = { connected: false, room: null, draft: null, current: null, viewer: null, active: false, remote: null };
      const ensure = () => pending ||= (async()=>{
        for(const path of manifest.features[feature])await script(path);
        return instance=root[global].create(config);
      })();
      return new Proxy({}, { get(_, key) {
        if (instance) { const value = instance[key]; return typeof value === 'function' ? value.bind(instance) : value; }
        if (key === 'then') return undefined;
        if (key === 'ready') return ensure().then(object=>object.ready);
        if (key === 'handle') return () => false;
        if (key in fields) return fields[key];
        if (idle.has(key)) return () => {};
        return (...args) => ensure().then(object => object[key]?.(...args)).catch(error => { console.error(error);root.dispatchEvent(new CustomEvent('duel-module-error'));return false; });
      } });
    } };
  }
  async function start(path) {
    manifest = await json(path);
    root.DuelCardAliases = await json(manifest.aliases);
    await script(manifest.media);
    lazy('DuelWorkshop', 'deck'); lazy('DuelAIImport', 'deck'); lazy('DuelTournamentUI', 'tournament'); lazy('DuelPVP', 'pvp'); lazy('DuelP2PUI','p2p');
    for (const item of manifest.core) {
      if (item.script) await script(item.script);
      if (item.rows) { root.DuelWebRows = []; await entries(item.rows, rows => root.DuelWebRows.push(...rows)); }
      if (item.locales) {
        root.DuelCardLocales = {};
        await entries(item.locales, rows => Object.assign(root.DuelCardLocales, Object.fromEntries(rows)));
        let language = 'zh-CN'; try { language = localStorage.getItem('duel-sanctuary-language-v1') || language; } catch {}
        if(!Object.hasOwn(manifest.languages,language))language='zh-CN';
        await loadLanguage(language);
      }
      await pause();
    }
    performance.mark('duel-code-ready');
  }
  root.DuelWeb = { start, loadLanguage, hasLanguage: language => readyLanguages.has(language), get manifest() { return manifest; } };
})(globalThis);
