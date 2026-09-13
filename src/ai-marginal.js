(function(root){
  'use strict';
  const cp=value=>JSON.parse(JSON.stringify(value));
  const traceKeys=new Set(['log','chainHistory','startedAt','chainId','nextUid','nextLog','nextLink','nextTrigger','nextChain',
    'frame','pending','building','resolvingLink','chain','chainCleanup','chainResolving','tasks','triggers','earlyEvent','earlyWindowSummon','earlyLastSummon',
    'used','usedTurn','duelUsed','actionsThisTurn','lpPaidByTurn','inputRoles','targetMeta','sourceUnavailableByNumber','effectNegatedByNumber','preventionState','deckSpec','earlySent']);
  const cardIdentity=new Set(['uid','id','originalOwner','faceUp','position','attacked','summonTurn','changedTurn','setTurn','generation',
    'properlySummoned','faceUpExtra','summonKind','pendingActivation','attacksMade','used','overlays']);
  function cloneEngine(engine){
    const copy=Object.assign(Object.create(Object.getPrototypeOf(engine)),engine);
    copy.state=cp(engine.state);copy.randomState=engine.randomState;copy.events=[];copy.onChange=()=>{};copy._collecting=null;
    copy._aiMarginalProbe=true;copy._aiMarginalPlans=new Map();return copy;
  }
  function priorCopy(engine,action,owner){
    const card=engine.find(action.uid)?.card;if(!card)return false;
    return engine.state.chain.some(link=>link.owner===owner&&link.sourceId===card.id&&link.key===action.key)
      ||engine.state.chainHistory.some(link=>link.owner===owner&&link.cardId===card.id&&link.key===action.key)
      ||engine.field(owner).some(m=>m.uid!==card.uid&&m.id===card.id&&m.faceUp)
      ||engine.refs(owner,['grave','banished']).some(f=>f.card.uid!==card.uid&&f.card.id===card.id);
  }
  function projection(engine,ignored,lpCosts,sourceId,counterCosts=new Map()){
    if(counterCosts.size){engine=cloneEngine(engine);for(const [uid,amount] of counterCosts){const card=engine.find(uid)?.card;if(card)card.counters=(card.counters||0)+amount;}}
    if(engine.state.winner!==null)return {winner:engine.state.winner};
    const walk=(value,key='')=>{
      if(traceKeys.has(key))return undefined;
      if(value===null||typeof value!=='object')return value;
      if(value.uid&&ignored.has(value.uid))return undefined;
      if(Array.isArray(value)){
        if(key==='mods'){
          const mods=[];
          for(const mod of value){
            if(mod.until&&mod.until<engine.state.turn)continue;
            const stats=mod.stat==='both'?['atk','def']:[mod.stat];
            // Repeating a setter with the same lifetime does not change either
            // the current value or what remains after temporary effects expire.
            if(mod.kind==='set'&&stats.every(stat=>{
              const last=mods.findLast(m=>m.stat===stat||m.stat==='both');
              return last?.kind==='set'&&last.value===mod.value&&last.until===mod.until;
            }))continue;
            mods.push(mod);
          }
          return mods.map(v=>walk(v));
        }
        if(key==='mirrorWallSources')return [...new Set(value.map(uid=>engine.find(uid)).filter(f=>f&&engine.activeSpell(f.card)).map(f=>f.owner+':'+f.card.id))].sort();
        const list=value.map(v=>walk(v)).filter(v=>v!==undefined);
        return key==='locks'?[...new Map(list.map(v=>[JSON.stringify(v),v])).values()]:list;
      }
      const out={};
      for(const k of Object.keys(value).sort()){
        const item=walk(value[k],k);if(item!==undefined)out[k]=item;
      }
      return out;
    };
    const result=walk(engine.state);
    for(let owner=0;owner<2;owner++){
      const p=result.players[owner];p.lp+=lpCosts[owner]||0;
      // Card activations consume a physical copy. Its persistent rule presence is
      // compared as a set; numerical stacking is captured by derived card stats.
      p.ongoing=[...new Set(engine.field(owner).filter(m=>m.faceUp&&!m.pendingActivation).map(m=>m.id))].sort();
      const sameSpell=m=>m&&m.id===sourceId&&m.faceUp&&!m.pendingActivation;
      const spellCopies=engine.spells(owner).filter(sameSpell);
      // Linked cards are a relationship between an effect and its target. Moving
      // that relationship from copy 1 to copy 2 is not a second revival/protection.
      const details=spellCopies.map(m=>{
        const detail={};for(const key of Object.keys(m).sort()){
          if(cardIdentity.has(key)||traceKeys.has(key))continue;
          const value=walk(m[key],key);
          if(value===undefined||value===null||value===0||Array.isArray(value)&&!value.length)continue;
          detail[key]=value;
        }
        return detail;
      }).filter(d=>Object.keys(d).length);
      p.copyEffectDetails=[...new Set(details.map(d=>JSON.stringify(d)))].sort();
      p.copyCounterPool=spellCopies.reduce((n,m)=>n+(m.counters||0),0);
      const liveCopies=spellCopies.filter(m=>engine.activeSpell(m));
      p.copyAbilities=liveCopies.length?Object.values(engine.fx.defs).filter(a=>a.id===sourceId&&!a.cardActivation&&!a.maintenance&&a.zones.some(z=>['spells','fieldSpell'].includes(z))).map(a=>({
        key:a.key,copies:a.trigger||a.once?.scope==='card'||a.leavesAsCost?liveCopies.length:1
      })).sort((a,b)=>a.key.localeCompare(b.key)):[];
      // Additive auras and recurring fees still stack when the relevant event
      // or monster has not appeared yet. Maintenance alone is not a benefit.
      p.copyStacking=engine.fx.passives[sourceId]?.stacking?liveCopies.length:0;
      p.attackBlocked=!!engine.attackBlocked(owner);
      p.fieldRules=engine.monsters(owner).filter(m=>!ignored.has(m.uid)).map(m=>({uid:m.uid,
        attack:engine.attackValue(m),defense:engine.defenseValue(m),level:engine.level(m),race:engine.race(m),
        attribute:engine.attribute(m),negated:engine.negated(m)})).sort((a,b)=>a.uid.localeCompare(b.uid));
      // Preserve actual slot positions while discarding the cost card itself.
      for(const zone of ['monsters','spells'])p[zone]=engine.state.players[owner][zone].flatMap((m,index)=>m&&!ignored.has(m.uid)&&!(zone==='spells'&&sameSpell(m))?[{index,card:walk(m)}]:[]);
      if(sameSpell(engine.state.players[owner].fieldSpell))p.fieldSpell=null;
    }
    return result;
  }
  function simulate(engine,action,owner,choices){
    const e=cloneEngine(engine),costs=new Set(),lpCosts=[0,0],counterCosts=new Map(),plan={},alternatives=[];
    let uncertain=false,paying=false,limitedAlternatives=false,steps=0;
    const random=e.random,move=e.move,payLP=e.payLP,commit=e.commitPrepared;
    e.random=function(){uncertain=true;return random.call(this);};
    e.move=function(uid,to,reason={}){if(paying&&(String(reason.kind||'').startsWith('cost')||reason.kind==='rule-field'))costs.add(uid);return move.call(this,uid,to,reason);};
    e.payLP=function(p,n){if(paying)lpCosts[p]+=n;return payLP.call(this,p,n);};
    e._aiMarginalCost={
      before(ctx){return action&&ctx.uid===action.uid&&ctx.key===action.key?new Map(e.physicalCards().map(c=>[c.uid,c.counters||0])):null;},
      after(ctx,before){if(before)for(const [uid,n] of before){const now=e.find(uid)?.card;if(now&&(now.counters||0)<n)counterCosts.set(uid,n-(now.counters||0));}}
    };
    e.commitPrepared=function(ctx){
      const candidate=action&&ctx.uid===action.uid&&ctx.key===action.key;
      if(candidate){
        Object.assign(plan,cp(ctx.args));
        for(const [key,uids] of Object.entries(ctx.args))if(key==='cost'||['cost','send-cost','discard'].includes(ctx.inputRoles?.[key]))for(const uid of uids)costs.add(uid);
      }
      paying=!!candidate;
      try{return commit.call(this,ctx);}finally{paying=false;}
    };
    const act=a=>{const result=e.act(a);if(!result.ok)throw new Error(result.error);};
    if(action)act({...action,...(choices?{choices}:{} )});
    else if(e.state.pending?.kind==='window'||e.state.pending?.kind==='trigger')act({type:'pass'});
    while(e.state.winner===null&&e.state.pending){
      if(++steps>160)throw new Error('AI projection decision budget');
      const p=e.state.pending;
      if(p.kind==='replay'&&!e.state.chainResolving&&!e.state.chain.length&&!e.state.tasks.length)break;
      if(p.kind==='window'||p.kind==='trigger'&&!p.trigger?.mandatory){act({type:'pass'});continue;}
      if(p.responder!==owner)throw new Error('Opponent decision is not known');
      if(p.kind==='input'&&action&&p.ctx.uid===action.uid&&p.ctx.key===action.key){
        const g=p.group,selected=choices?.[g.key]||e.fx.aiPick(e,p.ctx,g);
        plan[g.key]=cp(selected);
        if(g.min===1&&g.max===1&&g.key!=='cost'&&!['cost','send-cost','discard'].includes(g.role)){
          let remaining=g.candidates.filter(c=>!selected.includes(c.uid)&&e.fx.candidateScore(e,p.ctx,c,g.role)>=0);
          for(let i=0;remaining.length&&i<10;i++){
            const uid=e.fx.aiPick(e,p.ctx,{...g,candidates:remaining})[0];
            if(!remaining.some(c=>c.uid===uid))break;
            alternatives.push({key:g.key,uids:[uid]});remaining=remaining.filter(c=>c.uid!==uid);
          }
          if(remaining.length)limitedAlternatives=true;
        }
        act({type:'choose',uids:selected});
      }else if(p.kind==='order')act({type:'choose',uids:p.candidates.filter(c=>c.mandatory).map(c=>c.uid)});
      else act(e.chooseAI(p));
    }
    if(e.state.chainResolving||e.state.tasks.length||e.state.chain.length&&e.state.winner===null)throw new Error('Unfinished projection');
    return {engine:e,costs,lpCosts,counterCosts,plan,alternatives,limitedAlternatives,uncertain};
  }
  function evaluate(engine,action,owner,options={}){
    if(engine._aiMarginalProbe||!options.force&&!priorCopy(engine,action,owner))return {useful:true,reason:'no-duplicate'};
    const ability=engine.fx.get(action.key),source=engine.find(action.uid);
    if(!ability||!source)return {useful:true,reason:'unknown-source'};
    try{
      const baseline=simulate(engine,options.baselineAction||null,owner),candidate=simulate(engine,action,owner,action.choices);
      if(baseline.uncertain||candidate.uncertain)return {useful:true,reason:'uncertain-random'};
      if(baseline.engine.state.winner===owner)return {useful:false,reason:'already-winning'};
      if(candidate.engine.state.winner===1-owner&&baseline.engine.state.winner!==1-owner)return {useful:false,reason:'additional-loss'};
      let difference='';
      const changedPath=(a,b,path='')=>{
        if(a===b)return '';
        if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return path;
        for(const key of new Set([...Object.keys(a),...Object.keys(b)])){
          const found=changedPath(a[key],b[key],path?path+'.'+key:key);if(found)return found;
        }
        return '';
      };
      const compare=trial=>{
        if(trial.uncertain)return null;
        const ignored=new Set(trial.costs);
        if(ability.cardActivation||ability.leavesAsCost)ignored.add(action.uid);
        const before=projection(baseline.engine,ignored,[0,0],source.card.id),after=projection(trial.engine,ignored,trial.lpCosts,source.card.id,trial.counterCosts);
        difference=changedPath(before,after);return !!difference;
      };
      if(compare(candidate))return {useful:true,reason:'additional-outcome',choices:candidate.plan,difference};
      // A second targeted copy may be useful against a different target. Reuse
      // the selected costs, then test bounded alternative legal target choices.
      for(const alternative of candidate.alternatives.slice(0,10)){
        const choices={...candidate.plan,[alternative.key]:alternative.uids};
        try{
          const trial=simulate(engine,action,owner,choices),different=compare(trial);
          if(different===null)return {useful:true,reason:'uncertain-alternative'};
          if(different)return {useful:true,reason:'different-target',choices:trial.plan,difference};
        }catch{return {useful:true,reason:'uncertain-alternative'};}
      }
      if(candidate.limitedAlternatives||candidate.alternatives.length>10)return {useful:true,reason:'target-budget'};
      return {useful:false,reason:'same-outcome'};
    }catch{return {useful:true,reason:'uncertain-resolution'};}
  }
  function score(engine,action,owner,score){
    if(score<=0||engine._aiMarginalProbe)return score;
    const result=evaluate(engine,action,owner);
    if(!result.useful)return -100;
    if(result.choices){engine._aiMarginalPlans||=new Map();engine._aiMarginalPlans.set(action.uid+'|'+action.key,result.choices);}
    return score;
  }
  function action(engine,action){
    const choices=engine._aiMarginalPlans?.get(action.uid+'|'+action.key);
    return choices?{...action,choices:cp(choices)}:action;
  }
  function order(engine,pending){
    if(engine._aiMarginalProbe)return {type:'choose',uids:pending.candidates.filter(c=>c.mandatory).map(c=>c.uid)};
    const events=engine.state.building?.groups[0]?.events||[],selected=pending.candidates.filter(c=>c.mandatory).map(c=>c.uid),choicesByEvent={};
    for(const candidate of pending.candidates.filter(c=>!c.mandatory)){
      const event=events.find(t=>t.id===candidate.uid);
      if(!event){selected.push(candidate.uid);continue;}
      const action={type:'choose',uids:[...selected,candidate.uid],uid:event.uid,key:event.key,choicesByEvent:cp(choicesByEvent)};
      const duplicate=selected.some(id=>{const t=events.find(t=>t.id===id);return t?.sourceId===event.sourceId&&t.key===event.key;});
      const decision=evaluate(engine,action,pending.owner,{force:duplicate,baselineAction:{type:'choose',uids:[...selected],choicesByEvent:cp(choicesByEvent)}});
      if(decision.useful){selected.push(candidate.uid);if(decision.choices)choicesByEvent[candidate.uid]=decision.choices;}
    }
    return {type:'choose',uids:selected,...(Object.keys(choicesByEvent).length?{choicesByEvent}:{} )};
  }
  const api={evaluate,score,action,order};root.DuelAIMarginal=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
