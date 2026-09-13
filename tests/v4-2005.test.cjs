const test=require('node:test'),assert=require('node:assert/strict');
const {D,E,id,put,act}=require('./yearly-sweep-helpers.cjs'),{DuelEngine}=require('../src/advanced-engine.js');
function fresh(){const e=new DuelEngine({deck:'blue',opponentDeck:'dark',first:0,seed:2005});e.state.turn=6;e.state.phase='main1';for(const p of e.state.players){p.deck.push(...p.hand);p.hand=[];}return e;}
function drain(e){let n=0;while(e.state.pending&&n++<160)act(e,e.state.pending.kind==='window'?{type:'pass'}:e.chooseAI(e.state.pending));assert.ok(n<160);e.assertState();}
function cast(e,m,choices={}){act(e,{type:'activate',uid:m.uid,key:m.id+'::cast',choices});drain(e);}
function use(e,m,mode,choices={}){act(e,{type:'activate',uid:m.uid,key:m.id+'::'+mode,choices});drain(e);}
test('Dark World never responds to discard costs or a send-to-GY effect',()=>{
 for(const kind of ['cost-discard','effect-send']){const e=fresh(),m=put(e,0,'hand','Broww, Huntsman of Dark World');e.move(m.uid,'grave',{kind,source:{id:id('Sparks'),owner:1},byOwner:1});e.pump();drain(e);assert.equal(e.state.players[0].hand.length,0);assert.ok(!e.state.chainHistory.some(l=>l.cardId===m.id));}
});
test('Dark World Lightning discards by effect and Broww draws one card',()=>{
 const e=fresh(),broww=put(e,0,'hand','Broww, Huntsman of Dark World'),target=put(e,1,'spells','Jar of Greed',{faceUp:false}),spell=put(e,0,'hand','Dark World Lightning');cast(e,spell,{target:[target.uid]});assert.equal(e.find(target.uid).zone,'grave');assert.equal(e.find(broww.uid).zone,'grave');assert.equal(e.state.players[0].hand.length,1);
});
test('Dark Deal changes the opposing Spell and enables Browws opponent-discard bonus',()=>{
 const e=fresh(),broww=put(e,0,'hand','Broww, Huntsman of Dark World'),trap=put(e,0,'spells','Dark Deal',{faceUp:false}),spell=put(e,1,'hand','Pot of Greed');e.state.active=1;act(e,{type:'activate',uid:spell.uid,key:spell.id+'::cast'});act(e,{type:'respond',uid:trap.uid,key:trap.id+'::cast'});drain(e);assert.equal(e.find(broww.uid).zone,'grave');assert.equal(e.state.players[0].lp,7000);assert.equal(e.state.players[0].hand.length,2);assert.equal(e.state.players[1].hand.length,0);
});
test('Goldd revives and destroys opposing cards only after an opponent-effect discard',()=>{
 const e=fresh(),m=put(e,0,'hand','Goldd, Wu-Lord of Dark World'),a=put(e,1,'monsters','Battle Ox'),b=put(e,1,'spells','Soul Absorption');e.move(m.uid,'grave',{kind:'effect-discard',source:{id:id('Card Destruction'),owner:1},byOwner:1});e.pump();drain(e);assert.equal(e.find(m.uid).zone,'monsters');assert.equal(e.find(a.uid).zone,'grave');assert.equal(e.find(b.uid).zone,'grave');
});
test('Sillva requires the opponent to return exactly two hand cards after its bonus discard',()=>{
 const e=fresh(),m=put(e,0,'hand','Sillva, Warlord of Dark World');for(const n of ['Dark Magician','Sparks','Pot of Greed'])put(e,1,'hand',n);e.move(m.uid,'grave',{kind:'effect-discard',source:{id:id('Card Destruction'),owner:1},byOwner:1});e.pump();drain(e);assert.equal(e.find(m.uid).zone,'monsters');assert.equal(e.state.players[1].hand.length,1);
});
test('End of the World supports both Ritual Monsters and requires exactly Level 8',()=>{
 for(const name of ['Ruin, Queen of Oblivion','Demise, King of Armageddon']){const e=fresh(),m=put(e,0,'hand',name),s=put(e,0,'hand','End of the World'),material=put(e,0,'hand','Blue-Eyes White Dragon'),tooMuch=put(e,0,'hand','Master of Oz');assert.equal(e.ritualValid(0,m,[material],s.id),true);assert.equal(e.ritualValid(0,m,[tooMuch],s.id),false);cast(e,s);assert.equal(e.find(m.uid).zone,'monsters');assert.equal(e.find(m.uid).card.properlySummoned,true);}
});
test('Doomcaliber automatically tributes itself and negates a monster activation',()=>{
 const e=fresh(),doom=put(e,1,'monsters','Doomcaliber Knight'),m=put(e,0,'monsters','Gear Golem the Moving Fortress');use(e,m,'direct');assert.equal(e.find(doom.uid).zone,'grave');assert.equal(e.find(m.uid).zone,'grave');assert.equal(e.state.players[0].lp,7200);assert.ok(e.state.chainHistory.some(l=>l.cardId===doom.id));
});
test('Uria sends exactly three face-up traps as its actual summon cost',()=>{
 const e=fresh(),m=put(e,0,'hand','Uria, Lord of Searing Flames'),costs=['Gravity Bind','Spirit Barrier','Call of the Haunted'].map(n=>put(e,0,'spells',n));use(e,m,'year-special',{cost:costs.map(m=>m.uid)});for(const c of costs)assert.equal(e.find(c.uid).zone,'grave');assert.equal(e.find(m.uid).zone,'monsters');assert.equal(e.attackValue(m),3000);
});
test('Hamon sends three continuous spells and cannot substitute a normal Spell',()=>{
 const e=fresh(),m=put(e,0,'hand','Hamon, Lord of Striking Thunder'),cards=['Spell Absorption','Soul Absorption','Yellow Luster Shield'].map(n=>put(e,0,'spells',n));use(e,m,'year-special',{cost:cards.map(m=>m.uid)});assert.ok(cards.every(c=>e.find(c.uid).zone==='grave'));assert.equal(e.find(m.uid).zone,'monsters');
});
test('Raviel tributes three Fiends and creates a token for an opponents Normal Summon',()=>{
 const e=fresh(),m=put(e,0,'hand','Raviel, Lord of Phantasms'),cards=Array.from({length:3},()=>put(e,0,'monsters','Archfiend Soldier'));use(e,m,'year-special',{cost:cards.map(m=>m.uid)});e.state.active=1;const foe=put(e,1,'hand','Battle Ox');act(e,{type:'summon',uid:foe.uid});drain(e);assert.equal(e.monsters(0).filter(m=>m.id==='2005-phantasm-token').length,1);assert.equal(e.monsters(0).find(m=>m.id==='2005-phantasm-token').cannotAttack,true);
});
test('VW contact fusion banishes its real materials and is not a Polymerization summon',()=>{
 const e=fresh(),v=put(e,0,'monsters','V-Tiger Jet'),w=put(e,0,'monsters','W-Wing Catapult'),fusion=put(e,0,'extra','VW-Tiger Catapult');assert.equal(e.canSpecial(0,fusion,{via:'fusion'}),false);use(e,v,'contact-'+fusion.id,{material0:[v.uid],material1:[w.uid]});assert.equal(e.find(v.uid).zone,'banished');assert.equal(e.find(w.uid).zone,'banished');assert.ok(['monsters','extraMonster'].includes(e.find(fusion.uid).zone));assert.equal(fusion.properlySummoned,true);
});
test('Doriado provides all four elemental Attributes while face-up for Fuh-Rin-Ka-Zan',()=>{
 const e=fresh(),m=put(e,0,'monsters','Elemental Mistress Doriado'),t=put(e,0,'spells','Fuh-Rin-Ka-Zan',{faceUp:false});assert.deepEqual(e.attributes(m),['光','风','水','炎','地']);cast(e,t,{mode:['draw']});assert.equal(e.state.players[0].hand.length,2);m.faceUp=false;assert.deepEqual(e.attributes(m),['光']);
});
test('Dandylion has a mandatory trigger and its tokens cannot be Tributed this turn',()=>{
 const e=fresh(),m=put(e,0,'hand','Dandylion');e.move(m.uid,'grave',{kind:'cost-discard',byOwner:0});e.pump();drain(e);const tokens=e.monsters(0).filter(m=>m.id==='2005-fluff-token');assert.equal(tokens.length,2);assert.ok(tokens.every(m=>!e.canTribute(m,0,'normal')));e.state.turn++;assert.ok(tokens.every(m=>e.canTribute(m,0,'normal')));
});
test('Treeborn Frog requires an empty Spell and Trap area for both activation and resolution',()=>{
 const e=fresh(),m=put(e,0,'grave','Treeborn Frog'),trap=put(e,0,'spells','Jar of Greed',{faceUp:false});e.emit({type:'standby',owner:0});e.pump();drain(e);assert.equal(e.find(m.uid).zone,'grave');e.move(trap.uid,'grave',{kind:'rule-test'});e.state.turn+=2;e.emit({type:'standby',owner:0});e.pump();drain(e);assert.equal(e.find(m.uid).zone,'monsters');
});
test('Ancient Gear attacks suppress opposing Spell and Trap responses',()=>{
 const e=fresh(),m=put(e,0,'monsters','Ancient Gear Golem'),trap=put(e,1,'spells','Mirror Force',{faceUp:false});e.state.phase='battle';act(e,{type:'attack',uid:m.uid});assert.ok(!e.state.pending?.options?.some(o=>o.uid===trap.uid));drain(e);assert.equal(e.state.players[1].lp,5000);assert.equal(e.find(trap.uid).card.faceUp,false);
});
test('Ancient Gear Castle replaces the two tributes with one actual continuous Spell',()=>{
 const e=fresh(),castle=put(e,0,'spells','Ancient Gear Castle',{counters:2}),m=put(e,0,'hand','Ancient Gear Golem');act(e,{type:'summon',uid:m.uid,tributes:[castle.uid]});drain(e);assert.equal(e.find(castle.uid).zone,'grave');assert.equal(e.find(m.uid).zone,'monsters');assert.equal(e.attackValue(m),3000);
});
test('Pot of Avarice does not draw if one of its five targets leaves before resolution',()=>{
 const e=fresh(),cards=Array.from({length:5},()=>put(e,0,'grave','Battle Ox')),spell=put(e,0,'hand','Pot of Avarice'),trap=put(e,1,'spells','Disappear',{faceUp:false});act(e,{type:'activate',uid:spell.uid,key:spell.id+'::cast',choices:{target:cards.map(m=>m.uid)}});act(e,{type:'respond',uid:trap.uid,key:trap.id+'::cast',choices:{target:[cards[0].uid]}});drain(e);assert.equal(e.state.players[0].hand.length,0);assert.equal(cards.filter(m=>e.find(m.uid).zone==='grave').length,4);
});
test('Demise pays 2000 LP and destroys every other field card',()=>{
 const e=fresh(),m=put(e,0,'monsters','Demise, King of Armageddon'),a=put(e,0,'spells','Soul Absorption'),b=put(e,1,'monsters','Blue-Eyes White Dragon');use(e,m,'wipe');assert.equal(e.state.players[0].lp,6000);assert.equal(e.find(a.uid).zone,'grave');assert.equal(e.find(b.uid).zone,'grave');assert.equal(e.find(m.uid).zone,'monsters');
});
test('Commander Covington sends three distinct parts and summons Machina Force',()=>{
 const e=fresh(),c=put(e,0,'monsters','Commander Covington'),parts=['Machina Soldier','Machina Sniper','Machina Defender'].map(n=>put(e,0,'monsters',n)),m=put(e,0,'hand','Machina Force');use(e,c,'combine',Object.fromEntries(parts.map((m,i)=>['cost'+i,[m.uid]])));assert.ok(parts.every(m=>e.find(m.uid).zone==='grave'));assert.equal(e.find(m.uid).zone,'monsters');e.state.phase='battle';act(e,{type:'attack',uid:m.uid});drain(e);assert.equal(e.state.players[0].lp,7000);
});
test('Silent Swordsman and Skill Drain do not recurse while continuous cards are checked',()=>{
 const e=fresh(),m=put(e,0,'monsters','Silent Swordsman LV7'),spell=put(e,0,'spells','Yellow Luster Shield');assert.equal(e.activeSpell(spell),false);put(e,1,'spells','Skill Drain');assert.equal(e.negated(m),true);assert.equal(e.activeSpell(spell),true);e.assertState();
});
test('Necroshade grants one high-level HERO summon without tributes',()=>{
 const e=fresh(),n=put(e,0,'grave','Elemental HERO Necroshade'),m=put(e,0,'hand','Elemental HERO Bladedge');use(e,n,'tribute-credit');act(e,{type:'summon',uid:m.uid});drain(e);assert.equal(e.find(m.uid).zone,'monsters');assert.equal(e.find(n.uid).zone,'grave');assert.equal(e.state.players[0].necroCredit,undefined);
});
test('Malfunction negates a Trap then keeps it Set without chain cleanup consuming it',()=>{
 const e=fresh(),t=put(e,0,'spells','Malfunction',{faceUp:false}),jar=put(e,1,'spells','Jar of Greed',{faceUp:false});e.state.active=1;act(e,{type:'activate',uid:jar.uid,key:jar.id+'::cast'});act(e,{type:'respond',uid:t.uid,key:t.id+'::cast'});drain(e);assert.equal(e.find(jar.uid).zone,'spells');assert.equal(e.find(jar.uid).card.faceUp,false);assert.equal(e.state.players[1].hand.length,0);assert.equal(e.state.players[0].lp,7500);
});
test('Familiar Possessed can be summoned from the Deck through its Charmer with real send costs',()=>{
 const e=fresh(),charmer=put(e,0,'monsters','Hiita the Fire Charmer'),cost=put(e,0,'monsters','UFO Turtle'),m=put(e,0,'deck','Familiar-Possessed - Hiita');use(e,charmer,'possess',{charmer:[charmer.uid],other:[cost.uid]});assert.equal(e.find(charmer.uid).zone,'grave');assert.equal(e.find(cost.uid).zone,'grave');assert.equal(e.find(m.uid).zone,'monsters');assert.equal(m.possessedPiercing,true);
});
test('Dark World triggers and paid costs replay identically from an unresolved saved chain',()=>{
 const e=fresh(),dw=put(e,0,'hand','Broww, Huntsman of Dark World'),s=put(e,1,'hand','Card Destruction');e.state.active=1;act(e,{type:'activate',uid:s.uid,key:s.id+'::cast'});const r=DuelEngine.restore(e.snapshot());drain(e);drain(r);assert.deepEqual(e.snapshot(),r.snapshot());assert.equal(e.find(dw.uid).zone,'grave');
});
test('activation availability checks every known cost and target group before starting a prompt',()=>{
 const e=fresh(),chaos=put(e,0,'hand','Chaos Sorcerer');put(e,0,'grave','Blue-Eyes White Dragon');const trap=put(e,0,'spells','Karma Cut',{faceUp:false});put(e,0,'hand','Sparks');let list=E.available(e,0,{kind:'main',phase:'main1'});assert.ok(!list.some(a=>a.uid===chaos.uid));assert.ok(!list.some(a=>a.uid===trap.uid));put(e,0,'grave','Dark Magician');put(e,1,'monsters','Battle Ox');list=E.available(e,0,{kind:'main',phase:'main1'});assert.ok(list.some(a=>a.uid===chaos.uid));assert.ok(list.some(a=>a.uid===trap.uid));
});
test('Ancient Gear Castle receives one counter for a Normal Set as well as a Normal Summon',()=>{
 const e=fresh(),castle=put(e,0,'spells','Ancient Gear Castle'),m=put(e,0,'hand','Battle Ox');act(e,{type:'summon',uid:m.uid,mode:'defense'});drain(e);assert.equal(castle.counters,1);assert.equal(m.faceUp,false);
});
