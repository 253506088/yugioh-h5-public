(function(root){
  'use strict';
  // Planner layer for bots. It adds a phase-independent position value,
  // short rollouts of the rest of the turn on engine copies, simulated attack
  // selection and a benefit gate for chain responses. Every projection runs
  // through DuelAIMarginal.project, so hidden opposing cards stay redacted
  // and the live duel never consumes random numbers or writes journal
  // entries. Nothing here changes the rules: act() still accepts any legal
  // action from a player.
  const marginal=()=>root.DuelAIMarginal,tactics=()=>root.DuelAITactics;
  const projectionOptions={ownTriggers:true,allowShuffle:true,unknownDraws:true,redactOpponent:true};
  const WIN=1e6,DRAW_VALUE=190,BUDGET=30,DEPTH=2,CANDIDATES=4,ATTACKS=10;
  const HIDDEN_ATK=500,HIDDEN_DEF=1600;
  const bodyZone=z=>z==='monsters'||z==='extraMonster';
  // `_aiPlannerSeats` is an optional per-engine experiment switch ([true,false]
  // keeps the planner for seat 0 only). It is never saved with the duel.
  function enabled(e,owner=e?.state?.active){
    if(!e||e._aiMarginalProbe||e.state.difficulty==='casual'||!root.DuelAIMarginal||!root.DuelAITactics)return false;
    return !e._aiPlannerSeats||e._aiPlannerSeats[owner]!==false;
  }
  function store(e){return e._aiPlannerCache||=({rollouts:new Map(),projections:0});}
  function reset(e){e._aiPlannerCache={rollouts:new Map(),projections:0};}
  function project(e,action,owner,cache=store(e)){cache.projections++;return marginal().project(e,action,owner,action?.choices,projectionOptions);}
  function signature(action){return [action.type,action.uid||'',action.key||'',action.mode||'',action.noTribute?1:0,action.target||'',action.phase||'',action.slot??''].join('|');}
  function quickAbilities(e,m){return (e.fx.byCard?.[m.id]||[]).filter(a=>a.speed>=2&&Array.isArray(a.zones)&&a.zones.some(bodyZone)).length;}
  function bodyWorth(e,m,visible){
    const atk=visible?e.attackValue(m):HIDDEN_ATK,def=visible?e.defenseValue(m):HIDDEN_DEF;
    const abilities=m.faceUp&&!e.negated(m)?Math.min(2,quickAbilities(e,m)):0;
    return 250+Math.max(atk,def*.8)*.6+Math.min(atk,def)*.08+abilities*250;
  }
  // Worth of the monsters of `owner` that a face-up attacker of `attack` ATK
  // would destroy in battle.
  function threatened(e,owner,viewer,attack){
    let loss=0;
    for(const m of e.monsters(owner)){
      const visible=owner===viewer||m.faceUp;
      const guard=m.position==='defense'?(visible?e.defenseValue(m):HIDDEN_DEF):(visible?e.attackValue(m):HIDDEN_ATK);
      if(attack>guard)loss+=bodyWorth(e,m,visible)*.35;
    }
    return loss;
  }
  function side(e,owner,viewer){
    let power=0,maxAttack=0,strongest=0;
    for(const m of e.monsters(owner)){
      const visible=owner===viewer||m.faceUp;
      power+=bodyWorth(e,m,visible);
      const atk=visible?e.attackValue(m):HIDDEN_ATK;
      if(!m.cannotAttack&&(m.faceUp||owner!==viewer))strongest=Math.max(strongest,atk);
      if(m.faceUp&&m.position==='attack')maxAttack=Math.max(maxAttack,atk);
    }
    return {power:power+maxAttack*.55,strongest};
  }
  // Static worth of the position for `owner`. Face-down opposing monsters are
  // counted as plain 500/1600 bodies, matching how projections redact them,
  // so the live duel and its copies are compared on the same footing. Damage
  // already taken weighs more than damage that may still be avoided next turn,
  // and lethal exposure dominates everything else.
  function positionValue(e,owner){
    const s=e.state;if(s.winner===owner)return WIN;if(s.winner===1-owner)return -WIN;if(s.winner!==null)return 0;
    const T=tactics(),foe=1-owner,p=s.players[owner],q=s.players[foe];
    const mine=side(e,owner,owner),theirs=side(e,foe,owner);
    let value=mine.power-theirs.power*.85+p.hand.length*180-q.hand.length*120+p.lp*.35-q.lp*.4;
    for(const c of e.spells(owner))value+=c.faceUp?(e.activeSpell(c)?300:60):200;
    value-=e.spells(foe).length*160;
    value-=threatened(e,owner,owner,theirs.strongest);value+=threatened(e,foe,owner,mine.strongest)*.85;
    const incoming=T.expectedDamage(e,owner);
    value-=incoming>=p.lp?4500+incoming*.2:incoming*.3;
    const outgoing=T.expectedDamage(e,foe);
    value+=outgoing>=q.lp?1500+outgoing*.1:outgoing*.2;
    const limit=p.handSizeLimit||6;if(p.hand.length>limit)value-=(p.hand.length-limit)*180;
    if(p.deck.length<=2)value-=(3-p.deck.length)*1500;
    if(q.deck.length<=2)value+=(3-q.deck.length)*600;
    return value;
  }
  function canBattle(e,owner){return e.state.phase==='main1'&&e.state.turn>1&&!e.attackBlocked(owner)&&e.monsters(owner).some(m=>m.faceUp&&m.position==='attack'&&(e.canAttack(m,owner,null)||e.monsters(1-owner).some(t=>e.canAttack(m,owner,t.uid))));}
  // Execute `action` on a copy, then let the base policy continue the turn
  // for at most `depth` more Main Phase actions. Every line then plays out
  // its Battle Phase with the same attack policy, so a line that develops
  // the board first is compared with a line that attacks at once on equal
  // terms. A line that draws unknown cards is scored before the draw with a
  // flat value per card.
  function rollout(e,action,owner,depth=DEPTH){
    const cache=store(e);if(cache.projections>=BUDGET)return null;
    let trial;
    try{trial=project(e,action,owner,cache);}catch{return null;}
    let engine=trial.engine,steps=0,draws=trial.requestedDraws?.[owner]||0,scoreAt=null;
    if(trial.uncertain){scoreAt=trial.beforeDraw;if(!scoreAt)return null;}
    try{
      while(!scoreAt&&engine.state.winner===null&&!engine.state.pending&&engine.state.active===owner&&cache.projections<BUDGET){
        let next;
        if(steps<depth||engine.state.phase==='battle')next=engine.aiNext();
        else if(canBattle(engine,owner))next={type:'phase',phase:'battle'};
        else break;
        if(!next||next.type==='end')break;
        const t=project(engine,next,owner,cache);if(next.type!=='phase'&&next.type!=='attack')steps++;
        if(t.uncertain){draws+=t.requestedDraws?.[owner]||0;if(!t.beforeDraw)return null;scoreAt=t.beforeDraw;break;}
        engine=t.engine;
      }
    }catch{return null;}
    scoreAt||=engine;
    return {value:positionValue(scoreAt,owner)+draws*DRAW_VALUE,steps,winner:scoreAt.state.winner};
  }
  function value(e,action,owner=e.state.active,depth=DEPTH){
    const cache=store(e),key='r|'+owner+'|'+depth+'|'+signature(action);
    if(cache.rollouts.has(key))return cache.rollouts.get(key);
    const result=rollout(e,action,owner,depth);cache.rollouts.set(key,result);return result;
  }
  function attackActions(e,owner){
    const foes=e.monsters(1-owner),actions=[];
    for(const m of e.monsters(owner)){
      if((!foes.length||e.canDirect?.(m,owner)||m.directAttackTurn===e.state.turn)&&e.canAttack(m,owner,null))actions.push({type:'attack',uid:m.uid});
      for(const target of foes)if(e.canAttack(m,owner,target.uid))actions.push({type:'attack',uid:m.uid,target:target.uid});
    }
    return actions;
  }
  function staticGain(e,a){
    const m=e.find(a.uid)?.card,t=a.target?e.find(a.target)?.card:null,atk=e.attackValue(m);
    if(!t)return atk*.6;
    const guard=e.enemyValue(t);
    if(atk>guard)return (t.faceUp?guard:HIDDEN_DEF)*.7+(t.position==='attack'?(atk-guard)*.45:0);
    return atk===guard?-atk*.3:-(guard-atk)*.5-atk*.4;
  }
  // Battle Phase: each legal attack is executed on a copy and valued against
  // the current position. Face-down opposing Spell/Trap cards discount every
  // attack a little, so a marginal attack is skipped while a real gain is
  // still taken. Attacks that win the duel outrank everything.
  function battle(e){
    const s=e.state,owner=s.active;
    if(!enabled(e,owner)||s.phase!=='battle'||s.pending||s.winner!==null)return null;
    const actions=attackActions(e,owner);if(!actions.length)return {type:'phase',phase:'main2'};
    const base=positionValue(e,owner),hidden=e.spells(1-owner).filter(c=>!c.faceUp).length;
    const ranked=actions.map(a=>({a,order:staticGain(e,a)})).sort((x,y)=>y.order-x.order||x.a.uid.localeCompare(y.a.uid)||String(x.a.target||'').localeCompare(String(y.a.target||''))).slice(0,ATTACKS);
    let best=null;
    for(const {a,order} of ranked){
      const attacker=e.find(a.uid).card,atk=e.attackValue(attacker),r=value(e,a,owner,0);
      const gain=r?r.winner===owner?WIN:r.winner===1-owner?-WIN:r.value-base:order;
      const net=gain-Math.min(3,hidden)*(60+atk*.04);
      if(net<=0)continue;
      // The weakest attacker that achieves the same result goes first, so the
      // strongest body stays free for a later direct attack.
      if(!best||net>best.net+60||Math.abs(net-best.net)<=60&&atk<best.atk)best={action:a,net,atk};
    }
    return best?best.action:{type:'phase',phase:'main2'};
  }
  // Main Phase: the tactical filter keeps candidates that do not throw away a
  // strong board, then rollouts re-order the leading candidates. Nothing is
  // played when every candidate leaves a worse position than moving on.
  function select(e,ranked){
    const T=tactics(),owner=e.state.active;
    if(!enabled(e,owner))return T.select(e,ranked);
    const candidates=[],seen=new Set();let probes=0;
    const consider=item=>{
      let action=marginal().action(e,item.action);
      const key=signature(action);if(seen.has(key))return;seen.add(key);
      const tribute=action.type==='summon'&&!action.noTribute&&e.tributeCount(e.find(action.uid).card)>0;
      if(['activate','extra-summon'].includes(action.type)||tribute){
        if(probes++>=8)return;
        const result=T.evaluate(e,action);if(!result.useful)return;
        if(result.choices&&Object.keys(result.choices).length)action={...action,choices:result.choices};
      }
      candidates.push({action,score:item.score});
    };
    for(const item of ranked){if(candidates.length>=CANDIDATES)break;consider(item);}
    if(!candidates.length)return null;
    // The other position of a leading Normal Summon is always compared too.
    for(const c of [...candidates])if(c.action.type==='summon'){const other=ranked.find(i=>i.action.type==='summon'&&i.action.uid===c.action.uid&&i.action.mode!==c.action.mode&&!!i.action.noTribute===!!c.action.noTribute);if(other)consider(other);}
    const s=e.state,base=positionValue(e,owner),swing=r=>r?Math.max(-2500,Math.min(2500,r.value-base))*.6+(r.winner===owner?5000:r.winner===1-owner?-5000:0):0;
    for(const c of candidates){c.rollout=value(e,c.action,owner);c.final=c.score*.5+swing(c.rollout);}
    const real=candidates.reduce((a,b)=>b.final>a.final?b:a);
    let waiting=0;
    if(s.phase==='main1'&&s.turn>1&&!e.attackBlocked(owner)&&e.monsters(owner).some(m=>m.faceUp&&m.position==='attack'))waiting=Math.max(waiting,swing(value(e,{type:'phase',phase:'battle'},owner)));
    if(real.rollout&&real.final<waiting-150)return null;
    return real.action;
  }
  // A chain response is only worth its card when the position after
  // responding beats the position after letting the window pass. Paid
  // negations already carry the tactical verdict; default-scored responses
  // need a real benefit.
  function responseGate(e,action,owner,score){
    if(score<=0||!enabled(e,owner))return score;
    const p=e.state.pending;if(!p||p.kind!=='window'||p.responder!==owner||action?.type!=='respond')return score;
    const T=tactics(),ability=e.fx.get(action.key);if(!ability)return score;
    if(T.negationWorth(e,action,owner))return score;
    let pass,respond;
    try{pass=T.passProjection(e,owner);respond=project(e,action,owner);}catch{return score;}
    if(!pass||pass.uncertain||respond.uncertain)return score;
    const foe=1-owner;
    if(respond.engine.state.winner===foe&&pass.engine.state.winner!==foe)return -100;
    if(respond.engine.state.winner===owner)return score+2000;
    if(pass.engine.state.winner===foe)return score+1000;
    const gain=positionValue(respond.engine,owner)-positionValue(pass.engine,owner);
    // An authored response may have a benefit the position value does not
    // model (Staunch Defender only redirects attacks). It is dropped only when
    // the position gets worse by more than the card itself.
    if(gain<(ability.aiResponse?-700:1))return -100;
    return score;
  }
  const api={enabled,reset,positionValue,rollout,value,battle,select,responseGate,attackActions,WIN};
  root.DuelAIPlanner=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
