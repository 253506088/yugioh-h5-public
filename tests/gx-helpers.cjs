const assert=require('node:assert/strict');
const {DuelEngine}=require('../src/advanced-engine.js');
const {D,E,put,act,settle,run,id}=require('./yearly-sweep-helpers.cjs');
function fresh(seed=200608){const e=new DuelEngine({deck:'blue',opponentDeck:'dark',seed,first:0});e.state.turn=6;e.state.phase='main1';for(const p of e.state.players){p.deck.push(...p.hand);p.hand=[];}e.state.originalCardCount=e.physicalCards().filter(m=>D.CARDS[m.id].type!=='token').length;return e;}
function fieldCard(e,owner,name,props={}){return put(e,owner,'monsters',name,props);}
function ability(e,m,mode='gx-effect',choices={}){return run(e,{type:'activate',uid:m.uid,key:m.id+'::'+mode,choices},m.uid);}
function end(e){run(e,{type:'end'});}
module.exports={assert,D,E,DuelEngine,id,put,act,settle,run,fresh,fieldCard,ability,end};
