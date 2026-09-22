(function (root) {
  'use strict';
  class ParseError extends Error { constructor(code, detail = '') { super(code); this.code = code; this.detail = detail; } }
  const fail = (code, detail) => { throw new ParseError(code, detail); };
  const empty = name => ({ name, main: [], extra: [], side: [], uncertain: [] });
  const entry = (name, count = 1, isPassword = false) => ({ name: String(name).trim(), count, language: 'unknown', ...(isPassword ? { isPassword: true } : {}) });
  function section(line) {
    const text = line.replace(/^[#!\s]+|[：:\s]+$/g, '').replace(/\s*[（(]?\d+\s*[）)]?$/, '').trim().toLowerCase();
    return /^(main(?: deck)?|主卡组|主卡組|主牌组|メイン(?:デッキ)?)$/.test(text) ? 'main' :
      /^(extra(?: deck)?|额外(?:卡组)?|額外(?:卡組)?|エクストラ(?:デッキ)?)$/.test(text) ? 'extra' :
        /^(side(?: deck)?|副卡组|副卡組|副牌|サイド(?:デッキ)?)$/.test(text) ? 'side' : null;
  }
  function parse(text, { cards = root.DuelData?.CARDS || {} } = {}) {
    text = String(text).replace(/^\uFEFF/, '').trim();
    if (!text) return null;
    if (new TextEncoder().encode(text).length > 60000) fail('textLimit');
    if (/^ydke:\/\//i.test(text)) {
      const match = /^ydke:\/\/([A-Za-z0-9+/=]*)!([A-Za-z0-9+/=]*)!([A-Za-z0-9+/=]*)!$/.exec(text);
      if (!match) fail('invalidYdke');
      const deck = empty('YDKe');
      for (const [i, zone] of ['main', 'extra', 'side'].entries()) {
        const encoded = match[i + 1];
        if (encoded.length % 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) fail('invalidYdke');
        let bytes; try { bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0)); } catch { fail('invalidYdke'); }
        if (bytes.length % 4 || bytes.length > 1600) fail('invalidYdke');
        const view = new DataView(bytes.buffer);
        for (let at = 0; at < bytes.length; at += 4) { const id = view.getUint32(at, true); if (!id || id > 99999999) fail('invalidYdke'); deck[zone].push(entry(id, 1, true)); }
      }
      return { decks: [deck], format: 'ydke' };
    }
    if (/^\s*#main\s*$/im.test(text)) {
      const deck = empty('YDK'); let zone = null;
      for (const line of text.split(/\r?\n/).map(s => s.trim()).filter(Boolean)) {
        if (/^#main$/i.test(line)) { zone = 'main'; continue; }
        if (/^#extra$/i.test(line)) { zone = 'extra'; continue; }
        if (/^!side$/i.test(line)) { zone = 'side'; continue; }
        if (line.startsWith('#')) continue;
        if (!zone || !/^\d{1,8}$/.test(line) || Number(line) === 0) fail('invalidYdk', line.slice(0, 80));
        deck[zone].push(entry(line, 1, true));
        if (deck[zone].length > 400) fail('entryLimit');
      }
      return { decks: [deck], format: 'ydk' };
    }
    if (/^[{[]/.test(text)) {
      let data; try { data = JSON.parse(text); } catch { fail('invalidJSON'); }
      const raw = data?.format === 'duel-sanctuary-deck' ? [data.deck] : Array.isArray(data) ? data : data?.decks || [data];
      if (!Array.isArray(raw) || !raw.length || raw.length > 20) fail('invalidJSON');
      let totalEntries = 0;
      const decks = raw.map(value => {
        if (!value || typeof value.name !== 'string') fail('invalidJSON');
        const deck = empty(value.name.slice(0, 40));
        if (typeof value.notes === 'string') deck.notes = value.notes.slice(0, 16000);
        if (Array.isArray(value.uncertain) && value.uncertain.every(v => typeof v === 'string')) deck.uncertain = value.uncertain.slice(0, 100);
        for (const zone of ['main', 'extra', 'side']) {
          const list = zone === 'main' ? value.cards || value.main : value[zone] || [];
          if (!Array.isArray(list) || list.length > 400) fail('invalidJSON');
          totalEntries += list.length; if (totalEntries > 2400) fail('entryLimit');
          deck[zone] = list.map(item => {
            if (typeof item === 'string' || typeof item === 'number') {
              const card = Object.hasOwn(cards, item) ? cards[item] : null;
              if (card?.notCollectible) fail('invalidJSON');
              // Internal IDs are accepted only from the explicit local deck JSON format.
              return entry(card ? card.providerId || root.DuelCardLocales?.[card.id]?.locales?.en?.name || card.officialName || card.en || card.name : item, 1, Boolean(card?.providerId) || typeof item === 'number');
            }
            if (!item || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 200 || !Number.isInteger(item.count) || item.count < 1 || item.count > 99) fail('invalidJSON');
            return entry(item.name, item.count);
          });
        }
        return deck;
      });
      return { decks, format: 'json' };
    }
    const deck = empty('Imported deck'); let zone = 'main', hasEntries = false;
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim(); if (!line) continue;
      const found = section(line); if (found) { zone = found; continue; }
      const prefix = /^(\d{1,2})(?:\s*[x×*]\s*|\s+)(.+)$/i.exec(line);
      const match = prefix || /^(.+?)\s*[x×*]\s*(\d{1,2})$/i.exec(line);
      if (!match) return null; // Never silently drop prose or an unparsed line.
      const name = prefix ? match[2] : match[1], count = Number(prefix ? match[1] : match[2]);
      if (!Number.isInteger(count) || count < 1 || count > 99 || !name.trim() || name.length > 200) return null;
      deck[zone].push(entry(name, count)); hasEntries = true;
      if (deck[zone].length > 400) fail('entryLimit');
    }
    return hasEntries ? { decks: [deck], format: 'list' } : null;
  }
  root.DuelDeckParse = { parse, ParseError };
  if (typeof module !== 'undefined') module.exports = root.DuelDeckParse;
})(globalThis);
