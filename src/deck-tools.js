(function (root) {
  'use strict';
  const D = root.DuelData?.earlyLoaded ? root.DuelData : require('./early-cards.js');
  const { CARDS, DECKS, isMonster, isExtra } = D;
  const STORAGE = 'duel-sanctuary-custom-decks-v2';
  const clone = value => JSON.parse(JSON.stringify(value));
  const own = (object,key) => Object.prototype.hasOwnProperty.call(object,key);
  const normalName = card => (card.nameAlias || card.officialName || card.en || card.name).toLowerCase().replace(/\s+/g,' ').trim();
  let saved = [];
  function analyze(deck) {
    const errors = [], cards = Array.isArray(deck?.cards) ? deck.cards : [], extra = Array.isArray(deck?.extra) ? deck.extra : [];
    if (!deck || typeof deck !== 'object') return {valid:false,errors:['卡组数据不是有效对象。'],mainCount:0,extraCount:0};
    if (typeof deck.name !== 'string' || !deck.name.trim() || deck.name.trim().length > 40) errors.push('卡组名称需要1—40个字符。');
    if (!Array.isArray(deck.cards) || !Array.isArray(deck.extra)) errors.push('主卡组与额外卡组必须是卡牌列表。');
    if (cards.length < 40 || cards.length > 60) errors.push('主卡组需要40—60张，当前' + cards.length + '张。');
    if (extra.length > 15) errors.push('额外卡组最多15张，当前' + extra.length + '张。');
    const counts = new Map(), stats = {monsters:0,spells:0,traps:0,tuners:0,pendulums:0,extra:extra.length};
    for (const [zone,list] of [['main',cards],['extra',extra]]) for (const id of list) {
      if (typeof id !== 'string' || !own(CARDS,id)) { errors.push('存在无法识别的卡牌：' + String(id).slice(0,50)); continue; }
      const c = CARDS[id];
      if(c.implementationStatus==='pending')errors.push(c.name+'的效果尚待实现，暂不能用于正式决斗。');
      if (c.notCollectible || c.type === 'token') { errors.push('衍生物不能编入卡组。'); continue; }
      if (zone === 'main' && isExtra(c)) errors.push(c.name + '只能放入额外卡组。');
      if (zone === 'extra' && !isExtra(c)) errors.push(c.name + '不能放入额外卡组。');
      const key = normalName(c); counts.set(key,(counts.get(key)||0)+1);
      if (counts.get(key) === 4) errors.push(c.name + '的同名卡合计最多3张。');
      if (zone === 'main') {
        if (isMonster(c)) stats.monsters++; else if (c.type === 'spell') stats.spells++; else if (c.type === 'trap') stats.traps++;
        if (c.tuner) stats.tuners++; if (c.type === 'pendulum') stats.pendulums++;
      }
    }
    return {valid:errors.length===0,errors:[...new Set(errors)],mainCount:cards.length,extraCount:extra.length,stats};
  }
  function clean(input, id = null) {
    const result = {id:id || ('custom-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,7)),name:String(input.name||'我的新卡组').trim().slice(0,40),cards:Array.isArray(input.cards)?input.cards.slice(0,100):[],extra:Array.isArray(input.extra)?input.extra.slice(0,40):[],updatedAt:Date.now(),version:2};
    if (!/^custom-[a-z0-9-]{1,70}$/.test(result.id)) throw new Error('自建卡组标识不合法。');
    const check = analyze(result);
    if (!check.valid) throw new Error(check.errors.join('\n'));
    return result;
  }
  function decorate(raw) {
    const all = [...raw.extra,...raw.cards], ace = all.find(id=>CARDS[id].exodiaPart==='head') || [...all].sort((a,b)=>(CARDS[b].atk||0)-(CARDS[a].atk||0))[0];
    const counts = {};
    raw.cards.forEach(id => { const f=CARDS[id].family; if(f!=='generic') counts[f]=(counts[f]||0)+1; });
    const family = Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0] || 'custom';
    return {...clone(raw),en:'YOUR OWN DESTINY',ace:ace||'blue-eyes',avatar:family,player:'你的决斗者',mechanic:'自建卡组',description:'由你亲手构筑的' + raw.cards.length + '张主卡组，包含' + raw.extra.length + '张额外卡组。',subtitle:'自己的战术，自己的命运。',preset:false,custom:true,combo:['点击手牌或场上怪兽查看可用效果。','额外召唤会列出满足素材条件的同调与超量怪兽。']};
  }
  function persist() {
    if (!root.localStorage) return;
    try { root.localStorage.setItem(STORAGE,JSON.stringify(saved)); }
    catch { throw new Error('浏览器未能保存卡组。请先导出卡组备份，再检查本地存储空间。'); }
  }
  function save(input) {
    const raw = clean(input,input.id && saved.some(d=>d.id===input.id)?input.id:null), prior=clone(saved);
    const at=saved.findIndex(d=>d.id===raw.id); if(at<0)saved.push(raw);else saved[at]=raw;
    try { persist(); } catch(error) {saved=prior;throw error;}
    DECKS[raw.id]=decorate(raw); return clone(raw);
  }
  function remove(id) {
    const prior=clone(saved); const removed=saved.find(d=>d.id===id);
    if(!removed)throw new Error('未找到这副自建卡组。');
    saved=saved.filter(d=>d.id!==id);try{persist();}catch(error){saved=prior;throw error;}
    // An active duel keeps its immutable construction record even after deletion.
    if(DECKS[id])DECKS[id].retired=true;
    return clone(removed);
  }
  function load() {
    if(!root.localStorage)return [];
    try {
      const input=JSON.parse(root.localStorage.getItem(STORAGE)||'[]');
      if(!Array.isArray(input))return [];
      saved=[];
      for(const item of input.slice(0,500)) {
        try {const raw=clean(item,item.id); saved.push(raw);DECKS[raw.id]=decorate(raw);}catch{}
      }
    } catch {saved=[];}
    return clone(saved);
  }
  function list() { return [...Object.values(DECKS).filter(d=>d.preset),...saved.map(d=>DECKS[d.id])]; }
  function copy(id) {
    const d=DECKS[id];if(!d)throw new Error('找不到来源卡组。');
    return {name:(d.name+' · 我的构筑').slice(0,40),cards:[...d.cards],extra:[...d.extra]};
  }
  function parseJSON(text) {
    let input;try{input=JSON.parse(text);}catch{throw new Error('无法读取JSON卡组文件。');}
    if(input && input.format==='duel-sanctuary-deck' && input.deck)input=input.deck;
    const check=analyze(input);if(!check.valid)throw new Error(check.errors.join('\n'));
    return {name:input.name.trim().slice(0,40),cards:[...input.cards],extra:[...input.extra]};
  }
  function exportJSON(deck) {
    const check=analyze(deck);if(!check.valid)throw new Error(check.errors.join('\n'));
    return JSON.stringify({format:'duel-sanctuary-deck',version:2,exportedAt:new Date().toISOString(),deck:{name:deck.name,cards:[...deck.cards],extra:[...deck.extra]}},null,2);
  }
  function registerSnapshot(spec) {
    const check=analyze(spec);if(!check.valid)throw new Error('存档里的卡组构筑不合法。');
    if(!DECKS[spec.id]) {
      if(!/^custom-[a-z0-9-]{1,70}$/.test(spec.id))throw new Error('存档中的卡组标识无效。');
      DECKS[spec.id]={...decorate(spec),retired:true};
    }
    return DECKS[spec.id];
  }
  const api={analyze,clean,save,remove,load,list,copy,parseJSON,exportJSON,registerSnapshot,getSaved:()=>clone(saved),STORAGE};
  root.DuelDecks=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
