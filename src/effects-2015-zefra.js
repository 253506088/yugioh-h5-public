/* Zefra scales retain both archetypes and share exact name-based limits. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,C,I,is,A,Q,passive,mark,extend,card,def,field,monster,active,allF,allM,allS,ownM,foeM,hand,deck,grave,first,args,self,src,g,choose,target,moved,destroy,onEntry,onMove,onEnd,watch,revive,search,specialChoice,series,effect,cast,defer,lock,locked}=X;
 const Y=X.year2015,{fm,pend,live,limit,other,ps,back,send,banish,destroyed,pickSend}=Y,zef=m=>series(m,'Zefra'),scales=(e,p)=>e.scales(p).filter(Boolean).map(s=>s.card);
 const themes={Nekroz:['Zefraxa, Flame Beast of the Nekroz','Zefrasaber, Swordmaster of the Nekroz'],'Yang Zing':['Zefraxi, Treasure of the Yang Zing','Zefraniu, Secret of the Yang Zing'],tellarknight:['Stellarknight Zefraxciton','Satellarknight Zefrathuban'],'Ritual Beast':['Ritual Beast Tamer Zefrawendi','Ritual Beast Tamer Zeframpilica'],Shaddoll:['Shaddoll Zefranaga','Shaddoll Zefracore']};
 extend('canSpecial',function(prior,p,m,o={}){if(o.via==='pendulum')for(const s of scales(this,p))for(const [theme,names] of Object.entries(themes))if(names.some(n=>is(s,n))&&!zef(m)&&!series(m,theme))return false;return prior.call(this,p,m,o);});
 watch('Zefraxa, Flame Beast of the Nekroz','y15-revive','move',(e,v,f)=>v.owner===f.owner&&v.id!==f.card.id&&v.previous?.faceUp&&(fm(v.from)||v.from==='spells')&&destroyed(e,v)&&(zef({id:v.id})||series({id:v.id},'Nekroz')),{once:limit('zefraxa'),summons:true,resolve:(e,c)=>revive(e,c,c.uid,{via:'effect'})},{zones:['hand','grave']});
 onEntry('Zefraxi, Treasure of the Yang Zing','y15-tuner',{once:limit('zefraxi'),condition:(e,c)=>c.event.kind==='pendulum'||c.event.from==='deck',inputs:target('选择变为调整的龙星或灵摆士',(e,c)=>ownM(e,c).filter(m=>m.faceUp&&m.uid!==c.uid&&(zef(m)||series(m,'Yang Zing'))),'own-boost'),resolve:(e,c)=>{const m=card(e,first(c)),s=self(e,c);if(m&&!e.unaffected(m,c.source))m.y15Tuner=e.state.turn;if(s)s.y15ZefraBottom=true;}},['special']);
 extend('isTuner',function(prior,m){return m?.y15Tuner===this.state.turn||prior.call(this,m);});
 extend('move',function(prior,u,to,o={}){const f=this.find(u),bottom=f&&fm(f.zone)&&f.card.y15ZefraBottom;const r=prior.call(this,u,bottom?'deck':to,bottom?{...o,kind:'effect-return'}:o);return r;});
 const tellSelf=(e,c)=>e.field(c.owner).filter(m=>m.uid!==c.uid&&(fm(e.find(m.uid)?.zone)||e.isPendulumScale(m))&&(zef(m)||series(m,'tellarknight')));
 for(const [n,face] of [['Stellarknight Zefraxciton',false],['Satellarknight Zefrathuban',true]])onEntry(n,'y15-destroy',{once:limit(n),inputs:(e,c)=>[g(e,c,'own','选择自己的星骑士或灵摆士',tellSelf(e,c),1,1,'self-destroy'),g(e,c,'target','选择对方卡片',e.field(1-c.owner).filter(m=>!!m.faceUp===face))],resolve:(e,c)=>destroy(e,c,[...args(c,'own'),...args(c)])},['normal','flip','pendulum']);
 onEntry('Ritual Beast Tamer Zefrawendi','y15-recover',{resolve:(e,c)=>search(e,c,e.state.players[c.owner].extra.filter(m=>m.faceUpExtra&&zef(m)&&m.id!==c.sourceId))},['normal','pendulum']);
 onEntry('Ritual Beast Tamer Zeframpilica','y15-revive',{summons:true,inputs:target('选择复活的灵兽或灵摆士',(e,c)=>grave(e,c.owner,m=>monster(m)&&(zef(m)||series(m,'Ritual Beast'))&&m.id!==c.sourceId),'special'),resolve:(e,c)=>{const m=revive(e,c,first(c));if(m)defer(e,c,'end',e.state.turn,'gx-delayed-move',{uid:m.uid,generation:m.generation,to:'destroy',anyOwner:true});}},['normal','pendulum']);
 for(const n of ['Ritual Beast Tamer Zefrawendi','Ritual Beast Tamer Zeframpilica']){
  extend('canSpecial',function(prior,p,m,o={}){return !(is(m,n)&&this.state.players[p].usedTurn['y15-special:'+m.id]===this.state.turn)&&prior.call(this,p,m,o);});
  E.on('summon',(e,v)=>{if(is({id:v.id},n)&&!['normal','flip','set'].includes(v.kind))e.state.players[v.owner].usedTurn['y15-special:'+v.id]=e.state.turn;});
 }
 const dual=(n,s)=>{onEntry(n,'y15-pendulum',{once:limit(n),...s},['pendulum']);onMove(n,'y15-grave',{once:limit(n),...s},(e,v)=>v.to==='grave');};
 dual('Shaddoll Zefranaga',{condition:(e,c)=>scales(e,c.owner).some(zef),inputs:target('选择返回手牌的灵摆区卡片',e=>[...scales(e,0),...scales(e,1)],'bounce'),resolve:(e,c)=>{if(scales(e,c.owner).some(zef))moved(e,c,args(c),'hand','effect-return');}});
 dual('Shaddoll Zefracore',{summons:true,inputs:target('选择特殊召唤的灵摆区灵摆士',(e,c)=>scales(e,c.owner).filter(m=>zef(m)&&m.id!==c.sourceId),'special'),resolve:(e,c)=>revive(e,c,first(c),{via:'effect'})});
 const zefraniu={once:limit('zefraniu'),resolve:(e,c)=>search(e,c,deck(e,c.owner,m=>(zef(m)||series(m,'Yang Zing'))&&['spell','trap'].includes(def(m).type)))};
 onEntry('Zefraniu, Secret of the Yang Zing','y15-search',zefraniu,['pendulum']);onMove('Zefraniu, Secret of the Yang Zing','y15-destroyed',{zones:['grave','banished','extra'],...zefraniu},(e,v)=>fm(v.from)&&destroyed(e,v));
 // The existing Nekroz ritual engine consumes a card identity as its ritual
 // profile. This monster identity supplies the same exact-level profile; it is
 // activated as a monster effect, and its own Tribute is a separate cost.
 C('Zefrasaber, Swordmaster of the Nekroz').spellKind='ritual';
 A('Zefrasaber, Swordmaster of the Nekroz','y15-ritual',{zones:['hand','monsters','extraMonster'],once:limit('zefrasaber'),summons:true,condition:(e,c)=>e.ritualOptions(c.owner,c.sourceId).some(m=>e.ritualCombos(c.owner,m,c.sourceId).some(us=>!us.includes(c.uid))),cost:(e,c)=>X.tribute(e,c,[c.uid]),resolve:(e,c)=>choose(e,c,'选择影灵衣仪式怪兽',e.ritualOptions(c.owner,c.sourceId),1,1,'early-ritual-target',{spellId:c.sourceId,role:'special'}),aiScore:1100});
 cast('Oracle of Zefra',null,(e,c)=>search(e,c,deck(e,c.owner,m=>zef(m)&&monster(m))),{once:limit('oracle')});
 for(const kind of ['ritual','fusion','synchro','xyz'])watch('Oracle of Zefra','y15-'+kind,'summon',(e,v,f)=>v.owner===f.owner&&v.kind===kind&&v.materials?.some(zef),{once:H.once('y15-oracle-'+kind,'card'),summons:kind==='fusion',resolve:(e,c)=>{
  if(kind==='ritual')choose(e,c,'选择洗回卡组的怪兽',allM(e),1,1,'y15-shuffle',{role:'bounce'});
  if(kind==='fusion')specialChoice(e,c,hand(e,c.owner,monster),{via:'effect'});
  if(kind==='synchro')choose(e,c,'选择放到卡组顶的怪兽',deck(e,c.owner,monster),1,1,'y15-oracle-top',{role:'search'});
  if(kind==='xyz')X.drawDiscard(e,c,1,1);
 }},{zones:['fieldSpell']});
 E.op('y15-oracle-top',(e,t)=>{e.shuffle(e.state.players[t.owner].deck);e.putOnDeck(t.picks[0],'top',t.context.source);});
 cast('Zefra Divine Strike',null,X.negate,{main:false,condition:(e,c)=>!!c.event.window?.chainLast,inputs:(e,c)=>[g(e,c,'cost','选择除外的表侧额外灵摆士',e.state.players[c.owner].extra.filter(m=>m.faceUpExtra&&zef(m)&&monster(m)),1,1,'cost')],cost:(e,c)=>moved(e,c,args(c,'cost'),'banished','cost-banish'),aiResponse:()=>1800});
 cast('Zefra Path',null,(e,c)=>back(e,c,ownM(e,c).filter(m=>!zef(m)).map(m=>m.uid)),{condition:(e,c)=>{const s=e.scales(c.owner);return s.every(q=>q&&zef(q.card))&&s.map(q=>q.scale).sort((a,b)=>a-b).join(',')==='1,7';}});
 extend('canSpecial',function(prior,p,m,o={}){return !(live(this,'Zefra Path').length&&!['hand','extra'].includes(this.find(m?.uid)?.zone))&&prior.call(this,p,m,o);});
 extend('canTarget',function(prior,m,s){const f=this.find(m?.uid);return !(f&&is(m,'Zefra Path')&&active(this,m)&&scales(this,f.owner).length)&&prior.call(this,m,s);});
 E.on('move',(e,v)=>{if(v.from==='spells'&&pend({id:v.id})&&destroyed(e,v))for(const f of live(e,'Zefra Path',v.owner))e.destroy(f.card.uid,src(e,f.card));});
 const count=(e,p)=>new Set(e.state.players[p].extra.filter(m=>m.faceUpExtra&&zef(m)&&monster(m)).map(m=>m.id)).size;
 cast('Chosen of Zefra',null,()=>{});
 passive('Chosen of Zefra',{stat:(e,s,m,k)=>k==='atk'&&e.find(m.uid)?.owner===s.owner&&count(e,s.owner)>=3?[0,1].flatMap(p=>e.state.players[p].extra).filter(q=>q.faceUpExtra).length*100:0,protect:(e,s,m,b,source)=>!b&&source?.owner!==s.owner&&e.find(m.uid)?.owner===s.owner&&count(e,s.owner)>=5});
 extend('canTarget',function(prior,m,s){const f=this.find(m?.uid);return !(f&&fm(f.zone)&&s?.owner!==f.owner&&count(this,f.owner)>=8&&live(this,'Chosen of Zefra',f.owner).length)&&prior.call(this,m,s);});
 A('Chosen of Zefra','y15-reset',{zones:['spells'],effectType:'trap',condition:(e,c)=>count(e,c.owner)>=10&&e.state.ruleMode?.id!=='liberation'&&H.canSendGY(e,card(e,c.uid)),cost:(e,c)=>H.sendCost(e,c,[c.uid]),resolve:(e,c)=>back(e,c,[...hand(e,1-c.owner),...e.field(1-c.owner),...grave(e,1-c.owner)].map(m=>m.uid)),aiScore:2000});
})(globalThis);
