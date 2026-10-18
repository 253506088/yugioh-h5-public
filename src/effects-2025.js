/* 2025 contracts: authored effects, physical resources and JSON continuations. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,extend,card,def,field,monster,series}=X;
 const Y=X.year2025={...X.year2024,limit:n=>H.once('2025-'+n,'name')};
 for(const d of D.CARD_LIST.filter(c=>c.releaseYear===2025))if(!d.existing&&d.effect){d.implementationStatus='pending';d.implementationNote='2025 年效果待落实，不可编入正式构筑';}
 for(const [key,label,name]of [['maliss','码丽丝','Maliss'],['ryzeal','雷热涡炉','Ryzeal'],['k9','K9','K9']]){D.families[key]=label;for(const d of D.CARD_LIST)if(series(d,name))d.families=[...new Set([...(d.families||[]),key])];}
 Y.face=(e,p)=>e.monsters(p).filter(m=>m.faceUp);
 Y.overlays=(e,p,pred=()=>true)=>Y.face(e,p).filter(pred).flatMap(m=>m.overlays||[]);
 // Do not spend replacement resources on destruction already prevented by
 // immunity, a live passive, or the engine's ordinary protection flags.
 Y.alreadyProtected=(e,m,s,b)=>{const f=e.find(m.uid);return !b&&(e.unaffected(m,s)||m.linkProtection&&s?.owner!==f?.owner||m.effectIndestructible||m.effectProtectedUntil>=e.state.turn)||e.passiveSources().some(v=>E.passives[v.card.id]?.protect?.(e,v,m,b,s))||b&&(e.state.players[f.owner].wabokuTurn===e.state.turn||m.battleProtectedUntil>=e.state.turn||e.activeEquip(m,'saqlifice').length);};
 Y.detach=(e,us)=>{for(const u of us){const f=e.find(u);if(f?.zone==='overlays')e.detach(f.parentUid,[u]);}};
 Y.monsterActivated=(e,p,handGY=false)=>e.state.players[p][handGY?'y25HandGraveTurn':'y25MonsterTurn']===e.state.turn;
 extend('recordChain',function(prior,stage,l,...a){const r=prior.call(this,stage,l,...a);if(stage==='add'&&l.source.effectType==='monster'){this.state.players[l.owner].y25MonsterTurn=this.state.turn;if(['hand','grave'].includes(l.source.zone))this.state.players[l.owner].y25HandGraveTurn=this.state.turn;this.emit({type:'y25-monster-activated',owner:l.owner,link:l});}return r;});
 extend('runTask',function(prior,t){const r=prior.call(this,t);if(t.op==='finish-link'&&!t.link.negatedActivation&&t.link.source.effectType==='monster')this.emit({type:'y25-monster-resolved',owner:t.link.owner,link:t.link});return r;});
 extend('synchroValid',function(prior,p,m,ms,...a){const s=def(m)?.synchro||{},t=q=>this.synchroMaterialTuner(q,m,ms);return (!s.requiredTunerId||ms.some(q=>t(q)&&q.id===s.requiredTunerId))&&(!s.requiredTunerSeries||ms.some(q=>t(q)&&series(q,s.requiredTunerSeries)))&&(!s.additionalType||ms.some(q=>t(q)&&ms.every(v=>v===q||def(v).type===s.additionalType)))&&prior.call(this,p,m,ms,...a);});
 Y.xyzChoices=(e,c,pred=()=>true,required=c.uid)=>e.extraOptions(c.owner).filter(o=>o.type==='xyz'&&pred(o.card)).flatMap(o=>o.combos.filter(s=>!required||s.materials.includes(required)).map(s=>({uid:JSON.stringify([o.card.uid,...s.materials]),label:def(o.card).name+' · '+s.materials.map(u=>def(card(e,u)).name).join(' + '),value:def(o.card).atk||1000})));
 Y.xyzChoice=(e,c,pred=()=>true,required=c.uid)=>{const opts=Y.xyzChoices(e,c,pred,required);if(opts.length)e.queueChoice(c.owner,'选择超量怪兽与素材',opts,1,1,'y25-xyz',{source:c.source,required});};
 E.op('y25-xyz',(e,t)=>{const [u,...us]=JSON.parse(t.picks[0]),m=card(e,u),ms=us.map(v=>card(e,v));if(m&&(!t.context.required||us.includes(t.context.required))&&ms.every(Boolean)&&e.xyzValid(t.owner,m,ms))e.performXyz(t.owner,u,us,{source:t.context.source});});
 Y.attachChoice=(e,c,host,pool)=>{const f=e.find(host);if(f&&Y.fm(f.zone)&&pool.length)Y.pick(e,c,'选择叠放的卡片',pool,'y25-attach',{host,generation:f.card.generation,role:'own-boost'},0,1);};
 E.op('y25-attach',(e,t)=>{const f=e.find(t.context.host);if(f&&Y.fm(f.zone)&&f.card.generation===t.context.generation&&t.picks[0])e.attach(f.card.uid,t.picks[0],t.context.source);e.shuffle(e.state.players[t.owner].deck);});
 E.op('y25-special',(e,t)=>{for(const u of t.picks){const m=X.revive(e,Y.choiceContext(t),u,{via:t.context.via||'effect',position:t.context.position||'attack',negated:!!t.context.negated});if(m)Object.assign(m,t.context.flags||{});}if(t.context.shuffle)e.shuffle(e.state.players[t.owner].deck);});
 E.op('y25-set',(e,t)=>{for(const u of t.picks)Y.set(e,Y.choiceContext(t),u);e.shuffle(e.state.players[t.owner].deck);});
 E.op('y25-send',(e,t)=>X.moved(e,Y.choiceContext(t),t.picks,'grave','effect-send'));
 E.op('y25-banish',(e,t)=>X.moved(e,Y.choiceContext(t),t.picks,'banished','effect-banish'));
 E.op('y25-return',(e,t)=>X.moved(e,Y.choiceContext(t),t.picks,'hand','effect-return'));
 E.op('y25-destroy',(e,t)=>X.destroy(e,Y.choiceContext(t),t.picks));
 Y.endControl=(e,c,m)=>{const previousOwner=m&&e.find(m.uid)?.owner;if(m&&e.takeControl(m.uid,c.owner,{source:c.source}))X.defer(e,c,'end',e.state.turn,'y25-return-control',{uid:m.uid,generation:m.generation,previousOwner,anyOwner:true});};
 E.op('y25-return-control',(e,t)=>{const d=t.context||t.data||t,f=e.find(d.uid);if(f&&Y.fm(f.zone)&&f.card.generation===d.generation)e.takeControl(f.card.uid,d.previousOwner??f.card.originalOwner,{source:d.source,rule:true});});
 const clean=m=>{if(m)for(const k of Object.keys(m))if(k.startsWith('y25'))delete m[k];};
 extend('describe',function(prior,m,...a){return {...prior.call(this,m,...a),...Object.fromEntries(Object.entries(m).filter(([k])=>k.startsWith('y25')))};});
 extend('move',function(prior,u,to,o={}){const f=this.find(u),m=f?.card,r=prior.call(this,u,to,o);if(m&&r&&r.from!==r.to&&field(f.zone))clean(m);return r;});
 extend('takeMaterial',function(prior,u,...a){const r=prior.call(this,u,...a);for(const m of r.cards)clean(m);return r;});
 extend('setPosition',function(prior,u,pos,s,down=false){const r=prior.call(this,u,pos,s,down);if(r&&down)clean(card(this,u));return r;});
 if(typeof module!=='undefined'){for(const part of ['maliss','ryzeal','k9','lunalight','striker','support','final'])require('./effects-2025-'+part+'.js');module.exports=X;}
})(globalThis);
