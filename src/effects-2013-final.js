/* 2013 per-card rules: closers. Cards whose whole behaviour is a continuous
 * rule are marked after their engine extension; cards with a real activation
 * get a registration here. Registered from effects-2013.js. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,C,I,is,A,Q,R,passive,mark,extend,allM,allS,allF,monster,face,ownM,foeM,hand,deck,grave,first,args,self,src,active,field,has,g,choose,target,moved,destroy,pay,once,onEntry,onFlip,onMove,onEnd,onStandby,onDamage,onBattleWin,revive,search,specialChoice,series,guard,defer,card,def,names,isGY,fromField,destroyed,effect,cast,watch,sent,aura,ownAura,protect,lock,locked,stat,xyz,quickNegate,specialSelf,summonCost,negateMonster,equip,rule,trib}=X,{CARDS}=D;
 const S=cast,T=cast;
 const frontM=(e,c)=>foeM(e,c).filter(m=>m.faceUp);
 const tribOne=(e,c,uids)=>X.tribute(e,c,uids);
 // --- Cards whose entire behaviour is a continuous rule ----------------------
 // Each of these was already wired into the engine in the earlier 2013 parts;
 // the note records which rule is actually enforced.
 mark('Parsec, the Interstellar Dragon','自己场上有8星怪兽时可以不解放通常召唤');
 mark('Bachibachibachi','作为超量素材使用的超量怪兽获得贯穿');
 mark('Star Eater','同调召唤不能被无效，攻击时不受其他效果影响');
 mark('Armades, Keeper of Boundaries','此卡进行战斗时对方直到伤害步骤结束不能发动卡片效果');
 mark('Tardy Orc','通常召唤的回合不能攻击');
 mark('Soul Drain Dragon','只能由自己持有的龙族超量怪兽效果特殊召唤；特殊召唤时按生命值差提升攻击力');
 mark('Giganticastle','每个非调整同调素材提升200攻击力与守备力');
 mark('Chronomaly Mud Golem','自己场上的先史遗产攻击守备表示怪兽时造成贯穿伤害');
 mark('Hundred-Footed Horror','对方有怪兽且自己无怪兽时可不解放通常召唤，攻击力变为1300');
 mark('Night Express Knight','不能从卡组特殊召唤；可以不解放通常召唤，攻击力变为0');
 mark('Leo, the Keeper of the Sacred Tree','除自己主要阶段2外不会被对方效果指定');
 mark('Traptrix Atrax','不受「洞」通常陷阱影响；可从手牌发动「洞」；自己发动的通常陷阱不会被无效');
 // Trap Hole cards may be activated from the hand while Atrax is face up.
 extend('earlyCanUse',function(prior,c,a){if(a.cardActivation&&CARDS[c.sourceId]?.type==='trap'&&CARDS[c.sourceId]?.hole&&this.monsters(c.owner).some(m=>m.faceUp&&is(m,'Traptrix Atrax')))return true;return prior.call(this,c,a);});
 // --- Cards with a real activation ------------------------------------------
 // Geargiano Mk-III revives another Geargia when a Geargia card summons it.
 watch('Geargiano Mk-III','era-mk3','summon',(e,v)=>v.id===I('Geargiano Mk-III')&&v.kind!=='normal',{summons:true,once:H.once('mk3'),resolve:(e,c)=>{const list=[...hand(e,c.owner,m=>series(m,'Geargia')&&m.id!==c.sourceId),...grave(e,c.owner,m=>series(m,'Geargia')&&m.id!==c.sourceId)];if(!list.length)return;const m=revive(e,c,list[0].uid,{position:'defense'});if(m)m.effectNegated=true;lock(e,c.owner,'geargiaOnly');}},{zones:['monsters']});
 // Geargiattacker flips itself down, and its Flip Summon clears Spell/Trap.
 Q('Geargiattacker','era-attacker',{zones:['monsters'],once:H.once('attacker'),role:'own-boost',resolve:(e,c)=>e.setPosition(c.uid,'defense',c.source,true)});
 onFlip('Geargiattacker',{role:'destroy',inputs:(e,c)=>[g(e,c,'target','选择破坏的魔法／陷阱',allS(e).filter(m=>m.faceUp),0,Math.max(1,ownM(e,c).filter(m=>m.uid!==c.uid&&series(m,'Geargia')).length),'destroy')],resolve:(e,c)=>destroy(e,c,args(c))});
 // Genomix Fighter declares a Monster Type for its Synchro Material.
 effect('Genomix Fighter',null,(e,c)=>{const t=c.eraType;lock(e,c.owner,'typeOnly',t);if(self(e,c))self(e,c).eraGenomixType=t;},{mode:'era-genomix',once:H.once('genomix'),inputs:(e,c)=>[H.customGroup('type','宣言怪兽种族',D.CARD_LIST.filter(c2=>monster(c2)).map(c2=>c2.race).filter((r,i,a)=>a.indexOf(r)===i).map(r=>({uid:r,label:r,value:1})),1,1)],cost:(e,c)=>{c.eraType=first(c,'type');}});
 // Sea Lord's Amulet protects WATER monsters and expires on the 3rd End Phase.
 S('Sea Lord\'s Amulet',null,null,{zones:['hand'],role:'field',resolve:(e,c)=>{lock(e,c.owner,'waterProtected');e.state.players[c.owner].eraAmuletTurn=e.state.turn;}});
 extend('destroy',function(prior,uid,source=null,battle=false,extra={}){const f=this.find(uid);if(!battle&&f&&this.hasAttribute(f.card,'水')&&locked(this,f.owner,'waterProtected'))return false;return prior.call(this,uid,source,battle,extra);});
 onEnd('Sea Lord\'s Amulet',{zones:['spells'],condition:(e,c)=>{const p=e.find(c.uid)?.owner;return p!==undefined&&e.state.players[p].eraAmuletTurn+3<=e.state.turn;},resolve:(e,c)=>{const p=e.find(c.uid)?.owner;if(p!==undefined)unlock(e,p);moved(e,c,[c.uid],'grave','effect-send');}},{both:true});
 function unlock(e,p){const l=e.state.players[p].eraLocks;if(l)delete l.waterProtected;}
 if(typeof module!=='undefined')module.exports=X;
})(globalThis);
