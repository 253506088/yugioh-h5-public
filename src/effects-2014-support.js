/* Explicit supporting rules for the 2014 annual decks and Pendulum foundation. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,C,I,is,A,Q,R,passive,mark,extend,allM,allS,allF,monster,ownM,foeM,hand,deck,grave,first,args,self,src,active,field,g,choose,target,moved,destroy,onEntry,onMove,onEnd,revive,search,specialChoice,series,guard,card,def,effect,cast,watch}=X;
 const live=(e,n,p=null)=>allF(e).filter(m=>is(m,n)&&(p===null||e.find(m.uid)?.owner===p)&&active(e,m));
 const sh=m=>series(m,'Shaddoll'),qli=m=>series(m,'Qli'),tell=m=>series(m,'tellarknight');
 for(const n of ['Flash Knight','Mandragon','Dragong'])mark(n,'通常灵摆怪兽：无灵摆效果；刻度、灵摆召唤与表侧额外规则');
 for(const d of D.CARD_LIST.filter(m=>monster(m)&&qli(m))){d.family='qliphort';d.families=[...new Set([...(d.families||[]),'qliphort'])];if(d.type==='pendulum'&&d.effect)d.qliReduced=true;}
 // Qli's restriction cannot be negated, but only an actual, resolved scale
 // applies it: a Qli equipped to another monster is not a Pendulum Zone card.
 extend('canSpecial',function(prior,p,m,o={}){if(this.scales(p).some(s=>s&&qli(s.card))&&!qli(m))return false;return prior.call(this,p,m,o);});
 for(const n of ['Qliphort Shell','Qliphort Cephalopod'])passive(n,{stat:(e,s,m,k)=>e.isPendulumScale(s.card)&&k==='atk'&&e.find(m.uid)?.owner!==s.owner?-300:0});
 onEntry('Qliphort Shell','qli-shell',{mandatory:true,condition:(e,c)=>!!self(e,c)?.tributedQli,resolve:(e,c)=>{const m=self(e,c);if(m)m.eraQliShell=true;}},['normal']);
 extend('attackAllowance',function(prior,m,...a){return Math.max(prior.call(this,m,...a),m.eraQliShell&&!this.negated(m)?2:1);});
 extend('finishBattle',function(prior,a){const m=card(this,a.uid),t=card(this,a.target),amount=m?.eraQliShell&&!this.negated(m)&&t?.position==='defense'?Math.max(0,this.attackValue(m,a)-this.defenseValue(t,a)):0,p=t&&this.find(t.uid)?.owner;const r=prior.call(this,a);if(amount&&!a.cancelDamage&&this.state.winner===null)this.damage(p,amount,'战斗',src(this,m));return r;});
 onEntry('Qliphort Cephalopod','qli-drain',{condition:(e,c)=>!!self(e,c)?.tributedQli&&grave(e,1-c.owner,monster).length>grave(e,c.owner,monster).length,resolve:(e,c)=>{const n=Math.max(0,grave(e,1-c.owner,monster).length-grave(e,c.owner,monster).length)*300;if(n){e.heal(c.owner,n);e.damage(1-c.owner,n,'效果',c.source);}}},['normal']);
 C('Apoqliphort Skybase').noSpecial=true;C('Apoqliphort Skybase').tributeCount=3;C('Apoqliphort Skybase').tributeFamily='qliphort';
 effect('Apoqliphort Skybase',foeM,(e,c)=>e.takeControl(first(c),c.owner,{until:e.state.turn}),{mode:'qli-control',role:'control'});
 extend('unaffected',function(prior,m,s){if(is(m,'Apoqliphort Skybase')&&m.normalSummoned&&!this.negated(m)&&['spell','trap','pendulum-spell'].includes(s?.effectType))return true;return prior.call(this,m,s);});
 cast('Laser Qlip',null,()=>{});
 extend('canNormal',function(prior,m,p=this.state.active){if(qli(m)&&this.state.normalUsed&&!this.state.players[p].extraNormalUsed&&live(this,'Laser Qlip',p).length){const used=this.state.normalUsed;try{this.state.normalUsed=false;return prior.call(this,m,p);}finally{this.state.normalUsed=used;}}return prior.call(this,m,p);});
 extend('earlyCanUse',function(prior,c,a){const w=c.event?.window;if(a.summonNegation&&w?.summonKind==='normal'&&qli(card(this,w.uid))&&live(this,'Laser Qlip',w.owner).length)return false;return prior.call(this,c,a);});
 cast('Qlimate Change',(e,c)=>e.state.players[c.owner].extra.filter(m=>m.faceUpExtra&&qli(m)),(e,c)=>moved(e,c,args(c),'hand','effect-return'),{max:3,role:'search'});
 cast('Qlipper Launch',null,(e,c)=>{for(const m of allM(e).filter(m=>m.faceUp&&qli(m)&&m.normalSummoned)){m.eraQliLaunch=e.state.turn;X.negateMonster(e,m.uid);}},{condition:(e,c)=>ownM(e,c).some(m=>m.faceUp&&qli(m)&&m.normalSummoned)});
 extend('unaffected',function(prior,m,s){return !!m&&m.eraQliLaunch>=this.state.turn&&['spell','trap','pendulum-spell'].includes(s?.effectType)||prior.call(this,m,s);});
 extend('attackValue',function(prior,m,...a){const value=prior.call(this,m,...a);return m?.eraQliLaunch>=this.state.turn?value+300:value;});
 onEntry('Mathematician','year-send',{resolve:(e,c)=>choose(e,c,'选择送墓的4星以下怪兽',deck(e,c.owner,m=>monster(m)&&e.level(m)<=4),1,1,'early-move',{to:'grave',kind:'effect-send',shuffle:true,role:'search'})},['normal']);
 onMove('Mathematician','year-draw',{resolve:(e,c)=>e.draw(c.owner,1)},(e,v)=>v.to==='grave'&&v.kind==='battle');
 cast('Soul Charge',(e,c)=>grave(e,c.owner,m=>monster(m)&&e.canSpecial(c.owner,m,{via:'revive'})),(e,c)=>{let n=0;for(const u of args(c))if(revive(e,c,u))n++;if(n)e.loseLP(c.owner,n*1000,c.source);},{min:1,max:5,summons:true,once:H.once('soul-charge','name'),condition:(e,c)=>e.freeMain(c.owner)>0&&!(e.state.players[c.owner].eraBattleConducted===e.state.turn),cost:(e,c)=>{e.state.players[c.owner].skipBattleTurn=e.state.turn;},role:'special'});
 extend('act',function(prior,a){const p=this.state.active,turn=this.state.turn,r=prior.call(this,a);if(r.ok&&a.type==='phase'&&a.phase==='battle')this.state.players[p].eraBattleConducted=turn;return r;});
 cast('Sinister Shadow Games',null,(e,c)=>choose(e,c,'选择送墓的影依卡片',deck(e,c.owner,sh),1,1,'shaddoll-games-send',{role:'search'}),{condition:(e,c)=>deck(e,c.owner,sh).length>0});
 E.op('shaddoll-games-send',(e,t)=>{moved(e,{owner:t.owner,source:t.context.source},t.picks,'grave','effect-send');e.shuffle(e.state.players[t.owner].deck);const list=ownM(e,{owner:t.owner}).filter(m=>sh(m)&&!m.faceUp&&m.position==='defense');if(list.length)choose(e,{owner:t.owner,source:t.context.source},'选择翻开的影依怪兽',list,0,list.length,'shaddoll-games-flip');});
 E.op('shaddoll-games-flip',(e,t)=>{for(const u of t.picks){const m=card(e,u);if(m&&!m.faceUp&&sh(m))e.flipFaceUp(u,{position:'defense',source:t.context.source});}});
 cast('Nephe Shaddoll Fusion',null,(e,c)=>{const m=card(e,c.uid);if(m){m.equipTarget=first(c);m.eraNepheAttribute=first(c,'attribute');}},{inputs:(e,c)=>[g(e,c,'target','选择装备的影依怪兽',allM(e).filter(m=>m.faceUp&&sh(m)),1,1,'own-boost'),H.customGroup('attribute','宣言属性',['光','暗','地','水','炎','风','神'].map(v=>({uid:v,label:v})))]});
 extend('attribute',function(prior,m){const s=live(this,'Nephe Shaddoll Fusion').find(s=>s.equipTarget===m.uid);return s?.eraNepheAttribute||prior.call(this,m);});
 const nephe=(e,c)=>{const s=card(e,c.uid),m=s&&card(e,s.equipTarget);return m?{theme2014:'shaddoll',spellId:c.sourceId,zones:['hand','monsters','extraMonster'],requiredUid:m.uid,requiredZone:e.find(m.uid).zone,requiredGeneration:m.generation||0}:null;};
 A('Nephe Shaddoll Fusion','year-fusion',{zones:['spells'],effectType:'spell',once:H.once('nephe','name'),summons:true,condition:(e,c)=>!!nephe(e,c)&&e.fusions(c.owner,nephe(e,c)).length>0,resolve:(e,c)=>{const profile=nephe(e,c);if(profile)choose(e,c,'选择影依融合怪兽',e.fusions(c.owner,profile).map(f=>f.card),1,1,'theme2014-fusion',{profile,role:'special'});},aiScore:1100});
 effect('Castel, the Skyblaster Musketeer',(e,c)=>allM(e).filter(m=>m.faceUp),(e,c)=>e.setPosition(first(c),'defense',c.source,true),{mode:'year-set',detach:1,once:H.once('castel','name')});
 effect('Castel, the Skyblaster Musketeer',(e,c)=>allF(e).filter(m=>m.faceUp),(e,c)=>{moved(e,c,args(c),'deck','effect-return');for(const p of e.state.players)e.shuffle(p.deck);},{mode:'year-shuffle',detach:2,once:H.once('castel','name'),role:'bounce'});
 effect('Dark Rebellion Xyz Dragon',(e,c)=>foeM(e,c).filter(m=>m.faceUp),(e,c)=>{const m=card(e,first(c));if(!m)return;const n=Math.ceil(e.attackValue(m)/2);e.modify(m.uid,'atk','add',-n,null,c.source);if(self(e,c))e.modify(c.uid,'atk','add',n,null,c.source);},{mode:'year-drain',detach:2,oncePerTurn:false});
 onEntry('Elder Entity Norden','year-revive',{summons:true,inputs:target('选择复活的4星以下怪兽',(e,c)=>grave(e,c.owner,m=>monster(m)&&e.level(m)<=4),'special'),resolve:(e,c)=>{const m=revive(e,c,first(c),{negated:true});if(m){m.eraNorden={uid:c.uid,generation:card(e,c.uid)?.generation||0};}}},['special']);
 E.on('move',(e,v)=>{if(!field(v.from))return;for(const m of allM(e))if(m.eraNorden?.uid===v.uid&&m.eraNorden.generation===(v.previous?.generation||0))e.move(m.uid,'banished',{kind:'effect-banish',source:v.source,byOwner:v.owner});});
 for(const n of ['Timegazer Magician','Stargazer Magician']){
  const other=n==='Timegazer Magician'?'Stargazer Magician':'Timegazer Magician',blocked=n==='Timegazer Magician'?'trap':'spell';
  extend('pendulumScale',function(prior,m){if(is(m,n)&&this.isPendulumScale(m)&&active(this,m)){const f=this.find(m.uid),s=this.state.players[f.owner].spells[f.index===0?4:0];if(!s||!this.isPendulumScale(s)||!series(s,'Magician')&&!series(s,'Odd-Eyes'))return 4;}return prior.call(this,m);});
  extend('earlyCanUse',function(prior,c,a){const attack=c.event?.window?.attack;if(a.cardActivation&&c.source.effectType===blocked&&attack&&live(this,n,1-c.owner).some(m=>this.isPendulumScale(m))){const m=card(this,attack.uid),t=card(this,attack.target);if([m,t].some(m=>m&&def(m).type==='pendulum'&&this.find(m.uid)?.owner!==c.owner))return false;}return prior.call(this,c,a);});
  mark(n,'刻度条件、攻击时魔法／陷阱封锁与灵摆区保护');
 }
 extend('canActivatePendulumScale',function(prior,m,p){return !(is(m,'Timegazer Magician')&&this.monsters(p).length)&&prior.call(this,m,p);});
 // Both Magicians protect scales by battle-position-independent monster effects.
 extend('destroy',function(prior,u,s,b=false,...a){const f=this.find(u),m=f?.card;if(!b&&m&&this.isPendulumScale(m)&&s?.owner!==f.owner&&allM(this).some(q=>is(q,'Timegazer Magician')&&active(this,q)&&this.find(q.uid)?.owner===f.owner)&&this.state.players[f.owner].eraTimegazerProtected!==this.state.turn){this.state.players[f.owner].eraTimegazerProtected=this.state.turn;return false;}return prior.call(this,u,s,b,...a);});
 cast('Pendulum Back',(e,c)=>{const ss=e.scales(c.owner);if(ss.some(s=>!s))return [];const [lo,hi]=ss.map(s=>s.scale).sort((a,b)=>a-b);return grave(e,c.owner,m=>monster(m)&&e.level(m)>lo&&e.level(m)<hi);},(e,c)=>moved(e,c,args(c),'hand','effect-return'),{min:2,max:2,role:'search'});
 cast('Pendulum Shift',null,(e,c)=>{const m=card(e,first(c));if(m&&e.isPendulumScale(m))m.pendulumScaleOverride={value:Number(first(c,'scale')),until:e.state.turn};},{inputs:(e,c)=>[g(e,c,'target','选择灵摆区卡片',[0,1].flatMap(p=>e.scales(p).filter(Boolean).map(s=>s.card))),H.customGroup('scale','宣言1—10的刻度',Array.from({length:10},(_,i)=>({uid:String(i+1),label:String(i+1)})))]});
 onEnd("Foucault's Cannon",{zones:['spells'],effectType:'spell',inputs:target('选择破坏的表侧魔法陷阱',(e,c)=>allS(e).filter(m=>m.faceUp)),resolve:(e,c)=>destroy(e,c,args(c))},{zones:['spells']});
 X.year2014.nephe=nephe;
})(globalThis);
