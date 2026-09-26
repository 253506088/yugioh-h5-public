/* Toon World support and the 2015 Toon monsters. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,C,I,is,A,Q,passive,mark,extend,card,def,field,monster,active,allF,allM,allS,ownM,foeM,hand,deck,grave,first,args,self,src,g,choose,target,moved,destroy,onEntry,onMove,onEnd,watch,revive,search,specialChoice,series,effect,cast,defer,lock,locked}=X;
 const Y=X.year2015,{fm,pend,live,limit,back,send,banish,destroyed,pickSend}=Y,toon=m=>!!def(m)?.toon||!!m?.y15Comic,world=(e,p)=>e.hasEarly('Toon World',p),names=['Toon Cyber Dragon','Toon Ancient Gear Golem','Toon Barrel Dragon','Toon Buster Blader'];
 for(const n of names)mark(n);
 X.specialSelf('Toon Cyber Dragon',(e,c)=>foeM(e,c).length>0&&ownM(e,c).length===0);
 extend('canAttack',function(prior,m,p=this.state.active,t=null){return !(names.some(n=>is(m,n))&&m.summonTurn===this.state.turn)&&prior.call(this,m,p,t);});
 extend('canDirect',function(prior,m,p=this.state.active){if((names.some(n=>is(m,n))||m.y15Comic)&&!this.negated(m)&&world(this,p)&&!this.monsters(1-p).some(q=>q.faceUp&&toon(q)))return true;return prior.call(this,m,p);});
 X.rule('Toon Ancient Gear Golem',{piercing:true});
 extend('earlyCanUse',function(prior,c,a){const b=c.event.window?.attack;if(b&&is(card(this,b.uid),'Toon Ancient Gear Golem')&&b.owner!==c.owner&&!this.negated(card(this,b.uid))&&a.cardActivation&&['spell','trap'].includes(c.source.effectType))return false;return prior.call(this,c,a);});
 effect('Toon Barrel Dragon',allF,(e,c)=>{if(X.coin(e,c,3)>=2)destroy(e,c,args(c));},{mode:'y15-coin'});
 passive('Toon Buster Blader',{stat:(e,s,m,k)=>k==='atk'&&m.uid===s.card.uid?500*[...e.monsters(1-s.owner),...grave(e,1-s.owner)].filter(q=>monster(q)&&e.race(q)==='龙族').length:0});
 C('Toon Kingdom').nameAlias='Toon World';
 cast('Toon Kingdom',null,(e,c)=>{const us=deck(e,c.owner).slice(0,3).map(m=>m.uid);banish(e,c,us);for(const u of us)if(e.find(u)?.zone==='banished')card(e,u).faceUp=false;},{condition:(e,c)=>deck(e,c.owner).length>=3});
 extend('canTarget',function(prior,m,s){const f=this.find(m?.uid);return !(f&&fm(f.zone)&&toon(m)&&s?.owner!==f.owner&&live(this,'Toon Kingdom',f.owner).length)&&prior.call(this,m,s);});
 extend('destroy',function(prior,u,s,b=false,...a){const f=this.find(u);if(f&&fm(f.zone)&&toon(f.card)&&live(this,'Toon Kingdom',f.owner).length&&this.state.eraNoBanishAt!==this.state.turn){const top=this.state.players[f.owner].deck[0];if(top){const r=this.move(top.uid,'banished',{kind:'effect-banish',source:src(this,live(this,'Toon Kingdom',f.owner)[0].card),byOwner:f.owner});if(r.to==='banished'){top.faceUp=false;return false;}}}return prior.call(this,u,s,b,...a);});
 mark('Toon Kingdom','本作适配：以卡组顶里侧除外代替卡通怪兽破坏的选项自动适用。');
 cast('Shadow Toon',(e,c)=>foeM(e,c).filter(m=>m.faceUp),(e,c)=>{const m=card(e,first(c));if(m)e.damage(1-c.owner,e.attackValue(m),'效果',c.source);},{once:limit('shadow-toon'),condition:(e,c)=>world(e,c.owner)});
 cast('Toon Rollback',(e,c)=>ownM(e,c).filter(toon),(e,c)=>{const m=card(e,first(c));if(m)m.y15Double=e.state.turn;},{role:'own-boost'});
 cast('Comic Hand',(e,c)=>foeM(e,c).filter(m=>m.faceUp),(e,c)=>{const u=first(c),s=card(e,c.uid);if(s&&e.takeControl(u,c.owner,{until:null})){s.equipTarget=u;s.y15ComicOwner=1-c.owner;card(e,u).y15Comic=true;}},{condition:(e,c)=>world(e,c.owner),role:'control'});
 extend('continuousMaintenance',function(prior){let changed=prior.call(this);for(const f of live(this,'Comic Hand'))if(!this.hasEarly('Toon World'))changed=this.destroy(f.card.uid,src(this,f.card))||changed;return changed;});
 E.on('move',(e,v)=>{if(v.from==='spells'&&is({id:v.id},'Comic Hand')&&v.previous?.equipTarget){const m=card(e,v.previous.equipTarget);if(m&&fm(e.find(m.uid)?.zone)){delete m.y15Comic;e.takeControl(m.uid,v.previous.y15ComicOwner,{until:null});}}});
 cast('Mimicat',(e,c)=>grave(e,1-c.owner),(e,c)=>{const m=card(e,first(c));if(!m)return;if(monster(m))revive(e,c,m.uid);else X.setFrom(e,c,[m]);},{once:limit('mimicat'),summons:true,condition:(e,c)=>world(e,c.owner)&&ownM(e,c).some(toon),role:'special'});
 cast('Toon Mask',(e,c)=>foeM(e,c).filter(m=>m.faceUp),(e,c)=>{const q=card(e,first(c));if(q)specialChoice(e,c,[...hand(e,c.owner),...deck(e,c.owner)].filter(m=>toon(m)&&(def(m).level||0)<=(e.level(q)||def(q).rank||0)),{via:'effect',ignoreConditions:true,shuffle:true});},{summons:true,condition:(e,c)=>world(e,c.owner),role:'special'});
 X.eventTrap('Toon Briefcase','summon',(e,v,p)=>v.owner!==p&&e.monsters(p).some(toon),{resolve:(e,c)=>{if(card(e,c.event.uid)&&fm(e.find(c.event.uid)?.zone))back(e,c,[c.event.uid]);}});
})(globalThis);
