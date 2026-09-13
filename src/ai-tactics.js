(function(root){
  'use strict';
  const data=()=>root.DuelData, marginal=()=>root.DuelAIMarginal;
  const projectionOptions={ownTriggers:true,allowShuffle:true,unknownDraws:true,redactOpponent:true};
  const main=s=>s.phase==='main1'||s.phase==='main2';
  const bodyZone=z=>z==='monsters'||z==='extraMonster';
  function project(e,action,owner){return marginal().project(e,action,owner,action?.choices,projectionOptions);}
  function publicBoard(e,owner){return e.field(1-owner).every(m=>m.faceUp);}
  function attackActions(e,owner){
    const foes=e.monsters(1-owner),actions=[];
    for(const m of e.monsters(owner)){
      if((!foes.length||e.canDirect?.(m,owner)||m.directAttackTurn===e.state.turn)&&e.canAttack(m,owner,null))actions.push({type:'attack',uid:m.uid});
      for(const target of foes)if(e.canAttack(m,owner,target.uid))actions.push({type:'attack',uid:m.uid,target:target.uid});
    }
    const value=a=>{
      const m=e.find(a.uid)?.card,t=e.find(a.target)?.card,atk=e.attackValue(m),def=t?e.enemyValue(t):0;
      const hit=!t?atk:t.position==='attack'?Math.max(0,atk-def):0;
      return hit*2+(t&&atk>def?1000:0)-atk/10;
    };
    return actions.sort((a,b)=>value(b)-value(a)||a.uid.localeCompare(b.uid)||String(a.target||'').localeCompare(String(b.target||'')));
  }
  function battleKey(e){
    const s=e.state;
    return JSON.stringify([s.phase,s.players.map(p=>({lp:p.lp,monsters:p.monsters,extraMonster:p.extraMonster,extraMonster2:p.extraMonster2,spells:p.spells,fieldSpell:p.fieldSpell,usedTurn:p.usedTurn})),s.lastNegatedAttack]);
  }
  // Search only the public board. Opposing hands and deck order never supply a
  // predicted winning card, and a draw/coin/die result cannot certify this line.
  function battlePlan(engine,{maxNodes=32}={}){
    const s=engine.state,owner=s.active;
    if(s.pending||s.winner!==null||s.turn===1||!['main1','battle'].includes(s.phase)||engine.attackBlocked(owner)||!publicBoard(engine,owner))return null;
    const movable=engine.monsters(owner).filter(m=>m.faceUp&&(!m.cannotAttack)&&
      (m.position==='attack'||s.phase==='main1'&&m.summonTurn<s.turn&&m.changedTurn<s.turn&&!engine.positionLocked?.(m)));
    const ceiling=movable.reduce((n,m)=>n+engine.attackValue(m)*Math.max(0,Math.min(7,engine.attackAllowance(m))-(m.attacksMade||0)),0);
    if(!movable.length||ceiling<engine.state.players[1-owner].lp)return null;
    const queue=[{engine,path:[]}],seen=new Set();let nodes=0;
    while(queue.length&&nodes<maxNodes){
      const node=queue.shift(),e=node.engine,key=battleKey(e);if(seen.has(key))continue;seen.add(key);
      if(node.path.length>=12)continue;
      const actions=e.state.phase==='main1'?[{type:'phase',phase:'battle'},...e.monsters(owner).filter(m=>m.faceUp&&m.position==='defense'&&m.summonTurn<e.state.turn&&m.changedTurn<e.state.turn&&!e.positionLocked?.(m)).map(m=>({type:'stance',uid:m.uid}))]:attackActions(e,owner);
      for(const action of actions.slice(0,8)){
        if(nodes++>=maxNodes)break;
        try{
          const trial=project(e,action,owner);if(trial.uncertain)continue;
          const path=[...node.path,action];
          if(trial.engine.state.winner===owner)return {action:path[0],actions:path,owner,nodes,reason:'public-battle-win'};
          if(trial.engine.state.winner===null&&!trial.engine.state.pending&&trial.engine.state.active===owner&&['main1','battle'].includes(trial.engine.state.phase))queue.push({engine:trial.engine,path});
        }catch{/* An unresolved opponent choice is not a proven winning line. */}
      }
    }
    return null;
  }
  function fieldValue(e,owner){
    const monsters=e.monsters(owner),isMine=owner===e.state.active;
    let power=0,maxAttack=0,ready=0;
    for(const m of monsters){
      const visible=isMine||m.faceUp,atk=visible?e.attackValue(m):1200,def=visible?e.defenseValue(m):1600;
      const active=m.faceUp&&!e.negated(m),abilities=active?Object.values(e.fx.defs).filter(a=>a.id===m.id&&a.speed>=2&&a.zones.some(bodyZone)).length:0;
      power+=250+Math.max(atk,def*.8)*.6+Math.min(atk,def)*.08+Math.min(2,abilities)*250;
      if(m.faceUp){maxAttack=Math.max(maxAttack,atk);if(e.state.phase==='main1'&&e.state.turn>1&&attackActionsFor(e,m,owner).length)ready+=atk;}
    }
    return {power:power+maxAttack*.55,maxAttack,ready};
  }
  function attackActionsFor(e,m,owner){
    const foes=e.monsters(1-owner);
    if((!foes.length||e.canDirect?.(m,owner)||m.directAttackTurn===e.state.turn)&&e.canAttack(m,owner,null))return [null];
    return foes.filter(t=>e.canAttack(m,owner,t.uid)).map(t=>t.uid);
  }
  function assessment(e,owner){
    const mine=fieldValue(e,owner),foe=fieldValue(e,1-owner),p=e.state.players[owner],other=e.state.players[1-owner];
    return {...mine,value:mine.power-foe.power*.85+mine.ready*.25+p.hand.length*180+e.spells(owner).length*160+p.lp*.15-other.lp*.45,foePower:foe.power,foeMax:foe.maxAttack};
  }
  function expectedDamage(e,owner){
    const attackers=e.monsters(1-owner).filter(m=>!m.cannotAttack),defenders=e.monsters(owner).map(m=>({atk:e.attackValue(m),def:e.defenseValue(m),position:m.position,faceUp:m.faceUp}));
    let damage=0;
    for(const m of [...attackers].flatMap(m=>Array(Math.min(4,Math.max(1,e.attackAllowance(m)))).fill(m)).sort((a,b)=>(b.faceUp?e.attackValue(b):1600)-(a.faceUp?e.attackValue(a):1600))){
      const attack=m.faceUp?e.attackValue(m):1600;
      const targets=defenders.map((t,i)=>({i,t,hit:t.position==='attack'?Math.max(0,attack-t.atk):0,kill:attack>(t.position==='attack'?t.atk:t.def)})).sort((a,b)=>b.hit-a.hit||Number(b.kill)-Number(a.kill)||b.t.def-a.t.def);
      if(!targets.length){damage+=attack;continue;}
      const target=targets[0];damage+=target.hit;if(target.kill)defenders.splice(target.i,1);
    }
    return damage;
  }
  function entryBenefit(before,after,owner,uid){
    const original=before.monsters(owner).filter(m=>m.uid!==uid).map(m=>m.uid),remaining=after.monsters(owner);
    return after.state.players[owner].hand.length>before.state.players[owner].hand.length-1||remaining.some(m=>m.uid!==uid&&!original.includes(m.uid))||after.field(1-owner).length<before.field(1-owner).length;
  }
  function defenseBias(e,action){
    const source=e.find(action.uid)?.card;if(!source||!main(e.state))return 0;
    const owner=e.state.active,def=data().CARDS[source.id],enemy=e.monsters(1-owner),pressure=Math.max(0,...enemy.map(m=>m.faceUp?e.attackValue(m):1600));
    if(action.type==='summon'){
      const key=action.uid+'|'+!!action.noTribute,cache=e._aiDefenseCache;
      if(cache?.has(key))return action.mode==='defense'?cache.get(key):-cache.get(key);
      let bias=0;
      if(pressure>(def.atk||0)||def.flip||e.state.turn===1||e.state.phase==='main2'||e.attackBlocked(owner)){
        try{
          const attack=project(e,{...action,mode:'attack'},owner),defense=project(e,{...action,mode:'defense'},owner);
          if(attack.engine.state.winner===owner&&!attack.uncertain)bias=-1200;
          else if(!attack.uncertain&&battlePlan(attack.engine,{maxNodes:16}))bias=-1000;
          else{
            const a=expectedDamage(attack.engine,owner),d=expectedDamage(defense.engine,owner),saved=a-d;
            const usefulEntry=entryBenefit(e,attack.engine,owner,source.uid);
            if(saved>0&&a>=attack.engine.state.players[owner].lp&&d<defense.engine.state.players[owner].lp)bias=1000;
            else if(saved>=500&&(!usefulEntry||e.state.players[owner].lp<=pressure))bias=Math.min(700,200+saved/5);
            else if(!usefulEntry&&(def.flip||(def.def||0)>(def.atk||0)+300&&(e.state.turn===1||e.state.phase==='main2'||e.attackBlocked(owner)||pressure>(def.atk||0))))bias=240;
          }
        }catch{if(pressure>(def.atk||0)&&e.state.players[owner].lp<=pressure)bias=400;}
      }
      if(cache)cache.set(key,bias);return action.mode==='defense'?bias:-bias;
    }
    if(action.type==='stance'&&source.faceUp&&source.position==='attack'&&pressure>e.attackValue(source)){
      const exposed=expectedDamage(e,owner),copy=marginal().clone(e);copy.find(source.uid).card.position='defense';
      const saved=exposed-expectedDamage(copy,owner);
      if(saved>0)return 450+Math.min(600,saved/4);
    }
    return 0;
  }
  function recovery(trial,before,owner){
    let e=trial;
    for(let i=0;i<2;i++){
      if(e.state.pending||!main(e.state)||e.state.active!==owner)return false;
      const action=e.aiNext();if(!action||!(action.type==='extra-summon'||action.type==='activate'&&e.fx.get(action.key)?.summons))return false;
      const next=project(e,action,owner);if(next.uncertain)return false;e=next.engine;
      if(e.state.winner===owner||assessment(e,owner).value>=before.value-150)return true;
    }
    return false;
  }
  function evaluate(e,action,owner=e.state.active,options={}){
    if(e._aiMarginalProbe)return {useful:true,reason:'probe'};
    let baseline=e;
    if(options.baselineAction||action.type==='respond'&&['window','trigger'].includes(e.state.pending?.kind)){
      try{const pending=project(e,options.baselineAction||null,owner);if(pending.uncertain)return {useful:true,reason:'uncertain-existing-chain'};baseline=pending.engine;}
      catch{return {useful:true,reason:'uncertain-existing-chain'};}
    }
    if(baseline.state.winner===owner)return {useful:false,reason:'already-winning'};
    const before=assessment(baseline,owner);
    const dominant=before.maxAttack>=1600&&before.maxAttack>=before.foeMax&&before.power>=before.foePower&&!e.attackBlocked(owner);
    if(!dominant)return {useful:true,reason:'build-or-recover'};
    try{
      const trial=project(e,action,owner),after=assessment(trial.engine,owner);
      if(trial.engine.state.winner===owner&&!trial.uncertain)return {useful:true,reason:'winning-effect',choices:trial.plan};
      if(trial.engine.state.winner===1-owner&&!trial.uncertain)return {useful:false,reason:'avoidable-loss'};
      if(trial.uncertain){
        if(trial.beforeDraw){
          const guaranteed=assessment(trial.beforeDraw,owner),cards=trial.requestedDraws[owner]*180;
          if(before.power-guaranteed.power>650&&guaranteed.value+cards<before.value-350)return {useful:false,reason:'do-not-gamble-away-board'};
        }
        return {useful:true,reason:'uncertain-outcome'};
      }
      const collapse=before.power-after.power>650||before.maxAttack-after.maxAttack>=650;
      if(collapse&&after.value<before.value-250){
        if(recovery(trial.engine,before,owner))return {useful:true,reason:'productive-combination',choices:trial.plan};
        return {useful:false,reason:'preserve-strong-board',before:Math.round(before.value),after:Math.round(after.value)};
      }
      return {useful:true,reason:'productive-action',choices:trial.plan};
    }catch{return {useful:true,reason:'uncertain-resolution'};}
  }
  function select(e,ranked){
    let probes=0;
    for(const item of ranked){
      let action=marginal().action(e,item.action);
      const tribute=action.type==='summon'&&!action.noTribute&&e.tributeCount(e.find(action.uid).card)>0;
      if(['activate','extra-summon'].includes(action.type)||tribute){
        if(probes++>=8)continue;
        const result=evaluate(e,action);if(!result.useful)continue;
        if(result.choices&&Object.keys(result.choices).length)action={...action,choices:result.choices};
      }
      return action;
    }
    return null;
  }
  function response(e,action,owner,score){
    if(e._aiMarginalProbe||score<=0||owner!==e.state.active||!main(e.state))return score;
    const last=e.state.chain.at(-1);
    // Reactive disruption remains available. Restraint applies to extending
    // our own play with an optional action that would dismantle our board.
    if(last&&last.owner!==owner)return score;
    return evaluate(e,action,owner).useful?score:-100;
  }
  const api={battlePlan,evaluate,select,defenseBias,response,assessment,expectedDamage};root.DuelAITactics=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
