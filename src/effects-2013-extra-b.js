/* 2013 per-card rules: the remaining Synchro, Fusion and Xyz Monsters.
 * Registered from effects-2013.js. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,C,I,is,A,Q,R,passive,mark,extend,allM,allS,allF,monster,face,ownM,foeM,hand,deck,grave,first,args,self,src,active,field,has,g,choose,target,moved,destroy,pay,once,onEntry,onFlip,onMove,onEnd,onStandby,onDamage,onBattleWin,revive,search,specialChoice,series,guard,defer,card,def,names,isGY,fromField,destroyed,effect,cast,watch,sent,aura,ownAura,protect,lock,locked,stat,xyz,quickNegate}=X,{CARDS}=D;
 const S=cast,T=cast;
 const guardMat=(name,fn)=>protect(name,fn);
 const detachN=(n)=>(e,c)=>[H.detachInput(e,c,n)];
 const spend=(e,c,key='cost')=>e.detach(c.uid,args(c,key));
 const frontM=(e,c)=>foeM(e,c).filter(m=>m.faceUp);
 const mineM=(e,c)=>ownM(e,c).filter(m=>m.faceUp);
 const overlayCount=(e,uid)=>card(e,uid)?.overlays?.length||0;
 const gyCount=(e,p)=>[...grave(e,p)].length;
 // ==========================================================================
 // Synchro Monsters
 // ==========================================================================
 effect('Stardust Spark Dragon',(e,c)=>e.refs(c.owner,['monsters','extraMonster']).filter(f=>f.card.faceUp&&f.card.uid!==c.uid).map(f=>f.card),(e,c)=>{const m=card(e,first(c,'target'));if(m)m.eraIndestructibleTurn=e.state.turn;},{mode:'era-spark',quick:true,once:H.once('spark'),role:'own-boost',inputs:(e,c)=>[g(e,c,'target','选择本回合免受破坏的自己卡片',e.refs(c.owner,['monsters','extraMonster']).filter(f=>f.card.faceUp&&f.card.uid!==c.uid).map(f=>f.card),1,1,'own-boost')]});
 extend('destroy',function(prior,uid,source=null,battle=false,extra={}){const m=card(this,uid);if(m?.eraIndestructibleTurn===this.state.turn&&!battle)return false;const f=this.find(uid);if(m?.eraIndestructibleTurn===this.state.turn&&battle&&f&&this.state.players[f.owner].eraSparkBlock!==this.state.turn){this.state.players[f.owner].eraSparkBlock=this.state.turn;return false;}return prior.call(this,uid,source,battle,extra);});
 watch('Ancient Pixie Dragon','era-field-draw','era-activation',(e,v)=>CARDS[v.id]?.spellKind==='field'&&v.owner===0,{once:H.once('pixie-draw'),resolve:(e,c)=>e.draw(c.owner,1)},{zones:['monsters']});
 effect('Ancient Pixie Dragon',allM,(e,c)=>destroy(e,c,args(c)),{mode:'era-pixie',once:H.once('pixie'),role:'destroy',condition:(e,c)=>allS(e).some(m=>m.faceUp&&CARDS[m.id].type==='spell'&&CARDS[m.id].spellKind==='field'),inputs:(e,c)=>[g(e,c,'target','选择破坏的攻击表示怪兽',allM(e).filter(m=>m.faceUp&&m.position==='attack'),1,1,'destroy')]});
 onEntry('Power Tool Mecha Dragon','era-equip-draw',{resolve:(e,c)=>e.draw(c.owner,1)},['special']);
 watch('Power Tool Mecha Dragon','era-equip-draw','era-equipped',(e,v,f)=>e.find(f.card.uid)?.owner===e.state.active,{once:H.once('power-tool'),resolve:(e,c)=>e.draw(c.owner,1)},{zones:['monsters']});
 effect('Power Tool Mecha Dragon',(e,c)=>e.refs(0,['spells','fieldSpell']).concat(e.refs(1,['spells','fieldSpell'])).filter(f=>f.card.faceUp&&CARDS[f.card.id]?.spellKind==='equip').map(f=>f.card),(e,c)=>{const m=card(e,first(c,'target'));if(m)e.equipMonster(m.uid,c.uid,c.owner,c.source);},{mode:'era-power-tool',once:H.once('power-tool-steal'),role:'own-boost',quick:true,inputs:(e,c)=>[g(e,c,'target','选择重新装备的装备卡',e.refs(0,['spells','fieldSpell']).concat(e.refs(1,['spells','fieldSpell'])).filter(f=>f.card.faceUp&&CARDS[f.card.id]?.spellKind==='equip').map(f=>f.card),1,1,'own-boost')]});
 onDamage('HTS Psyhemuth',{resolve:(e,c)=>{const a=c.event.attack;if(!a)return;const f=e.find(a.target);if(f){moved(e,c,[f.card.uid],'banished','effect-banish');moved(e,c,[c.uid],'banished','effect-banish');}}});
 effect('Mist Bird Clausolas',frontM,(e,c)=>{const m=card(e,first(c,'target'));if(m){e.modify(m.uid,'atk','set',0,e.state.turn,c.source);m.eraNegatedUntil=e.state.turn;}},{mode:'era-clausolas',once:H.once('clausolas'),role:'own-boost',inputs:(e,c)=>[g(e,c,'target','选择攻击力归零的对方怪兽',frontM(e,c),1,1,'target')]});
 onBattleWin('Mighty Warrior',{resolve:(e,c)=>X.burn(e,c,Math.floor((CARDS[c.event.victim?.id]?.atk||0)/2))});
 onMove('Underworld Fighter Balmung','era-balmung',{summons:true,inputs:(e,c)=>[g(e,c,'target','选择复活的4星以下怪兽',grave(e,c.owner,m=>monster(m)&&e.level(m)<=4&&m.uid!==c.uid),1,1,'special')],resolve:(e,c)=>revive(e,c,first(c))},(e,v)=>v.to==='grave'&&v.kind==='destroy');
 effect('Puralis, the Purple Pyrotile',null,(e,c)=>{for(const m of foeM(e,c))e.modify(m.uid,'atk','add',-500,null,c.source);},{zones:['monsters'],mode:'era-puralis',triggerOnLeave:true});
 watch('Puralis, the Purple Pyrotile','era-puralis','move',(e,v,f)=>v.from==='monsters'&&v.to==='grave'&&f.card.id===I('Puralis, the Purple Pyrotile'),{resolve:(e,c)=>{for(const m of foeM(e,c))e.modify(m.uid,'atk','add',-500,null,c.source);}},{zones:['grave']});
 extend('attackValue',function(prior,m){const n=prior.call(this,m);if(!is(m,'Giganticastle'))return n;const ids=this.find(m.uid)?.card.eraSynchroMaterials||[];return n+200*ids.filter(id=>CARDS[id]?.type!=='tuner'&&!this.isTuner({id})).length;});
 effect('Hot Red Dragon Archfiend',null,(e,c)=>{for(const m of allM(e))if(m.uid!==c.uid&&m.faceUp&&m.position==='attack')destroy(e,c,[m.uid]);lock(e,c.owner,'noAttacks');},{mode:'era-hot-red',once:H.once('hot-red'),role:'destroy'});
 E.on('summon',(e,v)=>{if(CARDS[v.id]?.officialName!=='Ascension Sky Dragon'||v.kind!=='synchro')return;const m=card(e,v.uid);if(m)m.eraAscendAtk=800*hand(e,v.owner).length;e.addTrigger(v.uid,I('Ascension Sky Dragon')+'::era-ascend',v,{owner:v.owner,mandatory:true});});
 passive('Ascension Sky Dragon',{stat:(e,s,m,k)=>k==='atk'&&m.uid===s.card.uid?(m.eraAscendAtk||0):0});
 R('Ascension Sky Dragon','era-ascend',{zones:['monsters'],label:C('Ascension Sky Dragon').name,mandatory:true,resolve:(e,c)=>{const m=card(e,c.uid);if(m)m.eraAscendAtk=800*hand(e,c.owner).length;}});
 R('Ascension Sky Dragon','era-ascend-revive',{zones:['grave'],label:C('Ascension Sky Dragon').name,summons:true,once:H.once('ascend-revive'),resolve:(e,c)=>{const mats=(e.state.players[c.owner].eraSynchroTomb||{});}});
 extend('battleLocked',function(prior,p,attack){const m=attack&&this.find(attack.uid);const t=attack&&this.find(attack.target);if((m&&is(m.card,'Armades, Keeper of Boundaries'))||(t&&is(t.card,'Armades, Keeper of Boundaries')))return true;return prior.call(this,p,attack);});
 E.on('summon',(e,v)=>{if(CARDS[v.id]?.officialName!=='Azure-Eyes Silver Dragon'||v.kind!=='synchro')return;const p=v.owner;e.state.players[p].eraAzureUntil=e.state.turn+2;});
 extend('canTarget',function(prior,e,c,uid){const f=e.find(uid);if(!f)return prior.call(this,e,c,uid);const p=f.owner;if(e.state.players[p].eraAzureUntil>=e.state.turn&&e.race(f.card)==='龙族'&&c?.source?.owner!==p)return false;return prior.call(this,e,c,uid);});
 extend('destroy',function(prior,uid,source=null,battle=false,extra={}){const f=this.find(uid);if(!battle&&f&&this.state.players[f.owner].eraAzureUntil>=this.state.turn&&this.race(f.card)==='龙族')return false;return prior.call(this,uid,source,battle,extra);});
 onStandby('Azure-Eyes Silver Dragon',{zones:['monsters'],resolve:(e,c)=>{const list=grave(e,c.owner,m=>monster(m)&&e.isNormalMonster(m));if(list.length)revive(e,c,list[0].uid);}});
 effect('Michael, the Arch-Lightsworn',(e,c)=>allF(e).map(f=>f.card),(e,c)=>{moved(e,c,args(c),'banished','effect-banish');},{mode:'era-michael',once:H.once('michael'),cost:(e,c)=>pay(e,c,1000),inputs:(e,c)=>[g(e,c,'target','选择除外的场上卡片',allF(e).map(f=>f.card),1,1,'target')]});
 sent('Michael, the Arch-Lightsworn',(e,c)=>{const list=grave(e,c.owner,m=>series(m,'Lightsworn')&&m.uid!==c.uid);if(!list.length)return;moved(e,c,list.map(m=>m.uid),'deck','effect-return');e.shuffle(e.state.players[c.owner].deck);e.heal(c.owner,300*list.length);},(e,v)=>v.to==='grave'&&v.kind==='destroy');
 onEnd('Michael, the Arch-Lightsworn',{zones:['monsters'],resolve:(e,c)=>{const p=e.state.players[c.owner],n=Math.min(3,p.deck.length);for(let i=0;i<n;i++){const m=p.deck[p.deck.length-1];if(!m)break;moved(e,c,[m.uid],'grave','effect-send');}}});
 E.on('summon',(e,v)=>{if(CARDS[v.id]?.officialName!=='Cloudcastle'||v.kind!=='synchro')return;e.addTrigger(v.uid,I('Cloudcastle')+'::era-cloud',v,{owner:v.owner});});
 R('Cloudcastle','era-cloud',{zones:['monsters'],label:C('Cloudcastle').name,summons:true,inputs:(e,c)=>[g(e,c,'target','选择复活的9星怪兽',grave(e,c.owner,m=>monster(m)&&e.level(m)===9),1,1,'special')],resolve:(e,c)=>revive(e,c,first(c))});
 E.on('summon',(e,v)=>{if(!CARDS[v.id]||CARDS[v.id].type==='token')return;const m=card(e,v.uid);if(m&&e.level(m)>0&&e.level(m)<=8&&allM(e).some(q=>q.faceUp&&is(q,'Cloudcastle')))m.eraNoAttackUntil=e.state.turn;});
 // ==========================================================================
 // Fusion
 // ==========================================================================
 sent('Panzer Dragon',(e,c)=>{const list=allF(e).map(f=>f.uid);if(list.length)choose(e,c,'选择破坏的场上卡片',allF(e).map(f=>f.card),0,1,'era-panzer-destroy',{role:'destroy'});},isGY,{once:H.once('panzer')});
 E.op('era-panzer-destroy',(e,t)=>{if(t.picks[0])destroy(e,{owner:t.owner,source:t.context.source},t.picks);});
 // ==========================================================================
 // Remaining Xyz Monsters
 // ==========================================================================
 E.on('summon',(e,v)=>{if(CARDS[v.id]?.officialName!=='Artorigus, King of the Noble Knights'||v.kind!=='xyz')return;e.addTrigger(v.uid,I('Artorigus, King of the Noble Knights')+'::era-artorigus',v,{owner:v.owner});});
 R('Artorigus, King of the Noble Knights','era-artorigus',{zones:['extraMonster','monsters'],label:C('Artorigus, King of the Noble Knights').name,resolve:(e,c)=>{const list=grave(e,c.owner,m=>CARDS[m.id].spellKind==='equip'&&series(m,'Noble Arms'));const seen=new Set(),out=[];for(const m of list){if(seen.has(m.id))continue;seen.add(m.id);out.push(m);if(out.length===3)break;}if(out.length)choose(e,c,'选择装备的圣剑',out,0,out.length,'era-artorigus-equip',{role:'own-boost'});}});
 E.op('era-artorigus-equip',(e,t)=>{for(const uid of t.picks||[]){const f=e.find(uid);if(!f)continue;e.move(uid,'spells',{kind:'effect-return',source:t.context.source,byOwner:t.owner});const s=card(e,uid);if(s){s.faceUp=true;s.equipTarget=t.context.uid;}}});
 effect('Artorigus, King of the Noble Knights',(e,c)=>allS(e).filter(m=>m.faceUp).map(m=>m),(e,c)=>destroy(e,c,args(c)),{mode:'era-artorigus-pop',detach:1,once:H.once('artorigus-pop'),role:'destroy',inputs:(e,c)=>{const n=e.refs(c.owner,['spells']).filter(f=>f.card.faceUp&&CARDS[f.card.id]?.spellKind==='equip').length;return [...detachN(1)(e,c),g(e,c,'target','选择破坏的魔法／陷阱',allS(e).filter(m=>m.faceUp).map(m=>m),0,Math.max(1,n),'destroy')];}});
 X.token('era-phantom-bram','幻影衍生物','Phantom Token',1,500,500,'暗','恶魔族');
 effect('Crimson Knight Vampire Bram',(e,c)=>grave(e,1-c.owner,monster),(e,c)=>{const m=revive(e,{...c,owner:1-c.owner},first(c));if(m){e.takeControl(m.uid,c.owner,{source:c.source});lock(e,c.owner,'attacksOnly',m.uid);}},{mode:'era-bram',detach:1,once:H.once('bram'),summons:true,role:'special',inputs:(e,c)=>[...detachN(1)(e,c),g(e,c,'target','选择复活的对方墓地怪兽',grave(e,1-c.owner,monster),1,1,'special')]});
 R('Crimson Knight Vampire Bram','era-bram-return',{zones:['grave'],label:C('Crimson Knight Vampire Bram').name,summons:true,once:H.once('bram-return'),condition:(e,c)=>e.find(c.uid)?.card.eraOppDestroyed===true,resolve:(e,c)=>revive(e,c,c.uid,{position:'defense'})});
 E.on('move',(e,v)=>{if(v.to!=='grave'||v.kind!=='destroy')return;if(v.source?.owner===v.owner)return;if(CARDS[v.id]?.officialName!=='Crimson Knight Vampire Bram')return;const m=card(e,v.uid);if(m)m.eraOppDestroyed=true;});
 onBattleWin('CXyz Comics Hero Legend Arthur',{condition:(e,c)=>(card(e,c.uid)?.overlays||[]).some(m=>is(m,'Comics Hero King Arthur')),detach:1,resolve:(e,c)=>{const v=c.event.victim;if(!v)return;moved(e,c,[v.uid],'banished','effect-banish');X.burn(e,c,CARDS[v.id]?.atk||0);}});
 extend('destroy',function(prior,uid,source=null,battle=false,extra={}){const m=card(this,uid);if(battle&&is(m,'CXyz Comics Hero Legend Arthur')){const p=this.find(uid)?.owner;if(this.state.players[p].eraArthurGuard!==this.state.turn){this.state.players[p].eraArthurGuard=this.state.turn;return false;}}return prior.call(this,uid,source,battle,extra);});
 extend('attackValue',function(prior,m){const n=prior.call(this,m);return is(m,'Downerd Magician')?n+200*overlayCount(this,m.uid):n;});
 extend('piercing',function(prior,m,p=this.state.active){if(is(m,'Downerd Magician'))return true;return prior.call(this,m,p);});
 onDamage('Downerd Magician',{resolve:(e,c)=>{if(self(e,c)&&overlayCount(e,c.uid)>0)e.detach(c.uid,[card(e,c.uid).overlays[0].uid]);}});
 Q('Number 39: Utopia Roots','era-roots',{zones:['extraMonster','monsters'],main:false,condition:(e,c)=>{const a=c.event.window?.attack;return !!a&&!!a.uid&&a.uid!==c.uid;},inputs:(e,c)=>[H.detachInput(e,c,1)],cost:(e,c)=>spend(e,c),resolve:(e,c)=>{const a=e.state.frame?.attack;e.negateAttack();if(a){const m=a.uid&&card(e,a.uid);if(m&&CARDS[m.id].type==='xyz'&&self(e,c))e.modify(c.uid,'atk','add',(def(m).rank||0)*500,null,c.source);}}});
 if(typeof module!=='undefined')module.exports=X;
})(globalThis);
