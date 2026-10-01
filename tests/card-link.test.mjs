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
