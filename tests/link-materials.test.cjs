const test=require('node:test');
const {assert,D,DuelEngine,fresh,put}=require('./gx-helpers.cjs');
function fixture(e,link,rating=2){
 const id='test-annual-link';
 D.CARDS[id]={...D.CARDS['linkuriboh'],id,linkRating:rating,arrows:['BL','BR'],link:{min:2,max:2,...link}};
 const m=e.makeCard(id,0);e.state.players[0].extra.push(m);e.state.originalCardCount++;return m;
}
test('all-attribute Link materials reject a mixed pair while legacy including-attribute allows it',()=>{
 const e=fresh(),a=put(e,0,'monsters','Battle Ox'),b=put(e,0,'monsters','Blue-Eyes White Dragon'),m=fixture(e,{allAttribute:'地'});
 assert.equal(e.linkValid(0,m,[a,b]),false);D.CARDS[m.id].link={min:2,max:2,attribute:'地'};assert.equal(e.linkValid(0,m,[a,b]),true);
});
test('Link material race, archetype and Tuner requirements use actual monsters',()=>{
 const e=fresh(),a=put(e,0,'monsters','Junk Synchron'),b=put(e,0,'monsters','Battle Ox'),m=fixture(e,{includingTuner:true});
 assert.equal(e.linkValid(0,m,[a,b]),true);D.CARDS[m.id].link.race='战士族';assert.equal(e.linkValid(0,m,[a,b]),false);
 delete D.CARDS[m.id].link.race;D.CARDS[m.id].link.series='Synchron';assert.equal(e.linkValid(0,m,[a,b]),false);
});
test('Link group restrictions compare every material',()=>{
 const e=fresh(),a=put(e,0,'monsters','Battle Ox'),b=put(e,0,'monsters','Blue-Eyes White Dragon'),m=fixture(e,{differentRaces:true,differentAttributes:true});
 assert.equal(e.linkValid(0,m,[a,b]),true);D.CARDS[m.id].link.sameRace=true;assert.equal(e.linkValid(0,m,[a,b]),false);
 delete D.CARDS[m.id].link.sameRace;D.CARDS[m.id].link.sameAttribute=true;assert.equal(e.linkValid(0,m,[a,b]),false);
});
test('normal Link materials and previously Normal Summoned materials are distinct',()=>{
 const e=fresh(),a=put(e,0,'monsters','Battle Ox'),m=fixture(e,{min:1,max:1,normal:true},1);
 assert.equal(e.linkValid(0,m,[a]),true);D.CARDS[m.id].link={min:1,max:1,normalSummoned:true};a.summonKind='flip';
 assert.equal(e.linkValid(0,m,[a]),false);a.normalSummoned=true;assert.equal(e.linkValid(0,m,[a]),true);
});
test('a non-Effect Extra Deck monster is not a Normal Monster for Link Spider materials',()=>{
 const e=fresh(),a=put(e,0,'monsters','Gaia Knight, the Force of Earth'),m=fixture(e,{min:1,max:1,normal:true},1);
 assert.equal(e.isNormalMonster(a),true);assert.equal(e.linkValid(0,m,[a]),false);
});
test('Tokens satisfy Normal Monster materials but never Effect Monster materials',()=>{
 const e=fresh(),id='test-link-token';D.CARDS[id]={...D.cardByName('Battle Ox'),id,type:'token',effect:null,notCollectible:true};
 const a=e.createTokens(0,id,1)[0],m=fixture(e,{min:1,max:1,normal:true},1);
 assert.equal(e.linkValid(0,m,[a]),true);D.CARDS[m.id].link={min:1,max:1,effect:true};assert.equal(e.linkValid(0,m,[a]),false);
 D.CARDS[m.id].link={min:1,max:1,noTokens:true};assert.equal(e.linkValid(0,m,[a]),false);
});
test('actual Link summon consumes materials, keeps arrows and survives JSON restoration',()=>{
 const e=fresh(),a=put(e,0,'monsters','Battle Ox'),b=put(e,0,'monsters','Blue-Eyes White Dragon'),m=fixture(e,{differentRaces:true});
 e.performLink(0,m.uid,[a.uid,b.uid]);assert.equal(e.find(a.uid).zone,'grave');assert.equal(e.find(b.uid).zone,'grave');
 assert.equal(e.find(m.uid).zone,'extraMonster');assert.equal(e.find(m.uid).card.summonKind,'link');
 assert.deepEqual(e.linkedZones(0,m.uid),[0,2]);e.assertState();assert.deepEqual(DuelEngine.restore(e.snapshot()).snapshot(),e.snapshot());
});

test('2017 Link material caps and Flip requirements reject the actual wrong type',()=>{
 const e=fresh(),a=put(e,0,'monsters','Man-Eater Bug'),b=put(e,0,'monsters','Blue-Eyes White Dragon'),m=fixture(e,{min:1,max:1,maxLevel:4},1);
 assert.equal(e.linkValid(0,m,[a]),true);assert.equal(e.linkValid(0,m,[b]),false);
 D.CARDS[m.id].link={min:1,max:1,flip:true};assert.equal(e.linkValid(0,m,[a]),true);assert.equal(e.linkValid(0,m,[b]),false);
 D.CARDS[m.id].link={min:1,max:1,summonedFromExtra:true};assert.equal(e.linkValid(0,m,[a]),false);a.y16FromExtra=true;assert.equal(e.linkValid(0,m,[a]),true);
});
