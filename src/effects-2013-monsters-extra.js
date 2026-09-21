/* 2013 per-card rules: the Ghostrick, Evilswarm, Noble Knight and Battlin'
 * Boxer themes (main-deck monsters, their Equip Spells and their Xyz bosses).
 * Registered from effects-2013.js. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,C,I,is,A,Q,R,passive,mark,extend,allM,allS,allF,monster,face,ownM,foeM,hand,deck,grave,first,args,self,src,active,field,has,g,choose,target,moved,destroy,pay,once,onEntry,onFlip,onMove,onEnd,onStandby,onDamage,onBattleWin,revive,search,specialChoice,series,guard,defer,card,def,names,effect,cast,watch,sent,aura,ownAura,protect,lock,locked,stat,summonCost,specialSelf,quickNegate,equip}=X,{CARDS}=D;
 const S=cast,T=cast;
 const faceDownDefense=m=>!!m&&!m.faceUp&&m.position==='defense';
 const lightNormal=(e,m)=>monster(m)&&e.hasAttribute(m,'光')&&e.isNormalMonster(m);
 const equipSpells=(e,p)=>e.refs(p,['spells','fieldSpell']).filter(f=>f.card.faceUp&&CARDS[f.card.id]?.spellKind==='equip').map(f=>f.card);
 const armsOnField=(e,p)=>equipSpells(e,p).filter(m=>series(m,'Noble Arms'));
 // ==========================================================================
 // Ghostrick: every member hides itself once per turn, and the payoffs only
 // function while the opponent cannot reach a set monster.
 // ==========================================================================
 const ghostrick=m=>series(m,'Ghostrick');
 const ghostrickSpell=m=>ghostrick(m)||/^Ghostrick-/.test(def(m)?.officialName||'');
 const ghostrickCount=(e,p)=>ownM(e,{owner:p}).filter(m=>m.faceUp&&ghostrick(m)).length;
 const trickBodies=D.CARD_LIST.filter(c=>c.releaseYear===2013&&monster(c)&&ghostrick(c)&&!D.isExtra(c));
 // "Cannot be Normal Summoned, unless you control a Ghostrick monster" is a
 // field condition, not an absolute ban, so it must not set noNormal.
 extend('canNormal',function(prior,m,p=this.state.active){const c=CARDS[m.id];if(c.releaseYear===2013&&ghostrick(c)&&!this.monsters(p).some(q=>q.faceUp&&ghostrick(q)))return false;return prior.call(this,m,p);});
 for(const c of trickBodies)Q(c.officialName,'era-hide',{zones:['monsters','extraMonster','spells','fieldSpell'],once:H.once('ghostrick-hide','card'),role:'own-boost',resolve:(e,ctx)=>e.setPosition(ctx.uid,'defense',ctx.source,true)});
 onFlip('Ghostrick Jiangshi',{resolve:(e,c)=>{const limit=ghostrickCount(e,c.owner);const list=deck(e,c.owner,m=>ghostrick(m)&&e.level(m)<=limit);if(list.length)choose(e,c,'选择加入手牌的幽灵',list,1,1,'early-move',{to:'hand',kind:'effect-search',shuffle:true});}});
 onFlip('Ghostrick Skeleton',{resolve:(e,c)=>{const n=ghostrickCount(e,c.owner),p=e.state.players[1-c.owner];for(let i=0;i<n&&p.deck.length;i++)moved(e,c,[p.deck[p.deck.length-1].uid],'banished','effect-banish');}});
 onDamage('Ghostrick Stein',{resolve:(e,c)=>{if(c.event.battle&&c.event.owner===1-c.owner)search(e,c,deck(e,c.owner,m=>ghostrickSpell(m)&&def(m).type!=='monster'));}});
 sent('Ghostrick Yuki-onna',(e,c)=>{const a=c.event.attack?.uid,m=a&&card(e,a);if(m){e.setPosition(m.uid,'defense',c.source,true);m.positionLockedUntil=e.state.turn+1;}},(e,v)=>v.to==='grave'&&v.kind==='battle');
 watch('Ghostrick Specter','era-special','move',(e,v)=>v.to==='grave'&&ghostrick({id:v.id})&&(v.kind==='destroy'||v.kind==='battle'),{summons:true,resolve:(e,c)=>{revive(e,c,c.uid,{position:'defense',faceDown:true});e.draw(c.owner,1);}},{zones:['hand']});
 watch('Ghostrick Mary','era-special','damage',()=>true,{summons:true,resolve:(e,c)=>{const list=deck(e,c.owner,ghostrick);if(list.length)revive(e,c,list[0].uid,{position:'defense',faceDown:true,shuffle:true});}},{zones:['hand']});
 Q('Ghostrick Lantern','era-block',{zones:['hand'],main:false,condition:(e,c)=>{const a=c.event.window?.attack;return !!a&&a.stage==='declare'&&a.owner!==c.owner&&(!a.target||ghostrick(e.find(a.target)?.card));},cost:(e,c)=>H.discard(e,c,[c.uid]),resolve:(e,c)=>{e.negateAttack();revive(e,c,c.uid,{position:'defense',faceDown:true});},aiResponse:()=>1100});
 Q('Ghostrick Jackfrost','era-frost',{zones:['hand'],main:false,condition:(e,c)=>{const a=c.event.window?.attack;return !!a&&a.stage==='declare'&&a.owner!==c.owner&&!a.target;},resolve:(e,c)=>{const a=e.state.frame?.attack;if(a)e.setPosition(a.uid,'defense',c.source,true);revive(e,c,c.uid,{position:'defense',faceDown:true});},aiResponse:()=>900});
 Q('Ghostrick Witch','era-turn',{zones:['monsters','extraMonster'],once:H.once('witch'),condition:(e,c)=>foeM(e,c).some(m=>m.faceUp),inputs:(e,c)=>[g(e,c,'target','选择转为里侧守备的对方怪兽',foeM(e,c).filter(m=>m.faceUp),1,1,'target')],resolve:(e,c)=>e.setPosition(first(c),'defense',c.source,true)});
 E.on('summon',(e,v)=>{const m=card(e,v.uid);if(!m||e.level(m)<4)return;for(const p of [0,1])for(const f of e.refs(p,['monsters'])){if(f.card.id!==I('Ghostrick Nekomusume')||!active(e,f.card))continue;if(!allM(e).some(q=>q.uid!==f.card.uid&&q.faceUp&&ghostrick(q)))continue;e.addTrigger(f.card.uid,I('Ghostrick Nekomusume')+'::era-turn',v,{owner:p});}});
 specialSelf('Ghostrick Mummy',()=>true);
 extend('canNormal',function(prior,m,p=this.state.active){if(CARDS[m.id].releaseYear===2013&&ghostrick(m)&&this.monsters(p).some(q=>q.faceUp&&is(q,'Ghostrick Mummy'))&&!this.state.players[p].eraMummyUsed){this.state.players[p].eraMummyUsed=true;return this.freeMain(p)>0;}return prior.call(this,m,p);});
 extend('endTurn',function(prior,...a){for(const p of this.state.players)p.eraMummyUsed=false;return prior.call(this,...a);});
 extend('canSpecial',function(prior,p,m,o={}){const d=m&&CARDS[m.id];if(d?.releaseYear===2013&&!ghostrick(d)&&this.monsters(p).some(q=>q.faceUp&&is(q,'Ghostrick Mummy'))&&o.via!=='xyz'&&!this.hasAttribute(m,'暗'))return false;return prior.call(this,p,m,o);});
 cast('Ghostrick Mansion',null,(e,c)=>{}, {zones:['hand'],role:'field'});
 cast('Ghostrick Museum',null,(e,c)=>{}, {zones:['hand'],role:'field'});
 extend('attackTargets',function(prior,m,p=this.state.active){let list=prior.call(this,m,p);if(!has(this,'Ghostrick Mansion')&&!has(this,'Ghostrick Museum'))return list;const foe=this.monsters(1-p);if(foe.length&&foe.every(q=>faceDownDefense(q)))return list;return list.filter(uid=>{const f=this.find(uid);return !(f&&faceDownDefense(f.card));});});
 T('Ghostrick Vanish',{condition:(e,c)=>hand(e,c.owner,ghostrick).length>0,cost:(e,c)=>{const m=hand(e,c.owner,ghostrick)[0];e.revealCards(1-c.owner,[m],'展示幽灵');lock(e,c.owner,'ghostrickShield');},summons:false});
 extend('destroy',function(prior,uid,source=null,battle=false,extra={}){const m=card(this,uid),f=this.find(uid);if(!battle&&m&&f&&locked(this,f.owner,'ghostrickShield')&&(ghostrick(m)||faceDownDefense(m)))return false;return prior.call(this,uid,source,battle,extra);});
 T('Ghostrick Scare',{inputs:(e,c)=>[g(e,c,'target','选择翻转的自己里侧怪兽',ownM(e,c).filter(m=>faceDownDefense(m)),1,99,'own-boost')],resolve:(e,c)=>{let n=0;for(const uid of args(c,'target')){e.setPosition(uid,'attack',c.source);if(ghostrick(card(e,uid)))n++;}for(const m of foeM(e,c).filter(m=>m.faceUp).slice(0,Math.max(1,n)))e.setPosition(m.uid,'defense',c.source,true);}});
 T('Ghostrick-Go-Round',{inputs:(e,c)=>[H.customGroup('mode','选择转盘效果',[{uid:'hide',label:'自己转为里侧并翻开对方里侧',value:1},{uid:'show',label:'翻开自己里侧并盖住对方',value:2}],1,1),g(e,c,'own','选择自己怪兽',ownM(e,c),1,1,'own-boost'),g(e,c,'foe','选择对方怪兽',foeM(e,c),1,1,'target')],resolve:(e,c)=>{const s=card(e,first(c,'own')),f=card(e,first(c,'foe'));if(!s||!f)return;if(first(c,'mode')==='hide'){e.setPosition(s.uid,'defense',c.source,true);e.setPosition(f.uid,'attack',c.source);}else{e.setPosition(s.uid,'attack',c.source);if(ghostrick(s))e.setPosition(f.uid,'defense',c.source,true);}}});
 // ==========================================================================
 // Evilswarm Exciton Knight: the Level 4 reset that also ends the turn's damage.
 // ==========================================================================
 A('Evilswarm Exciton Knight','era-reset',{zones:['extraMonster','monsters'],main:true,quick:true,label:C('Evilswarm Exciton Knight').name,once:H.once('exciton'),quick:true,role:'destroy',condition:(e,c)=>!e.state.chain.length&&((e.state.players[1-c.owner].hand||[]).length+e.field(1-c.owner).length)>(e.state.players[c.owner].hand||[]).length+e.field(c.owner).length,inputs:(e,c)=>[H.detachInput(e,c,1)],cost:(e,c)=>e.detach(c.uid,args(c,'cost')),resolve:(e,c)=>{const targets=allF(e).filter(d=>d&&d.uid&&d.uid!==c.uid).map(d=>d.uid);if(targets.length)destroy(e,c,targets);for(const p of [0,1])e.state.players[p].excitonTurn=e.state.turn;}});
 // "your opponent takes no further damage this turn" applies to both players'
 // remaining damage for the rest of the turn, including battle damage.
 extend('damage',function(prior,p,n,kind,...a){if(this.state.players[p].excitonTurn===this.state.turn)return;return prior.call(this,p,n,kind,...a);});
 // ==========================================================================
 // Noble Knight: bare Knights are Normal Monsters on the field; armed ones
 // become effect monsters with the printed ability.
 // ==========================================================================
 const nobleKnight=m=>series(m,'Noble Knight');
 const gate=(e,m)=>!!m&&e.activeEquip(m).some(q=>series(q,'Noble Arms'));
 const liveKnights=['Noble Knight Gwalchavad','Noble Knight Medraut'];
 for(const n of liveKnights)C(n).effect=C(n).id;
 extend('isNormalMonster',function(prior,m){if(m&&liveKnights.some(n=>is(m,n))&&!gate(this,m)){const f=this.find(m.uid);if(f&&['monsters','extraMonster'].includes(f.zone)&&m.faceUp)return true;}return prior.call(this,m);});
 specialSelf('Noble Knight Gawayn',(e,c)=>ownM(e,c).some(m=>lightNormal(e,m)),{position:'defense'});
 effect('Noble Knight Gwalchavad',(e,c)=>grave(e,c.owner,nobleKnight),(e,c)=>{moved(e,c,args(c),'hand','effect-return');const arms=armsOnField(e,c.owner)[0];if(arms)destroy(e,c,[arms.uid]);},{mode:'era-gwalchavad',role:'search',inputs:(e,c)=>[g(e,c,'target','选择回收的圣骑士',grave(e,c.owner,nobleKnight),1,1,'search')]});
 extend('level',function(prior,m){return is(m,'Noble Knight Medraut')&&gate(this,m)?prior.call(this,m)+1:prior.call(this,m);});
 extend('attribute',function(prior,m){return is(m,'Noble Knight Medraut')&&gate(this,m)?'暗':prior.call(this,m);});
 effect('Noble Knight Medraut',null,(e,c)=>{const list=deck(e,c.owner,m=>nobleKnight(m)&&m.id!==c.sourceId);if(!list.length)return;if(!revive(e,c,list[0].uid,{position:'defense',shuffle:true}))return;const arms=armsOnField(e,c.owner)[0];if(arms)destroy(e,c,[arms.uid]);},{mode:'era-medraut',role:'special',summons:true,condition:(e,c)=>ownM(e,c).filter(m=>m.uid!==c.uid).length===0});
 const warriorNames=D.CARD_LIST.filter(q=>monster(q)&&q.race==='战士族').map(q=>q.officialName);
 equip('Noble Arms of Destiny',m=>m&&D.CARDS[m.id]?.race==='战士族',{names:warriorNames});
 equip('Noble Arms - Gallatin',m=>m&&D.CARDS[m.id]?.race==='战士族',{names:warriorNames});
 equip('Noble Arms - Caliburn',m=>m&&D.CARDS[m.id]?.race==='战士族',{names:warriorNames});
 equip('Noble Arms - Arfeudutyr',m=>m&&D.CARDS[m.id]?.race==='战士族',{names:warriorNames});
 aura('Noble Arms - Gallatin',(e,m,s)=>s.card.equipTarget===m.uid,1000);
 aura('Noble Arms - Caliburn',(e,m,s)=>s.card.equipTarget===m.uid,500);
 onStandby('Noble Arms - Gallatin',{zones:['spells'],condition:(e,c)=>!!card(e,c.uid)?.equipTarget,resolve:(e,c)=>{const h=card(e,c.uid)?.equipTarget;if(h)e.modify(h,'atk','add',-200,null,c.source);}});
 effect('Noble Arms - Caliburn',null,(e,c)=>e.heal(c.owner,500),{zones:['spells'],mode:'era-lifegain',role:'own-boost'});
 effect('Noble Arms - Arfeudutyr',(e,c)=>e.refs(1-c.owner,['spells','fieldSpell']).filter(f=>!f.card.faceUp).map(f=>f.card),(e,c)=>{const h=card(e,c.uid)?.equipTarget;if(h)e.modify(h,'atk','add',-500,null,c.source);destroy(e,c,args(c));},{zones:['spells'],mode:'era-armbreak',role:'destroy',inputs:(e,c)=>[g(e,c,'target','选择破坏的对方盖卡',e.refs(1-c.owner,['spells','fieldSpell']).filter(f=>!f.card.faceUp).map(f=>f.card),1,1,'destroy')]});
 passive('Noble Arms of Destiny',{protect:(e,s,card)=>{if(card.uid!==e.find(s.card.uid)?.card.equipTarget)return false;const f=e.find(card.uid);if(!f||f.card.eraDestinyTurn===e.state.turn)return false;f.card.eraDestinyTurn=e.state.turn;return true;}});
 // A destroyed face-up Noble Arms re-arms onto another Noble Knight.
 E.on('move',(e,v)=>{if(v.from!=='spells'||v.to!=='grave'||!series({id:v.id},'Noble Arms'))return;const list=e.monsters(v.owner).filter(m=>m.faceUp&&nobleKnight(m));if(list.length)equipTo(e,v,list[0]);});
 function equipTo(e,v,target){const owner=v.owner,slot=e.freeSpellZones(owner)[0];if(slot===undefined)return;const card=e.makeCard(v.id,owner);Object.assign(card,{faceUp:true,position:'attack',setTurn:0,changedTurn:0,equipTarget:target.uid});e.state.players[owner].spells[slot]=card;}
 // ==========================================================================
 // Battlin' Boxer: Level 4 Warriors that trade themselves for the Graveyard.
 // ==========================================================================
 const boxer=m=>series(m,'Battlin\' Boxer');
 Q('Battlin\' Boxer Counterpunch','era-punch',{zones:['hand','grave'],main:false,once:H.once('counterpunch','name'),condition:(e,c)=>{const a=e.state.frame?.attack;if(!a)return false;const uid=a.owner===c.owner?a.uid:a.target;const m=uid&&card(e,uid);return !!m&&boxer(m);},cost:(e,c)=>{const a=e.state.frame?.attack;c.eraMine=a?(a.owner===c.owner?a.uid:a.target):null;moved(e,c,[c.uid],'banished','cost-banish');},resolve:(e,c)=>{if(c.eraMine)e.modify(c.eraMine,'atk','add',1000,e.state.turn,c.source);},aiResponse:()=>1000});
 Q('Battlin\' Boxer Rib Gardna','era-rgb',{zones:['hand','grave'],main:false,condition:(e,c)=>ownM(e,c).some(boxer),inputs:(e,c)=>[g(e,c,'target','选择暂时除外的拳击手',ownM(e,c).filter(boxer),1,1,'cost')],cost:(e,c)=>moved(e,c,[c.uid],'banished','cost-banish'),resolve:(e,c)=>{const uid=first(c);defer(e,c,'standby',e.state.turn+2,'era-boxer-return',{uid});moved(e,c,[uid],'banished','effect-banish');}});
 E.op('era-boxer-return',(e,t)=>{if(e.find(t.context.uid)?.zone==='banished')revive(e,{owner:t.owner,source:t.context.source},t.context.uid);});
 sent('Battlin\' Boxer Glassjaw',(e,c)=>search(e,c,grave(e,c.owner,m=>boxer(m)&&m.id!==c.sourceId)),(e,v)=>v.to==='grave'&&/^(effect|cost)-/.test(v.kind||''));
 watch('Battlin\' Boxer Glassjaw','era-selfdestruct','attack',(e,v,f)=>v.target===f.card.uid,{mandatory:true,resolve:(e,c)=>destroy(e,c,[c.uid])},{zones:['monsters']});
 specialSelf('Battlin\' Boxer Sparrer',(e,c)=>ownM(e,c).some(boxer),{position:'defense'});
 E.on('summon',(e,v)=>{if(CARDS[v.id]?.officialName!=='Battlin\' Boxer Sparrer'||v.kind!=='special')return;e.state.players[v.owner].skipBattleTurn=e.state.turn;});
 onEntry('Battlin\' Boxer Switchitter','era-revive',{summons:true,inputs:(e,c)=>[g(e,c,'target','选择复活的拳击手',grave(e,c.owner,m=>boxer(m)),1,1,'special')],resolve:(e,c)=>{if(revive(e,c,first(c)))lock(e,c.owner,'boxerOnly');}},['normal']);
 onEntry('Battlin\' Boxer Headgeared','era-mill',{inputs:(e,c)=>[g(e,c,'send','选择送去墓地的拳击手',deck(e,c.owner,boxer),1,1,'cost')],cost:(e,c)=>moved(e,c,args(c,'send'),'grave','effect-send'),resolve:()=>{}},['normal']);
 extend('destroy',function(prior,uid,source=null,battle=false,extra={}){const m=card(this,uid);if(!battle&&m&&is(m,'Battlin\' Boxer Headgeared')&&m.faceUp&&m.position==='attack'&&m.eraHeadgearedTurn!==this.state.turn){m.eraHeadgearedTurn=this.state.turn;return false;}return prior.call(this,uid,source,battle,extra);});
 onDamage('Battlin\' Boxer Rabbit Puncher',{resolve:(e,c)=>{const a=c.event.attack,t=a&&card(e,a.target);if(t&&e.find(t.uid)?.position==='defense')destroy(e,c,[t.uid]);}});
 R('Battlin\' Boxer Lead Yoke','era-pump',{zones:['extraMonster','monsters'],label:C('Battlin\' Boxer Lead Yoke').name,mandatory:true,main:false,resolve:(e,c)=>{if(self(e,c))e.modify(c.uid,'atk','add',800,null,c.source);}});
 E.on('move',(e,v)=>{if(v.kind!=='detach'||!v.source)return;if(CARDS[v.source.id]?.officialName!=='Battlin\' Boxer Lead Yoke')return;if(!e.find(v.source.uid))return;e.addTrigger(v.source.uid,I('Battlin\' Boxer Lead Yoke')+'::era-pump',v,{owner:v.source.owner,mandatory:true});});
 passive('Battlin\' Boxer Lead Yoke',{protect:(e,s,card,battle)=>{if(!boxer(card))return false;const f=e.find(card.uid),host=e.find(s.card.uid);if(!f||!host||f.owner!==host.owner)return false;if(!host.card.overlays.length)return false;e.detach(s.card.uid,[host.card.overlays[0].uid]);return true;}});
 R('Battlin\' Boxer Cheat Commissioner','era-rig',{zones:['extraMonster','monsters'],label:C('Battlin\' Boxer Cheat Commissioner').name,once:H.once('commissioner'),inputs:(e,c)=>[H.detachInput(e,c,2)],cost:(e,c)=>e.detach(c.uid,args(c,'cost')),resolve:(e,c)=>e.revealCards(1-c.owner,e.state.players[1-c.owner].hand.slice(),'查看对方手牌')});
 if(typeof module!=='undefined')module.exports=X;
})(globalThis);
