/* Nekroz: exact-level Rituals, Extra Deck material and serializable multi-summon choices. */
(function(root){
 'use strict';
 const X=root.DuelChronicle,{D,E,H,C,I,is,A,Q,R,mark,extend,allM,allF,monster,ownM,foeM,hand,deck,grave,first,args,self,src,active,field,g,choose,target,moved,destroy,onEntry,onMove,revive,search,specialChoice,series,guard,card,def,effect,cast,watch}=X;
 const nek=m=>series(m,'Nekroz'),ritual=m=>nek(m)&&def(m).type==='ritual',spell=m=>nek(m)&&def(m).spellKind==='ritual';
 const limit=n=>H.once('nekroz-'+n,'name'),extra=m=>m.summonFrom==='extra';
 const isSpell=(id,n)=>is({id},'Nekroz '+n),isRitual=id=>spell({id});
 const validMaterial=(e,target,m)=>!(['Nekroz of Valkyrus','Nekroz of Trishula','Nekroz of Gungnir','Nekroz of Decisive Armor'].some(n=>is(target,n))&&e.level(m)===def(target).level)&&!(['Nekroz of Brionac','Nekroz of Catastor'].some(n=>is(target,n))&&m.id===target.id);
 for(const d of D.CARD_LIST.filter(ritual)){d.specialOnly='ritual';guard('special',d.officialName,(e,p,m,o)=>o.via==='ritual');}
 extend('ritualAccepts',function(prior,id,m){return isRitual(id)?ritual(m):prior.call(this,id,m);});
 extend('ritualWeight',function(prior,m,target,id){return isRitual(id)&&is(m,'Shurit, Strategist of the Nekroz')?this.level(target):prior.call(this,m,target,id);});
 extend('ritualPool',function(prior,p,m,id){
  if(!isRitual(id))return prior.call(this,p,m,id);
  let list=prior.call(this,p,m,id).filter(q=>q.uid!==m.uid&&validMaterial(this,m,q));
  if(isSpell(id,'Mirror'))list.push(...grave(this,p,q=>nek(q)&&monster(q)&&q.uid!==m.uid&&validMaterial(this,m,q)));
  if(isSpell(id,'Kaleidoscope'))list.push(...this.state.players[p].extra.filter(q=>!q.faceUpExtra&&['fusion','synchro'].includes(def(q).type)&&validMaterial(this,m,q)&&H.canSendGY(this,q)));
  return [...new Map(list.map(q=>[q.uid,q])).values()];
 });
 extend('ritualValid',function(prior,p,m,list,id){
  if(!isRitual(id))return prior.call(this,p,m,list,id);
  if(!m||!ritual(m)||this.find(m.uid)?.owner!==p||!(isSpell(id,'Cycle')?['hand','grave']:['hand']).includes(this.find(m.uid)?.zone)||!this.canSpecial(p,m,{via:'ritual'}))return false;
  const pool=new Set(this.ritualPool(p,m,id).map(q=>q.uid));
  return list.length>0&&(!isSpell(id,'Kaleidoscope')||list.length===1)&&new Set(list.map(q=>q?.uid)).size===list.length&&list.every(q=>q&&pool.has(q.uid)&&validMaterial(this,m,q))&&list.reduce((n,q)=>n+this.ritualWeight(q,m,id),0)===this.level(m)&&this.freeZones(p,m,{materials:list.map(q=>q.uid)}).length>0;
 });
 extend('ritualOptions',function(prior,p,id){return isSpell(id,'Cycle')?[...hand(this,p),...grave(this,p)].filter(m=>ritual(m)&&this.ritualCombos(p,m,id).length):prior.call(this,p,id);});
 function summon(e,p,targets,materials,id,source,position='attack',zone=null){
  const snapshots=materials.map(m=>e.describe(m));
  for(const m of materials){const z=e.find(m.uid).zone,banish=z==='grave';e.move(m.uid,banish?'banished':'grave',{kind:banish?'effect-ritual-banish':z==='extra'?'effect-ritual-material':'effect-ritual-tribute',source,byOwner:p});}
  const results=[];
  for(const m of targets){const r=e.special(p,m.uid,{via:'ritual',position,materials:snapshots,...(zone===null?{}:{zone})});if(r){r.eraDjinnMaterials=snapshots.filter(q=>def(q).eraDjinn).map(q=>q.id);r.eraRitualSpell=id;results.push(r);e.emit({type:'era-ritual',owner:p,uid:r.uid,id:r.id,spellId:id,source,materials:snapshots});}}
  return results;
 }
 extend('performRitual',function(prior,p,uid,uids,id,s,z=null,pos='attack'){
  if(!isRitual(id))return prior.call(this,p,uid,uids,id,s,z,pos);
  const m=card(this,uid),ms=uids.map(u=>card(this,u));if(!this.ritualValid(p,m,ms,id))throw new root.DuelRuleError('影灵衣仪式素材、等级或召唤限制不满足。');return summon(this,p,[m],ms,id,s,pos,z)[0];
 });
 // A choice contains identities only. It is reconstructed and revalidated on
 // resolution, and can be persisted during any choice or chain window.
 function kaleidoscope(e,p){
  const id=I('Nekroz Kaleidoscope'),targets=hand(e,p,ritual).filter(m=>e.canSpecial(p,m,{via:'ritual'})),out=[];
  const materials=[...e.refs(p,['hand','monsters','extraMonster']).map(f=>f.card).filter(m=>monster(m)&&e.level(m)>0&&e.canTribute(m,p,'ritual')),...e.state.players[p].extra.filter(m=>!m.faceUpExtra&&['fusion','synchro'].includes(def(m).type)&&H.canSendGY(e,m))];
  for(const m of materials){const capacity=e.freeMain(p)+(X.year2014.fieldMonster(e.find(m.uid)?.zone)?1:0),need=e.level(m);const walk=(at,list,sum)=>{if(out.length>=200)return;if(list.length&&list.length<=capacity&&(sum===need||list.length===1&&is(m,'Shurit, Strategist of the Nekroz'))){out.push({material:m.uid,targets:list.map(q=>q.uid)});if(sum===need)return;}if(sum>=need||list.length>=capacity)return;for(let i=at;i<targets.length;i++){const t=targets[i];if(t.uid!==m.uid&&validMaterial(e,t,m))walk(i+1,[...list,t],sum+e.level(t));}};walk(0,[],0);}
  return out;
 }
 cast('Nekroz Kaleidoscope',null,(e,c)=>{const list=kaleidoscope(e,c.owner);if(list.length)e.queueChoice(c.owner,'选择万华镜的仪式怪兽与素材',list.map(s=>({uid:JSON.stringify(s),label:s.targets.map(u=>def(card(e,u)).name).join(' + ')+' ← '+def(card(e,s.material)).name,value:s.targets.reduce((n,u)=>n+(def(card(e,u)).atk||0)+1200,0)})),1,1,'nekroz-kaleidoscope',{source:c.source});},{once:limit('Kaleidoscope'),summons:true,condition:(e,c)=>kaleidoscope(e,c.owner).length>0});
 E.op('nekroz-kaleidoscope',(e,t)=>{const chosen=kaleidoscope(e,t.owner).find(s=>JSON.stringify(s)===t.picks[0]);if(chosen)summon(e,t.owner,chosen.targets.map(u=>card(e,u)),[card(e,chosen.material)],I('Nekroz Kaleidoscope'),t.context.source);});
 for(const n of ['Mirror','Cycle'])cast('Nekroz '+n,null,(e,c)=>choose(e,c,'选择影灵衣仪式怪兽',e.ritualOptions(c.owner,c.sourceId),1,1,'early-ritual-target',{spellId:c.sourceId,role:'special'}),{once:limit(n),summons:true,condition:(e,c)=>e.ritualOptions(c.owner,c.sourceId).length>0});
 for(const n of ['Mirror','Cycle','Kaleidoscope'])A('Nekroz '+n,'nekroz-recycle',{zones:['grave'],condition:(e,c)=>!ownM(e,c).length&&grave(e,c.owner,m=>nek(m)&&monster(m)).length>0,inputs:(e,c)=>[g(e,c,'cost','选择除外的影灵衣怪兽',grave(e,c.owner,m=>nek(m)&&monster(m)),1,1,'cost')],cost:(e,c)=>moved(e,c,[c.uid,...args(c,'cost')],'banished','cost-banish'),banishesCost:true,resolve:(e,c)=>search(e,c,deck(e,c.owner,m=>nek(m)&&def(m).type==='spell')),aiScore:900});
 function discard(n,mode,pool,resolve,s={}){A(n,mode,{zones:['hand'],once:limit(n+'-'+mode),...(pool?{inputs:target('选择影灵衣效果对象',pool,'search')}:{}),cost:(e,c)=>H.discard(e,c,[c.uid]),resolve,aiScore:950,...s});}
 discard('Nekroz of Brionac','nekroz-search',null,(e,c)=>search(e,c,deck(e,c.owner,m=>nek(m)&&monster(m)&&m.id!==c.sourceId)),{condition:(e,c)=>deck(e,c.owner,m=>nek(m)&&monster(m)&&m.id!==c.sourceId).length>0});
 discard('Nekroz of Clausolas','nekroz-search',null,(e,c)=>search(e,c,deck(e,c.owner,m=>nek(m)&&['spell','trap'].includes(def(m).type))),{condition:(e,c)=>deck(e,c.owner,m=>nek(m)&&['spell','trap'].includes(def(m).type)).length>0});
 discard('Nekroz of Unicore','nekroz-recover',(e,c)=>grave(e,c.owner,m=>nek(m)&&m.id!==c.sourceId),(e,c)=>moved(e,c,args(c),'hand','effect-return'));
 discard('Nekroz of Catastor','nekroz-revive',(e,c)=>grave(e,c.owner,m=>nek(m)&&monster(m)&&e.canSpecial(c.owner,m,{via:'revive'})),(e,c)=>revive(e,c,first(c)),{summons:true});
 effect('Nekroz of Brionac',(e,c)=>allM(e).filter(m=>m.faceUp&&extra(m)),(e,c)=>{moved(e,c,args(c),'deck','effect-return');for(const p of e.state.players)e.shuffle(p.deck);},{mode:'nekroz-bounce',max:2,once:limit('brionac-bounce'),role:'bounce'});
 Q('Nekroz of Clausolas','nekroz-negate',{once:limit('clausolas-negate'),inputs:target('选择从额外登场的怪兽',(e,c)=>allM(e).filter(m=>m.faceUp&&extra(m))),resolve:(e,c)=>{const m=card(e,first(c));if(m){e.modify(m.uid,'atk','set',0,e.state.turn,c.source);X.negateMonster(e,m.uid);}},aiResponse:()=>1300});
 const rawUnicore=e=>allM(e).some(m=>is(m,'Nekroz of Unicore')&&m.faceUp&&!m.effectNegated&&!(m.eraNegatedUntil>=e.state.turn)&&!e.rawEarly('Skill Drain').length);
 extend('negated',function(prior,m){return !!m&&m.faceUp&&field(this.find(m.uid)?.zone)&&extra(m)&&rawUnicore(this)||prior.call(this,m);});
 for(const [n,mode] of [['Nekroz of Decisive Armor','boost'],['Nekroz of Gungnir','protect']])Q(n,'nekroz-hand',{zones:['hand'],once:limit(n+'-hand'),inputs:target('选择自己的影灵衣怪兽',(e,c)=>ownM(e,c).filter(m=>m.faceUp&&nek(m)),'own-boost'),cost:(e,c)=>H.discard(e,c,[c.uid]),resolve:(e,c)=>{const m=card(e,first(c));if(!m)return;if(mode==='boost'){e.modify(m.uid,'atk','add',1000,e.state.turn,c.source);e.modify(m.uid,'def','add',1000,e.state.turn,c.source);}else m.eraNekrozProtection=e.state.turn;},aiResponse:()=>900});
 extend('destroy',function(prior,uid,s,b=false,...a){if(card(this,uid)?.eraNekrozProtection>=this.state.turn)return false;return prior.call(this,uid,s,b,...a);});
 effect('Nekroz of Gungnir',allF,(e,c)=>destroy(e,c,args(c)),{mode:'nekroz-destroy',quick:true,once:limit('gungnir-destroy'),inputs:(e,c)=>[g(e,c,'cost','选择丢弃的影灵衣',hand(e,c.owner,nek),1,1,'cost'),g(e,c,'target','选择破坏的卡片',allF(e))],cost:(e,c)=>H.discard(e,c,args(c,'cost'))});
 effect('Nekroz of Decisive Armor',(e,c)=>e.field(1-c.owner).filter(m=>!m.faceUp),(e,c)=>{for(const u of args(c))if(e.destroy(u,c.source)&&e.find(u)?.zone==='grave')moved(e,c,[u],'banished','effect-banish');},{mode:'nekroz-banish',once:limit('armor-destroy')});
 effect('Nekroz of Valkyrus',null,(e,c)=>{const list=args(c,'tribute').filter(u=>{const m=card(e,u);return m&&e.canTribute(m,c.owner,'ritual');});for(const u of list)e.move(u,'grave',{kind:'effect-tribute',source:c.source,byOwner:c.owner});if(list.length)e.draw(c.owner,list.length);},{mode:'nekroz-draw',once:limit('valkyrus-draw'),inputs:(e,c)=>[g(e,c,'tribute','选择解放至多2只怪兽',[...hand(e,c.owner,monster),...ownM(e,c)].filter(m=>e.canTribute(m,c.owner,'ritual')),1,2,'cost')]});
 Q('Nekroz of Valkyrus','nekroz-stop',{zones:['hand'],main:false,once:limit('valkyrus-stop'),condition:(e,c)=>c.event.window?.kind==='attack'&&c.event.window.attack.owner!==c.owner,inputs:(e,c)=>[g(e,c,'cost','选择除外的影灵衣卡',grave(e,c.owner,nek),1,1,'cost')],cost:(e,c)=>{moved(e,c,args(c,'cost'),'banished','cost-banish');H.discard(e,c,[c.uid]);},banishesCost:true,resolve:(e,c)=>{e.negateAttack(true);},aiResponse:()=>1800});
 Q('Nekroz of Trishula','nekroz-hand',{zones:['hand'],main:false,once:limit('trishula-hand'),condition:(e,c)=>{const l=c.event.window?.chainLast;return !!l&&Object.values(l.targetMeta||{}).some(group=>Object.keys(group).some(u=>{const m=card(e,u);return m&&e.find(u)?.owner===c.owner&&field(e.find(u)?.zone)&&nek(m);}));},cost:(e,c)=>H.discard(e,c,[c.uid]),resolve:(e,c)=>e.negateLink(c.responseTo,c.source,true,false),aiResponse:()=>1500});
 onEntry('Nekroz of Trishula','nekroz-banish',{once:limit('trishula-banish'),condition:(e,c)=>hand(e,1-c.owner).length>0&&e.field(1-c.owner).length>0&&grave(e,1-c.owner).length>0,resolve:(e,c)=>{if(!hand(e,1-c.owner).length||!e.field(1-c.owner).length||!grave(e,1-c.owner).length)return;choose(e,c,'选择除外的场上卡',e.field(1-c.owner),1,1,'nekroz-trishula-field',{role:'banish'});}},['ritual']);
 E.op('nekroz-trishula-field',(e,t)=>{const c={owner:t.owner,source:t.context.source};choose(e,c,'选择除外的墓地卡',grave(e,1-t.owner),1,1,'nekroz-trishula-grave',{fieldUid:t.picks[0],role:'banish'});});
 E.op('nekroz-trishula-grave',(e,t)=>{const list=hand(e,1-t.owner),f=e.find(t.context.fieldUid),g=e.find(t.picks[0]);if(list.length&&f&&field(f.zone)&&g?.zone==='grave')moved(e,{owner:t.owner,source:t.context.source},[list[Math.floor(e.random()*list.length)].uid,f.card.uid,g.card.uid],'banished','effect-banish');});
 watch('Nekroz of Catastor','nekroz-battle','damage-start',(e,v,f)=>{const a=v.attack,m=card(e,a.uid),t=card(e,a.target);return !!m&&!!t&&[[m,t],[t,m]].some(([a,b])=>e.find(a.uid)?.owner===f.owner&&nek(a)&&b.faceUp&&extra(b));},{resolve:(e,c)=>{const a=c.event.attack,m=[card(e,a.uid),card(e,a.target)].find(m=>m&&e.find(m.uid)?.owner!==c.owner&&m.faceUp&&extra(m));if(m)destroy(e,c,[m.uid]);}},{mandatory:true});
 for(const [n,race] of [['Shurit, Strategist of the Nekroz','战士族'],['Great Sorcerer of the Nekroz','魔法师族'],['Exa, Enforcer of the Nekroz','龙族']])onMove(n,'nekroz-tribute',{once:limit(n),resolve:(e,c)=>search(e,c,deck(e,c.owner,m=>ritual(m)&&def(m).race===race))},(e,v)=>v.byEffect&&/tribute/.test(v.kind));
 onMove('Great Sorcerer of the Nekroz','nekroz-banished',{once:limit('Great Sorcerer of the Nekroz'),resolve:(e,c)=>choose(e,c,'选择送墓的影灵衣怪兽',deck(e,c.owner,m=>nek(m)&&monster(m)&&m.id!==c.sourceId),1,1,'early-move',{to:'grave',kind:'effect-send',shuffle:true,role:'search'})},(e,v)=>v.to==='banished');
 onMove('Exa, Enforcer of the Nekroz','nekroz-banished',{once:limit('Exa, Enforcer of the Nekroz'),summons:true,inputs:target('选择除外的影灵衣怪兽',(e,c)=>e.state.players[c.owner].banished.filter(m=>nek(m)&&monster(m)&&m.uid!==c.uid&&e.canSpecial(c.owner,m,{via:'revive'})),'special'),resolve:(e,c)=>revive(e,c,first(c))},(e,v)=>v.to==='banished');
 onMove('Dance Princess of the Nekroz','nekroz-tribute',{once:limit('princess'),inputs:target('选择除外的影灵衣怪兽',(e,c)=>e.state.players[c.owner].banished.filter(m=>nek(m)&&monster(m)&&m.id!==c.sourceId),'search'),resolve:(e,c)=>moved(e,c,args(c),'hand','effect-return')},(e,v)=>v.byEffect&&/tribute/.test(v.kind));
 extend('canTarget',function(prior,m,s){return !(s?.owner!==this.find(m.uid)?.owner&&ritual(m)&&allM(this).some(q=>is(q,'Dance Princess of the Nekroz')&&this.find(q.uid)?.owner===this.find(m.uid)?.owner&&active(this,q)))&&prior.call(this,m,s);});
 // Herald's graveyard trigger also works when Kaleidoscope sends it directly
 // from the Extra Deck. Its replacement does not apply while it is material.
 onMove('Herald of the Arc Light','nekroz-search',{resolve:(e,c)=>search(e,c,deck(e,c.owner,m=>def(m).type==='ritual'||def(m).spellKind==='ritual'))},(e,v)=>v.to==='grave');
 Q('Herald of the Arc Light','nekroz-negate',{main:false,condition:(e,c)=>!!c.event.window?.chainLast&&e.canTribute(self(e,c),c.owner),cost:(e,c)=>X.tribute(e,c,[c.uid]),resolve:X.negate,aiResponse:()=>1700});
 extend('move',function(prior,uid,to,o={}){const f=this.find(uid);if(to==='grave'&&f&&['hand','deck'].includes(f.zone)&&monster(f.card)&&!o.ignoreReplacement&&allM(this).some(q=>is(q,'Herald of the Arc Light')&&active(this,q)))to='banished';return prior.call(this,uid,to,o);});
 X.nekrozKaleidoscope=kaleidoscope;
})(globalThis);
