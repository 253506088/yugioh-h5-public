/* 2013 per-card rules: Mecha Phantom Beast (幻兽机). Registered from
 * effects-2013.js, which owns the shared token, protection and Level vocabulary. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,C,I,is,A,Q,R,passive,mark,extend,allM,allS,allF,monster,face,ownM,foeM,hand,deck,grave,first,args,self,src,active,field,has,g,target,moved,destroy,pay,once,onEntry,onFlip,onMove,onEnd,onStandby,onDamage,onBattleWin,revive,search,specialChoice,series,guard,defer,card,def,names,effect,cast,watch,sent,aura,ownAura,protect,xyz,lock,locked,stat,summonCost,mpbTokens,hasMpbToken,mpbProtect,mecha}=X,{CARDS}=D;
 // Every member shares "while you control a Token, this card cannot be destroyed
 // by battle or card effects", and its printed Level rises by the total Levels
 // of those Tokens. Both are read live so token creation and removal stay in sync.
 const mpbMembers=D.CARD_LIST.filter(c=>c.releaseYear===2013&&monster(c)&&series(c,'Mecha Phantom Beast'));
 for(const c of mpbMembers)c.mechaPhantom=true;
 const tokenTotal=(e,owner)=>ownM(e,{owner}).reduce((n,m)=>n+(m.faceUp&&m.id==='era-mpb-token'?e.level(m):0),0);
 for(const c of mpbMembers)mpbProtect(c.officialName);
 extend('level',function(prior,m){const n=prior.call(this,m);if(n<=0||!m||!CARDS[m.id]?.mechaPhantom)return n;const f=this.find(m.uid);if(!f||!['monsters','extraMonster'].includes(f.zone)||!m.faceUp)return n;return n+tokenTotal(this,f.owner);});
 passive('Mecha Phantom Beast Turtletracer',{protect:(e,s,card,battle)=>!!battle&&card.id==='era-mpb-token'&&e.find(s.card.uid)?.owner===e.find(card.uid)?.owner&&card.eraTurtleTurn!==e.state.turn&&(card.eraTurtleTurn=e.state.turn,true)});
 const tokens=(e,c,n=1)=>e.createTokens(c.owner,'era-mpb-token',n);
 const tokenCount=(e,c)=>ownM(e,c).filter(m=>m.faceUp&&m.id==='era-mpb-token').length;
 const tokenGroup=(e,c,n=1,title='选择解放的幻兽机衍生物')=>g(e,c,'cost',title,ownM(e,c).filter(m=>m.faceUp&&m.id==='era-mpb-token'),n,n,'cost');
 const spendToken=(e,c,costKey='cost')=>X.tribute(e,c,args(c,costKey));
 // --- Token generation ------------------------------------------------------
 // Megaraptor watches the real summon moment, so the Token it makes cannot
 // trigger its own effect again; the others act on their own entry or battle.
 R('Mecha Phantom Beast Megaraptor','era-token',{zones:['monsters'],label:C('Mecha Phantom Beast Megaraptor').name,once:once('megaraptor-token'),summons:true,resolve:(e,c)=>tokens(e,c,1)});
 E.on('summon',(e,v)=>{if(CARDS[v.id]?.type!=='token'||v.kind!=='token')return;for(const p of [0,1])for(const f of e.refs(p,['monsters'])){if(f.card.id!==I('Mecha Phantom Beast Megaraptor')||!active(e,f.card)||e.find(f.card.uid)?.owner!==v.owner)continue;e.addTrigger(f.card.uid,I('Mecha Phantom Beast Megaraptor')+'::era-token',v,{owner:p});}});
 onEntry('Mecha Phantom Beast Tetherwolf','era-token',{summons:true,resolve:(e,c)=>tokens(e,c,1)},['normal']);
 onEntry('Mecha Phantom Beast Coltwing','era-token',{summons:true,condition:(e,c)=>ownM(e,c).some(m=>m.uid!==c.uid&&m.faceUp&&mecha(m)),resolve:(e,c)=>tokens(e,c,2)},['special']);
 onFlip('Mecha Phantom Beast Hamstrat',{summons:true,resolve:(e,c)=>tokens(e,c,2)});
 onDamage('Mecha Phantom Beast Stealthray',{summons:true,resolve:(e,c)=>{if(c.event.battle&&c.event.owner===1-c.owner)tokens(e,c,1);}},{zones:['monsters']});
 effect('Mecha Phantom Beast Warbluran',null,(e,c)=>{tokens(e,c,1);lock(e,c.owner,'windsOnly');},{zones:['grave'],once:H.once('warbluran','name'),summons:true,condition:(e,c)=>{const f=e.find(c.source?.uid??c.uid);const mats=(c.event?.materials||[]).filter(q=>q?.id);return mats.includes(I('Mecha Phantom Beast Warbluran'))&&mats.some(id=>CARDS[id]?.type==='synchro'&&CARDS[id].race==='机械族');}});
 R('Mecha Phantom Beast Blue Impala','era-token',{zones:['grave'],label:C('Mecha Phantom Beast Blue Impala').name,once:once('impala-token'),summons:true,condition:(e,c)=>!ownM(e,c).length&&foeM(e,c).some(m=>m.faceUp),resolve:(e,c)=>{moved(e,c,[c.uid],'banished','cost-banish');tokens(e,c,1);}});
 effect('Mecha Phantom Beast Kalgriffin',null,(e,c)=>{const list=hand(e,c.owner,m=>series(m,'Mecha Phantom Beast'));if(list.length){H.discard(e,c,[list[0].uid]);tokens(e,c,1);}},{mode:'era-second',role:'special',condition:(e,c)=>hand(e,c.owner,m=>series(m,'Mecha Phantom Beast')).length>0,summons:true});
 // --- Token-consuming payoffs ----------------------------------------------
 effect('Mecha Phantom Beast Blackfalcon',(e,c)=>foeM(e,c).filter(m=>m.faceUp&&m.position!=='defense'),(e,c)=>e.setPosition(first(c),'defense',c.source),{quick:true,inputs:(e,c)=>[tokenGroup(e,c),g(e,c,'target','选择变更表示的对方怪兽',foeM(e,c).filter(m=>m.faceUp&&m.position!=='defense'))],cost:(e,c)=>spendToken(e,c)});
 effect('Mecha Phantom Beast Stealthray',(e,c)=>e.refs(1-c.owner,['spells','fieldSpell']).map(f=>f.card),(e,c)=>destroy(e,c,args(c)),{inputs:(e,c)=>[tokenGroup(e,c),g(e,c,'target','选择破坏的魔法／陷阱',e.refs(1-c.owner,['spells','fieldSpell']).map(f=>f.card))],cost:(e,c)=>spendToken(e,c),role:'destroy'});
 effect('Mecha Phantom Beast Megaraptor',null,(e,c)=>search(e,c,deck(e,c.owner,m=>series(m,'Mecha Phantom Beast'))),{mode:'era-second',role:'search',inputs:(e,c)=>[tokenGroup(e,c)],cost:(e,c)=>spendToken(e,c)});
 effect('Mecha Phantom Beast Hamstrat',(e,c)=>grave(e,c.owner,m=>series(m,'Mecha Phantom Beast')&&e.canSpecial(c.owner,m,{via:'revive'})),(e,c)=>revive(e,c,first(c)),{inputs:(e,c)=>[tokenGroup(e,c),g(e,c,'target','选择复活的幻兽机',grave(e,c.owner,m=>series(m,'Mecha Phantom Beast')&&e.canSpecial(c.owner,m,{via:'revive'})))],cost:(e,c)=>spendToken(e,c),summons:true,role:'special'});
 effect('Mecha Phantom Beast Harrliard',null,(e,c)=>{const list=hand(e,c.owner,m=>series(m,'Mecha Phantom Beast'));if(list.length)specialChoice(e,c,list);},{mode:'era-second',role:'special',inputs:(e,c)=>[tokenGroup(e,c)],cost:(e,c)=>spendToken(e,c),summons:true});
 effect('Mecha Phantom Beast Coltwing',(e,c)=>foeM(e,c),(e,c)=>{const uid=first(c);if(e.destroy(uid,c.source))moved(e,c,[uid],'banished','effect-banish');},{inputs:(e,c)=>[tokenGroup(e,c,2,'选择解放的两个幻兽机衍生物'),g(e,c,'target','选择破坏并除外的对方卡片',foeM(e,c))],cost:(e,c)=>spendToken(e,c),condition:(e,c)=>tokenCount(e,c)>=2,role:'destroy'});
 effect('Mecha Phantom Beast Sabre Hawk',(e,c)=>[...grave(e,0),...grave(e,1)],(e,c)=>moved(e,c,args(c),'banished','effect-banish'),{inputs:(e,c)=>[tokenGroup(e,c),g(e,c,'target','选择除外的墓地卡片',[...grave(e,0),...grave(e,1)])],cost:(e,c)=>spendToken(e,c),role:'banish'});
 effect('Mecha Phantom Beast Tetherwolf',null,(e,c)=>{if(self(e,c))e.modify(c.uid,'atk','add',800,e.state.turn,c.source);},{mode:'era-pump',quick:true,role:'own-boost',condition:(e,c)=>!!e.state.frame?.attack&&e.state.frame.attack.uid===c.uid,summons:false,inputs:(e,c)=>[tokenGroup(e,c)],cost:(e,c)=>spendToken(e,c)});
 effect('Mecha Phantom Beast Warbluran',(e,c)=>ownM(e,c).filter(m=>m.uid!==c.uid&&mecha(m)&&m.faceUp),(e,c)=>{if(self(e,c))self(e,c).levelOverride={value:e.level(self(e,c))+1,until:e.state.turn};},{mode:'era-level',role:'own-boost',inputs:(e,c)=>[g(e,c,'cost','选择解放其他幻兽机',ownM(e,c).filter(m=>m.uid!==c.uid&&mecha(m)&&m.faceUp),1,1,'cost')],cost:(e,c)=>X.tribute(e,c,args(c,'cost'))});
 // Harrliard reacts to any of the controller's monsters being Tributed for a
 // cost other than its own effect.
 E.on('move',(e,v)=>{if(v.to!=='grave'||!/^cost-tribute$/.test(v.kind||''))return;for(const p of [0,1])for(const f of e.refs(p,['monsters'])){if(f.card.id!==I('Mecha Phantom Beast Harrliard')||!active(e,f.card)||v.uid===f.card.uid)continue;e.addTrigger(f.card.uid,I('Mecha Phantom Beast Harrliard')+'::era-token',v,{owner:p});}});
 R('Mecha Phantom Beast Harrliard','era-token',{zones:['monsters'],label:C('Mecha Phantom Beast Harrliard').name,once:once('harrliard-token'),summons:true,resolve:(e,c)=>tokens(e,c,1)});
 summonCost('Mecha Phantom Beast Kalgriffin',(e,c)=>ownM(e,c).filter(m=>m.faceUp&&series(m,'Mecha Phantom Beast')),2,{zones:['hand'],tribute:true,position:'attack'});
 // Sabre Hawk cannot attack while any monster in either Graveyard is not a
 // Mecha Phantom Beast, and Blue Impala may only make a Machine-Type Synchro.
 extend('canAttack',function(prior,m,p,t){if(is(m,'Mecha Phantom Beast Sabre Hawk')&&!t&&[...grave(this,0),...grave(this,1)].some(q=>monster(q)&&!series(q,'Mecha Phantom Beast')))return false;return prior.call(this,m,p,t);});
 extend('synchroValid',function(prior,p,extra,list,o={}){if(list.some(m=>is(m,'Mecha Phantom Beast Blue Impala'))&&this.race(extra)!=='机械族')return false;return prior.call(this,p,extra,list,o);});
 // Dracossack: two Tokens, or one Token plus a Mecha Phantom Beast tribute to pop
 // any card; using the pop costs this card its attack for the turn.
 A('Mecha Phantom Beast Dracossack','era-token',{zones:['extraMonster','monsters'],main:true,label:C('Mecha Phantom Beast Dracossack').name,once:once('dracossack-token'),summons:true,inputs:(e,c)=>[H.detachInput(e,c,1)],cost:(e,c)=>e.detach(c.uid,args(c,'cost')),resolve:(e,c)=>tokens(e,c,2)});
 A('Mecha Phantom Beast Dracossack','era-pop',{zones:['extraMonster','monsters'],main:true,label:C('Mecha Phantom Beast Dracossack').name,once:once('dracossack-pop'),role:'destroy',inputs:(e,c)=>[g(e,c,'cost','选择解放的幻兽机怪兽',ownM(e,c).filter(m=>m.faceUp&&series(m,'Mecha Phantom Beast')),1,1,'cost'),g(e,c,'target','选择破坏的场上卡片',allF(e))],cost:(e,c)=>{X.tribute(e,c,args(c,'cost'));if(self(e,c))self(e,c).eraNoAttackUntil=e.state.turn;},resolve:(e,c)=>destroy(e,c,args(c))});
 for(const name of mpbMembers.map(c=>c.officialName))mark(name,'幻兽机：衍生物保护、等级提升与逐条效果已登记');
 mark('Mecha Phantom Beast Warbluran','送入墓地的机械族同调素材生成衍生物；本回合只能特殊召唤风属性');
 mark('Mecha Phantom Beast Turtletracer','每回合首只被战斗破坏的衍生物保留；等级提升已登记');
 mark('Mecha Phantom Beast Sabre Hawk','墓地含非幻兽机时不能攻击、不能直击，以及除外效果已登记');
 if(typeof module!=='undefined')module.exports=X;
})(globalThis);
