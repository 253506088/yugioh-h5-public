(function (root) {
  'use strict';
  const D = root.DuelData?.earlyLoaded ? root.DuelData : require('./early-cards.js');
  const { CARDS, DECKS, isMonster, isExtra } = D;
  const STORAGE = 'duel-sanctuary-custom-decks-v3', LEGACY = 'duel-sanctuary-custom-decks-v2';
  const clone = value => JSON.parse(JSON.stringify(value));
  const own = (object,key) => Object.prototype.hasOwnProperty.call(object,key);
  const normalName = card => (card.nameAlias || card.officialName || card.en || card.name).toLowerCase().replace(/\s+/g,' ').trim();
  const identity = id => own(CARDS,id) ? normalName(CARDS[id]) : String(id);
  let saved = [], diagnostics = [], recoverySource = null;
  function analyze(deck) {
    const errors = [], cards = Array.isArray(deck?.cards) ? deck.cards : [], extra = Array.isArray(deck?.extra) ? deck.extra : [], side = Array.isArray(deck?.side) ? deck.side : [];
    if (!deck || typeof deck !== 'object') return {valid:false,errors:['卡组数据不是有效对象。'],mainCount:0,extraCount:0};
    if (typeof deck.name !== 'string' || !deck.name.trim() || deck.name.trim().length > 40) errors.push('卡组名称需要1—40个字符。');
    if (!Array.isArray(deck.cards) || !Array.isArray(deck.extra)) errors.push('主卡组与额外卡组必须是卡牌列表。');
    if (deck.side !== undefined && !Array.isArray(deck.side)) errors.push('副卡组必须是卡牌列表。');
    if (side.length > 15) errors.push('副卡组最多15张，当前' + side.length + '张。');
    if (cards.length < 40 || cards.length > 60) errors.push('主卡组需要40—60张，当前' + cards.length + '张。');
    if (extra.length > 15) errors.push('额外卡组最多15张，当前' + extra.length + '张。');
    const counts = new Map(), stats = {monsters:0,spells:0,traps:0,tuners:0,pendulums:0,extra:extra.length};
    for (const [zone,list] of [['main',cards],['extra',extra],['side',side]]) for (const id of list) {
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
    return {valid:errors.length===0,errors:[...new Set(errors)],mainCount:cards.length,extraCount:extra.length,sideCount:side.length,stats};
  }
  function clean(input, id = null) {
    const checkInput=analyze(input);if(!checkInput.valid)throw new Error(checkInput.errors.join('\n'));
    const result = {id:id || ('custom-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,7)),name:input.name.trim(),cards:[...input.cards],extra:[...input.extra],side:[...(input.side||[])],updatedAt:input.updatedAt||Date.now(),version:3};
    if (!/^custom-[a-z0-9-]{1,70}$/.test(result.id)) throw new Error('自建卡组标识不合法。');
    if (typeof input.notes === 'string' && input.notes) result.notes = input.notes.slice(0,16000);
    const check = analyze(result);
    if (!check.valid) throw new Error(check.errors.join('\n'));
    return result;
  }
  function decorate(raw) {
    const all = [...raw.extra,...raw.cards].filter(id=>own(CARDS,id)), ace = all.find(id=>CARDS[id].exodiaPart==='head') || [...all].sort((a,b)=>(CARDS[b].atk||0)-(CARDS[a].atk||0))[0];
    const counts = {};
    raw.cards.forEach(id => { const f=CARDS[id]?.family; if(f&&f!=='generic') counts[f]=(counts[f]||0)+1; });
    const family = Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0] || 'custom';
    return {...clone(raw),en:'YOUR OWN DESTINY',ace:ace||'blue-eyes',avatar:family,player:'你的决斗者',mechanic:'自建卡组',description:'由你亲手构筑的' + raw.cards.length + '张主卡组，包含' + raw.extra.length + '张额外卡组。',subtitle:'自己的战术，自己的命运。',preset:false,custom:true,combo:['点击手牌或场上怪兽查看可用效果。','额外召唤会列出满足素材条件的同调与超量怪兽。']};
  }
  function persist() {
    if (!root.localStorage) return;
    try { if(recoverySource!==null)root.localStorage.setItem(STORAGE+'-recovery',recoverySource);root.localStorage.setItem(STORAGE,JSON.stringify(saved));recoverySource=null; }
    catch { throw new Error('浏览器未能保存卡组。请先导出卡组备份，再检查本地存储空间。'); }
  }
  function cleanDraft(input,id=null){
    if(!input||typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>40)throw Error('卡组名称需要1—40个字符。');
    for(const z of ['cards','extra','side']){const list=input[z]===undefined&&z==='side'?[]:input[z];if(!Array.isArray(list)||list.length>1200||list.some(id=>typeof id!=='string'||id.length>100))throw Error('卡牌列表格式无效。');}
    const result={id:id||('custom-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7)),name:input.name.trim(),cards:[...input.cards],extra:[...input.extra],side:[...(input.side||[])],version:3,updatedAt:input.updatedAt||Date.now(),notes:typeof input.notes==='string'?input.notes.slice(0,16000):''};
    if(!/^custom-[a-z0-9-]{1,70}$/.test(result.id))throw Error('自建卡组标识不合法。');
    result.draft=!analyze(result).valid;return result;
  }
  function save(input,{allowDraft=false}={}) {
    const raw = (allowDraft?cleanDraft:clean)({...input,updatedAt:Date.now()},input.id && saved.some(d=>d.id===input.id)?input.id:null), prior=clone(saved);
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
    diagnostics=[];recoverySource=null;
    try {
      const current=root.localStorage.getItem(STORAGE);recoverySource=current??root.localStorage.getItem(LEGACY);const input=JSON.parse(recoverySource??'[]');
      if(!Array.isArray(input)||input.length>500)throw new Error('卡组存储格式无效，原数据已保留。');
      saved=[];
      for(const item of input) {
        try {const raw=(item?.draft===true?cleanDraft:clean)(item,item.id); saved.push(raw);DECKS[raw.id]=decorate(raw);}catch(error){diagnostics.push({name:item?.name||'',error:error.message,raw:clone(item)});}
      }
      if(current===null&&!diagnostics.length)persist();
      if(!diagnostics.length)recoverySource=null;
    } catch(error) {saved=[];diagnostics.push({error:error.message});}
    return clone(saved);
  }
  function list() { return [...Object.values(DECKS).filter(d=>d.preset),...saved.map(d=>DECKS[d.id])]; }
  function copy(id) {
    const d=DECKS[id];if(!d)throw new Error('找不到来源卡组。');
    return {name:(d.name+' · 我的构筑').slice(0,40),cards:[...d.cards],extra:[...d.extra],side:[...(d.side||[])],...(d.notes?{notes:d.notes}:{})};
  }
  function parseJSON(text) {
    let input;try{input=JSON.parse(text);}catch{throw new Error('无法读取JSON卡组文件。');}
    if(input && input.format==='duel-sanctuary-deck' && input.deck)input=input.deck;
    const check=analyze(input);if(!check.valid)throw new Error(check.errors.join('\n'));
    return {name:input.name.trim().slice(0,40),cards:[...input.cards],extra:[...input.extra],side:[...(input.side||[])],...(typeof input.notes==='string'?{notes:input.notes.slice(0,16000)}:{})};
  }
  function exportJSON(deck,{allowDraft=false}={}) {
    if(allowDraft)deck=cleanDraft(deck);
    const check=analyze(deck);if(!allowDraft&&!check.valid)throw new Error(check.errors.join('\n'));
    return JSON.stringify({format:'duel-sanctuary-deck',version:3,exportedAt:new Date().toISOString(),deck:{name:deck.name,cards:[...deck.cards],extra:[...deck.extra],side:[...(deck.side||[])],...(typeof deck.notes==='string'&&deck.notes?{notes:deck.notes.slice(0,16000)}:{})}},null,2);
  }
  function registerSnapshot(spec) {
    const check=analyze(spec);if(!check.valid)throw new Error('存档里的卡组构筑不合法。');
    if(!DECKS[spec.id]) {
      if(!/^custom-[a-z0-9-]{1,70}$/.test(spec.id))throw new Error('存档中的卡组标识无效。');
      DECKS[spec.id]={...decorate(spec),retired:true};
    }
    return DECKS[spec.id];
  }
  const api={analyze,identity,clean,cleanDraft,save,saveDraft:input=>save(input,{allowDraft:true}),remove,load,list,copy,parseJSON,exportJSON,registerSnapshot,getSaved:()=>clone(saved),getDiagnostics:()=>clone(diagnostics),STORAGE};
  root.DuelDecks=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
