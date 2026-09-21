/* 2013 per-card rules: the Vampire, Archfiend, Gorgonic, Traptrix, Coach and
 * Mermail volumes plus their support. Registered from effects-2013.js. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,C,I,is,A,Q,R,passive,mark,extend,allM,allS,allF,monster,face,ownM,foeM,hand,deck,grave,first,args,self,src,active,field,has,g,choose,target,moved,destroy,pay,once,onEntry,onFlip,onMove,onEnd,onStandby,onDamage,onBattleWin,revive,search,specialChoice,series,guard,defer,card,def,names,effect,cast,watch,sent,aura,ownAura,protect,lock,locked,stat,summonCost,specialSelf,quickNegate}=X,{CARDS}=D;
 const S=cast,T=cast;
 const zombie=(e,m)=>monster(m)&&e.race(m)==='不死族',rock=(e,m)=>monster(m)&&e.race(m)==='岩石族';
 const vampire=m=>series(m,'Vampire'),archfiend=m=>series(m,'Archfiend'),gorgonic=m=>series(m,'Gorgonic'),traptrix=m=>series(m,'Traptrix'),mermail=m=>series(m,'Mermail');
 const hole=m=>def(m)?.type==='trap'&&def(m)?.trapKind==='normal'&&/Hole/.test(def(m)?.officialName||'');
 // ==========================================================================
 // Vampire
 // ==========================================================================
 extend('stat',function(prior,m,key,battle){const n=prior.call(this,m,key,battle);if(!has(this,'Vampire Kingdom')||!zombie(this,m)||key!=='atk')return n;const f=this.find(m.uid);if(!f||!battle)return n;return n+500;});
 S('Vampire Kingdom',null,()=>{}, {zones:['hand'],role:'field'});
 effect('Vampire Kingdom',(e,c)=>allF(e).map(f=>f.card),(e,c)=>{const d=hand(e,c.owner,m=>vampire(m)&&e.hasAttribute(m,'暗'))[0]||deck(e,c.owner,m=>vampire(m)&&e.hasAttribute(m,'暗'))[0];if(!d)return;moved(e,c,[d.uid],'grave','effect-send');destroy(e,c,args(c));},{zones:['fieldSpell'],mode:'era-kingdom',once:H.once('kingdom','name'),role:'destroy',condition:(e,c)=>e.state.players[c.owner].eraOppMilled===e.state.turn,inputs:(e,c)=>[g(e,c,'target','选择破坏的场上卡片',allF(e).map(f=>f.card),1,1,'destroy')]});
 E.on('move',(e,v)=>{if(v.from!=='deck'||v.to!=='grave')return;const p=e.state.players[1-v.owner];if(p)p.eraOppMilled=e.state.turn;});
 T('Vampire Takeover',{inputs:(e,c)=>[g(e,c,'target','选择复活的暗属性吸血鬼',grave(e,c.owner,m=>vampire(m)&&e.hasAttribute(m,'暗')),0,1,'special')],condition:(e,c)=>!e.state.players[c.owner].fieldSpell&&ownM(e,c).length>0&&ownM(e,c).every(m=>m.faceUp&&zombie(e,m)),resolve:(e,c)=>{const slot=e.state.players[c.owner].fieldSpell;const d=deck(e,c.owner,m=>is(m,'Vampire Kingdom'))[0];if(d){e.remove(d.uid);e.state.players[c.owner].fieldSpell=e.makeCard(d.id,c.owner);e.state.players[c.owner].fieldSpell.faceUp=true;e.state.originalCardCount=e.physicalCards().filter(m=>CARDS[m.id].type!=='token').length;}if(first(c,'target'))revive(e,c,first(c,'target'),{position:'defense'});}});
 effect('Vampire Grace',null,(e,c)=>{const list=deck(e,c.owner);const pick=c.eraType;const found=list.find(m=>CARDS[m.id].type===pick);if(found)moved(e,c,[found.uid],'grave','effect-send');},{zones:['grave'],mode:'era-grace',once:H.once('grace'),inputs:(e,c)=>[H.customGroup('type','宣言卡的种类',[{uid:'monster',label:'怪兽',value:1},{uid:'spell',label:'魔法',value:2},{uid:'trap',label:'陷阱',value:3}],1,1)],cost:(e,c)=>{c.eraType=first(c,'type');pay(e,c,2000);}});
 effect('Vampire Grace',null,(e,c)=>revive(e,c,c.uid),{zones:['grave'],mode:'era-grace-revive',summons:true,once:H.once('grace-revive'),condition:(e,c)=>e.state.players[c.owner].lp>2000});
 effect('Vampire Sorcerer',null,(e,c)=>{}, {zones:['grave'],mode:'era-sorcerer',once:H.once('sorcerer'),cost:(e,c)=>moved(e,c,[c.uid],'banished','cost-banish'),resolve:(e,c)=>lock(e,c.owner,'vampireFree')});
 sent('Vampire Sorcerer',(e,c)=>{const list=deck(e,c.owner,m=>vampire(m)&&e.hasAttribute(m,'暗'));if(list.length)search(e,c,list);},(e,v)=>v.to==='grave'&&(v.source?.owner??v.owner)!==v.owner);
 onDamage('Vampire Hunter',{resolve:(e,c)=>{const a=c.event.attack,t=a&&card(e,a.uid);if(t&&e.hasAttribute(t,'暗'))destroy(e,c,[t.uid]);}});
 // ==========================================================================
 // Archfiend
 // ==========================================================================
 S('Archfiend Palabyrinth',null,()=>{}, {zones:['hand'],role:'field'});
 aura('Archfiend Palabyrinth',(e,m,s)=>monster(m)&&e.race(m)==='恶魔族'&&e.find(s.card.uid)?.owner===e.find(m.uid)?.owner,500);
 effect('Archfiend Palabyrinth',(e,c)=>ownM(e,c).filter(m=>archfiend(m)&&m.faceUp),(e,c)=>{const t=card(e,first(c,'target'));if(!t)return;const lv=e.level(t);const other=ownM(e,c).find(m=>m.uid!==t.uid&&monster(m)&&e.race(m)==='恶魔族');if(!other)return;moved(e,c,[other.uid],'banished','cost-banish');const pool=[...hand(e,c.owner,archfiend),...deck(e,c.owner,archfiend),...grave(e,c.owner,archfiend)].filter(m=>e.level(m)===lv&&e.canSpecial(c.owner,m,{via:'effect'}));if(pool.length)revive(e,c,pool[0].uid);},{zones:['fieldSpell'],mode:'era-palab',once:H.once('palab','name'),summons:true,condition:(e,c)=>ownM(e,c).filter(m=>m.faceUp&&e.race(m)==='恶魔族').length>=2,inputs:(e,c)=>[g(e,c,'target','选择选择的恶魔怪兽',ownM(e,c).filter(m=>archfiend(m)&&m.faceUp),1,1,'special')]});
 sent('Archfiend Heiress',(e,c)=>search(e,c,deck(e,c.owner,m=>archfiend(m)&&m.id!==c.sourceId)),(e,v)=>v.to==='grave'&&(v.kind==='destroy'||v.kind==='battle'||/^effect-/.test(v.kind||'')),{once:H.once('heiress')});
 specialSelf('Archfiend Commander',(e,c)=>ownM(e,c).some(m=>archfiend(m)||(monster(m)&&/Archfiend/.test(def(m)?.officialName||''))),{position:'attack'});
 E.on('summon',(e,v)=>{if(CARDS[v.id]?.officialName!=='Archfiend Commander'||v.kind!=='special')return;const m=card(e,v.uid);if(m)m.eraNoAttackUntil=e.state.turn;});
 effect('Archfiend Commander',(e,c)=>allM(e).filter(m=>archfiend(m)||/Archfiend/.test(def(m)?.officialName||'')),(e,c)=>{if(first(c))destroy(e,c,[first(c)]);},{mode:'era-commander',summons:false,mandatory:true,inputs:(e,c)=>[g(e,c,'target','选择破坏的恶魔卡片',allF(e).filter(f=>/Archfiend/.test(def(f.card)?.officialName||'')),0,1,'destroy')]});
 onEntry('Archfiend Commander','era-revive',{summons:true,inputs:(e,c)=>[g(e,c,'target','选择复活的6星恶魔',grave(e,c.owner,m=>archfiend(m)&&e.level(m)===6),1,1,'special')],resolve:(e,c)=>revive(e,c,first(c),{position:'defense'})},['normal']);
 sent('Archfiend Cavalry',(e,c)=>{const list=grave(e,c.owner,m=>archfiend(m)&&m.id!==c.sourceId);if(list.length)revive(e,c,list[0].uid);},(e,v)=>v.to==='grave'&&v.kind==='destroy');
 effect('Archfiend Emperor, the First Lord of Horror',null,(e,c)=>destroy(e,c,args(c)),{mode:'era-emperor',once:H.once('emperor'),role:'destroy',inputs:(e,c)=>[g(e,c,'cost','选择除外的恶魔卡片',[...hand(e,c.owner,m=>archfiend(m)||/Archfiend/.test(def(m)?.officialName||'')),...grave(e,c.owner,m=>archfiend(m))],1,1,'cost'),g(e,c,'target','选择破坏的场上卡片',allF(e).map(f=>f.card),1,1,'destroy')],cost:(e,c)=>moved(e,c,args(c,'cost'),'banished','cost-banish')});
 C('Archfiend Emperor, the First Lord of Horror').tributeCount=0;
 extend('tributeCount',function(prior,m){return is(m,'Archfiend Emperor, the First Lord of Horror')?0:prior.call(this,m);});
 E.on('summon',(e,v)=>{if(CARDS[v.id]?.officialName!=='Archfiend Emperor, the First Lord of Horror'||v.kind!=='normal')return;const m=card(e,v.uid);if(m){m.atkOverride=Math.floor((CARDS[m.id].atk||0)/2);m.defOverride=Math.floor((CARDS[m.id].def||0)/2);m.eraEmperorEnd=true;}});
 onEnd('Archfiend Emperor, the First Lord of Horror',{zones:['monsters'],mandatory:true,condition:(e,c)=>self(e,c)?.eraEmperorEnd,resolve:(e,c)=>destroy(e,c,[c.uid])});
 extend('canSpecial',function(prior,p,m,o={}){const d=m&&CARDS[m.id];if(d&&this.monsters(p).some(q=>q.faceUp&&is(q,'Archfiend Emperor, the First Lord of Horror'))&&this.race(m)!=='恶魔族'&&!D.isExtra(d)&&!/Archfiend/.test(d.officialName||''))return false;return prior.call(this,p,m,o);});
 // ==========================================================================
 // Gorgonic
 // ==========================================================================
 onEntry('Gorgonic Cerberus','era-level',{resolve:(e,c)=>{for(const m of ownM(e,c).filter(m=>m.faceUp&&rock(e,m)))m.levelOverride={value:3,until:e.state.turn};}},['normal']);
 watch('Gorgonic Gargoyle','era-special','summon',(e,v)=>v.kind==='normal'&&rock(e,{id:v.id}),{summons:true,resolve:(e,c)=>revive(e,c,c.uid)},{zones:['hand']});
 sent('Gorgonic Golem',(e,c)=>{const a=c.event.attack?.uid,m=a&&card(e,a);if(m)e.modify(m.uid,'atk','set',0,null,c.source);},(e,v)=>v.to==='grave'&&v.kind==='battle');
 effect('Gorgonic Golem',null,(e,c)=>{}, {zones:['grave'],mode:'era-golem',once:H.once('golem'),inputs:(e,c)=>[g(e,c,'target','选择不能发动的对方盖卡',e.refs(1-c.owner,['spells','fieldSpell']).filter(f=>!f.card.faceUp).map(f=>f.card),1,1,'target')],cost:(e,c)=>{moved(e,c,[c.uid],'banished','cost-banish');const m=card(e,first(c));if(m)m.eraCantActivateTurn=e.state.turn;}});
 summonCost('Gorgonic Ghoul',(e,c)=>[],0,{});
 effect('Gorgonic Ghoul',null,(e,c)=>{}, {zones:['hand'],mode:'era-ghoul',summons:true,oncePerTurn:false,condition:(e,c)=>e.state.players[c.owner].lp>300&&ownM(e,c).some(m=>m.faceUp&&is(m,'Gorgonic Ghoul')),cost:(e,c)=>pay(e,c,300),resolve:(e,c)=>revive(e,c,c.uid)});
 R('Gorgonic Guardian','era-zero',{zones:['extraMonster','monsters'],label:C('Gorgonic Guardian').name,quick:true,once:H.once('guardian'),role:'own-boost',inputs:(e,c)=>[H.detachInput(e,c,1),g(e,c,'target','选择攻击力归零的对方怪兽',foeM(e,c).filter(m=>m.faceUp),1,1,'target')],cost:(e,c)=>e.detach(c.uid,args(c,'cost')),resolve:(e,c)=>{const m=card(e,first(c));if(m){e.modify(m.uid,'atk','set',0,e.state.turn,c.source);m.eraNegatedUntil=e.state.turn;}}});
 R('Gorgonic Guardian','era-destroy',{zones:['extraMonster','monsters'],label:C('Gorgonic Guardian').name,once:H.once('guardian-destroy'),role:'destroy',inputs:(e,c)=>[g(e,c,'target','选择攻击力0的怪兽',allM(e).filter(m=>e.attackValue(m)===0),1,1,'destroy')],resolve:(e,c)=>destroy(e,c,args(c))});
 // ==========================================================================
 // Traptrix
 // ==========================================================================
 C('Traptrix Myrmeleo').holeImmune=true;C('Traptrix Atrax').holeImmune=true;C('Traptrix Nepenthes').holeImmune=true;
 onEntry('Traptrix Myrmeleo','era-search',{resolve:(e,c)=>search(e,c,deck(e,c.owner,m=>hole(m)))},['normal']);
 onEntry('Traptrix Myrmeleo','era-pop',{inputs:(e,c)=>[g(e,c,'target','选择破坏的对方魔法／陷阱',e.refs(1-c.owner,['spells','fieldSpell']).map(f=>f.card),1,1,'destroy')],resolve:(e,c)=>destroy(e,c,args(c))},['special']);
 R('Traptrix Nepenthes','era-recruit',{zones:['monsters'],label:C('Traptrix Nepenthes').name,once:H.once('nepenthes'),summons:true,resolve:(e,c)=>{const list=deck(e,c.owner,m=>traptrix(m)&&m.id!==c.sourceId);if(list.length)specialChoice(e,c,list);}});
 E.on('era-activation',(e,v)=>{if(!hole({id:v.id}))return;for(const f of e.refs(v.owner,['monsters']))if(f.card.id===I('Traptrix Nepenthes')&&active(e,f.card))e.addTrigger(f.card.uid,I('Traptrix Nepenthes')+'::era-recruit',v,{owner:v.owner});});
 extend('canActivate',function(prior,e,c){if(CARDS[c.sourceId]?.holeImmune&&c.source?.effectType==='trap'&&CARDS[c.sourceId]?.hole)return false;return prior.call(this,e,c);});
 extend('canUseFromHand',function(prior,e,c){if(CARDS[c.sourceId]?.type==='trap'&&CARDS[c.sourceId]?.hole&&this.monsters(c.owner).some(m=>m.faceUp&&is(m,'Traptrix Atrax')))return true;return prior?prior.call(this,e,c):true;});
 quickNegate('Traptrix Trap Hole Nightmare',()=>true,{condition:(e,c)=>{const l=c.event.window?.chainLast;if(!l||l.owner===c.owner)return false;const m=e.find(l.uid);return !!m&&m.summonTurn===e.state.turn;},resolve:(e,c)=>{const l=e.state.chain.at(-1);if(l){X.negate(e,c);const f=e.find(l.uid);if(f)destroy(e,c,[f.card.uid]);}}});
 // ==========================================================================
 // Coach
 // ==========================================================================
 effect('Coach Soldier Wolfbark',(e,c)=>grave(e,c.owner,m=>e.level(m)===4&&e.race(m)==='兽战士族'&&e.hasAttribute(m,'炎')),(e,c)=>{const m=revive(e,c,first(c),{position:'defense'});if(m)m.effectNegated=true;},{mode:'era-wolfbark',summons:true,once:H.once('wolfbark'),inputs:(e,c)=>[g(e,c,'target','选择复活的4星炎属性兽战士',grave(e,c.owner,m=>e.level(m)===4&&e.race(m)==='兽战士族'&&e.hasAttribute(m,'炎')),1,1,'special')]});
 C('Coach Captain Bearman').tributeCount=0;
 extend('tributeCount',function(prior,m){return is(m,'Coach Captain Bearman')?0:prior.call(this,m);});
 E.on('summon',(e,v)=>{if(CARDS[v.id]?.officialName!=='Coach Captain Bearman'||v.kind!=='normal')return;const m=card(e,v.uid);if(m)m.atkOverride=1300;});
 effect('Coach Captain Bearman',(e,c)=>{for(const m of ownM(e,c).filter(m=>m.faceUp&&e.level(m)===4&&e.race(m)==='兽战士族'))m.levelOverride={value:8,until:e.state.turn};},{mode:'era-bearman',once:H.once('bearman'),role:'own-boost'});
 R('Coach King Giantrainer','era-draw',{zones:['extraMonster','monsters'],label:C('Coach King Giantrainer').name,oncePerTurn:false,role:'search',inputs:(e,c)=>[H.detachInput(e,c,1)],cost:(e,c)=>e.detach(c.uid,args(c,'cost')),resolve:(e,c)=>{const list=e.draw(c.owner,1)||[];if(list.length)e.revealCards(1-c.owner,list,'公开抽到的卡片');if(list.length&&monster(list[0]))X.burn(e,c,800);}});
 E.on('era-activation',()=>{});
 // ==========================================================================
 // Mermail (2013 additions)
 // ==========================================================================
 effect('Mermail Abyssteus',null,(e,c)=>{const list=deck(e,c.owner,m=>mermail(m)&&e.level(m)<=4);if(list.length)search(e,c,list);},{mode:'era-abyssteus-search',zones:['monsters'],once:H.once('abyssteus'),role:'search'});
 effect('Mermail Abyssteus',null,(e,c)=>revive(e,c,c.uid),{zones:['hand'],mode:'era-abyssteus',summons:true,once:H.once('abyssteus-summon'),inputs:(e,c)=>[g(e,c,'cost','选择丢弃的其他水属性怪兽',hand(e,c.owner,m=>m.uid!==c.uid&&e.hasAttribute(m,'水')&&monster(m)),1,1,'cost')],cost:(e,c)=>H.discard(e,c,args(c,'cost'))});
 effect('Mermail Abyssocea',(e,c)=>ownM(e,c).filter(m=>mermail(m)&&m.faceUp),(e,c)=>{const t=card(e,first(c));if(!t)return;const limit=e.level(t);const pool=deck(e,c.owner,m=>mermail(m)&&e.level(m)<=4&&e.level(m)<=limit&&e.canSpecial(c.owner,m,{via:'effect'}));if(pool.length)specialChoice(e,c,pool);},{mode:'era-abyssocea',summons:true,once:H.once('abyssocea'),inputs:(e,c)=>[g(e,c,'target','选择作为等级上限的水精鳞',ownM(e,c).filter(m=>mermail(m)&&m.faceUp),1,1,'special')]});
 effect('Mermail Abyssbalaen',null,(e,c)=>revive(e,c,c.uid),{zones:['hand'],mode:'era-abyssbalaen',summons:true,once:H.once('abyssbalaen'),inputs:(e,c)=>[g(e,c,'cost','选择丢弃的4只水精鳞',hand(e,c.owner,m=>m.uid!==c.uid&&mermail(m)),4,4,'cost')],cost:(e,c)=>H.discard(e,c,args(c,'cost'))});
 effect('Mermail Abyssbalaen',null,(e,c)=>{const n=grave(e,c.owner,mermail).length;const targets=foeM(e,c).slice(0,n);if(!targets.length)return;if(self(e,c))e.modify(c.uid,'atk','add',500,null,c.source);destroy(e,c,targets.map(m=>m.uid));},{mode:'era-abyssbalaen-burn',role:'destroy'});
 effect('Mermail Abyssmander',null,(e,c)=>{const n=c.eraN||1;for(const m of ownM(e,c).filter(mermail))m.levelOverride={value:e.level(m)+n,until:e.state.turn};},{zones:['grave'],mode:'era-abyssmander',once:H.once('abyssmander'),inputs:(e,c)=>[H.customGroup('n','选择提升的等级',[{uid:'1',label:'1',value:1},{uid:'2',label:'2',value:2}],1,1)],cost:(e,c)=>{c.eraN=Number(first(c,'n'));moved(e,c,[c.uid],'banished','cost-banish');}});
 // ==========================================================================
 // Gravekeeper's (2013)
 // ==========================================================================
 onFlip('Gravekeeper\'s Ambusher',{resolve:(e,c)=>{const list=grave(e,1-c.owner);if(list.length)e.putOnDeck(list[0].uid,'bottom',c.source);}});
 sent('Gravekeeper\'s Ambusher',(e,c)=>{const list=grave(e,c.owner,m=>/Necrovalley/.test(def(m)?.officialName||''));if(list.length)search(e,c,list);},(e,v)=>v.to==='grave');
 watch('Gravekeeper\'s Nobleman','era-recruit','move',(e,v)=>v.to==='grave'&&v.kind==='battle'&&CARDS[v.id]?.officialName==='Gravekeeper\'s Nobleman',{summons:true,resolve:(e,c)=>{const list=deck(e,c.owner,m=>/Gravekeeper/.test(def(m)?.officialName||'')&&m.id!==c.sourceId);if(list.length)revive(e,c,list[0].uid,{position:'defense',faceDown:true,shuffle:true});}},{zones:['monsters']});
 R('Gravekeeper\'s Shaman','era-shaman',{zones:['monsters'],label:C('Gravekeeper\'s Shaman').name,mandatory:true,main:false,resolve:()=>{}});
 passive('Gravekeeper\'s Shaman',{stat:(e,s,m,k)=>{if(k!=='def'||m.uid!==s.card.uid)return 0;return grave(e,e.find(s.card.uid)?.owner,m=>/Gravekeeper/.test(def(m)?.officialName||'')).length*200;}});
 if(typeof module!=='undefined')module.exports=X;
})(globalThis);
