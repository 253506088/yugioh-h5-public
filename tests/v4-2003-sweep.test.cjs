const test=require('node:test'),assert=require('node:assert/strict');
const {D,exercise}=require('./yearly-sweep-helpers.cjs');
const cards=D.CARD_LIST.filter(c=>c.early&&c.releaseYear===2003);
test('2003 source identities and executable coverage are complete',()=>{assert.equal(cards.length,237);assert.equal(cards.filter(c=>c.implementationStatus==='pending').length,0);assert.equal(new Set(cards.map(c=>c.providerId)).size,237);});
for(const card of cards)test('2003 sweep · '+card.officialName,()=>exercise(card));
