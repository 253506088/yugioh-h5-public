/* Pseudo Space retains its physical identity. Only its current field name and
 * registered field effects are copied; saved choices contain stable keys. */
(function(root){
 'use strict';
 const D=root.DuelData,E=root.DuelEffects,P=root.ModernDuelEngine.prototype;
 const id=D.cardByName('Pseudo Space').id,copy=E.get(id+'::era-effect');
 const active=(e,m)=>m?.id===id&&m.pseudoSpace?.turn===e.state.turn&&e.find(m.uid)?.zone==='fieldSpell';
 const originalResolve=copy.resolve,originalCondition=copy.condition;
 copy.label='除外墓地场地：复制卡名与效果至回合结束';
 copy.condition=(e,c)=>!active(e,e.find(c.uid)?.card)&&(!originalCondition||originalCondition(e,c));
 copy.resolve=(e,c)=>{originalResolve(e,c);const m=e.find(c.uid)?.card;if(m&&e.find(m.uid).zone==='fieldSpell'){m.pseudoSpace={id:c.eraCopied,turn:e.state.turn};m.gxCopy={...m.pseudoSpace};e.log('effect','拟似空间：复制「'+D.CARDS[c.eraCopied].name+'」的卡名和场地效果，直到回合结束',c.owner,{uid:c.uid,cardId:id});}};
 const abilities=Object.values(E.defs).filter(a=>a.id!==id&&!a.cardActivation&&!a.inherent&&!a.trigger&&D.CARDS[a.id]?.spellKind==='field'&&a.zones.includes('fieldSpell'));
 for(const a of abilities){const {key,mode,id:target,...spec}=a,adapt=c=>({...c,sourceId:target,source:{...c.source,id:target}});
  E.register(id,'field-copy:'+key,{...spec,copyTargetId:target,fieldCopyOf:key,zones:['fieldSpell'],effectType:'spell',
   condition:(e,c)=>{const m=e.find(c.uid)?.card;return active(e,m)&&m.pseudoSpace.id===target&&e.activeSpell(m)&&(!a.condition||a.condition(e,adapt(c)));},
   inputs:a.inputs?(e,c)=>a.inputs(e,adapt(c)):undefined,
   cost:(e,c)=>{const next=adapt(c);a.cost?.(e,next);Object.assign(c,next,{sourceId:id,source:c.source});},
   resolve:(e,c)=>a.resolve(e,adapt(c))});
 }
 function extend(name,fn){const prior=P[name];P[name]=function(...a){return fn.call(this,prior,...a);};}
 extend('passiveSources',function(prior){const list=prior.call(this);for(const owner of [0,1]){const m=this.state.players[owner].fieldSpell;if(active(this,m)&&this.activeSpell(m)&&E.passives[m.pseudoSpace.id])list.push({...this.find(m.uid),card:{...m,id:m.pseudoSpace.id}});}return list;});
 const clear=e=>{for(const owner of [0,1]){const m=e.state.players[owner].fieldSpell;if(m?.pseudoSpace){delete m.pseudoSpace;delete m.gxCopy;delete m.gxCopyName;e.log('effect','拟似空间：复制效果结束，恢复原卡名',owner,{uid:m.uid,cardId:id});}}};
 // End-phase card effects resolve before expiry, then remove the copy before
 // the next player's Draw Phase. Leaving the field already clears these flags.
 extend('beginNextTurn',function(prior,...args){clear(this);return prior.apply(this,args);});
 D.CARDS[id].implementationNote='复制至回合结束：场地名称、已登记的场地主动效果与通用持续效果；保留原实体、代价与次数。仅在卡片发动时处理的效果不重新处理。独立注册的特殊事件仍依照本作该场地的实现。';
 root.DuelFieldCopies={id,abilities:abilities.map(a=>a.key)};
})(globalThis);
