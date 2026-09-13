(function(root){
  'use strict';
  const L=root.DuelLog,Engine=root.ModernDuelEngine,E=root.DuelEffects,D=root.DuelData;
  if(!L||!Engine||!E||Engine.prototype._duelLogInstalled)return;
  const P=Engine.prototype;
  Object.defineProperty(P,'_duelLogInstalled',{value:true});
  function wrap(name,fn){const prior=P[name];if(prior)P[name]=function(...args){return L.enabled(this)?fn.call(this,prior,...args):prior.apply(this,args);};}
  function effect(name,kind){const prior=E[name];E[name]=function(e,c,...args){return L.scope(e,{cause:L.causeFor(e,c,kind)},()=>L.trackLP(e,()=>prior(e,c,...args)));};}
  effect('payCost','cost');effect('resolve','effect');
  function continuation(e,task){
    const carried=task.traceCause||L.current(e),supplied=L.source(task.link||task.context?.source||task.source);
    return supplied?{...(carried?.cardId===supplied.cardId?carried:{}),...supplied}:carried;
  }
  const operation=E.operation;
  E.operation=function(e,task){return L.scope(e,{cause:continuation(e,task)},()=>L.trackLP(e,()=>operation(e,task)));};
  function battle(e){
    const a=e.state.frame?.attack;
    if(!a)return L.current(e)?.kind==='battle'?L.current(e):{kind:'battle'};
    const attacker=L.card(e,a.uid,true),defender=L.card(e,a.target,true),m=e.find(a.uid)?.card,t=e.find(a.target)?.card;
    return {kind:'battle',attacker,defender,attackValue:m?e.attackValue(m,a):undefined,targetValue:t?(t.position==='defense'?e.defenseValue(t,a):e.attackValue(t,a)):undefined,targetPosition:t?.position};
  }
  wrap('finish',function(prior,...args){L.flushLP(this);return prior.apply(this,args);});
  wrap('declareAttack',function(prior,action){
    const cause={kind:'battle',attacker:L.card(this,action.uid,true),defender:L.card(this,action.target)};
    return L.scope(this,{cause},()=>prior.call(this,action));
  });
  wrap('commitPrepared',function(prior,ctx){return L.scope(this,{cause:L.source(ctx)},()=>prior.call(this,ctx));});
  wrap('queue',function(prior,task){const cause=L.current(this);return prior.call(this,cause?{...task,traceCause:task.traceCause||cause}:task);});
  wrap('runTask',function(prior,task){
    const cause=continuation(this,task);
    return L.scope(this,{cause},()=>{const result=prior.call(this,task);if(this.state.pending&&cause)this.state.pending.traceCause=JSON.parse(JSON.stringify(cause));return result;});
  });
  wrap('choose',function(prior,action){const p=this.state.pending;return L.scope(this,{cause:p?.traceCause||L.source(p?.source)||L.current(this)},()=>prior.call(this,action));});
  for(const method of ['normalSummon','extraSummon'])wrap(method,function(prior,action){
    const f=this.find(action.uid),via=method==='normalSummon'?'normal':D.CARDS[f?.card.id]?.type||'special';
    const cause=f?{kind:'summon',cardId:f.card.id,uid:f.card.uid,owner:f.owner,public:action.mode!=='defense',via}:L.current(this);
    const materials=(action.tributes||action.materials||[]).map(uid=>L.card(this,uid,true)).filter(Boolean);
    return L.scope(this,{cause,details:{kinds:['summon'],uid:action.uid,card:f?L.card(this,action.uid,action.mode!=='defense'):null,from:'hand',to:'monsters',via:'normal',faceUp:action.mode!=='defense',materials}},()=>prior.call(this,action));
  });
  wrap('special',function(prior,owner,uid,options={}){
    const f=this.find(uid);if(!f)return prior.call(this,owner,uid,options);
    const cause=options.source?L.causeFor(this,options.source):L.current(this)||{kind:'summon',cardId:f.card.id,uid,owner,via:options.via||'special'};
    const materials=(options.materials||[]).map(m=>({uid:m.uid,cardId:m.id||m.cardId,owner:m.owner,zone:m.zone,public:true}));
    return L.scope(this,{cause,details:{kinds:['special','synchro','xyz','link','pendulum','ritual','fusion'],uid,card:L.card(this,uid,!options.faceDown),from:f.zone,fromOwner:f.owner,to:'@current',via:options.via||'special',faceUp:!options.faceDown,materials}},()=>prior.call(this,owner,uid,options));
  });
  wrap('move',function(prior,uid,destination,options={}){
    const f=this.find(uid);if(!f)return prior.call(this,uid,destination,options);
    const kind=options.kind||'move',cost=kind.startsWith('cost'),rule=kind.startsWith('rule');
    let cause=kind==='battle'?battle(this):rule?{kind:'rule',rule:kind}:L.causeFor(this,options.source,cost?'cost':'effect');
    if(cost&&cause)cause={...cause,kind:'cost'};
    let replacement;
    if(destination==='grave'){
      const law=this.monsters(1-f.card.originalOwner).find(m=>m.faceUp&&m.id==='masked-dark-law'&&!this.negated(m));
      if(law)replacement=L.card(this,law.uid,true);
    }
    const visible=['grave','banished','extra-up'].includes(destination)||['monsters','extraMonster','spells','fieldSpell'].includes(f.zone)&&f.card.faceUp;
    return L.scope(this,{cause,details:{kinds:['move','destroy','discard'],uid,card:L.card(this,uid,visible),from:f.zone,fromOwner:f.owner,to:'@current',requestedTo:destination,moveKind:kind,reason:options.reason||'',replacement}},()=>prior.call(this,uid,destination,options));
  });
  wrap('draw',function(prior,owner,amount=1,silent=false){
    const cause=L.current(this)||(this.state.inDrawPhase?{kind:'rule',rule:'normal-draw'}:null);
    return L.scope(this,{cause,details:{kinds:['draw'],owner,handBefore:this.state.players[owner].hand.map(m=>m.uid)}},()=>prior.call(this,owner,amount,silent));
  });
  wrap('search',function(prior,owner,uids){return L.scope(this,{details:{kinds:['search'],owner,from:'deck',to:'hand'}},()=>prior.call(this,owner,uids));});
  wrap('damage',function(prior,owner,amount,type='战斗',source=null){
    const named=!['战斗','效果'].includes(type)?D.CARD_LIST.find(c=>c.name===type||c.officialName===type):null;
    const cause=type==='战斗'?battle(this):L.causeFor(this,source||(named?{id:named.id}:null));
    return L.scope(this,{cause,details:{kinds:['damage'],owner,lpBefore:this.state.players[owner].lp,damageType:type==='战斗'?'battle':'effect'}},()=>prior.call(this,owner,amount,type));
  });
  for(const method of ['heal','payLP'])wrap(method,function(prior,owner,amount,source=null){
    const cause=L.causeFor(this,source,method==='payLP'?'cost':'effect');
    return L.scope(this,{cause,details:{kinds:[method==='heal'?'heal':'cost'],owner,lpBefore:this.state.players[owner].lp}},()=>prior.call(this,owner,amount));
  });
})(globalThis);
