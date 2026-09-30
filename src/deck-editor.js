(function(root){
  'use strict';
  const T=root.DuelDecks||(typeof require==='function'?require('./deck-tools.js'):null), D=root.DuelData;
  const zones=['cards','extra','side'],clone=v=>JSON.parse(JSON.stringify(v));
  function normalize(d){
    if(!d||typeof d!=='object')throw Error('卡组数据不是有效对象。');
    const out=clone(d);for(const z of zones){if(z==='side'&&out[z]===undefined)out[z]=[];if(!Array.isArray(out[z])||out[z].length>1200||out[z].some(id=>typeof id!=='string'))throw Error('卡牌列表格式无效。');}return out;
  }
  function inventory(d){const out={};for(const z of zones)for(const id of d[z]||[])out[id]=(out[id]||0)+1;return Object.entries(out).sort(([a],[b])=>a.localeCompare(b));}
  function check(d,registered){const result=T.analyze(d);if(registered&&JSON.stringify(inventory(d))!==JSON.stringify(inventory(registered)))result.errors.push('换备必须保留报名时的全部卡片。');result.valid=!result.errors.length;return result;}
  function move(d,moves,{registered,strict=true}={}){
    const next=normalize(d),selected=new Set(),entries=[];
    for(const m of moves){const key=m.from+':'+m.index;if(!zones.includes(m.from)||!zones.includes(m.to)||!Number.isInteger(m.index)||m.index<0||m.index>=next[m.from].length||selected.has(key))throw Error('卡片选择已失效。');
      selected.add(key);const id=next[m.from][m.index],c=D.CARDS[id];if(!c||m.to!=='side'&&(D.isExtra(c)?'extra':'cards')!==m.to)throw Error('卡片不能移入这个分区。');entries.push({...m,id});}
    for(const z of zones)next[z]=next[z].filter((id,index)=>!selected.has(z+':'+index));
    for(const m of entries)next[m.to].push(m.id);
    const result=check(next,registered);if(strict&&!result.valid)throw Error(result.errors.join('\n'));return next;
  }
  function diff(before,after){const out=[];for(const z of zones){const counts=new Map();for(const id of before[z]||[])counts.set(id,(counts.get(id)||0)-1);for(const id of after[z]||[])counts.set(id,(counts.get(id)||0)+1);for(const [id,delta] of counts)if(delta)out.push({zone:z,id,delta});}return out;}
  const api={zones,normalize,inventory,check,move,diff};root.DuelDeckEditor=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
