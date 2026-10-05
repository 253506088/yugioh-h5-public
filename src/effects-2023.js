/* 2023 shared rules: identities, physical materials and serializable choices. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,extend,card,def,field,monster,series}=X;
 const Y=X.year2023={...X.year2022,limit:n=>H.once('2023-'+n,'name')};
 for(const d of D.CARD_LIST.filter(c=>c.releaseYear===2023))if(!d.existing&&d.effect){d.implementationStatus='pending';d.implementationNote='2023 年效果待落实，不可编入正式构筑';}
 const groups={vanquishsoul:['VS','Vanquish Soul'],purrely:['纯爱妖精','Purrely'],rescueace:['救援王牌','Rescue-ACE'],bystial:['深渊兽','Bystial']};
 for(const[key,[label,name]]of Object.entries(groups)){D.families[key]=label;for(const d of D.CARD_LIST)if(series(d,name))d.families=[...new Set([...(d.families||[]),key])];}
 Y.lightDark=(e,m)=>monster(m)&&['光','暗'].includes(e.attribute(m));
 Y.bottom=(e,c,us)=>{const owners=new Map(us.map(u=>[u,card(e,u)?.originalOwner]));X.moved(e,c,us,'deck','effect-return');for(const owner of [0,1])Y.orderDeck(e,{...c,owner},us.filter(u=>owners.get(u)===owner&&e.find(u)?.zone==='deck'));};
 Y.activated=(e,s)=>!!s&&!s.continuous&&(s.zone!==undefined||e.state.resolvingLink?.source?.uid===s.uid);
 Y.set=(e,c,u)=>{const m=card(e,u);if(!m||!Y.st(m)||def(m).spellKind!=='field'&&!e.freeSpellZones(c.owner).length)return null;const r=e.move(u,def(m).spellKind==='field'?'fieldSpell':'spells',{kind:'effect-set',source:c.source,byOwner:c.owner,owner:c.owner,faceUp:false});return r?card(e,u):null;};
 // find().index already identifies the physical shared Extra Monster Zone;
 // extraSlot() converts a relative zone name and must not convert it again.
 Y.column=(e,m)=>{const f=e.find(m.uid);if(!f||!field(f.zone))return null;if(f.zone==='extraMonster')return root.DuelLinkRules.extraPoint(f.card.extraSlot??f.index).x;return f.owner===0?f.index:4-f.index;};
 Y.sameChain=(e,c)=>e.state.chain.some(l=>l.owner===c.owner&&l.sourceId===c.sourceId);
 Y.place=(e,c,u)=>{const m=card(e,u);if(!m||!Y.st(m)||e.state.players[c.owner].spells.every(Boolean))return null;const r=e.move(u,'spells',{kind:'effect-place',source:c.source,byOwner:c.owner,owner:c.owner,faceUp:true});if(r){m.faceUp=true;m.setTurn=-1;return m;}return null;};
 Y.pick=(e,c,title,pool,op,data={},min=1,max=min)=>X.choose(e,c,title,pool,min,max,op,{role:'search',...data});
 E.op('y23-set',(e,t)=>{for(const u of t.picks)Y.set(e,Y.choiceContext(t),u);e.shuffle(e.state.players[t.owner].deck);});
 E.op('y23-place',(e,t)=>{for(const u of t.picks)Y.place(e,Y.choiceContext(t),u);e.shuffle(e.state.players[t.owner].deck);});
 E.op('y23-destroy',(e,t)=>X.destroy(e,Y.choiceContext(t),t.picks));
 E.op('y23-return',(e,t)=>X.moved(e,Y.choiceContext(t),t.picks,'hand','effect-return'));
 E.op('y23-send',(e,t)=>X.moved(e,Y.choiceContext(t),t.picks,'grave','effect-send'));
 E.op('y23-banish',(e,t)=>X.moved(e,Y.choiceContext(t),t.picks,'banished','effect-banish'));
 E.op('y23-revive',(e,t)=>{for(const u of t.picks)X.revive(e,Y.choiceContext(t),u,{via:t.context.via||'effect',position:t.context.position||'attack'});if(t.context.shuffle)e.shuffle(e.state.players[t.owner].deck);});
 const clean=m=>{if(m)for(const k of Object.keys(m))if(k.startsWith('y23'))delete m[k];};
 extend('describe',function(prior,m,...a){return {...prior.call(this,m,...a),...Object.fromEntries(Object.entries(m).filter(([k])=>k.startsWith('y23')))};});
 extend('move',function(prior,u,to,o={}){const f=this.find(u),m=f?.card,r=prior.call(this,u,to,o);if(m&&r&&r.from!==r.to&&field(f.zone))clean(m);return r;});
 extend('takeMaterial',function(prior,u,...a){const r=prior.call(this,u,...a);for(const m of r.cards)clean(m);return r;});
 extend('setPosition',function(prior,u,pos,s,down=false){const r=prior.call(this,u,pos,s,down);if(r&&down)clean(card(this,u));return r;});
 extend('materialMatches',function(prior,m,s,p=null){const f=this.find(m.uid);return (!s.races||s.races.includes(this.race(m)))&&(!s.handOnly||f?.zone==='hand')&&(!s.own||f?.owner===(p??this._y20FusionOwner??this.state.active))&&(!s.faceDown||!m.faceUp)&&(!s.faceUp||m.faceUp)&&(!s.position||m.position===s.position)&&(s.maxDef===undefined||this.defenseValue(m)<=s.maxDef)&&(s.atk===undefined||this.attackValue(m)===s.atk)&&(s.def===undefined||this.defenseValue(m)===s.def)&&prior.call(this,m,s,p);});
 extend('synchroValid',function(prior,p,m,ms,...a){const s=def(m)?.synchro||{},t=q=>this.synchroMaterialTuner?this.synchroMaterialTuner(q,m,ms):this.isTuner(q);return (!s.finalMaterialAttribute||ms.some(q=>this.attribute(q)===s.finalMaterialAttribute&&ms.filter(v=>v!==q).every(t)))&&ms.every(q=>t(q)?!s.tunerLevel||this.level(q)===s.tunerLevel:!s.nonAttributes||s.nonAttributes.includes(this.attribute(q)))&&prior.call(this,p,m,ms,...a);});
 extend('linkValid',function(prior,p,m,ms,...a){const s=def(m)?.link||{};return ms.every(q=>!def(q).cannotLink&&(!s.nonLink||def(q).type!=='link')&&(!s.materialName||X.is(q,s.materialName))&&(!s.equipped||this.spells(p).some(v=>v.equipTarget===q.uid)))&&(!s.includingMinLevel||ms.some(q=>this.level(q)>=s.includingMinLevel))&&prior.call(this,p,m,ms,...a);});
 for(const method of ['fusionValid','fusionCombos'])extend(method,function(prior,p,m,...a){const d=def(m);if(!d?.fusionAlternatives)return prior.call(this,p,m,...a);const original=d.fusion,variants=[original,...d.fusionAlternatives],results=[];try{for(const specs of variants){d.fusion=specs;const r=prior.call(this,p,m,...a);if(method==='fusionValid'&&r)return true;if(method==='fusionCombos')results.push(...r);}return method==='fusionValid'?false:[...new Map(results.map(us=>[us.slice().sort().join(','),us])).values()];}finally{d.fusion=original;}});
 if(typeof module!=='undefined'){for(const part of ['bystial','vanquish','purrely','rescue','support','final'])require('./effects-2023-'+part+'.js');module.exports=X;}
})(globalThis);
