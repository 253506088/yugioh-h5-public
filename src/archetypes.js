/* OCG membership is independent of display language and deck-theme families. */
(function(root){
 'use strict';
 const D=root.DuelData?.earlyLoaded?root.DuelData:require('./early-cards.js');
 const locales=root.DuelCardLocales||require('./card-locales.js');
 const data=root.DuelArchetypeData||require('./archetype-data.js');
 const normalize=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
 const entries=new Map(),resolved=new Map();
 for(const entry of data.registry.entries)for(const key of [entry.name,...(entry.aliases||[])]){
  const normalized=normalize(key),prior=entries.get(normalized);
  if(prior&&prior!==entry)throw new Error('Ambiguous archetype key: '+key);
  entries.set(normalized,entry);
 }
 const lookup=key=>{if(!resolved.has(key))resolved.set(key,entries.get(normalize(key)));return resolved.get(key);};
 const definition=card=>typeof card==='string'?D.CARDS[card]:D.CARDS[card?.id]||card;
 function attachCodes(card){
  if(!card||Array.isArray(card.setcodes))return card;
  const record=locales[card.id]||(card.type==='token'&&(data.tokenIds[card.id]||data.tokens[card.officialName]));
  if(record&&Array.isArray(record.setcodes)){
   card.setcodes=record.setcodes.slice();card.setcodeSourceId=record.setcodeSourceId;
  }
  return card;
 }
 function inArchetype(card,key){
  const entry=lookup(key),c=attachCodes(definition(card));
  if(!entry)throw new Error('Unregistered archetype: '+key);
  if(!c)return false;
  if(entry.kind==='race')return c.race===entry.race;
  const name=c.officialName||'';
  if(entry.kind==='name-fragment')return entry.match==='prefix'?name.startsWith(entry.value):name.includes(entry.value);
  const code=Number(entry.code);
  // [] means the database explicitly says there is no archetype. English
  // fallback is permitted only for a custom identity absent from the database.
  if(Array.isArray(c.setcodes))return c.setcodes.some(s=>(s&0xfff)===(code&0xfff)&&(s&code)===code);
  const fallback=entry.fallback;
  return !!fallback&&(fallback.match==='prefix'?name.startsWith(fallback.value):name.includes(fallback.value));
 }
 D.inArchetype=inArchetype;D.archetypeEntry=lookup;
 // Compatibility tags are for archive filters and old metadata consumers.
 // Game rules call inArchetype directly; broad deck themes stay in isFamily.
 const legacy=[['blackwing','Blackwing',true],['synchron','Synchron',true],['utopia','Utopia',true],['galaxy','Galaxy',true],['bamboo','Bamboo Sword',true],['junk','Junk'],['hero','HERO'],['gagaga','Gagaga'],['gogogo','Gogogo'],['dododo','Dododo'],['zubaba','Zubaba']];
 D.applyArchetypeTags=function(c){
  attachCodes(c);
  for(const [key,name,primary] of legacy)if((key==='bamboo'||D.isMonster(c))&&(key!=='utopia'||c.type==='xyz')&&inArchetype(c,name)){
   if(primary&&['early','generic'].includes(c.family))c.family=key;
   c.families=[...new Set([...(c.families||[]),key])];
  }
  for(const [flag,name] of [['junk','Junk'],['elemental','Elemental HERO'],['masked','Masked HERO'],['cyberDragon','Cyber Dragon'],['crystron','Crystron']])c[flag]=inArchetype(c,name);
  return c;
 };
 for(const c of D.CARD_LIST)D.applyArchetypeTags(c);
 if(typeof module!=='undefined')module.exports={inArchetype,lookup,attachCodes};
})(globalThis);
