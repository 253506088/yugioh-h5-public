import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLink} from '../scripts/lib/card-link.mjs';
import {materialArchetypeReferences} from '../scripts/lib/archetype-references.mjs';
const opts = {races:{Cyberse:'电子界族',Warrior:'战士族'},attributes:{EARTH:'地',WATER:'水'},linkRating:2,linkMarkers:['Bottom-Left','Bottom-Right']};
const parse = (text, more={}) => parseLink('fixture',text,{...opts,...more});
test('Link import distinguishes all-attribute requirements, race and archetype',()=>{
  assert.deepEqual(parse('2 EARTH monsters').link,{min:2,max:2,allAttribute:'地'});
  assert.equal(parse('2 Cyberse monsters').link.race,'电子界族');
  assert.equal(parse('2 "SPYRAL" monsters').link.series,'SPYRAL');
});
test('Link import preserves normal, effect, pendulum, level and summoned qualifications',()=>{
  assert.equal(parse('2+ Effect Monsters').link.effect,true);
  assert.equal(parse('2 Pendulum Monsters').link.pendulum,true);
  assert.equal(parse('1 Normal Monster').link.normal,true);
  assert.equal(parse('1 Level 1 monster').link.level,1);
  assert.equal(parse('1 Normal Summoned/Set monster').link.normalSummoned,true);
  assert.equal(parse('2+ Link Monsters').link.linkOnly,true);
});
test('Link import retains group restrictions and mandatory Tuner material',()=>{
  assert.equal(parse('2 monsters, including a Tuner').link.includingTuner,true);
  assert.equal(parse('2 monsters with different Types and Attributes').link.differentRaces,true);
  assert.equal(parse('2 monsters with different Types and Attributes').link.differentAttributes,true);
  assert.equal(parse('2 monsters with the same Type, except Tokens').link.sameRace,true);
  assert.equal(parse('2 monsters with the same Type, except Tokens').link.noTokens,true);
  assert.equal(parse('3 monsters with the same Attribute but different Types',{linkRating:3,linkMarkers:['Top','Bottom-Left','Bottom-Right']}).link.sameAttribute,true);
});
test('Link import rejects unknown grammar, duplicate arrows and contradictory counts',()=>{
  assert.throws(()=>parse('2 vaguely related monsters'),/Unknown/);
  assert.throws(()=>parse('3 monsters'),/count/);
  assert.throws(()=>parse('2 monsters',{linkMarkers:['Bottom','Bottom']}),/arrows/);
  assert.throws(()=>parse('2 monsters',{linkMarkers:['Bottom','Middle']}),/arrows/);
  assert.throws(()=>parse('2 monsters',{linkRating:0}),/rating/);
});
test('Link archetypes participate in the same fixed-CDB registry audit as Fusion and Synchro',()=>{
  assert.deepEqual(materialArchetypeReferences([{id:'fixture',...parse('2 "SPYRAL" monsters')}]),[{name:'SPYRAL',file:'card:fixture',kind:'series'}]);
});

test('2017 Link grammar preserves a level cap, Flip, Link, and extra-deck origin',()=>{
 assert.deepEqual(parse('1 Level 4 or lower Cyberse monster').link,{min:1,max:1,maxLevel:4,race:'电子界族'});
 assert.equal(parse('2 Flip monsters').link.flip,true);
 assert.equal(parse('1 Cyberse Link Monster').link.linkOnly,true);
 assert.equal(parse('2+ monsters Special Summoned from the Extra Deck').link.summonedFromExtra,true);
 assert.equal(parse('1 Normal Monster, except a Token').link.noTokens,true);
 assert.equal(parse('2 monsters with different Types and different Attributes').link.differentAttributes,true);
});

test('2018 Link grammar preserves excluded names/attributes and composed qualifications',()=>{
 assert.equal(parse('1 "Knightmare" monster, except "Knightmare Mermaid"').link.excludeName,'Knightmare Mermaid');
 assert.deepEqual(parse('1 non-WATER "Sky Striker Ace" monster').link,{min:1,max:1,excludeAttribute:'水',series:'Sky Striker Ace'});
 assert.deepEqual(parse('2 Warrior Effect Monsters').link,{min:2,max:2,effect:true,race:'战士族'});
 assert.equal(parse('2 Level 2 or higher Cyberse monsters').link.minLevel,2);
 assert.equal(parse('1 non-Link "Traptrix" monster').link.nonLink,true);
});
test('2018 included materials distinguish a specific card, a series and a card type',()=>{
 assert.equal(parse('2 monsters, including "Cyber Dragon"').link.includingName,'Cyber Dragon');
 assert.equal(parse('2 Effect Monsters, including a "Crusadia" monster').link.includingSeries,'Crusadia');
 assert.equal(parse('2 Effect Monsters, including a "T.G." Tuner').link.includingSeriesTuner,true);
 assert.equal(parse('2 monsters, including a Link Monster').link.includingType,'link');
 assert.equal(parse('2 monsters, including a Token').link.includingToken,true);
 assert.equal(parse('2 monsters, including a monster with 2000 or more ATK').link.includingMinAtk,2000);
 assert.throws(()=>parse('2 monsters, including an unknown qualifier'),/Unknown/);
});
test('2018 compound race and group requirements do not erase Effect Monster restrictions',()=>{
 const o={races:{Warrior:'战士族',Machine:'机械族'},attributes:{DARK:'暗'}};
 assert.deepEqual(parse('2 Effect Monsters (Warrior and/or Machine), including a Tuner',o).link,{min:2,max:2,includingTuner:true,races:['战士族','机械族'],effect:true});
 const d=parse('2 DARK Machine monsters',o).link;assert.equal(d.allAttribute,'暗');assert.equal(d.race,'机械族');
 const s=parse('2+ Effect Monsters with the same Type and Attribute',o).link;assert.equal(s.effect,true);assert.equal(s.sameRace,true);assert.equal(s.sameAttribute,true);
});

test('2019 Link grammar preserves level groups, Almiraj, included races and alternative categories',()=>{
 assert.equal(parse('3 Level 5 or higher monsters',{linkRating:3,linkMarkers:['Bottom-Left','Bottom','Bottom-Right']}).link.minLevel,5);
 assert.deepEqual(parse('1 Normal Summoned monster with 1000 or less ATK').link,{min:1,max:1,normalSummoned:true,maxAtk:1000});
 assert.equal(parse('2 non-Link Monsters').link.nonLink,true);
 assert.equal(parse('2 monsters with different Levels').link.differentLevels,true);
 assert.equal(parse('2 monsters with the same Level').link.sameLevel,true);
 assert.equal(parse('2 monsters with the same Type or Attribute').link.sameRaceOrAttribute,true);
 assert.equal(parse('1 non-Link Monster in an Extra Monster Zone').link.extraMonsterZone,true);
 assert.deepEqual(parse('2 monsters including a Ritual, Fusion, Synchro, or Xyz Monster').link.includingTypes,['ritual','fusion','synchro','xyz']);
 assert.equal(parse('2 monsters including a Spellcaster monster',{races:{Spellcaster:'魔法师族'}}).link.includingRace,'魔法师族');
 assert.throws(()=>parse('2 monsters including an unspecified monster'),/Unknown/);
});
