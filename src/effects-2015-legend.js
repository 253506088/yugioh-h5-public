/* Legendary dragon procedures preserve actual material identities and source. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,C,I,is,A,Q,passive,mark,extend,card,def,field,monster,active,allF,allM,allS,ownM,foeM,hand,deck,grave,first,args,self,src,g,choose,target,moved,destroy,onEntry,onMove,onEnd,watch,revive,search,specialChoice,series,effect,cast,defer,lock,locked}=X;
 const Y=X.year2015,{fm,pend,live,limit,back,send,banish,destroyed,pickSend,tempBanish}=Y,canSend=(e,m)=>e.state.ruleMode?.id!=='liberation'&&H.canSendGY(e,m);
 for(const spell of ['The Fang of Critias','The Claw of Hermos']){
  const combos=(e,p)=>e.state.players[p].extra.filter(m=>def(m).legendaryFusion===spell&&!m.faceUpExtra&&e.canSpecial(p,m,{via:def(m).specialOnly})).flatMap(m=>[...hand(e,p),...e.field(p)].filter(q=>e.materialMatches(q,def(m).legendaryMaterial)&&canSend(e,q)).map(q=>({uid:JSON.stringify({extra:m.uid,material:q.uid}),label:def(m).name+' ← '+def(q).name,value:def(m).atk||0})));
  cast(spell,null,(e,c)=>{const s=JSON.parse(first(c,'combo')),m=card(e,s.extra),q=card(e,s.material);if(!m||!q||!canSend(e,q))return;send(e,c,[q.uid]);if(e.find(q.uid)?.zone==='grave')revive(e,c,m.uid,{via:def(m).specialOnly});},{once:limit(spell),summons:true,condition:(e,c)=>combos(e,c.owner).length>0,inputs:(e,c)=>[H.customGroup('combo','选择传说之龙与素材',combos(e,c.owner))]});
 }
 const hermos=['Time Magic Hammer','Red-Eyes Black Dragon Sword','Rocket Hermos Cannon','Goddess Bow'];
 for(const n of hermos)Y.mustEntry(n,'y15-equip',{mandatory:true,inputs:target('选择装备的另一只表侧怪兽',(e,c)=>allM(e).filter(m=>m.uid!==c.uid&&m.faceUp),'own-boost'),resolve:(e,c)=>e.equipMonster(c.uid,first(c),c.owner,c.source)},['special']);
 passive('Red-Eyes Black Dragon Sword',{stat:(e,s,m,k)=>s.card.equipTarget===m.uid?(k==='atk'?1000:0)+500*[...allM(e),...grave(e,0),...grave(e,1)].filter(q=>monster(q)&&e.race(q)==='龙族').length:0});
 passive('Tyrant Burst Dragon',{stat:(e,s,m)=>s.card.equipTarget===m.uid?400:0});
 effect('Tyrant Burst Dragon',(e,c)=>ownM(e,c).filter(m=>m.uid!==c.uid&&m.faceUp),(e,c)=>e.equipMonster(c.uid,first(c),c.owner,c.source),{mode:'y15-equip',oncePerTurn:false,role:'own-boost'});
 X.rule('Tyrant Burst Dragon',{attackAll:true});
 extend('attackAllowance',function(prior,m,...a){const equips=this.activeEquip(m);return Math.max(prior.call(this,m,...a),equips.some(q=>is(q,'Tyrant Burst Dragon'))?3:equips.some(q=>is(q,'Rocket Hermos Cannon'))?2:1);});
 extend('finishBattle',function(prior,a){const m=card(this,a.uid);if(m&&this.activeEquip(m).some(q=>is(q,'Rocket Hermos Cannon')))m.piercingUntil=this.state.turn;return prior.call(this,a);});
 watch('Time Magic Hammer','y15-banish','damage-start',(e,v,f)=>!!f.card.equipTarget&&[v.attack.uid,v.attack.target].includes(f.card.equipTarget),{resolve:(e,c)=>{const s=card(e,c.uid),a=c.event.attack,u=a.uid===s?.equipTarget?a.target:a.uid;if(u)tempBanish(e,c,u,'standby',e.state.turn+X.die(e,c));}},{zones:['spells']});
 // This compulsory negation applies to the first opposing chain link in the
 // Battle Phase, including monster effects. Keep its physical instance counter.
 extend('commitPrepared',function(prior,c){const r=prior.call(this,c),l=this.state.chain.at(-1);if(l&&l.uid===c.uid&&this.state.phase==='battle')for(const f of live(this,'Goddess Bow',1-c.owner)){if(!f.card.equipTarget||f.card.y15BowTurn===this.state.turn)continue;f.card.y15BowTurn=this.state.turn;l.effectNegated=true;const m=card(this,f.card.equipTarget);if(m)m.y15Double=this.state.turn;}return r;});
 mark('Goddess Bow','本作适配：战斗阶段对方第一个发动效果自动无效，装备怪兽获得第二次攻击。');
 onEntry('Doom Virus Dragon','y15-virus',{resolve:(e,c)=>{for(const m of [...foeM(e,c),...hand(e,1-c.owner)].filter(m=>monster(m)&&(def(m).atk||0)>=1500))e.destroy(m.uid,c.source);e.state.players[1-c.owner].y15DoomVirus={until:e.state.turn+(e.state.active===c.owner?5:4),source:c.source};}},['special']);
 E.on('added',(e,v)=>{const d=e.state.players[v.owner].y15DoomVirus;if(v.reason==='draw'&&d?.until>=e.state.turn)for(const u of v.uids){const m=card(e,u);if(m&&monster(m)&&(def(m).atk||0)>=1500)e.destroy(u,d.source);}});
 const mirror=(e,c)=>destroy(e,c,e.field(1-c.owner).map(m=>m.uid));
 watch('Mirror Force Dragon','y15-attack','attack',(e,v,f)=>v.owner!==f.owner&&e.find(v.target)?.owner===f.owner,{resolve:mirror});
 Q('Mirror Force Dragon','y15-target',{main:false,condition:(e,c)=>{const l=c.event.window?.chainLast;return l?.owner!==c.owner&&Object.values(l?.args||{}).flat().some(u=>e.find(u)?.owner===c.owner&&fm(e.find(u)?.zone));},resolve:mirror,aiResponse:()=>1600});
 for(const n of ['Legendary Knight Hermos','Legendary Knight Critias']){
  C(n).specialOnly='legend-of-heart';onEntry(n,'y15-banish',{inputs:target('选择除外的表侧魔法陷阱',e=>allS(e).filter(m=>m.faceUp),'banish'),resolve:(e,c)=>banish(e,c,args(c))},['special']);
 }
 watch('Legendary Knight Critias','y15-trap','attack',(e,v,f)=>v.target===f.card.uid,{inputs:target('选择盖放的墓地陷阱',(e,c)=>grave(e,c.owner,m=>def(m).type==='trap'),'search'),resolve:(e,c)=>E.ops['y15-booby'](e,{owner:c.owner,picks:args(c),context:{source:c.source}})});
 watch('Legendary Knight Hermos','y15-copy','attack',(e,v,f)=>v.target===f.card.uid,{once:H.once('y15-hermos','card'),inputs:target('选择复制的墓地效果怪兽',(e,c)=>grave(e,c.owner,m=>monster(m)&&!!def(m).effect),'search'),resolve:(e,c)=>{const m=self(e,c),q=card(e,first(c));if(m&&q){m.gxCopy=m.gxCopyName={id:q.id,turn:e.state.turn+(e.state.active===c.owner?2:1)};}},note:'本作适配：沿用复制系统，复制已登记主动与快速效果和原名，不复制独立诱发与被动效果。'});
 root.DuelChronicleCopies.registerHost('Legendary Knight Hermos');
 C('Timaeus the Knight of Destiny').specialOnly='y15-timaeus';C('Timaeus the Knight of Destiny').contactOnly=true;
 A('Timaeus the Knight of Destiny','y15-contact',{zones:['extra'],inherent:true,summons:true,inputs:(e,c)=>['Timaeus','Critias','Hermos'].map(n=>g(e,c,n,'选择传说的骑士',ownM(e,c).filter(m=>is(m,'Legendary Knight '+n)&&canSend(e,m)),1,1,'cost')),cost:(e,c)=>{const us=['Timaeus','Critias','Hermos'].flatMap(n=>args(c,n));c.y15Materials=us.map(u=>e.describe(card(e,u)));H.sendCost(e,c,us);},resolve:(e,c)=>revive(e,c,c.uid,{via:'y15-timaeus',materials:c.y15Materials}),aiScore:1600});
 extend('canSpecial',function(prior,p,m,o={}){return !(is(m,'Timaeus the Knight of Destiny')&&!o.ignoreConditions&&o.via!=='y15-timaeus')&&prior.call(this,p,m,o);});
 extend('unaffected',function(prior,m,s){return is(m,'Timaeus the Knight of Destiny')&&m.faceUp&&fm(this.find(m.uid)?.zone)&&!this.negated(m)&&s?.uid!==m.uid||prior.call(this,m,s);});
 Q('Timaeus the Knight of Destiny','y15-stats',{main:false,damageStep:true,condition:(e,c)=>{const a=c.event.window?.attack;return a?.stage==='calc'&&[a.uid,a.target].includes(c.uid)&&self(e,c)?.y15TimaeusBattle!==a.serial;},resolve:(e,c)=>{const m=self(e,c);if(m){m.y15TimaeusBattle=c.event.window.attack.serial;e.modify(m.uid,'both','set',Math.max(...allM(e).map(q=>e.attackValue(q))),e.state.turn,c.source);}},aiResponse:()=>1100});
 onMove('Timaeus the Knight of Destiny','y15-knights',{summons:true,resolve:(e,c)=>specialChoice(e,c,[...hand(e,c.owner),...deck(e,c.owner),...grave(e,c.owner)].filter(m=>series(m,'Legendary Knight')),{via:'effect',ignoreConditions:true,max:3,shuffle:true})},(e,v)=>v.kind==='battle');
 cast('Tyrant Wing',e=>allM(e).filter(m=>m.faceUp&&e.race(m)==='龙族'),(e,c)=>{const s=card(e,c.uid);if(s)s.equipTarget=first(c);},{role:'own-boost'});
 passive('Tyrant Wing',{stat:(e,s,m)=>s.card.equipTarget===m.uid?400:0});
 extend('attackAllowance',function(prior,m,...a){return this.activeEquip(m).some(q=>is(q,'Tyrant Wing'))?Math.max(2,prior.call(this,m,...a)):prior.call(this,m,...a);});
 extend('canAttack',function(prior,m,p=this.state.active,t=null){return !(m.attacksMade>=1&&!t&&this.activeEquip(m).some(q=>is(q,'Tyrant Wing')))&&prior.call(this,m,p,t);});
 onEnd('Tyrant Wing',{condition:(e,c)=>{const m=card(e,card(e,c.uid)?.equipTarget);return !!m&&m.attacksMade>0;},resolve:(e,c)=>e.destroy(c.uid,c.source)},{zones:['spells'],mandatory:true});
 cast('Roulette Spider',null,(e,c)=>{const a=e.state.frame?.attack;if(!a)return;const n=X.die(e,c),m=card(e,a.uid);if(n===1)e.loseLP(c.owner,Math.ceil(e.state.players[c.owner].lp/2),c.source);if(n===2){a.target=null;a.targetGeneration=null;}if(n===3||n===4)choose(e,c,'选择新的攻击对象',e.monsters(n===3?c.owner:1-c.owner).filter(q=>q.uid!==a.uid),1,1,'y15-roulette-target',{role:'target'});if(n===5&&e.negateAttack()&&m)e.damage(1-c.owner,e.attackValue(m),'效果',c.source);if(n===6)e.destroy(a.uid,c.source);},{main:false,condition:(e,c)=>c.event.window?.attack?.owner!==c.owner&&c.event.window?.attack?.stage==='declare',aiResponse:()=>900});
 E.op('y15-roulette-target',(e,t)=>{const a=e.state.frame?.attack,m=card(e,t.picks[0]);if(a&&m){a.target=m.uid;a.targetGeneration=m.generation;a.stage='calc';}});
})(globalThis);
