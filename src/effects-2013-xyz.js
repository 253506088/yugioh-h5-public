/* 2013 per-card rules: Xyz Monsters from the 2013 slice. Registered from
 * effects-2013.js. Every registration names a real card and uses the shared
 * detach, revive and burn vocabulary rather than inventing its own state. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,C,I,is,A,Q,R,passive,mark,extend,allM,allS,allF,monster,face,ownM,foeM,hand,deck,grave,first,args,self,src,active,field,has,g,choose,target,moved,destroy,pay,once,onEntry,onFlip,onMove,onEnd,onStandby,onDamage,onBattleWin,revive,search,specialChoice,series,guard,defer,card,def,names,isGY,gy,fromField,destroyed,effect,cast,watch,sent,aura,ownAura,protect,lock,locked,stat,xyz,quickNegate}=X,{CARDS}=D;
 const S=cast,T=cast;
 const detachN=(n)=>(e,c)=>[H.detachInput(e,c,n)];
 const spend=(e,c,key='cost')=>e.detach(c.uid,args(c,key));
 const frontM=(e,c)=>foeM(e,c).filter(m=>m.faceUp);
 const mineM=(e,c)=>ownM(e,c).filter(m=>m.faceUp);
 const mats=(c)=>card(c.e, c.uid)?.overlays?.length||0;
 const overlayCount=(e,uid)=>card(e,uid)?.overlays?.length||0;
 // A shared "detach one, do something" shape keeps the many single-material
 // Xyz bodies consistent without hiding their differences.
 const xyzOnce=(name,mode,spec={})=>effect(name,spec.pool,spec.resolve,{...spec,mode,once:H.once(name+'-'+mode),inputs:spec.inputs||detachN(1),cost:(e,c)=>spend(e,c),role:spec.role||'own-boost'});
 const guardMat=(name,fn)=>protect(name,fn);
 // ---------------------------------------------------------------------------
 // Number 42: Galaxy Tomahawk
 xyzOnce('Number 42: Galaxy Tomahawk','era-eagles',{inputs:detachN(2),summons:true,resolve:(e,c)=>{const n=6-ownM(e,c).length;if(n>0)e.createTokens(c.owner,'era-battle-eagle-token',n);lock(e,c.owner,'noBattleDamage');}});
 X.token('era-battle-eagle-token','战鹰衍生物','Battle Eagle Token',6,2000,0,'风','机械族');
 // Number 47: Nightmare Shark
 R('Number 47: Nightmare Shark','era-attach',{zones:['extraMonster','monsters'],label:C('Number 47: Nightmare Shark').name,once:H.once('shark-attach'),inputs:(e,c)=>[g(e,c,'cost','选择作为超量素材的3星水属性',[...hand(e,c.owner,m=>monster(m)&&e.level(m)===3&&e.hasAttribute(m,'水')),...mineM(e,c).filter(m=>e.level(m)===3&&e.hasAttribute(m,'水'))],1,1,'cost')],cost:(e,c)=>{const uid=first(c,'cost');if(e.find(uid)?.zone!=='monsters'&&e.find(uid)?.zone!=='hand')return;e.attach(c.uid,uid,{source:c.source});},resolve:()=>{}});
 E.on('summon',(e,v)=>{if(CARDS[v.id]?.officialName!=='Number 47: Nightmare Shark')return;e.addTrigger(v.uid,I('Number 47: Nightmare Shark')+'::era-attach',v,{owner:v.owner});});
 xyzOnce('Number 47: Nightmare Shark','era-direct',{pool:(e,c)=>mineM(e,c).filter(m=>e.hasAttribute(m,'水')),inputs:(e,c)=>[...detachN(1)(e,c),g(e,c,'target','选择可以直击的水属性怪兽',mineM(e,c).filter(m=>e.hasAttribute(m,'水')),1,1,'own-boost')],resolve:(e,c)=>{const m=card(e,first(c,'target'));if(m){m.directUntil=e.state.turn;lock(e,c.owner,'attacksOnly',first(c,'target'));}}});
 // King of the Feral Imps
 xyzOnce('King of the Feral Imps','era-search',{role:'search',resolve:(e,c)=>search(e,c,deck(e,c.owner,m=>monster(m)&&e.race(m)==='爬虫类族'))});
 // Gauntlet Launcher
 effect('Gauntlet Launcher',frontM,(e,c)=>destroy(e,c,args(c)),{mode:'era-launch',detach:1,role:'destroy',inputs:(e,c)=>[...detachN(1)(e,c),g(e,c,'target','选择破坏的对方怪兽',frontM(e,c),1,1,'destroy')]});
 // CXyz Dark Fairy Cheer Girl
 sent('CXyz Dark Fairy Cheer Girl',(e,c)=>e.draw(c.owner,1),isGY);
 onBattleWin('CXyz Dark Fairy Cheer Girl',{condition:(e,c)=>!!self(e,c)&&(card(e,c.uid)?.overlays||[]).some(m=>is(m,'Fairy Cheer Girl')),detach:1,resolve:(e,c)=>{X.burn(e,c,400*hand(e,c.owner).length);}});
 // Shark Fortress
 extend('attackTargets',function(prior,m,p=this.state.active){let list=prior.call(this,m,p);const fortress=allM(this).find(q=>q.faceUp&&is(q,'Shark Fortress'));if(!fortress||this.find(fortress.uid)?.owner===p)return list;return list.filter(uid=>uid===fortress.uid);});
 xyzOnce('Shark Fortress','era-second',{pool:(e,c)=>mineM(e,c),inputs:(e,c)=>[...detachN(1)(e,c),g(e,c,'target','选择可以再攻击的怪兽',mineM(e,c),1,1,'own-boost')],resolve:(e,c)=>{const m=card(e,first(c,'target'));if(m)m.bonusAttacks=(m.bonusAttacks||0)+1;}});
 // Fairy Cheer Girl
 xyzOnce('Fairy Cheer Girl','era-draw',{role:'search',resolve:(e,c)=>e.draw(c.owner,1)});
 // Number 105: Battlin' Boxer Star Cestus
 Q('Number 105: Battlin\' Boxer Star Cestus','era-cestus',{zones:['extraMonster','monsters'],main:false,once:H.once('cestus'),condition:(e,c)=>{const a=e.state.frame?.attack;if(!a)return false;const mine=a.owner===c.owner?a.uid:a.target,m=card(e,mine);return !!m&&series(m,'Battlin\' Boxer');},inputs:(e,c)=>[H.detachInput(e,c,1)],cost:(e,c)=>spend(e,c),resolve:(e,c)=>{const a=e.state.frame?.attack;if(!a)return;const foe=card(e,a.owner===c.owner?a.target:a.uid);if(foe)foe.eraNegatedUntil=e.state.turn;}});
 // Harpie's Pet Phantasmal Dragon
 extend('canDirect',function(prior,m,p=this.state.active){return is(m,'Harpie\'s Pet Phantasmal Dragon')&&overlayCount(this,m.uid)>0?true:prior.call(this,m,p);});
 extend('attackTargets',function(prior,m,p=this.state.active){let list=prior.call(this,m,p);if(!allM(this).some(q=>q.faceUp&&is(q,'Harpie\'s Pet Phantasmal Dragon')&&overlayCount(this,q.uid)>0))return list;return list.filter(uid=>{const f=this.find(uid);return !f||!series(f.card,'Harpie')||uid===m.uid;});});
 onEnd('Harpie\'s Pet Phantasmal Dragon',{zones:['extraMonster','monsters'],mandatory:true,condition:(e,c)=>overlayCount(e,c.uid)>0,resolve:(e,c)=>{const m=card(e,c.uid);if(m)e.detach(c.uid,[m.overlays[0].uid]);}});
 // Ice Beast Zerofyne
 xyzOnce('Ice Beast Zerofyne','era-negate-all',{resolve:(e,c)=>{let n=-1;for(const f of allF(e)){if(f.faceUp===false)continue;const m=card(e,f.uid);if(m&&e.find(f.uid)?.owner!==c.owner)m.eraNegatedUntil=e.state.turn+1;n++;}if(self(e,c))e.modify(c.uid,'atk','add',300*Math.max(0,n),null,c.source);}});
 // Number 107: Galaxy-Eyes Tachyon Dragon
 R('Number 107: Galaxy-Eyes Tachyon Dragon','era-tachyon',{zones:['extraMonster','monsters'],label:C('Number 107: Galaxy-Eyes Tachyon Dragon').name,once:H.once('tachyon'),inputs:(e,c)=>[H.detachInput(e,c,1)],cost:(e,c)=>spend(e,c),resolve:(e,c)=>{for(const m of allM(e))if(m.uid!==c.uid&&m.faceUp)m.eraNegatedUntil=e.state.turn;const s=self(e,c);if(s){s.bonusAttacks=(s.bonusAttacks||0)+1;s.eraTachyonTurn=e.state.turn;}}});
 E.on('phase',(e,v)=>{if(v.phase!=='battle')return;const m=allM(e).find(q=>q.faceUp&&is(q,'Number 107: Galaxy-Eyes Tachyon Dragon')&&overlayCount(e,q.uid)>0);if(m)e.addTrigger(m.uid,I('Number 107: Galaxy-Eyes Tachyon Dragon')+'::era-tachyon',v,{owner:e.find(m.uid).owner});});
 // Number C106: Giant Red Hand
 xyzOnce('Number C106: Giant Red Hand','era-seal',{quick:true,condition:(e,c)=>!e.state.chain.length&&(card(e,c.uid)?.overlays||[]).some(m=>/^Number/.test(def(m)?.officialName||'')),resolve:(e,c)=>{for(const m of allM(e))if(m.uid!==c.uid&&m.faceUp)m.eraNegatedUntil=e.state.turn;for(const s of allS(e))if(s.faceUp&&s.uid!==c.uid)s.eraNegatedUntil=e.state.turn;}});
 // Herald of Pure Light
 xyzOnce('Herald of Pure Light','era-recover',{pool:(e,c)=>grave(e,c.owner,monster),role:'search',inputs:(e,c)=>[...detachN(1)(e,c),g(e,c,'target','选择回收的墓地怪兽',grave(e,c.owner,monster),1,1,'search'),g(e,c,'cost','选择洗回卡组的手牌',hand(e,c.owner),1,1,'cost')],cost:(e,c)=>{spend(e,c);moved(e,c,args(c,'cost'),'deck','cost-return');e.shuffle(e.state.players[c.owner].deck);},resolve:(e,c)=>moved(e,c,args(c,'target'),'hand','effect-return')});
 // Number 104: Masquerade
 R('Number 104: Masquerade','era-mill',{zones:['extraMonster','monsters'],label:C('Number 104: Masquerade').name,once:H.once('masquerade'),resolve:(e,c)=>{const p=e.state.players[1-c.owner];if(p.deck.length)moved(e,c,[p.deck[p.deck.length-1].uid],'grave','effect-send');}});
 Q('Number 104: Masquerade','era-battle-negate',{zones:['extraMonster','monsters'],main:false,condition:(e,c)=>!!c.event.window?.chainLast&&c.event.window.chainLast.owner!==c.owner,inputs:(e,c)=>[H.detachInput(e,c,1)],cost:(e,c)=>spend(e,c),resolve:(e,c)=>{X.negate(e,c);X.burn(e,c,800);}});
 // Ice Princess Zereort
 effect('Ice Princess Zereort',frontM,(e,c)=>{const m=card(e,first(c,'target'));if(m)e.modify(m.uid,'atk','set',0,e.state.turn,c.source);},{mode:'era-zero',detach:1,role:'own-boost',inputs:(e,c)=>[...detachN(1)(e,c),g(e,c,'target','选择攻击力归零的对方怪兽',frontM(e,c),1,1,'target')]});
 // Shark Caesar
 xyzOnce('Shark Caesar','era-counter',{resolve:(e,c)=>{const s=self(e,c);if(s)s.eraSharkCounters=(s.eraSharkCounters||0)+1;}});
 passive('Shark Caesar',{battleStat:(e,s,m,stat,battle)=>{if(stat!=='atk'||m.uid!==s.card.uid||!battle)return 0;return (m.eraSharkCounters||0)*1000;}});
 // Starliege Lord Galaxion
 effect('Starliege Lord Galaxion',null,(e,c)=>{const n=args(c,'count').length;const from=n>=2?'deck':'hand';const list=(from==='deck'?deck(e,c.owner):hand(e,c.owner)).filter(m=>is(m,'Galaxy-Eyes Photon Dragon'));if(list.length)revive(e,c,list[0].uid,{shuffle:from==='deck'});},{mode:'era-galaxion',summons:true,role:'special',inputs:(e,c)=>[H.detachInput(e,c,1)],condition:(e,c)=>[hand(e,c.owner,m=>is(m,'Galaxy-Eyes Photon Dragon')),deck(e,c.owner,m=>is(m,'Galaxy-Eyes Photon Dragon'))].some(l=>l.length)});
 // Number C104: Umbral Horror Masquerade
 effect('Number C104: Umbral Horror Masquerade',allS,(e,c)=>destroy(e,c,args(c)),{mode:'era-c104-entry',detach:1,role:'destroy',inputs:(e,c)=>[H.detachInput(e,c,1),g(e,c,'target','选择破坏的魔法／陷阱',allS(e),1,1,'destroy')],summons:false});
 E.on('summon',(e,v)=>{if(CARDS[v.id]?.officialName!=='Number C104: Umbral Horror Masquerade')return;e.addTrigger(v.uid,I('Number C104: Umbral Horror Masquerade')+'::era-c104-entry',v,{owner:v.owner});});
 xyzOnce('Number C104: Umbral Horror Masquerade','era-halve',{quick:true,condition:(e,c)=>!!(card(e,c.uid)?.overlays||[]).some(m=>is(m,'Number 104: Masquerade')),resolve:(e,c)=>{const p=e.state.players[1-c.owner];const h=p.hand;if(h.length){const pick=h[Math.floor(e.random()*h.length)];moved(e,c,[pick.uid],'grave','effect-discard');p.lp=Math.floor(p.lp/2);}}});
 // Number 102: Star Seraph Sentry
 effect('Number 102: Star Seraph Sentry',frontM,(e,c)=>{const m=card(e,first(c,'target'));if(m){e.modify(m.uid,'atk','mul',0.5,e.state.turn,c.source);m.eraNegatedUntil=e.state.turn;}},{mode:'era-halve',detach:1,role:'own-boost',inputs:(e,c)=>[...detachN(1)(e,c),g(e,c,'target','选择减半的对方怪兽',frontM(e,c),1,1,'target')]});
 guardMat('Number 102: Star Seraph Sentry',(e,m)=>{const host=e.find(m.uid)?.card;if(!host?.overlays?.length)return false;e.detach(m.uid,host.overlays.map(q=>q.uid));lock(e,e.find(m.uid).owner,'halfBattleDamage');return true;});
 // Number 66: Master Key Beetle
 effect('Number 66: Master Key Beetle',(e,c)=>e.refs(c.owner,['monsters','spells','fieldSpell']).filter(f=>f.card.uid!==c.uid).map(f=>f.card),(e,c)=>{const m=card(e,first(c,'target'));if(m)m.eraKeyProtected=true;},{mode:'era-key',detach:1,role:'own-boost',inputs:(e,c)=>[...detachN(1)(e,c),g(e,c,'target','选择效果破坏保护的自方卡',e.refs(c.owner,['monsters','spells','fieldSpell']).filter(f=>f.card.uid!==c.uid).map(f=>f.card),1,1,'own-boost')]});
 extend('destroy',function(prior,uid,source=null,battle=false,extra={}){const m=card(this,uid);if(!battle&&m?.eraKeyProtected)return false;return prior.call(this,uid,source,battle,extra);});
 // Googly-Eyes Drum Dragon
 effect('Googly-Eyes Drum Dragon',null,(e,c)=>{if(self(e,c))e.modify(c.uid,'atk','add',1000,e.state.turn+2,c.source);},{mode:'era-pump',detach:1,role:'own-boost',inputs:detachN(1)});
 sent('Googly-Eyes Drum Dragon',(e,c)=>{const list=grave(e,c.owner,m=>series(m,'Super Defense Robot'));if(!list.length)return;moved(e,c,[list[0].uid],'banished','effect-banish');const r=revive(e,c,c.uid,{position:'defense'});if(r)e.attach(r.uid,list[1]?.uid||list[0].uid);},(e,v)=>v.to==='grave'&&v.kind==='destroy',{condition:()=>true});
 // Number C39: Utopia Ray Victory
 extend('battleLocked',function(prior,p,attack){const m=attack&&allM(this).find(q=>is(q,'Number C39: Utopia Ray Victory'));if(m&&this.find(m.uid)?.owner===p)return true;return prior.call(this,p,attack);});
 xyzOnce('Number C39: Utopia Ray Victory','era-victory',{condition:(e,c)=>!!(card(e,c.uid)?.overlays||[]).some(m=>/Utopia/.test(def(m)?.officialName||''))});
 effect('Number C39: Utopia Ray Victory',frontM,(e,c)=>{const m=card(e,first(c,'target'));if(m){m.eraNegatedUntil=e.state.turn;if(self(e,c))e.modify(c.uid,'atk','add',e.attackValue(m),e.state.turn,c.source);}},{mode:'era-victory-gain',detach:1,role:'own-boost',inputs:(e,c)=>[...detachN(1)(e,c),g(e,c,'target','选择攻击宣言的对方怪兽',frontM(e,c),1,1,'target')]});
 // Number C105: Battlin' Boxer Comet Cestus
 onBattleWin('Number C105: Battlin\' Boxer Comet Cestus',{resolve:(e,c)=>X.burn(e,c,Math.floor((CARDS[c.event.victim?.id]?.atk||0)/2))});
 effect('Number C105: Battlin\' Boxer Comet Cestus',frontM,(e,c)=>{const m=card(e,first(c,'target'));if(!m)return;const atk=e.attackValue(m);if(destroy(e,c,[m.uid]))X.burn(e,c,atk);},{mode:'era-comet',detach:1,role:'destroy',condition:(e,c)=>!!(card(e,c.uid)?.overlays||[]).some(m=>is(m,'Number 105: Battlin\' Boxer Star Cestus')),inputs:(e,c)=>[...detachN(1)(e,c),g(e,c,'target','选择破坏的对方怪兽',frontM(e,c),1,1,'destroy')]});
 // Giant Soldier of Steel
 extend('unaffected',function(prior,m,source){if(m&&is(m,'Giant Soldier of Steel')&&source?.effectType==='monster')return true;return prior.call(this,m,source);});
 guardMat('Giant Soldier of Steel',(e,m,s)=>{const f=e.find(m.uid);if(!f)return false;const host=f.card;if(!is(m,'Giant Soldier of Steel')||!host?.overlays?.length)return false;e.detach(m.uid,[host.overlays[0].uid]);e.modify(m.uid,'def','add',1000,e.state.turn,s.card);lock(e,f.owner,'noEffectDamage');return false;});
 extend('damage',function(prior,p,n,kind,...a){if(kind==='效果'&&locked(this,p,'noEffectDamage'))return;return prior.call(this,p,n,kind,...a);});
 // Infernal Flame Vixen
 xyzOnce('Infernal Flame Vixen','era-pump',{resolve:(e,c)=>{if(self(e,c))e.modify(c.uid,'atk','add',500,e.state.turn+1,c.source);}});
 sent('Infernal Flame Vixen',(e,c)=>{const list=[];for(const p of [0,1])list.push(...grave(e,p).slice(0,3));if(list.length)moved(e,c,list.slice(0,3).map(m=>m.uid),'banished','effect-banish');},(e,v)=>v.to==='grave'&&v.kind==='destroy',{condition:(e,c)=>true});
 E.on('move',(e,v)=>{if(v.to!=='grave'||v.kind!=='destroy'||CARDS[v.id]?.officialName!=='Infernal Flame Vixen')return;const host=card(e,v.uid);const atk=host?.mods?.reduce((n,q)=>n+(q.stat==='atk'&&q.kind==='add'?(q.value||0):0),CARDS[v.id].atk||0)||CARDS[v.id].atk;if((atk||0)>=2500)e.addTrigger(v.uid,I('Infernal Flame Vixen')+'::era-banish-three',v,{owner:v.owner,mandatory:true});});
 R('Infernal Flame Vixen','era-banish-three',{zones:['grave'],label:C('Infernal Flame Vixen').name,mandatory:true,resolve:(e,c)=>{const list=[];for(const p of [0,1])list.push(...grave(e,p));if(list.length)moved(e,c,list.slice(0,3).map(m=>m.uid),'banished','effect-banish');}});
 // Totem Bird
 extend('stat',function(prior,m,stat,battle){const n=prior.call(this,m,stat,battle);if(stat!=='atk'||!is(m,'Totem Bird')||overlayCount(this,m.uid)>0)return n;return Math.max(0,n-300);});
 quickNegate('Totem Bird','spell/trap',{detach:2});
 // Divine Dragon Knight Felgrand
 effect('Divine Dragon Knight Felgrand',allM,(e,c)=>{const m=card(e,first(c,'target'));if(m){m.eraNegatedUntil=e.state.turn;m.eraFelgrandProtected=e.state.turn;}},{mode:'era-felgrand',detach:1,role:'own-boost',quick:true,inputs:(e,c)=>[...detachN(1)(e,c),g(e,c,'target','选择效果无效但不受其他效果的表侧怪兽',allM(e).filter(m=>m.faceUp),1,1,'target')]});
 extend('unaffected',function(prior,m,source){if(m?.eraFelgrandProtected===this.state.turn&&source?.uid!==undefined)return true;return prior.call(this,m,source);});
 // Number 46: Dragluon
 effect('Number 46: Dragluon',null,(e,c)=>{const p=c.eraPick;if(p==='hand'){const list=hand(e,c.owner,m=>monster(m)&&e.race(m)==='龙族');if(list.length)specialChoice(e,c,list);}else if(p==='steal'){const list=foeM(e,c).filter(m=>e.race(m)==='龙族');if(list.length)e.takeControl(list[0].uid,c.owner,{source:c.source});}else lock(e,1-c.owner,'noDragonEffects');},{mode:'era-dragluon',summons:true,once:H.once('dragluon'),condition:(e,c)=>ownM(e,c).length===1,inputs:(e,c)=>[H.detachInput(e,c,1),H.customGroup('pick','选择龙神的效果',[{uid:'hand',label:'从手牌特殊召唤龙族',value:1},{uid:'steal',label:'夺取对方龙族',value:2},{uid:'lock',label:'对方龙族效果无效',value:3}],1,1)],cost:(e,c)=>{c.eraPick=first(c,'pick');spend(e,c);}});
 // Number 65: Djinn Buster
 quickNegate('Number 65: Djinn Buster','monster',{detach:2,resolve:(e,c)=>{X.negate(e,c);X.burn(e,c,500);}});
 // Number C65: King Overfiend
 xyzOnce('Number C65: King Overfiend','era-weaken',{pool:frontM,inputs:(e,c)=>[...detachN(1)(e,c),g(e,c,'target','选择弱化的对方怪兽',frontM(e,c),1,1,'target')],resolve:(e,c)=>{const m=card(e,first(c,'target'));if(m){e.modify(m.uid,'atk','add',-1000,e.state.turn,c.source);e.modify(m.uid,'def','add',-1000,e.state.turn,c.source);}}});
 // Number 64: Ronin Raccoon Sandayu
 X.token('era-kagemusha-token','影武者浣熊衍生物','Kagemusha Raccoon Token',1,0,0,'地','兽族');
 xyzOnce('Number 64: Ronin Raccoon Sandayu','era-token',{summons:true,resolve:(e,c)=>{const best=allM(e).reduce((n,m)=>Math.max(n,e.attackValue(m)),0);const list=e.createTokens(c.owner,'era-kagemusha-token',1)||[];for(const t of list)e.modify(t.uid,'atk','set',best,null,c.source);}});
 guardMat('Number 64: Ronin Raccoon Sandayu',(e,m)=>{const f=e.find(m.uid);if(!f||!is(m,'Number 64: Ronin Raccoon Sandayu'))return false;return e.monsters(f.owner).some(q=>q.uid!==m.uid&&q.faceUp&&e.race(q)==='兽族');});
 // Meliae of the Trees
 xyzOnce('Meliae of the Trees','era-meliae',{summons:true,role:'special',inputs:(e,c)=>[H.detachInput(e,c,1),H.customGroup('pick','选择森之精的效果',[{uid:'mill',label:'送去墓地的植物族',value:1},{uid:'revive',label:'复活的植物族',value:2}],1,1)],cost:(e,c)=>{c.eraPick=first(c,'pick');spend(e,c);},resolve:(e,c)=>{if(c.eraPick==='mill'){const list=deck(e,c.owner,m=>monster(m)&&e.race(m)==='植物族');if(list.length)moved(e,c,[list[0].uid],'grave','effect-send');}else{const list=grave(e,c.owner,m=>monster(m)&&e.race(m)==='植物族'&&e.canSpecial(c.owner,m,{via:'revive'}));if(list.length)revive(e,c,list[0].uid,{position:'defense'});}}});
 // Number C96: Dark Storm
 extend('destroy',function(prior,uid,source=null,battle=false,extra={}){if(battle&&is(card(this,uid),'Number C96: Dark Storm'))return false;return prior.call(this,uid,source,battle,extra);});
 extend('damage',function(prior,p,n,kind,...a){const b=this.state.frame?.attack;if(kind==='战斗'&&b){const m=this.find(b.uid),t=this.find(b.target);if((m&&is(m.card,'Number C96: Dark Storm'))||(t&&is(t.card,'Number C96: Dark Storm'))){prior.call(this,p,n,kind,...a);return prior.call(this,1-p,n,kind,...a);}}return prior.call(this,p,n,kind,...a);});
 effect('Number C96: Dark Storm',frontM,(e,c)=>{const m=card(e,first(c,'target'));if(m){const atk=e.originalAttack(m);e.modify(m.uid,'atk','set',0,e.state.turn,c.source);if(self(e,c))e.modify(c.uid,'atk','add',atk,e.state.turn,c.source);}},{mode:'era-darkstorm',detach:1,quick:true,role:'own-boost',condition:(e,c)=>!!(card(e,c.uid)?.overlays||[]).some(m=>is(m,'Number 96: Dark Mist')),inputs:(e,c)=>[...detachN(1)(e,c),g(e,c,'target','选择攻击力归零的对方怪兽',frontM(e,c),1,1,'target')]});
 // Number 49: Fortune Tune
 onStandby('Number 49: Fortune Tune',{zones:['extraMonster','monsters'],resolve:(e,c)=>e.heal(c.owner,500)});
 extend('canTarget',function(prior,e,c,uid){if(is(card(e,uid),'Number 49: Fortune Tune'))return false;return prior.call(this,e,c,uid);});
 guardMat('Number 49: Fortune Tune',(e,m)=>{const f=e.find(m.uid);if(!is(m,'Number 49: Fortune Tune')||!f?.card.overlays?.length)return false;e.detach(m.uid,[f.card.overlays[0].uid]);return true;});
 sent('Number 49: Fortune Tune',(e,c)=>{const list=grave(e,c.owner,m=>monster(m)&&e.level(m)===3).slice(0,2);if(list.length<2)return;moved(e,c,list.map(m=>m.uid),'deck','effect-return');e.shuffle(e.state.players[c.owner].deck);if(e.find(c.uid)?.zone==='grave')moved(e,c,[c.uid],'extra','effect-return');},isGY,{once:H.once('fortune-tune')});
 // Number 72: Shogi Rook
 R('Number 72: Shogi Rook','era-rook',{zones:['extraMonster','monsters'],label:C('Number 72: Shogi Rook').name,once:H.once('rook'),role:'destroy',inputs:(e,c)=>[H.detachInput(e,c,2),g(e,c,'target','选择破坏的对方怪兽',frontM(e,c),1,1,'destroy'),g(e,c,'set','选择破坏的对方盖卡',e.refs(1-c.owner,['spells','fieldSpell']).filter(f=>!f.card.faceUp).map(f=>f.card),1,1,'destroy')],cost:(e,c)=>spend(e,c),resolve:(e,c)=>{destroy(e,c,[...args(c,'target'),...args(c,'set')]);lock(e,1-c.owner,'halfBattleDamage');}});
 // Number 87: Queen of the Night
 effect('Number 87: Queen of the Night',null,(e,c)=>{const p=c.eraPick;if(p==='block'){const m=card(e,first(c,'target'));if(m)m.eraCantActivateTurn=e.state.turn;}else if(p==='plant'){e.setPosition(first(c,'target'),'defense',c.source,true);}else{const m=card(e,first(c,'target'));if(m)e.modify(m.uid,'atk','add',300,e.state.turn,c.source);}},{mode:'era-queen',detach:1,quick:true,inputs:(e,c)=>[H.detachInput(e,c,1),H.customGroup('pick','选择夜之女王的效果',[{uid:'block',label:'盖卡不能发动',value:1},{uid:'plant',label:'植物族变里侧',value:2},{uid:'boost',label:'怪兽攻击力上升',value:3}],1,1),g(e,c,'target','选择对象',[...e.refs(1-c.owner,['spells','fieldSpell']).filter(f=>!f.card.faceUp).map(f=>f.card),...allM(e)],0,1,'target')],cost:(e,c)=>{c.eraPick=first(c,'pick');spend(e,c);}});
 // Number 63: Shamoji Soldier
 effect('Number 63: Shamoji Soldier',null,(e,c)=>{if(c.eraPick==='draw'){e.state.players[c.owner].eraShamojiDraw=e.state.turn;}else for(const p of [0,1])e.heal(p,1000);},{mode:'era-shamoji',detach:1,once:H.once('shamoji'),inputs:(e,c)=>[H.detachInput(e,c,1),H.customGroup('pick','选择饭勺战士的效果',[{uid:'draw',label:'双方各抽1张',value:1},{uid:'heal',label:'双方各回复1000',value:2}],1,1)],cost:(e,c)=>{c.eraPick=first(c,'pick');spend(e,c);}});
 onStandby('Number 63: Shamoji Soldier',{zones:['extraMonster','monsters'],resolve:(e,c)=>{if(e.state.players[c.owner].eraShamojiDraw===e.state.turn){for(const p of [0,1])e.draw(p,1);delete e.state.players[c.owner].eraShamojiDraw;}}});
 // Number 48: Shadow Lich
 X.token('era-phantom-token','幻影衍生物','Phantom Token',1,500,500,'暗','恶魔族');
 effect('Number 48: Shadow Lich',null,(e,c)=>e.createTokens(c.owner,'era-phantom-token',1),{mode:'era-phantom',detach:1,summons:true,quick:true,once:H.once('shadow-lich'),inputs:detachN(1)});
 passive('Number 48: Shadow Lich',{stat:(e,s,m,k)=>k==='atk'&&m.uid===s.card.uid?ownM(e,{owner:e.find(s.card.uid)?.owner}).filter(q=>q.id==='era-phantom-token').length*500:0});
 extend('attackTargets',function(prior,m,p=this.state.active){let list=prior.call(this,m,p);const lich=allM(this).find(q=>q.faceUp&&is(q,'Number 48: Shadow Lich')&&ownM(this,{owner:this.find(q.uid)?.owner}).some(t=>t.id==='era-phantom-token'));if(!lich||this.find(lich.uid)?.owner===p)return list;return list.filter(uid=>uid!==lich.uid);});
 // Full Armored Black Ray Lancer
 extend('attackValue',function(prior,m){const n=prior.call(this,m);return is(m,'Full Armored Black Ray Lancer')?n+200*overlayCount(this,m.uid):n;});
 guardMat('Full Armored Black Ray Lancer',(e,m)=>{const f=e.find(m.uid);if(!is(m,'Full Armored Black Ray Lancer')||!f?.card.overlays?.length)return false;e.detach(m.uid,f.card.overlays.map(q=>q.uid));return true;});
 onBattleWin('Full Armored Black Ray Lancer',{role:'destroy',inputs:(e,c)=>[g(e,c,'target','选择破坏的对方魔法／陷阱',e.refs(1-c.owner,['spells','fieldSpell']).map(f=>f.card),1,1,'destroy')],resolve:(e,c)=>destroy(e,c,args(c))});
 // Number 73: Abyss Splash
 xyzOnce('Number 73: Abyss Splash','era-double',{quick:true,resolve:(e,c)=>{if(self(e,c)){e.modify(c.uid,'atk','mul',2,e.state.turn+1,c.source);lock(e,c.owner,'halfBattleDamage');}}});
 // Number 94: Crystalzero
 xyzOnce('Number 94: Crystalzero','era-halve',{quick:true,pool:allM,inputs:(e,c)=>[...detachN(1)(e,c),g(e,c,'target','选择攻击力减半的表侧怪兽',allM(e).filter(m=>m.faceUp),1,1,'target')],resolve:(e,c)=>{const m=card(e,first(c,'target'));if(m)e.modify(m.uid,'atk','mul',0.5,e.state.turn,c.source);}});
 // Full Armored Crystalzero Lancer
 extend('attackValue',function(prior,m){const n=prior.call(this,m);return is(m,'Full Armored Crystalzero Lancer')?n+500*overlayCount(this,m.uid):n;});
 guardMat('Full Armored Crystalzero Lancer',(e,m)=>{const f=e.find(m.uid);if(!is(m,'Full Armored Crystalzero Lancer')||!f?.card.overlays?.length)return false;e.detach(m.uid,[f.card.overlays[0].uid]);return true;});
 xyzOnce('Full Armored Crystalzero Lancer','era-negate-all',{resolve:(e,c)=>{for(const m of frontM(e,c))m.eraNegatedUntil=e.state.turn;}});
 // Number 36: Chronomaly Chateau Huyuk
 xyzOnce('Number 36: Chronomaly Chateau Huyuk','era-zero',{quick:true,pool:frontM,inputs:(e,c)=>[...detachN(1)(e,c),g(e,c,'target','选择攻击力归零的对方怪兽',frontM(e,c),1,1,'target')],resolve:(e,c)=>{const m=card(e,first(c,'target'));if(m)e.modify(m.uid,'atk','set',0,e.state.turn,c.source);}});
 effect('Number 36: Chronomaly Chateau Huyuk',null,(e,c)=>destroy(e,c,args(c)),{mode:'era-chateau',inputs:(e,c)=>[g(e,c,'cost','选择解放的先史遗产',ownM(e,c).filter(m=>series(m,'Chronomaly')),1,1,'cost'),g(e,c,'target','选择攻击力与原本不同的对方怪兽',frontM(e,c).filter(m=>e.attackValue(m)!==e.originalAttack(m)),1,1,'destroy')],cost:(e,c)=>X.tribute(e,c,args(c,'cost'))});
 // Number C69: Heraldry Crest of Horror
 R('Number C69: Heraldry Crest of Horror','era-wipe',{zones:['extraMonster','monsters'],label:C('Number C69: Heraldry Crest of Horror').name,once:H.once('crest-horror'),mandatory:false,role:'destroy',condition:(e,c)=>{const a=c.event.window?.attack;return !!a&&a.owner!==c.owner;},resolve:(e,c)=>{destroy(e,c,e.field(1-c.owner).map(f=>f.card.uid));}});
 E.on('attack',(e,v)=>{if(v.owner!==0&&v.owner!==1)return;for(const f of e.refs(v.owner,['extraMonster','monsters'])){if(f.card.id!==I('Number C69: Heraldry Crest of Horror'))continue;if(f.card.uid!==v.uid&&f.owner!==v.owner)e.addTrigger(f.card.uid,I('Number C69: Heraldry Crest of Horror')+'::era-wipe',v,{owner:f.owner});}});
 xyzOnce('Number C69: Heraldry Crest of Horror','era-copy',{condition:(e,c)=>!!(card(e,c.uid)?.overlays||[]).some(m=>is(m,'Number 69: Heraldry Crest')),pool:frontM,inputs:(e,c)=>[...detachN(1)(e,c),g(e,c,'target','选择复制攻击力与效果的对方超量怪兽',frontM(e,c).filter(m=>CARDS[m.id].type==='xyz'),1,1,'target')],resolve:(e,c)=>{const m=card(e,first(c,'target'));if(m&&self(e,c)){e.modify(c.uid,'atk','add',e.originalAttack(m),e.state.turn,c.source);self(e,c).eraCopiedName=def(m)?.officialName;}}});
 // Number C101: Silent Honor DARK
 effect('Number C101: Silent Honor DARK',(e,c)=>foeM(e,c).filter(m=>e.find(m.uid)?.card.summonKind&&e.find(m.uid).card.summonKind!=='normal'),
 (e,c)=>{const m=card(e,first(c,'target'));if(m)e.attach(c.uid,m.uid,{source:c.source});},{mode:'era-dark',once:H.once('honor-dark'),inputs:(e,c)=>[g(e,c,'target','选择吸收的对方特殊召唤怪兽',foeM(e,c).filter(m=>e.find(m.uid)?.card.summonKind&&e.find(m.uid).card.summonKind!=='normal'),1,1,'target')]});
 sent('Number C101: Silent Honor DARK',(e,c)=>{if(!grave(e,c.owner,m=>is(m,'Number 101: Silent Honor ARK')).length)return;const m=revive(e,c,c.uid);if(m){e.heal(c.owner,CARDS[c.sourceId]?.atk||0);m.eraNoAttackUntil=e.state.turn;}},(e,v)=>v.to==='grave'&&!!(v.previous?.overlays||[]).length);
 // Fairy Knight Ingunar
 R('Fairy Knight Ingunar','era-bounce',{zones:['extraMonster','monsters'],label:C('Fairy Knight Ingunar').name,once:H.once('ingunar'),role:'own-boost',inputs:(e,c)=>[H.detachInput(e,c,2)],cost:(e,c)=>spend(e,c),resolve:(e,c)=>{const list=allF(e).filter(f=>f.card.uid!==c.uid).map(f=>f.card.uid);if(list.length)moved(e,c,list,'hand','effect-return');}});
 // Number 18: Heraldry Patriarch
 effect('Number 18: Heraldry Patriarch',null,(e,c)=>{const pick=c.eraName;const same=allM(e).filter(m=>def(m)?.officialName===pick);if(same.length<2)return;const keep=same.find(m=>!m.eraHeraldPick);destroy(e,c,same.filter(m=>m!==keep).map(m=>m.uid));for(const m of allM(e))if(def(m)?.officialName===pick)m.eraHeraldPick=true;lock(e,1-c.owner,'noSummonName',pick);},{mode:'era-patriarch',detach:1,once:H.once('patriarch'),inputs:(e,c)=>[H.detachInput(e,c,1),H.customGroup('name','选择同名怪兽',allM(e).filter(m=>m.faceUp).map(m=>({uid:def(m).officialName,label:def(m).officialName,value:1})).filter((v,i,a)=>a.findIndex(x=>x.uid===v.uid)===i),1,1)],cost:(e,c)=>{c.eraName=first(c,'name');spend(e,c);}});
 sent('Number 18: Heraldry Patriarch',(e,c)=>{const list=deck(e,c.owner,m=>series(m,'Heraldic Beast')).slice(0,2);if(list.length)moved(e,c,list.map(m=>m.uid),'grave','effect-send');},isGY);
 // Number C92: Heart-eartH Chaos Dragon
 extend('destroy',function(prior,uid,source=null,battle=false,extra={}){if(battle&&is(card(this,uid),'Number C92: Heart-eartH Chaos Dragon'))return false;return prior.call(this,uid,source,battle,extra);});
 extend('damage',function(prior,p,n,kind,...a){const r=prior.call(this,p,n,kind,...a);const has=allM(this).some(m=>m.faceUp&&is(m,'Number C92: Heart-eartH Chaos Dragon'));if(has&&kind==='战斗')this.heal(p,n);return r;});
 xyzOnce('Number C92: Heart-eartH Chaos Dragon','era-negate-all',{condition:(e,c)=>!!(card(e,c.uid)?.overlays||[]).some(m=>is(m,'Number 92: Heart-eartH Dragon')),resolve:(e,c)=>{for(const m of allM(e))if(m.uid!==c.uid&&m.faceUp)m.eraNegatedUntil=e.state.turn;for(const s of allS(e))if(s.faceUp)s.eraNegatedUntil=e.state.turn;}});
 // Number 101: Silent Honor ARK
 effect('Number 101: Silent Honor ARK',(e,c)=>foeM(e,c).filter(m=>m.faceUp&&m.position==='attack'&&e.find(m.uid)?.card.summonKind&&e.find(m.uid).card.summonKind!=='normal'),(e,c)=>{const m=card(e,first(c,'target'));if(m)e.attach(c.uid,m.uid,{source:c.source});},{mode:'era-ark',once:H.once('honor-ark'),inputs:(e,c)=>[H.detachInput(e,c,2),g(e,c,'target','选择吸收的对方特殊召唤攻击表示怪兽',foeM(e,c).filter(m=>m.faceUp&&m.position==='attack'&&e.find(m.uid)?.card.summonKind&&e.find(m.uid).card.summonKind!=='normal'),1,1,'target')],cost:(e,c)=>spend(e,c)});
 guardMat('Number 101: Silent Honor ARK',(e,m)=>{const f=e.find(m.uid);if(!is(m,'Number 101: Silent Honor ARK')||!f?.card.overlays?.length)return false;e.detach(m.uid,[f.card.overlays[0].uid]);return true;});
 // Number 57: Tri-Head Dust Dragon
 E.on('summon',(e,v)=>{if(CARDS[v.id]?.officialName!=='Number 57: Tri-Head Dust Dragon'||v.kind==='normal')return;e.addTrigger(v.uid,I('Number 57: Tri-Head Dust Dragon')+'::era-gain',v,{owner:v.owner,mandatory:true});});
 R('Number 57: Tri-Head Dust Dragon','era-gain',{zones:['extraMonster','monsters'],label:C('Number 57: Tri-Head Dust Dragon').name,mandatory:true,pool:frontM,inputs:(e,c)=>[g(e,c,'target','选择参考攻击力的对方怪兽',frontM(e,c),0,1,'target')],resolve:(e,c)=>{const m=card(e,first(c,'target'));if(m&&self(e,c))e.modify(c.uid,'atk','add',e.attackValue(m),null,c.source);}});
 // Number 54: Lion Heart
 extend('destroy',function(prior,uid,source=null,battle=false,extra={}){const m=card(this,uid);if(battle&&m&&is(m,'Number 54: Lion Heart')&&m.faceUp&&m.position==='attack')return false;return prior.call(this,uid,source,battle,extra);});
 extend('damage',function(prior,p,n,kind,...a){const b=this.state.frame?.attack;const lion=b&&[this.find(b.uid),this.find(b.target)].filter(Boolean).find(f=>is(f.card,'Number 54: Lion Heart'));const r=prior.call(this,p,n,kind,...a);if(lion&&kind==='战斗'&&this.find(lion.card.uid)?.owner===p)prior.call(this,1-p,n,kind,...a);return r;});
 effect('Number 54: Lion Heart',null,(e,c)=>{}, {mode:'era-lion',detach:1,quick:true,condition:(e,c)=>{const b=e.state.frame?.attack;return !!b&&[b.uid,b.target].includes(c.uid);}});
 // Princess Cologne
 E.on('summon',(e,v)=>{if(CARDS[v.id]?.officialName!=='Princess Cologne'||v.kind!=='xyz')return;e.addTrigger(v.uid,I('Princess Cologne')+'::era-revive-box',v,{owner:v.owner});});
 R('Princess Cologne','era-revive-box',{zones:['extraMonster','monsters'],label:C('Princess Cologne').name,summons:true,resolve:(e,c)=>{const list=grave(e,c.owner,m=>is(m,'Box of Friends'));if(list.length)revive(e,c,list[0].uid);}});
 extend('attackTargets',function(prior,m,p=this.state.active){let list=prior.call(this,m,p);const cologne=allM(this).find(q=>q.faceUp&&is(q,'Princess Cologne'));if(!cologne||this.find(cologne.uid)?.owner===p)return list;if(this.monsters(this.find(cologne.uid).owner).length<2)return list;return list.filter(uid=>uid!==cologne.uid);});
 effect('Princess Cologne',null,(e,c)=>{const list=[...deck(e,c.owner,m=>monster(m)&&e.isNormalMonster(m)),...grave(e,c.owner,m=>monster(m)&&e.isNormalMonster(m))];if(list.length)revive(e,c,list[0].uid,{position:'defense',shuffle:true});},{mode:'era-cologne',detach:1,summons:true});
 // Photon Alexandra Queen
 xyzOnce('Photon Alexandra Queen','era-bounce-all',{resolve:(e,c)=>{const all=allM(e).map(m=>m.uid);moved(e,c,all,'hand','effect-return');X.burn(e,c,300*Math.floor(all.length/2));X.burn(e,1-c.owner,300*Math.ceil(all.length/2));}});
 // CXyz Battleship Cherry Blossom
 onEnd('CXyz Battleship Cherry Blossom',{zones:['extraMonster','monsters'],once:H.once('cherry-end'),condition:(e,c)=>e.state.players[1-c.owner].hand.length>e.state.players[c.owner].hand.length,resolve:(e,c)=>{const h=e.state.players[1-c.owner].hand;if(h.length)moved(e,c,[h[0].uid],'grave','effect-discard');}},{opponent:true});
 effect('CXyz Battleship Cherry Blossom',null,(e,c)=>X.burn(e,c,300*allF(e).length),{mode:'era-cherry',detach:1,once:H.once('cherry'),condition:(e,c)=>!!(card(e,c.uid)?.overlays||[]).some(m=>is(m,'Battlecruiser Dianthus')),inputs:detachN(1)});
 // Comics Hero King Arthur
 guardMat('Comics Hero King Arthur',(e,m)=>{const f=e.find(m.uid);if(!is(m,'Comics Hero King Arthur')||!f?.card.overlays?.length)return false;e.detach(m.uid,[f.card.overlays[0].uid]);e.modify(m.uid,'atk','add',500,null);X.burn(e,{owner:f.owner,source:src(e,m)},500);return true;});
 // Number 44: Sky Pegasus
 xyzOnce('Number 44: Sky Pegasus','era-pegasus',{inputs:(e,c)=>[...detachN(1)(e,c),g(e,c,'target','选择破坏或支付的对方怪兽',frontM(e,c),1,1,'target')],resolve:(e,c)=>{const m=card(e,first(c,'target'));if(!m)return;const p=e.state.players[1-c.owner];if(p.lp>=1000){p.lp-=1000;return;}destroy(e,c,[m.uid]);}});
 // CXyz Coach Lord Ultimatrainer
 extend('canTarget',function(prior,e,c,uid){if(is(card(e,uid),'CXyz Coach Lord Ultimatrainer')&&c&&c.source?.owner!==e.find(uid)?.owner)return false;return prior.call(this,e,c,uid);});
 effect('CXyz Coach Lord Ultimatrainer',null,(e,c)=>{const list=e.draw(c.owner,1)||[];if(list.length)e.revealCards(1-c.owner,list,'公开抽到的卡片');if(list.length&&monster(list[0]))X.burn(e,c,800);},{mode:'era-ultimatrainer',detach:1,role:'search',condition:(e,c)=>!!(card(e,c.uid)?.overlays||[]).some(m=>CARDS[m.id]?.type==='xyz'),inputs:detachN(1)});
 // Number 58: Burner Visor
 effect('Number 58: Burner Visor',(e,c)=>allM(e).filter(m=>CARDS[m.id].type==='xyz'&&m.uid!==c.uid),(e,c)=>{const t=card(e,first(c,'target'));if(t)e.equipMonster(c.uid,t.uid,c.owner,c.source);},{mode:'era-visor',role:'own-boost',summons:false,inputs:(e,c)=>[g(e,c,'target','选择装备的超量怪兽',allM(e).filter(m=>CARDS[m.id].type==='xyz'&&m.uid!==c.uid),1,1,'own-boost')]});
 effect('Number 58: Burner Visor',null,(e,c)=>{}, {mode:'era-visor-summon',summons:true,condition:(e,c)=>!!card(e,c.uid)?.equipTarget});
 // Skypalace Gangaridai
 effect('Skypalace Gangaridai',(e,c)=>e.field(1-c.owner).filter(f=>f.faceUp).map(f=>f.card),(e,c)=>{if(destroy(e,c,args(c)))X.burn(e,c,1000);if(self(e,c))self(e,c).eraNoAttackUntil=e.state.turn;},{mode:'era-gangaridai',detach:1,role:'destroy',once:H.once('gangaridai'),inputs:(e,c)=>[...detachN(1)(e,c),g(e,c,'target','选择破坏的对方卡片',e.field(1-c.owner).filter(f=>f.faceUp).map(f=>f.card),1,1,'destroy')]});
 // Night Papilloperative
 xyzOnce('Night Papilloperative','era-pump',{resolve:(e,c)=>{const n=allM(e).reduce((s,m)=>s+overlayCount(e,m.uid),0);if(self(e,c))e.modify(c.uid,'atk','add',300*n,e.state.turn,c.source);}});
 // Norito the Moral Leader
 quickNegate('Norito the Moral Leader','spell/trap',{detach:1});
 // Mechquipped Angineer
 effect('Mechquipped Angineer',(e,c)=>mineM(e,c).filter(m=>m.position==='attack'),(e,c)=>{const m=card(e,first(c,'target'));if(m){e.setPosition(m.uid,'defense',c.source);m.eraIndestructibleTurn=e.state.turn;}},{mode:'era-angineer',detach:1,quick:true,role:'own-boost',inputs:(e,c)=>[...detachN(1)(e,c),g(e,c,'target','选择转为守备的自方攻击表示怪兽',mineM(e,c).filter(m=>m.position==='attack'),1,1,'own-boost')]});
 // Number 74: Master of Blades
 Q('Number 74: Master of Blades','era-blades',{zones:['extraMonster','monsters'],main:false,condition:(e,c)=>{const l=c.event.window?.chainLast;return !!l&&l.owner!==c.owner&&Object.values(l.targetMeta||{}).some(map=>Object.keys(map).includes(c.uid));},inputs:(e,c)=>[H.detachInput(e,c,1),g(e,c,'target','选择破坏的场上卡片',allF(e).map(f=>f.card),0,1,'destroy')],cost:(e,c)=>{spend(e,c);X.negate(e,c);},resolve:(e,c)=>{const l=e.state.chain.at(-1);if(l){const f=e.find(l.uid);if(f)destroy(e,c,[f.card.uid]);}destroy(e,c,args(c,'target'));}});
 // Alsei, the Sylvan High Protector
 effect('Alsei, the Sylvan High Protector',null,(e,c)=>{const list=deck(e,c.owner);if(!list.length)return;if(def(list[0])?.officialName===c.eraName){moved(e,c,[list[0].uid],'hand','effect-search');}else moved(e,c,[list[0].uid],'grave','effect-send');},{mode:'era-alsei',once:H.once('alsei'),inputs:(e,c)=>[H.customGroup('name','宣言卡名',deck(e,c.owner).slice(0,12).map(m=>({uid:def(m).officialName,label:def(m).officialName,value:1})),1,1)],cost:(e,c)=>{c.eraName=first(c,'name');}});
 effect('Alsei, the Sylvan High Protector',(e,c)=>allF(e).map(f=>f.card),(e,c)=>{const m=first(c,'target');if(m)e.putOnDeck(m,'top',c.source);},{mode:'era-alsei-place',detach:1,role:'own-boost',once:H.once('alsei-place'),condition:(e,c)=>e.state.players[c.owner].eraSylvanMilled===e.state.turn,inputs:(e,c)=>[...detachN(1)(e,c),g(e,c,'target','选择放回卡组的卡片',allF(e).map(f=>f.card),1,1,'target')]});
 E.on('move',(e,v)=>{if(v.from!=='deck'||v.to!=='grave')return;const p=e.state.players[v.owner];if(p)p.eraSylvanMilled=e.state.turn;});
 // Geargiagear Gigant XG
 Q('Geargiagear Gigant XG','era-gigant',{zones:['extraMonster','monsters'],main:false,condition:(e,c)=>{const a=e.state.frame?.attack;return !!a&&!!card(e,a.owner===c.owner?a.uid:a.target)&&e.race(card(e,a.owner===c.owner?a.uid:a.target))==='机械族';},inputs:(e,c)=>[H.detachInput(e,c,1)],cost:(e,c)=>spend(e,c),resolve:(e,c)=>{for(const m of frontM(e,c))m.eraNegatedUntil=e.state.turn;}});
 R('Geargiagear Gigant XG','era-recover',{zones:['grave'],label:C('Geargiagear Gigant XG').name,role:'search',inputs:(e,c)=>[g(e,c,'target','选择回收的齿轮齿轮卡',grave(e,c.owner,m=>series(m,'Geargia')&&m.uid!==c.uid),1,1,'search')],resolve:(e,c)=>moved(e,c,args(c),'hand','effect-return')});
 E.on('move',(e,v)=>{if(!['monsters','extraMonster'].includes(v.from)||v.to!=='grave')return;if(CARDS[v.id]?.officialName!=='Geargiagear Gigant XG')return;e.addTrigger(v.uid,I('Geargiagear Gigant XG')+'::era-recover',v,{owner:v.owner});});
 // Pilgrim Reaper
 passive('Pilgrim Reaper',{stat:(e,s,m,k)=>{if(m.uid!==s.card.uid||!['atk','def'].includes(k))return 0;const p=e.find(s.card.uid)?.owner;return [...grave(e,0),...grave(e,1)].filter(q=>e.hasAttribute(q,'暗')).length*200;}});
 xyzOnce('Pilgrim Reaper','era-mill',{role:'send-deck',resolve:(e,c)=>{for(const p of [0,1]){const pl=e.state.players[p],n=Math.min(5,pl.deck.length);for(let i=0;i<n;i++){const m=pl.deck[pl.deck.length-1];if(!m)break;moved(e,c,[m.uid],'grave','effect-send');}}}});
 // Unformed Void
 effect('Unformed Void',null,(e,c)=>{let n=0;for(const f of e.field(1-c.owner))if(CARDS[f.card.id]?.type==='xyz')n+=e.attackValue(f.card);if(self(e,c)){e.modify(c.uid,'atk','set',n,null,c.source);e.modify(c.uid,'def','set',n,null,c.source);}},{mode:'era-void',detach:1,quick:true,role:'own-boost',inputs:detachN(1)});
 // Battlecruiser Dianthus
 xyzOnce('Battlecruiser Dianthus','era-burn',{resolve:(e,c)=>X.burn(e,c,200*e.state.players[1-c.owner].hand.length)});
 // CXyz Simon the Great Moral Leader
 extend('unaffected',function(prior,m,source){if(m&&is(m,'CXyz Simon the Great Moral Leader')&&source?.effectType==='monster')return true;return prior.call(this,m,source);});
 effect('CXyz Simon the Great Moral Leader',frontM,(e,c)=>{const m=card(e,first(c,'target'));if(m){e.setPosition(m.uid,m.position==='attack'?'defense':'attack',c.source);m.eraNegatedUntil=e.state.turn;}},{mode:'era-simon',detach:1,quick:true,condition:(e,c)=>!!(card(e,c.uid)?.overlays||[]).some(q=>is(q,'Norito the Moral Leader')),inputs:(e,c)=>[...detachN(1)(e,c),g(e,c,'target','选择变更表示并无效的对方怪兽',frontM(e,c),1,1,'target')]});
 // CXyz Mechquipped Djinn Angeneral
 E.on('summon',(e,v)=>{if(CARDS[v.id]?.officialName!=='CXyz Mechquipped Djinn Angeneral'||v.kind!=='xyz')return;e.addTrigger(v.uid,I('CXyz Mechquipped Djinn Angeneral')+'::era-turn',v,{owner:v.owner});});
 R('CXyz Mechquipped Djinn Angeneral','era-turn',{zones:['extraMonster','monsters'],label:C('CXyz Mechquipped Djinn Angeneral').name,mandatory:true,inputs:(e,c)=>[g(e,c,'target','选择转为攻击表示的守备怪兽',allM(e).filter(m=>m.faceUp&&m.position==='defense'),0,1,'target')],resolve:(e,c)=>{const m=card(e,first(c,'target'));if(m)e.setPosition(m.uid,'attack',c.source);}});
 effect('CXyz Mechquipped Djinn Angeneral',null,(e,c)=>X.burn(e,c,1000),{mode:'era-angeneral',detach:1,condition:(e,c)=>!!(card(e,c.uid)?.overlays||[]).some(m=>is(m,'Mechquipped Angineer')),inputs:detachN(1)});
 E.on('damage',(e,v)=>{if(v.owner!==1&&v.owner!==0)return;if(!v.battle&&v.kind!=='战斗')return;for(const f of e.refs(1-v.owner,['extraMonster','monsters'])){if(f.card.id!==I('CXyz Mechquipped Djinn Angeneral'))continue;if(!(f.card.overlays||[]).some(m=>is(m,'Mechquipped Angineer')))continue;e.addTrigger(f.card.uid,I('CXyz Mechquipped Djinn Angeneral')+'::era-angeneral',v,{owner:f.owner});}});
 // CXyz Skypalace Babylon
 onBattleWin('CXyz Skypalace Babylon',{resolve:(e,c)=>X.burn(e,c,Math.floor((CARDS[c.event.victim?.id]?.atk||0)/2))});
 effect('CXyz Skypalace Babylon',null,(e,c)=>{if(self(e,c))self(e,c).bonusAttacks=(self(e,c).bonusAttacks||0)+1;},{mode:'era-babylon-attack',detach:1,condition:(e,c)=>!!(card(e,c.uid)?.overlays||[]).some(m=>is(m,'Skypalace Gangaridai')),inputs:detachN(1)});
 if(typeof module!=='undefined')module.exports=X;
})(globalThis);
