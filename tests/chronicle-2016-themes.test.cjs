const test=require('node:test');
const {assert,D,E,DuelEngine,fresh,put,fieldCard,act,drain,use,trigger,source}=require('./chronicle-2015-helpers.cjs');
const fm=(e,m)=>['monsters','extraMonster'].includes(e.find(m.uid)?.zone);
test('Maxx C is unavailable when its send-to-grave cost is replaced, including in planner candidates',()=>{const e=fresh(),s=put(e,0,'hand','Maxx "C"');e.state.ruleMode={id:'liberation',version:1,players:[{},{}]};assert.equal(E.available(e,0,{kind:'main'}).some(a=>a.uid===s.uid),false);assert.equal(e.actionsFor(s.uid).some(a=>a.uid===s.uid&&a.type==='activate'),false);e.state.ruleMode=null;assert.equal(E.available(e,0,{kind:'main'}).some(a=>a.uid===s.uid),true);});
test('Effect Veiler is not offered as a response under liberation or Macro Cosmos',()=>{for(const mode of ['liberation','macro']){const e=fresh(),s=put(e,1,'hand','Effect Veiler');fieldCard(e,0,'Darklord Nasten');if(mode==='liberation')e.state.ruleMode={id:'liberation',version:1,players:[{},{}]};else put(e,0,'spells','Macro Cosmos');assert.equal(E.available(e,1,{kind:'main-open',owner:0}).some(a=>a.uid===s.uid),false);}const e=fresh(),s=put(e,1,'hand','Effect Veiler');fieldCard(e,0,'Darklord Nasten');assert.equal(E.available(e,1,{kind:'main-open',owner:0}).some(a=>a.uid===s.uid),true);});
test('Amdusc can target itself after it is discarded as the actual activation cost',()=>{const e=fresh(),s=put(e,0,'hand','Darklord Amdusc'),m=put(e,0,'hand','Darklord Contact');use(e,s,'y16-discard',{cost:[m.uid],target:[s.uid]});assert.equal(e.find(m.uid).zone,'grave');assert.equal(e.find(s.uid).zone,'hand');});
test('Amdusc cannot target costs that will be banished, but can still recover an existing grave card',()=>{
 for(const mode of ['liberation','macro']){const e=fresh(),s=put(e,0,'hand','Darklord Amdusc'),cost=put(e,0,'hand','Darklord Contact');if(mode==='liberation')e.state.ruleMode={id:'liberation',version:1,players:[{},{}]};else put(e,1,'spells','Macro Cosmos');
 assert.equal(E.available(e,0,{kind:'main'}).some(a=>a.uid===s.uid&&a.key.endsWith('y16-discard')),false);
 const target=put(e,0,'grave','Darklord Superbia');use(e,s,'y16-discard',{cost:[cost.uid],target:[target.uid]});
 assert.equal(e.find(s.uid).zone,'banished');assert.equal(e.find(cost.uid).zone,'banished');assert.equal(e.find(target.uid).zone,'hand');}
});
test('Panther Dancer resists either player effect destruction while Leo resists only its opponent',()=>{
 const e=fresh(),panther=fieldCard(e,0,'Lunalight Panther Dancer'),leo=fieldCard(e,0,'Lunalight Leo Dancer');
 for(const owner of [0,1])assert.equal(e.destroy(panther.uid,source(e,'Raigeki',owner)),false);
 assert.equal(e.destroy(leo.uid,source(e)),false);assert.equal(e.destroy(leo.uid,source(e,'Raigeki',0)),true);
 assert.equal(e.destroy(panther.uid,source(e),true),true);
});
test('Vayu excludes material pairs with no corresponding Blackwing Synchro, then resolves a legal pair',()=>{const e=fresh(),s=put(e,0,'grave','Blackwing - Vayu the Emblem of Honor'),bad=put(e,0,'grave','Blackwing - Shura the Blue Flame'),x=put(e,0,'extra','Blackwing Armed Wing');assert.equal(E.available(e,0,{kind:'main'}).some(a=>a.uid===s.uid),false);const good=put(e,0,'grave','Blackwing - Sirocco the Dawn');use(e,s,'era-effect',{target:[good.uid]});assert.equal(e.find(s.uid).zone,'banished');assert.equal(e.find(good.uid).zone,'banished');assert.equal(e.find(bad.uid).zone,'grave');assert.ok(fm(e,x));assert.equal(e.negated(x),true);});
test('Caliga history cannot make an otherwise empty monster effect look useful to the AI',()=>{const e=fresh(),m=fieldCard(e,0,'Dark Magician'),mode='test-y16-empty',key=m.id+'::'+mode;E.register(m.id,mode,{resolve:()=>{},aiScore:100});try{const result=global.DuelAIMarginal.evaluate(e,{type:'activate',uid:m.uid,key},0,{force:true});assert.equal(result.useful,false,JSON.stringify(result));}finally{delete E.defs[key];E.byCard[m.id]=E.byCard[m.id].filter(a=>a.key!==key);}});
test('Darklord copy pays LP but not the copied trap cost, then shuffles the actual trap',()=>{
 const e=fresh(),s=fieldCard(e,0,'Darklord Ixchel'),trap=put(e,0,'grave','Darklord Rebellion'),victim=fieldCard(e,1,'Blue-Eyes White Dragon');const lp=e.state.players[0].lp;use(e,s,'y16-copy',{target:[trap.uid]},p=>p.kind==='choice'?{type:'choose',uids:[victim.uid]}:null);assert.equal(e.state.players[0].lp,lp-1000);assert.ok(fm(e,s));assert.equal(e.find(victim.uid).zone,'grave');assert.equal(e.find(trap.uid).zone,'deck');
});
test('Darklord copied search can pause and resume from JSON before shuffling',()=>{
 let e=fresh();const s=fieldCard(e,0,'Darklord Nasten'),spell=put(e,0,'grave','Banishment of the Darklords'),m=put(e,0,'deck','Darklord Ukoback');act(e,{type:'activate',uid:s.uid,key:s.id+'::y16-copy',choices:{target:[spell.uid]}});let guard=0;while(e.state.pending?.kind==='window'&&guard++<10)act(e,{type:'pass'});assert.equal(e.state.pending?.kind,'choice');e=DuelEngine.restore(e.snapshot());drain(e,p=>p.kind==='choice'?{type:'choose',uids:[m.uid]}:null);assert.equal(e.find(m.uid).zone,'hand');assert.equal(e.find(spell.uid).zone,'deck');
});
test('Darklord original trap requires a send-to-grave cost and liberation prevents activation',()=>{
 const e=fresh(),s=put(e,0,'spells','Darklord Rebellion',{faceUp:false}),m=fieldCard(e,0,'Darklord Ixchel'),t=fieldCard(e,1,'Blue-Eyes White Dragon');e.state.ruleMode={id:'liberation',version:1,players:[{},{}]};assert.equal(E.available(e,0,{kind:'main'}).some(a=>a.uid===s.uid),false);e.state.ruleMode=null;use(e,s,'cast',{cost:[m.uid]},p=>p.kind==='choice'?{type:'choose',uids:[t.uid]}:null);assert.equal(e.find(m.uid).zone,'grave');assert.equal(e.find(t.uid).zone,'grave');
});
test('Darklord Ixchel discards two physical cards before drawing two and shares its summon limit by name',()=>{
 const e=fresh(),s=put(e,0,'hand','Darklord Ixchel'),t=put(e,0,'hand','Darklord Contact');use(e,s,'y16-discard',{cost:[t.uid]});assert.equal(e.find(s.uid).zone,'grave');assert.equal(e.find(t.uid).zone,'grave');assert.equal(e.state.players[0].hand.length,2);trigger(e,()=>e.special(0,s.uid,{via:'revive'}));const copy=put(e,0,'grave','Darklord Ixchel');assert.equal(e.canSpecial(0,copy,{via:'revive'}),false);e.state.turn++;assert.equal(e.canSpecial(0,copy,{via:'revive'}),true);
});
test('Darklord copied Contact revives an older member and uses monster effect immunity',()=>{
 const e=fresh(),s=fieldCard(e,0,'Darklord Amdusc'),spell=put(e,0,'grave','Darklord Contact'),m=put(e,0,'grave','Darklord Superbia');use(e,s,'y16-copy',{target:[spell.uid]});assert.ok(fm(e,m));assert.equal(m.position,'defense');assert.equal(e.find(spell.uid).zone,'deck');
});
test('Tezcatlipoca replaces destruction once without protecting an opponent monster',()=>{
 const e=fresh(),s=put(e,0,'hand','Darklord Tezcatlipoca'),m=fieldCard(e,0,'Darklord Superbia'),t=fieldCard(e,1,'Darklord Superbia');assert.equal(e.destroy(t.uid,source(e)),true);assert.equal(e.find(s.uid).zone,'hand');assert.equal(e.destroy(m.uid,source(e)),false);assert.equal(e.find(s.uid).zone,'grave');assert.ok(fm(e,m));assert.equal(e.destroy(m.uid,source(e)),true);
});
test('Ukoback sends a Darklord card without confusing cards whose English names merely contain Darklord',()=>{
 const e=fresh(),s=put(e,0,'hand','Darklord Ukoback'),m=put(e,0,'deck','Darklord Contact');act(e,{type:'summon',uid:s.uid});drain(e,p=>p.kind==='choice'?{type:'choose',uids:[m.uid]}:null);assert.equal(e.find(m.uid).zone,'grave');assert.equal(D.inArchetype(D.cardByName('Darklord Superbia'),'Darklord'),true);
});
test('Lunalight Wolf fuses from grave by banishing materials and its summon restriction survives negation',()=>{
 const e=fresh(),s=put(e,0,'spells','Lunalight Wolf'),a=put(e,0,'grave','Lunalight Black Sheep'),b=put(e,0,'grave','Lunalight Blue Cat'),f=put(e,0,'extra','Lunalight Cat Dancer');use(e,s,'y16-fusion',{},p=>p.purpose==='fusion'?{type:'choose',uids:[a.uid,b.uid]}:null);assert.ok(fm(e,f));assert.equal(e.find(a.uid).zone,'banished');assert.equal(e.find(b.uid).zone,'banished');const scale=put(e,0,'spells','Lunalight Tiger');e.state.players[0].spells[e.state.players[0].spells.indexOf(scale)]=null;e.state.players[0].spells[4]=scale;s.spellNegated=true;const other=put(e,0,'hand','Battle Ox');assert.equal(e.pendulumValid(0,[other.uid]),false);
});
test('Lunalight Tiger revives with effects negated, no attacks, and saved End Phase destruction',()=>{
 let e=fresh();const s=put(e,0,'spells','Lunalight Tiger'),m=put(e,0,'grave','Lunalight Blue Cat');use(e,s,'y16-revive',{target:[m.uid]});assert.ok(fm(e,m));assert.equal(e.negated(m),true);assert.equal(e.canAttack(m,0),false);e=DuelEngine.restore(e.snapshot());trigger(e,()=>e.emit({type:'end-phase',owner:0}));assert.equal(e.find(m.uid).zone,'grave');
});
test('Destroyed Lunalight Tiger triggers from the face-up Extra Deck',()=>{
 const e=fresh(),s=put(e,0,'spells','Lunalight Tiger'),m=put(e,0,'grave','Lunalight White Rabbit');trigger(e,()=>e.destroy(s.uid,source(e)));assert.equal(e.find(s.uid).zone,'extra');assert.ok(fm(e,m));
});
test('Kaleido Chick sends exact named material but changes its identity only for Fusion validation',()=>{
 const e=fresh(),s=fieldCard(e,0,'Lunalight Kaleido Chick'),named=put(e,0,'extra','Lunalight Panther Dancer'),a=fieldCard(e,0,'Lunalight Blue Cat'),b=fieldCard(e,0,'Lunalight Black Sheep'),leo=put(e,0,'extra','Lunalight Leo Dancer');use(e,s,'y16-name',{cost:[named.uid]});assert.equal(e.find(named.uid).zone,'grave');assert.equal(e.cardNameId(s),s.id);assert.equal(e.fusionValid(0,leo,[s,a,b]),true);e.state.turn++;assert.equal(e.fusionValid(0,leo,[s,a,b]),false);
});
test('Crimson Fox triggers from effect sending but not from Kaleido-style send costs',()=>{
 for(const cost of [true,false]){const e=fresh(),s=put(e,0,'hand','Lunalight Crimson Fox'),m=fieldCard(e,1,'Blue-Eyes White Dragon');trigger(e,()=>e.move(s.uid,'grave',{kind:cost?'cost-send':'effect-send',source:source(e)}));assert.equal(e.attackValue(m),cost?3000:0);}
});
test('Black Sheep searches Polymerization after discarding and can recover a face-up Extra Deck Pendulum',()=>{
 const e=fresh(),s=put(e,0,'hand','Lunalight Black Sheep'),poly=put(e,0,'deck','Polymerization');use(e,s,'y16-poly',{},p=>p.kind==='choice'?{type:'choose',uids:[poly.uid]}:null);assert.equal(e.find(s.uid).zone,'grave');assert.equal(e.find(poly.uid).zone,'hand');const t=put(e,0,'extra','Lunalight Tiger',{faceUpExtra:true});e.move(s.uid,'hand',{kind:'effect-return'});trigger(e,()=>e.move(s.uid,'grave',{kind:'fusion-material',source:{id:poly.id,owner:0,effectType:'spell'}}));assert.equal(e.find(t.uid).zone,'hand');
});
test('Cat Dancer protects the first battle, destroys on the second, and cannot attack the same monster three times',()=>{
 const e=fresh(),s=fieldCard(e,0,'Lunalight Cat Dancer'),cost=fieldCard(e,0,'Lunalight Black Sheep'),m=fieldCard(e,1,'Battle Ox');use(e,s,'y16-dance',{cost:[cost.uid]});e.state.phase='battle';act(e,{type:'attack',uid:s.uid,target:m.uid});drain(e);assert.ok(fm(e,m));act(e,{type:'attack',uid:s.uid,target:m.uid});drain(e);assert.equal(e.find(m.uid).zone,'grave');assert.equal(e.canAttack(s,0,m.uid),false);assert.equal(e.canAttack(s,0,null),false);
});
test('Panther Dancer gains 200 only until the end of the Battle Phase',()=>{
 const e=fresh(),s=fieldCard(e,0,'Lunalight Panther Dancer'),m=fieldCard(e,1,'Battle Ox');e.state.phase='battle';act(e,{type:'attack',uid:s.uid,target:m.uid});drain(e);assert.equal(e.attackValue(s),3000);trigger(e,()=>e.emit({type:'battle-end',owner:0}));assert.equal(e.attackValue(s),2800);
});
test('Leo Dancer destroys only Special Summoned enemy monsters after its attack',()=>{
 const e=fresh(),s=fieldCard(e,0,'Lunalight Leo Dancer'),a=fieldCard(e,1,'Marshmallon'),b=fieldCard(e,1,'Battle Ox',{summonKind:'effect'}),c=fieldCard(e,1,'Dark Magician',{summonKind:'normal'});e.state.phase='battle';act(e,{type:'attack',uid:s.uid,target:a.uid});drain(e);assert.equal(e.find(b.uid).zone,'grave');assert.ok(fm(e,c));assert.equal(e.attackAllowance(s),2);
});
