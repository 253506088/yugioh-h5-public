(function(root){
 'use strict';
 const D=root.DuelData||(typeof require==='function'?require('./early-cards.js'):null);
 const cardData=root.DuelCardLocales||(typeof require==='function'?require('./card-locales.js'):{});
 const ui=root.DuelUITranslations||(typeof require==='function'?require('./i18n-data.js'):{});
 if(typeof module!=='undefined'&&module.exports){require('./i18n-ai.js');require('./i18n-years.js');require('./i18n-years-gx.js');require('./i18n-polish.js');}
 if(!ui.effectLabels&&typeof require==='function')require('./i18n-effects.js');
 for(const d of Object.values(D.DECKS).filter(d=>d.preset)){const names=ui.deckNames[d.id],descriptions=ui.deckDescriptions[d.id];if(names)ui.messages[d.name]={en:names[0],ja:names[1]};if(descriptions){for(const value of [d.description,d.subtitle,...(d.combo||[])])if(value)ui.messages[value]={en:descriptions[0],ja:descriptions[1]};}}
 const languages=['zh-CN','en','ja'],key='duel-sanctuary-language-v1',unknown=new Set();
 let language='zh-CN';try{const saved=root.localStorage?.getItem(key);if(languages.includes(saved))language=saved;}catch{}
 const proxies=new Map(),deckProxies=new WeakMap(),textCache=new Map(),nodeText=new WeakMap(),nodeAttributes=new WeakMap();
 let namePattern,nameMap,observer,scheduled=false,nativeTexts=new Set();
 const escapeRegExp=v=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function term(value){if(language==='zh-CN')return value;return ui.messages[value]?.[language]||value;}
 const tokenNames={'early-insect-token':['昆虫怪兽衍生物','Insect Monster Token','昆虫モンスタートークン'],'early-kuriboh-token':['栗子球衍生物','Kuriboh Token','クリボートークン'],'early-sheep-token':['羊衍生物','Sheep Token','羊トークン'],'early-slime-token':['史莱姆衍生物','Slime Token','スライムトークン'],'doppel-token':['二重身衍生物','Doppel Token','ドッペル・トークン'],'cry-token':['水晶机巧衍生物','Crystron Token','クリストロントークン']};
 function name(id){const c=D.CARDS[id];if(!c)return '';return cardData[id]?.locales[language]?.name||tokenNames[id]?.[languages.indexOf(language)]||(c.notCollectible?(language==='en'?c.officialName:language==='ja'?'トークン':c.name):c.name);}
 function rebuildNames(){nameMap=new Map();nativeTexts=new Set(Object.values(ui.messages).map(m=>m[language]).filter(Boolean));for(const c of D.CARD_LIST){const target=name(c.id);nativeTexts.add(target);for(const variant of [c.name,c.officialName,c.en,...Object.values(cardData[c.id]?.locales||{}).map(l=>l.name)])if(variant&&variant!==target)nameMap.set(variant,target);}const terms=[...nameMap.keys()].filter(n=>n.length>=3&&!ui.messages[n]).sort((a,b)=>b.length-a.length);namePattern=terms.length?new RegExp(terms.map(escapeRegExp).join('|'),'g'):null;}
 const patterns=(ui.patterns||[]).map(([pattern,en,ja])=>({regex:new RegExp(pattern),en,ja}));
 const phrases=Object.keys(ui.messages).filter(t=>/[\u3400-\u9fff]/.test(t)).sort((a,b)=>b.length-a.length);
 function translated(value){
  const original=String(value??'');if(textCache.has(original))return textCache.get(original);
  const leading=original.match(/^\s*/)?.[0]||'',trailing=original.match(/\s*$/)?.[0]||'',source=original.trim();
  if(!source)return {text:original,untranslated:false};
  let result=source,untranslated=false;
  if(language!=='zh-CN'&&nativeTexts.has(source))result=source;
  else if(language!=='zh-CN'&&ui.messages[source])result=ui.messages[source][language];
  else if(nameMap.has(source))result=nameMap.get(source);
  else if(language==='zh-CN'){if(namePattern)result=source.replace(namePattern,m=>nameMap.get(m));}
  else{
   let matched=false;
   for(const p of patterns){const match=p.regex.exec(source);if(match){result=p[language].replace(/\$(\d+)/g,(_,index)=>{const part=match[Number(index)]||'',localized=part===source?{text:part,untranslated:false}:translated(part);untranslated||=localized.untranslated;return localized.text;});matched=true;break;}}
   if(!matched){const separator=source.includes(' · ')?' · ':source.includes(' / ')?' / ':null;if(separator){const parts=source.split(separator).map(translated);result=parts.map(p=>p.text).join(separator);untranslated=parts.some(p=>p.untranslated);matched=true;}}
   if(!matched&&language==='ja'&&(/[\u3040-\u30ff]/.test(source)&&!/[这张选择对发为来从无你的]/.test(source)||source.replace(/[【】]/g,'').split('／').every(s=>nativeTexts.has(s)))){result=source;matched=true;}
   if(!matched){
    // Dynamic legacy UI is made of short translated fragments; card text is rendered separately.
    const fragments=[];
    const stash=value=>'\uE000'+(fragments.push(value)-1)+'\uE001';
    let protectedText=namePattern?source.replace(namePattern,m=>stash(nameMap.get(m))):source;
    for(const phrase of phrases)if(protectedText.includes(phrase))protectedText=protectedText.split(phrase).join(stash(ui.messages[phrase][language]));
    untranslated=/[\u3400-\u9fff]/.test(protectedText);
    result=protectedText.replace(/\uE000(\d+)\uE001/g,(_,i)=>fragments[Number(i)]);
    if(untranslated)unknown.add(source);
   }
  }
  const answer={text:leading+result+trailing,untranslated};textCache.set(original,answer);return answer;
 }
 const text=value=>translated(value).text;
 function card(id){
  if(proxies.has(id))return proxies.get(id);const base=D.CARDS[id];if(!base)return undefined;
  const proxy=new Proxy(base,{get(target,property){const localized=cardData[id]?.locales[language];if(property==='name')return name(id);if(property==='description')return localized?.description||(target.notCollectible?term('由卡片效果特殊召唤的衍生物；离场后消失。'):target.description);if(property==='pendulumDescription')return localized?.pendulumDescription||target.pendulumDescription;if(property==='race'||property==='attribute')return term(target[property]);if(property==='descriptionLanguage')return language;return Reflect.get(target,property);}});proxies.set(id,proxy);return proxy;
 }
 const cards=new Proxy(D.CARDS,{get:(_,id)=>typeof id==='string'&&D.CARDS[id]?card(id):D.CARDS[id]});
 const searchCache=new Map(),searchNames=new Map();
 function searchName(id){if(!searchNames.has(id)){const c=D.CARDS[id];searchNames.set(id,[id,c?.name,c?.officialName,c?.providerId,...Object.values(cardData[id]?.locales||{}).map(v=>v.name)].join(' ').normalize('NFKC').toLowerCase());}return searchNames.get(id)||'';}
 function searchText(id){if(!searchCache.has(id))searchCache.set(id,[searchName(id),...Object.values(cardData[id]?.locales||{}).flatMap(v=>[v.description,v.pendulumDescription])].join(' ').normalize('NFKC').toLowerCase());return searchCache.get(id)||'';}
 function deck(value){const base=typeof value==='string'?D.DECKS[value]:value;if(!base)return base;if(deckProxies.has(base))return deckProxies.get(base);const proxy=new Proxy(base,{get(target,property){if(language==='zh-CN'||!target.preset)return Reflect.get(target,property);const at=language==='en'?0:1;if(property==='name')return ui.deckNames[target.id]?.[at]||target.name;if(['description','subtitle'].includes(property))return ui.deckDescriptions[target.id]?.[at]||text(target[property]);if(property==='combo')return [ui.deckDescriptions[target.id]?.[at]||text(target.description)];if(property==='mechanic')return text(target.mechanic);if(property==='player'){const r=translated(target.player);return r.untranslated?(language==='en'?'Opponent':'対戦相手'):r.text;}return Reflect.get(target,property);}});deckProxies.set(base,proxy);return proxy;}
 const decks=new Proxy(D.DECKS,{get:(_,id)=>typeof id==='string'&&D.DECKS[id]?deck(id):D.DECKS[id]});
 function player(owner,engine){if(engine?.state?.mode==='spectate')return term(owner===0?'机器人 A':'机器人 B');if(owner===0)return term('你');return engine?deck(engine.deckInfo(owner))?.player||term('对方'):term('对方');}
 const modeWords=[[/negate|protect/,'无效'],[/search|entry/,'检索'],[/revive|return/,'复活'],[/draw/,'抽卡'],[/destroy|wipe|break/,'破坏'],[/banish/,'除外'],[/fusion/,'融合召唤'],[/synchro/,'同调召唤'],[/link/,'连接召唤'],[/special|recruit|summon/,'特殊召唤'],[/boost|gain/,'上升'],[/send|mill/,'送墓'],[/recover/,'回收']];
 function effectLabel(effect){if(!effect)return term('发动效果');const result=translated(effect.label||'发动效果');if(language==='zh-CN'||!result.untranslated)return result.text;const word=modeWords.find(([pattern])=>pattern.test(effect.mode||effect.key||''));return (word?term(word[1]):term('发动效果'))+(effect.id&&D.CARDS[effect.id]?' · '+name(effect.id):'');}
 function actionLabel(action){if(action.type==='activate')return effectLabel(root.DuelEffects?.get(action.key));const r=translated(action.label||'');if(!r.untranslated)return r.text;return term({summon:'通常召唤',set:'盖放',stance:'改变表示',attack:'攻击', 'extra-summon':'额外召唤','pendulum-scale':'设置灵摆刻度','pendulum-summon':'灵摆召唤'}[action.type]||'发动效果');}
 function pendingTitle(p,engine){const r=translated(p.title||'选择卡片');if(language==='zh-CN'||!r.untranslated)return r.text;if(p.purpose==='ritual')return term('仪式召唤')+' · '+name(engine.find(p.uid)?.card.id);if(p.kind==='materials')return term('素材')+' · '+term('选择卡片');const role=p.group?.role,prefix=['cost','send-cost','discard'].includes(role)?term('代价'):p.group?.key==='target'?term('目标'):term('选择卡片');return prefix;}
 function option(option,p,engine){const o={...option};if(o.cardId){o.label=name(o.cardId);const f=engine?.find(o.uid);if(f&&D.isMonster(D.CARDS[f.card.id]))o.detail=(D.CARDS[f.card.id].type==='link'?'LINK '+D.CARDS[f.card.id].linkRating:D.CARDS[f.card.id].type==='xyz'?term('阶级')+' '+D.CARDS[f.card.id].rank:term('等级')+' '+engine.level(f.card))+' · ATK '+engine.attackValue(f.card);else o.detail=text(o.detail||'');}else{o.label=text(o.label||o.uid);o.detail=text(o.detail||'');}return o;}
 const logKinds={turn:'回合',draw:'抽卡',spell:'魔法',trap:'陷阱',effect:'效果',summon:'通常召唤',special:'特殊召唤',ritual:'仪式召唤',fusion:'融合召唤',synchro:'同调召唤',xyz:'超量召唤',link:'连接召唤',pendulum:'灵摆召唤',attack:'攻击',damage:'伤害',heal:'回复',cost:'代价',move:'移动',destroy:'破坏',set:'盖放',reveal:'公开卡片',search:'检索',phase:'阶段',end:'结束回合',victory:'决斗结束',negate:'无效',stance:'改变表示',discard:'丢弃',mill:'送墓',overlay:'叠放素材',return:'返回场上',equip:'装备'};
 function baseLog(entry,engine){if(entry.kind==='victory'&&root.DuelOutcome){const outcome=entry.outcome||root.DuelOutcome.read(engine?.state);if(outcome)return root.DuelOutcome.summary(outcome,{language,names:[player(0,engine),player(1,engine)],cardName:name});}if(language==='zh-CN')return text(entry.text);const r=translated(entry.text);if(!r.untranslated)return r.text;const actor=[0,1].includes(entry.owner)?player(entry.owner,engine)+': ':'',amount=entry.amount??entry.count,unit=['damage','heal','cost'].includes(entry.kind)?' LP':language==='ja'?'枚':' card(s)';return actor+(entry.key?effectLabel(root.DuelEffects?.get(entry.key)):term(logKinds[entry.kind]||'效果'))+(entry.cardId?' · '+name(entry.cardId):'')+(Number.isFinite(amount)?' · '+amount+unit:'');}
 function logEntry(entry,engine,names){const shown=names||[player(0,engine),player(1,engine)];let fallback=baseLog(entry,engine);if([0,1].includes(entry.owner)){const aliases=entry.owner===0?[term('你'),'你',term('机器人 A')]:[engine?.deckInfo(1)?.player,deck(engine?.deckInfo(1))?.player,term('机器人 B')];const prefix=aliases.find(p=>p&&fallback.startsWith(p));if(prefix)fallback=shown[entry.owner]+fallback.slice(prefix.length);}return root.DuelLog?root.DuelLog.describe(entry,{language,names:shown,cardName:name,allVisible:engine?.state.mode==='spectate',fallback}):{text:fallback,cause:'',change:'',cards:[],category:'other'};}
 function log(entry,engine){const view=logEntry(entry,engine);return [view.text,view.cause,view.change,view.materials].filter(Boolean).join(' · ');}
 function error(value){const r=translated(value);return language==='zh-CN'||!r.untranslated?r.text:term('操作未能完成，请检查当前条件和目标。');}
 function picker(){return '<select class="locale-select" data-locale-select data-i18n-skip aria-label="'+esc(term('显示语言'))+'">'+[['zh-CN','中文'],['en','English'],['ja','日本語']].map(([id,label])=>'<option value="'+id+'"'+(id===language?' selected':'')+'>'+label+'</option>').join('')+'</select>';}
 function updateSelectors(){if(!root.document)return;for(const el of document.querySelectorAll('[data-locale-select]')){el.value=language;el.setAttribute('aria-label',term('显示语言'));}document.documentElement.lang=language;document.title=language==='zh-CN'?'游戏王 · 决斗之境 | DUEL SANCTUARY':language==='en'?'Yu-Gi-Oh! · Duel Sanctuary':'遊戯王・デュエル・サンクチュアリ';}
 function setLanguage(value){if(!languages.includes(value))return false;if(language===value)return true;language=value;try{root.localStorage?.setItem(key,language);}catch{}textCache.clear();unknown.clear();rebuildNames();updateSelectors();if(root.dispatchEvent)root.dispatchEvent(new CustomEvent('duel-language-change',{detail:{language}}));apply();return true;}
 function skip(element){return !element||element.closest('script,style,svg,noscript,textarea,[data-i18n-skip],[data-user-content],.pc-name,.pc-description,.pc-pendulum p,.card-name,.card-description,.card-en,.pendulum-description p,.ws-card-name,.library-card h3,.response-option small,.pile-view h3,.pending-source h3,.popover-title,.ws-deck-card strong');}
 function apply(container=root.document?.body){if(!container)return;observer?.disconnect();try{
  const walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode())){if(skip(node.parentElement))continue;const saved=nodeText.get(node),base=saved&&node.nodeValue===saved.rendered?saved.base:node.nodeValue,result=text(base);if(result!==node.nodeValue)node.nodeValue=result;nodeText.set(node,{base,rendered:result});}
  for(const el of container.querySelectorAll('[title],[placeholder],[aria-label],optgroup[label]')){if(skip(el))continue;const saved=nodeAttributes.get(el)||{};for(const attribute of ['title','placeholder','aria-label','label'])if(el.hasAttribute(attribute)){const value=el.getAttribute(attribute),old=saved[attribute],base=old&&value===old.rendered?old.base:value,result=text(base);if(result!==value)el.setAttribute(attribute,result);saved[attribute]={base,rendered:result};}nodeAttributes.set(el,saved);}
 }finally{if(observer)observer.observe(document.body,{childList:true,subtree:true,characterData:true});}updateSelectors();}
 function mount(){if(!root.document)return;updateSelectors();apply();observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;apply();});});observer.observe(document.body,{childList:true,subtree:true,characterData:true});document.addEventListener('change',event=>{if(event.target.matches('[data-locale-select]'))setLanguage(event.target.value);});}
 rebuildNames();
 const API={get language(){return language;},languages,setLanguage,text,translated,term,card,cards,decks,deck,name,searchName,searchText,player,effectLabel,actionLabel,pendingTitle,option,log,logEntry,error,picker,apply,mount,get missingUI(){return [...unknown];},references:cardData};
 root.DuelI18n=API;if(typeof module!=='undefined')module.exports=API;
})(globalThis);
