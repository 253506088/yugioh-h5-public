/* 2024 contracts: physical materials, authored effects and saved continuations. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,C,extend,card,def,field,monster,series}=X;
 const Y=X.year2024={...X.year2023,limit:n=>H.once('2024-'+n,'name')};
 for(const d of D.CARD_LIST.filter(c=>c.releaseYear===2024))if(!d.existing&&d.effect){d.implementationStatus='pending';d.implementationNote='2024 年效果待落实，不可编入正式构筑';}
 for(const[key,label,name]of [['fiendsmith','魔锻','Fiendsmith'],['tenpai','天杯龙','Tenpai Dragon'],['snakeeye','蛇眼','Snake-Eye'],['yubel','尤贝尔','Yubel']]){D.families[key]=label;for(const d of D.CARD_LIST)if(series(d,name))d.families=[...new Set([...(d.families||[]),key])];}
 Y.fireDragon=(e,m)=>monster(m)&&e.attribute(m)==='炎'&&e.race(m)==='龙族';
 Y.lightFiend=(e,m)=>monster(m)&&e.attribute(m)==='光'&&e.race(m)==='恶魔族';
 Y.live=(e,n,p=null)=>X.year2023.live(e,n,p).filter(f=>!f.card.y24Continuous&&!f.card.monsterEquip);
 extend('earlyCanUse',function(prior,c,a){return !card(this,c.uid)?.y24Continuous&&prior.call(this,c,a);});
 Y.mentions=(m,name)=>(def(m)?.originalDescription||'').includes('"'+name+'"');
 Y.shuffle=(e,c,us,kind='effect-return')=>{X.moved(e,c,us,'deck',kind);for(const p of [0,1])e.shuffle(e.state.players[p].deck);};
 Y.fusionProfile=(zones,pred)=>({zones,destination:'deck',noTokens:true,y24Fiend:pred==='fiend',y24Fiendsmith:pred==='fiendsmith'});
 Y.fusionChoice=(e,c,profile)=>{const opts=e.fusions(c.owner,profile);if(opts.length)e.queueChoice(c.owner,'选择融合召唤的怪兽',opts.map(o=>e.option(o.card,{viewer:c.owner})),1,1,'y24-fusion',{profile,source:c.source});};
 E.op('y24-fusion',(e,t)=>{const m=card(e,t.picks[0]);if(m&&e.fusionCombos(t.owner,m,t.context.profile).length)e.state.tasks.push({op:'fusion-materials',owner:t.owner,extraUid:m.uid,spellId:t.context.profile,source:t.context.source});});
 extend('fusionAllowed',function(prior,m,s){return (!s?.y24Fiend||def(m).race==='恶魔族')&&(!s?.y24Fiendsmith||series(m,'Fiendsmith'))&&prior.call(this,m,s);});
 extend('materialMatches',function(prior,m,s,...a){return (s.originalAtk===undefined||this.originalAttack(m)===s.originalAtk)&&(s.originalDef===undefined||this.originalDefense(m)===s.originalDef)&&(!s.mentionsName||Y.mentions(m,s.mentionsName))&&prior.call(this,m,s,...a);});
 extend('fusionValid',function(prior,p,m,ms,...a){const d=def(m),gy=ms.filter(q=>this.find(q.uid)?.zone==='grave');return (!d.fusionDifferentLevels||new Set(ms.map(q=>this.level(q))).size===ms.length)&&(!d.fusionUniqueGraveNames||new Set(gy.map(q=>this.cardNameId(q))).size===gy.length)&&prior.call(this,p,m,ms,...a);});
 extend('linkValid',function(prior,p,m,ms,...a){const s=def(m)?.link||{};return (!s.includingMaterial||ms.some(q=>this.materialMatches(q,s.includingMaterial)))&&(s.maxOriginalAtk===undefined||ms.every(q=>this.originalAttack(q)<=s.maxOriginalAtk))&&prior.call(this,p,m,ms,...a);});
 extend('synchroValid',function(prior,p,m,ms,...a){const d=def(m),original=d?.synchro;if(d?.synchroAlternatives){try{for(const s of [original,...d.synchroAlternatives]){d.synchro=s;if(prior.call(this,p,m,ms,...a))return true;}return false;}finally{d.synchro=original;}}return ms.every(q=>this.isTuner(q)||(original?.nonOriginalAtk===undefined||this.originalAttack(q)===original.nonOriginalAtk)&&(original?.nonOriginalDef===undefined||this.originalDefense(q)===original.nonOriginalDef))&&prior.call(this,p,m,ms,...a);});
 Y.synchroChoices=(e,c)=>e.extraOptions(c.owner).filter(o=>o.type==='synchro').flatMap(o=>o.combos.filter(s=>s.materials.includes(c.uid)).map(s=>({uid:JSON.stringify([o.card.uid,...s.materials]),label:def(o.card).name+' · '+s.materials.map(u=>def(card(e,u)).name).join(' + '),value:def(o.card).atk||1000})));
 Y.quickSynchro=n=>X.Q(n,'y24-synchro',{once:H.once('tenpai-synchro','card'),summons:true,condition:(e,c)=>e.state.phase==='battle'&&!Y.damageStep(e)&&Y.synchroChoices(e,c).length>0,resolve:(e,c)=>e.queueChoice(c.owner,'选择同调怪兽与素材',Y.synchroChoices(e,c),1,1,'y24-synchro',{source:c.source,uid:c.uid,generation:card(e,c.uid)?.generation}),aiScore:1800,aiResponse:()=>1800});
 E.op('y24-synchro',(e,t)=>{const [u,...us]=JSON.parse(t.picks[0]),m=card(e,u),ms=us.map(v=>card(e,v)),f=e.find(t.context.uid);if(m&&f&&Y.fm(f.zone)&&f.card.generation===t.context.generation&&us.includes(t.context.uid)&&ms.every(Boolean)&&e.synchroValid(t.owner,m,ms))e.performSynchro(t.owner,u,us,{source:t.context.source});});
 Y.chooseDiscard=(e,c,op=null,data={})=>Y.pick(e,c,'选择丢弃一张手牌',X.hand(e,c.owner),'y24-discard',{op,...data,role:'cost'});
 E.op('y24-discard',(e,t)=>{const c=Y.choiceContext(t);X.moved(e,c,t.picks,'grave','effect-discard');if(t.context.op)E.operation(e,{...t,operation:t.context.op});});
 E.op('y24-shuffle',(e,t)=>Y.shuffle(e,Y.choiceContext(t),t.picks));
 E.op('y24-destroy',(e,t)=>X.destroy(e,Y.choiceContext(t),t.picks));
 const clean=m=>{if(m)for(const k of Object.keys(m))if(k.startsWith('y24'))delete m[k];};
 extend('describe',function(prior,m,...a){return {...prior.call(this,m,...a),attribute:this.attribute(m),race:this.race(m),...Object.fromEntries(Object.entries(m).filter(([k])=>k.startsWith('y24')))};});
 extend('move',function(prior,u,to,o={}){const f=this.find(u),m=f?.card,r=prior.call(this,u,to,o);if(m&&r&&r.from!==r.to&&field(f.zone))clean(m);return r;});
 extend('takeMaterial',function(prior,u,...a){const r=prior.call(this,u,...a);for(const m of r.cards)clean(m);return r;});
 extend('setPosition',function(prior,u,pos,s,down=false){const r=prior.call(this,u,pos,s,down);if(r&&down)clean(card(this,u));return r;});
 if(typeof module!=='undefined'){for(const part of ['fiendsmith','yubel','snake-eye','tenpai','final'])require('./effects-2024-'+part+'.js');module.exports=X;}
})(globalThis);
