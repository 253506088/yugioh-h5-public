/* 2013 per-card rules: the Gagaga / Gogogo / Dododo / Zubaba, Star Seraph,
 * Umbral Horror, Malicevorous, Super Defense, Mythic, Lightray, Overlay and
 * ZW volumes. Registered from effects-2013.js. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,C,I,is,A,Q,R,passive,mark,extend,allM,allS,allF,monster,face,ownM,foeM,hand,deck,grave,first,args,self,src,active,field,has,g,choose,target,moved,destroy,pay,once,onEntry,onFlip,onMove,onEnd,onStandby,onDamage,onBattleWin,revive,search,specialChoice,series,guard,defer,card,def,names,effect,cast,watch,sent,aura,ownAura,protect,lock,locked,stat,summonCost,specialSelf}=X,{CARDS}=D;
 const S=cast,T=cast;
 const gagaga=m=>series(m,'Gagaga'),gogogo=m=>series(m,'Gogogo'),dododo=m=>series(m,'Dododo');
 const starseraph=m=>series(m,'Star Seraph'),umbral=m=>series(m,'Umbral Horror'),malice=m=>series(m,'Malicevorous');
 const sdr=m=>series(m,'Super Defense Robot')||is(m,'Orbital 7'),mythic=m=>series(m,'Mythic');
 const utopia=m=>monster(m)&&/Utopia/.test(def(m)?.officialName||'');
 const discardOne=(e,c,pred,after)=>{const list=hand(e,c.owner,pred);if(!list.length)return false;H.discard(e,c,[list[0].uid]);after?.(list[0]);return true;};
 // ==========================================================================
 // Gagaga / Gogogo / Dododo / Zubaba
 // ==========================================================================
 specialSelf('Gagaga Child',(e,c)=>ownM(e,c).some(m=>gagaga(m)&&!is(m,'Gagaga Child')));
 E.on('summon',(e,v)=>{if(CARDS[v.id]?.officialName!=='Gagaga Child'||v.kind!=='special')return;e.state.players[v.owner].skipBattleTurn=e.state.turn;});
 effect('Gagaga Child',(e,c)=>ownM(e,c).filter(m=>gagaga(m)&&e.level(m)>0),(e,c)=>{const m=card(e,first(c));if(m&&self(e,c))self(e,c).levelOverride={value:e.level(m),until:e.state.turn};},{mode:'era-level',onEntry:false,role:'own-boost',condition:(e,c)=>ownM(e,c).filter(m=>gagaga(m)&&e.level(m)>0).length>0,inputs:(e,c)=>[g(e,c,'target','选择复制等级的嘎嘎嘎',ownM(e,c).filter(m=>gagaga(m)&&e.level(m)>0),1,1,'own-boost')]});
 S('Gagagawind',{summons:true,inputs:(e,c)=>[g(e,c,'target','选择特殊召唤的嘎嘎嘎',hand(e,c.owner,gagaga),1,1,'special')],resolve:(e,c)=>{const m=revive(e,c,first(c),{position:'attack'});if(m)m.levelOverride={value:4,until:999999};}});
 S('Gagagatag',{once:H.once('gagagatag','name'),resolve:(e,c)=>{const n=ownM(e,c).filter(m=>m.faceUp&&gagaga(m)).length;for(const m of ownM(e,c).filter(m=>m.faceUp&&gagaga(m)))e.modify(m.uid,'atk','add',500*n,e.state.turn+1,c.source);}});
 specialSelf('Gogogo Gigas',()=>true);
 extend('canSpecial',function(prior,p,m,o={}){if(is(m,'Gogogo Gigas')&&this.find(m.uid)?.zone==='grave'&&this.state.players[p].eraGogogoTurn===this.state.turn)return false;return prior.call(this,p,m,o);});
 E.on('summon',(e,v)=>{if(CARDS[v.id]?.officialName!=='Gogogo Gigas')return;if(!gogogo({id:v.id}))return;if(v.kind==='special')e.state.players[v.owner].skipBattleTurn=e.state.turn;});
 E.on('summon',(e,v)=>{if(!gogogo({id:v.id})||CARDS[v.id]?.officialName==='Gogogo Gigas')return;for(const f of e.refs(v.owner,['grave']))if(f.card.id===I('Gogogo Gigas'))e.addTrigger(f.card.uid,I('Gogogo Gigas')+'::era-gigas',v,{owner:v.owner});});
 R('Gogogo Gigas','era-gigas',{zones:['grave'],label:C('Gogogo Gigas').name,summons:true,once:H.once('gigas'),resolve:(e,c)=>{if(revive(e,c,c.uid,{position:'defense'}))e.state.players[c.owner].eraGogogoTurn=e.state.turn;}});
 C('Gogogo Golem - Golden Form').noNormal=true;
 E.on('summon',(e,v)=>{const m=card(e,v.uid);if(!m||CARDS[v.id]?.officialName!=='Gogogo Golem - Golden Form')return;m.atkOverride=2*(m.eraGoldenAtk||0);m.eraHalfDamage=true;});
 effect('Gogogo Golem - Golden Form',null,(e,c)=>{if(self(e,c))e.modify(c.uid,'atk','add',-1500,null,c.source);lock(e,c.owner,'noMonsterEffects');},{mode:'era-golden',quick:true,role:'own-boost'});
 S('Gogogo Talisman',{resolve:()=>{},zones:['hand'],role:'field'});
 extend('damage',function(prior,p,n,kind,...a){if(kind==='效果'&&this.monsters(p).filter(m=>m.faceUp&&gogogo(m)).length>=2&&has(this,'Gogogo Talisman'))return;return prior.call(this,p,n,kind,...a);});
 passive('Gogogo Talisman',{protect:(e,s,card,battle)=>!!battle&&gogogo(card)&&e.find(s.card.uid)?.owner===e.find(card.uid)?.owner});
 onEntry('Dododo Witch','era-special',{summons:true,inputs:(e,c)=>[g(e,c,'target','选择特殊召唤的怒怒怒',hand(e,c.owner,m=>dododo(m)&&m.id!==c.sourceId),1,1,'special'),H.customGroup('pos','选择表示形式',[{uid:'attack',label:'攻击表示',value:1},{uid:'defense',label:'里侧守备',value:2}],1,1)],resolve:(e,c)=>{const f=e.find(first(c,'target'));if(!f)return;const down=first(c,'pos')==='defense';e.special(f.owner,f.card.uid,{via:'effect',position:down?'defense':'attack'});if(down)e.setPosition(f.card.uid,'defense',c.source,true);}},['normal','special']);
 onFlip('Dododo Swordsman',{resolve:(e,c)=>{const list=allM(e).filter(m=>m.faceUp).slice(0,2);if(list.length)destroy(e,c,list.map(m=>m.uid));}});
 E.on('flip',(e,v)=>{if(CARDS[v.id]?.officialName!=='Dododo Swordsman')return;const m=card(e,v.uid);if(m)m.eraFlipBoost=true;});
 passive('Dododo Swordsman',{stat:(e,s,m,k)=>k==='atk'&&m.uid===s.card.uid&&m.eraFlipBoost?3500:0});
 R('Zubaba General','era-equip',{zones:['extraMonster','monsters'],label:C('Zubaba General').name,once:H.once('zubaba-general'),inputs:(e,c)=>[H.detachInput(e,c,1),g(e,c,'target','选择装备的战士族手牌',hand(e,c.owner,m=>monster(m)&&e.race(m)==='战士族'),1,1,'cost')],cost:(e,c)=>{e.detach(c.uid,args(c,'cost'));e.equipMonster(first(c,'target'),c.uid,c.owner,c.source);},resolve:()=>{}});
 passive('Zubaba General',{stat:(e,s,m,k)=>k==='atk'&&m.uid===s.card.uid?e.activeEquip(m).reduce((n,q)=>n+(CARDS[q.id]?.atk||0),0):0});
 // ==========================================================================
 // Star Seraph
 // ==========================================================================
 onEntry('Star Seraph Scout','era-special',{summons:true,resolve:(e,c)=>specialChoice(e,c,hand(e,c.owner,starseraph))},['normal']);
 effect('Star Seraph Sage',null,(e,c)=>specialChoice(e,c,hand(e,c.owner,starseraph)),{mode:'era-sage',summons:true,once:H.once('sage'),condition:(e,c)=>hand(e,c.owner,m=>CARDS[m.id].type==='spell').length>0,inputs:(e,c)=>[g(e,c,'cost','选择送去墓地的魔法',hand(e,c.owner,m=>CARDS[m.id].type==='spell'),1,1,'cost')],cost:(e,c)=>moved(e,c,args(c,'cost'),'grave','effect-send')});
 effect('Star Seraph Sword',null,(e,c)=>{if(self(e,c))e.modify(c.uid,'atk','add',c.eraBoost||0,e.state.turn,c.source);},{mode:'era-sword',once:H.once('sword'),role:'own-boost',condition:(e,c)=>hand(e,c.owner,starseraph).length>0,inputs:(e,c)=>[g(e,c,'cost','选择送去墓地的星辉士',hand(e,c.owner,starseraph),1,1,'cost')],cost:(e,c)=>{c.eraBoost=e.originalAttack(card(e,first(c,'cost')));moved(e,c,args(c,'cost'),'grave','effect-send');}});
 // ==========================================================================
 // Umbral Horror
 // ==========================================================================
 effect('Umbral Horror Ghoul',null,(e,c)=>{if(self(e,c))e.modify(c.uid,'atk','set',0,null,c.source);const list=hand(e,c.owner,m=>umbral(m)&&(CARDS[m.id].atk||0)===0);if(list.length)specialChoice(e,c,list);},{mode:'era-ghoul',summons:true,once:H.once('ghoul')});
 watch('Umbral Horror Unform','era-recruit','move',(e,v)=>v.to==='grave'&&v.kind==='battle'&&CARDS[v.id]?.officialName==='Umbral Horror Unform',{summons:true,once:H.once('unform'),resolve:(e,c)=>{const list=deck(e,c.owner,umbral);if(list.length)specialChoice(e,c,list.slice(0,2));}},{zones:['monsters']});
 onEntry('Umbral Horror Will o\' the Wisp','era-level',{resolve:(e,c)=>{const other=allM(e).find(m=>m.uid!==c.uid&&umbral(m));if(other&&self(e,c))self(e,c).levelOverride={value:e.level(other),until:e.state.turn};}},['normal','special']);
 watch('Umbral Horror Will o\' the Wisp','era-destroy','move',(e,v)=>v.to==='grave'&&v.kind==='battle'&&CARDS[v.id]?.officialName==='Umbral Horror Will o\' the Wisp',{mandatory:true,resolve:(e,c)=>{const a=c.event.attack?.uid;if(a)destroy(e,c,[a]);}},{zones:['monsters']});
 // ==========================================================================
 // Malicevorous / Super Defense
 // ==========================================================================
 specialSelf('Malicevorous Fork',(e,c)=>hand(e,c.owner,m=>monster(m)&&e.race(m)==='恶魔族'&&m.uid!==c.uid).length>0);
 E.get(I('Malicevorous Fork')+'::gx-special').cost=(e,c)=>H.discard(e,c,[hand(e,c.owner,m=>monster(m)&&e.race(m)==='恶魔族'&&m.uid!==c.uid)[0].uid]);
 onEntry('Malicevorous Knife','era-revive',{summons:true,inputs:(e,c)=>[g(e,c,'target','选择复活的恶意之匙',grave(e,c.owner,m=>malice(m)&&m.id!==c.sourceId),1,1,'special')],resolve:(e,c)=>revive(e,c,first(c))},['normal']);
 watch('Malicevorous Spoon','era-revive','move',(e,v)=>v.to==='grave'||false,{summons:true,once:H.once('spoon'),resolve:()=>{}},{zones:['monsters']});
 E.on('summon',(e,v)=>{if(!malice({id:v.id}))return;for(const f of e.refs(v.owner,['monsters'])){if(f.card.id!==I('Malicevorous Spoon')||f.card.uid===v.uid||CARDS[v.id]?.officialName==='Malicevorous Spoon')continue;e.addTrigger(f.card.uid,I('Malicevorous Spoon')+'::era-revive',v,{owner:v.owner});}});
 R('Malicevorous Spoon','era-revive',{zones:['monsters'],label:C('Malicevorous Spoon').name,summons:true,once:H.once('spoon'),resolve:(e,c)=>{const list=grave(e,c.owner,m=>monster(m)&&e.race(m)==='恶魔族'&&e.level(m)===2);if(!list.length)return;const m=revive(e,c,list[0].uid);if(m)m.effectNegated=true;}});
 onEntry('Super Defense Robot Lio','era-special',{summons:true,resolve:(e,c)=>specialChoice(e,c,hand(e,c.owner,sdr))},['normal']);
 onEntry('Super Defense Robot Elephan','era-special',{summons:true,resolve:(e,c)=>specialChoice(e,c,hand(e,c.owner,sdr))},['normal']);
 effect('Super Defense Robot Elephan',(e,c)=>ownM(e,c).filter(sdr),(e,c)=>{const m=card(e,first(c));if(m)m.levelOverride={value:8,until:e.state.turn};},{mode:'era-level',once:H.once('elephan'),role:'own-boost',inputs:(e,c)=>[g(e,c,'target','选择等级变为8的怪兽',ownM(e,c).filter(sdr),1,1,'own-boost')]});
 onEntry('Super Defense Robot Monki','era-special',{summons:true,resolve:(e,c)=>specialChoice(e,c,hand(e,c.owner,sdr))},['normal']);
 effect('Super Defense Robot Monki',(e,c)=>grave(e,c.owner,sdr),(e,c)=>search(e,c,args(c)),{inputs:(e,c)=>[g(e,c,'cost','选择除外的机械族',grave(e,c.owner,m=>monster(m)&&e.race(m)==='机械族'),1,1,'cost'),g(e,c,'target','选择回收的怪兽',grave(e,c.owner,sdr),1,1,'search')],cost:(e,c)=>moved(e,c,args(c,'cost'),'banished','cost-banish'),mode:'era-monki',once:H.once('monki')});
 // ==========================================================================
 // Mythic / Lightray / Overlay / Galaxy
 // ==========================================================================
 effect('Mythic Tree Dragon',(e,c)=>ownM(e,c).filter(m=>monster(m)&&e.race(m)==='龙族'&&e.hasAttribute(m,'水')),(e,c)=>{const m=card(e,first(c));if(m&&self(e,c))self(e,c).levelOverride={value:e.level(m),until:e.state.turn};},{mode:'era-level',once:H.once('mythic-tree'),role:'own-boost',inputs:(e,c)=>[g(e,c,'target','选择复制等级的水属性龙族',ownM(e,c).filter(m=>monster(m)&&e.race(m)==='龙族'&&e.hasAttribute(m,'水')),1,1,'own-boost')]});
 specialSelf('Mythic Water Dragon',(e,c)=>ownM(e,c).some(m=>monster(m)&&e.hasAttribute(m,'地')));
 specialSelf('Lightray Madoor',(e,c)=>[...grave(e,c.owner),...e.state.players.filter((_,i)=>false)].length>=0&&H.cards(e,c.owner,['banished'],m=>monster(m)&&e.hasAttribute(m,'光')).length>=3);
 specialSelf('Lightray Grepher',(e,c)=>hand(e,c.owner,m=>monster(m)&&e.hasAttribute(m,'光')&&e.level(m)>=5).length>0);
 E.get(I('Lightray Grepher')+'::gx-special').cost=(e,c)=>H.discard(e,c,[hand(e,c.owner,m=>monster(m)&&e.hasAttribute(m,'光')&&e.level(m)>=5)[0].uid]);
 effect('Lightray Grepher',null,(e,c)=>{const list=deck(e,c.owner,m=>monster(m)&&e.hasAttribute(m,'光'));if(list.length)moved(e,c,[list[0].uid],'banished','effect-banish');e.shuffle(e.state.players[c.owner].deck);},{mode:'era-lightray',once:H.once('lightray-grepher'),condition:(e,c)=>hand(e,c.owner,m=>monster(m)&&e.hasAttribute(m,'光')).length>0,cost:(e,c)=>{const d=hand(e,c.owner,m=>monster(m)&&e.hasAttribute(m,'光'))[0];H.discard(e,c,[d.uid]);}});
 extend('destroy',function(prior,uid,source=null,battle=false,extra={}){const m=card(this,uid);if(battle&&m&&is(m,'Lightray Madoor')&&m.eraMadoorTurn!==this.state.turn){m.eraMadoorTurn=this.state.turn;return false;}return prior.call(this,uid,source,battle,extra);});
 specialSelf('Overlay Booster',(e,c)=>ownM(e,c).some(m=>e.attackValue(m)>=2000),{position:'defense'});
 effect('Overlay Booster',null,(e,c)=>{const m=card(e,first(c));if(m)e.modify(m.uid,'atk','add',500*(m.overlays||[]).length,e.state.turn,c.source);},{zones:['grave'],mode:'era-booster',role:'own-boost',inputs:(e,c)=>[g(e,c,'target','选择获得攻击力的超量怪兽',ownM(e,c).filter(m=>CARDS[m.id].type==='xyz'&&(m.overlays||[]).length>0),1,1,'own-boost')],cost:(e,c)=>moved(e,c,[c.uid],'banished','cost-banish')});
 C('Overlay Sentinel').noSpecial=true;
 onEntry('Overlay Sentinel','era-sentinel',{resolve:(e,c)=>{e.setPosition(c.uid,'defense',c.source);}},['normal']);
 effect('Overlay Sentinel',null,(e,c)=>{const m=card(e,first(c));if(m){const n=ownM(e,c).reduce((s,q)=>s+(q.overlays||[]).length,0);e.modify(m.uid,'atk','add',-500*n,null,c.source);}},{zones:['grave'],mode:'era-sentinel-grave',condition:(e,c)=>ownM(e,c).some(m=>CARDS[m.id].type==='xyz'&&(m.overlays||[]).length>0),inputs:(e,c)=>[g(e,c,'target','选择降低攻击力的对方怪兽',foeM(e,c).filter(m=>m.faceUp),1,1,'target')],cost:(e,c)=>moved(e,c,[c.uid],'banished','cost-banish')});
 S('Overlay Capture',{inputs:(e,c)=>[g(e,c,'target','选择夺取素材的对方超量怪兽',foeM(e,c).filter(m=>CARDS[m.id].type==='xyz'&&(m.overlays||[]).length>0),1,1,'target'),g(e,c,'own','选择接收素材的超量怪兽',ownM(e,c).filter(m=>CARDS[m.id].type==='xyz'),1,1,'own-boost')],resolve:(e,c)=>{const t=card(e,first(c,'target')),own=card(e,first(c,'own'));if(!t||!own)return;const mats=[...t.overlays].map(m=>m.uid);if(mats.length)e.detach(t.uid,mats);e.attach(own.uid,c.uid);}});
 extend('canAttack',function(prior,m,p,t){if(is(m,'Galaxy Dragon')){const f=t&&this.find(t);if(!t)return false;if(f&&this.race(f.card)!=='龙族')return false;}return prior.call(this,m,p,t);});
 extend('canDirect',function(prior,m,p){return is(m,'Galaxy Dragon')?false:prior.call(this,m,p);});
 passive('Galaxy Dragon',{battleStat:(e,s,m,stat,battle)=>{if(stat!=='atk')return 0;const f=e.find(m.uid);if(!f||e.race(m)!=='龙族')return 0;if(battle)return 1000;return 0;}});
 // ==========================================================================
 // ZW (equip to a "Utopia" monster)
 // ==========================================================================
 const zwEffect=(name,bonus,extra={})=>{
  C(name).spellKind=undefined;
  effect(name,(e,c)=>ownM(e,c).filter(utopia),(e,c)=>{const t=card(e,first(c));if(t)e.equipMonster(c.uid,t.uid,c.owner,c.source);},{mode:'era-zw-equip',role:'own-boost',inputs:(e,c)=>[g(e,c,'target','选择装备的霍普',ownM(e,c).filter(utopia),1,1,'own-boost')],...extra});
  aura(name,(e,m,s)=>s.card.equipTarget===m.uid,bonus);
 };
 zwEffect('ZW - Sleipnir Mail',1000);
 zwEffect('ZW - Asura Strike',1000);
 effect('ZW - Asura Strike',null,(e,c)=>{const h=card(e,c.uid)?.equipTarget;if(h){const m=card(e,h);if(m)m.bonusAttacks=(m.bonusAttacks||0)+99;}},{mode:'era-asura',zones:['spells'],once:H.once('asura')});
 specialSelf('ZW - Eagle Claw',(e,c)=>e.state.players[1-c.owner].lp-e.state.players[c.owner].lp>=2000);
 effect('ZW - Eagle Claw',(e,c)=>ownM(e,c).filter(utopia),(e,c)=>{const t=card(e,first(c));if(t)e.equipMonster(c.uid,t.uid,c.owner,c.source);},{mode:'era-zw-eagle',role:'own-boost',condition:(e,c)=>ownM(e,c).some(utopia),inputs:(e,c)=>[g(e,c,'target','选择装备的霍普',ownM(e,c).filter(utopia),1,1,'own-boost')]});
 aura('ZW - Eagle Claw',(e,m,s)=>s.card.equipTarget===m.uid,2000);
 watch('ZW - Sleipnir Mail','era-zw-return','move',(e,v)=>v.to==='grave'&&CARDS[v.id]?.officialName==='ZW - Sleipnir Mail',{summons:true,resolve:(e,c)=>{const list=grave(e,c.owner,utopia);if(list.length)revive(e,c,list[0].uid);}},{zones:['grave']});
 // ==========================================================================
 // Heraldic Beast (2013)
 // ==========================================================================
 specialSelf('Heraldic Beast Amphisbaena',(e,c)=>hand(e,c.owner,m=>series(m,'Heraldic Beast')&&m.uid!==c.uid).length>0);
 E.get(I('Heraldic Beast Amphisbaena')+'::gx-special').cost=(e,c)=>H.discard(e,c,[hand(e,c.owner,m=>series(m,'Heraldic Beast')&&m.uid!==c.uid)[0].uid]);
 effect('Heraldic Beast Amphisbaena',null,(e,c)=>{if(self(e,c))e.modify(c.uid,'atk','add',800,e.state.turn,c.source);},{mode:'era-amphis',role:'own-boost',once:H.once('amphis'),condition:(e,c)=>hand(e,c.owner,m=>series(m,'Heraldic Beast')).length>0,cost:(e,c)=>H.discard(e,c,[hand(e,c.owner,m=>series(m,'Heraldic Beast'))[0].uid])});
 // Risebell
 onEntry('Risebell the Star Adjuster','era-boost',{resolve:(e,c)=>{const list=allM(e).filter(m=>m.faceUp);if(list.length)e.addTrigger(c.uid,c.sourceId+'::era-risebell-pick',c.event,{owner:c.owner});}},['special']);
 R('Risebell the Star Adjuster','era-risebell-pick',{zones:['monsters'],label:C('Risebell the Star Adjuster').name,role:'own-boost',inputs:(e,c)=>[g(e,c,'target','选择提升等级的怪兽',allM(e).filter(m=>m.faceUp),1,1,'own-boost'),H.customGroup('n','选择提升的等级',[1,2,3].map(n=>({uid:String(n),label:String(n),value:n})),1,1)],resolve:(e,c)=>{const m=card(e,first(c,'target'));if(m)m.levelOverride={value:e.level(m)+Number(first(c,'n')),until:e.state.turn};}});
 effect('Risebell the Star Psycher',(e,c)=>allM(e).filter(m=>m.faceUp),(e,c)=>{const m=card(e,first(c));if(m)m.levelOverride={value:e.level(m)+1,until:e.state.turn};},{mode:'era-psycher',quick:true,role:'own-boost',inputs:(e,c)=>[g(e,c,'target','选择提升等级的怪兽',allM(e).filter(m=>m.faceUp),1,1,'own-boost')]});
 // Paladin of Photon Dragon: tribute for Galaxy-Eyes, then draw on a battle win.
 effect('Paladin of Photon Dragon',null,(e,c)=>{const list=[...hand(e,c.owner,m=>is(m,'Galaxy-Eyes Photon Dragon')),...deck(e,c.owner,m=>is(m,'Galaxy-Eyes Photon Dragon'))];if(!list.length)return;if(!X.tribute(e,c,[c.uid]))return;revive(e,c,list[0].uid);e.shuffle(e.state.players[c.owner].deck);},{mode:'era-paladin',summons:true,once:H.once('paladin-photon'),inputs:()=>[]});
 onBattleWin('Paladin of Photon Dragon',{resolve:(e,c)=>e.draw(c.owner,1)});
 // Luminous Dragon Ritual's Graveyard half: banish exactly 4 Levels, then Ritual Summon.
 S('Luminous Dragon Ritual',null,null,{mode:'era-luminous',zones:['grave'],purpose:'grave',summons:true,once:H.once('luminous','name'),inputs:(e,c)=>[g(e,c,'cost','选择除外等级合计4的怪兽',grave(e,c.owner,m=>monster(m)&&e.level(m)>=1),1,9,'cost'),g(e,c,'target','选择仪式召唤的光子龙骑士',hand(e,c.owner,m=>is(m,'Paladin of Photon Dragon')),1,1,'special')],cost:(e,c)=>{const picks=args(c,'cost');const total=picks.reduce((n,uid)=>n+e.level(card(e,uid)||0),0);if(total!==4)throw new Error('必须合计恰好4级');moved(e,c,[c.uid,...picks],'banished','cost-banish');},resolve:(e,c)=>revive(e,c,first(c,'target'),{via:'ritual'})});
 if(typeof module!=='undefined')module.exports=X;
})(globalThis);
