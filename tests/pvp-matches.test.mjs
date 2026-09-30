import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../server/store.mjs';
import {PvpService,PROTOCOL} from '../server/service.mjs';
import {Data,Match} from '../server/engine.mjs';
function setup(t){
 const store=new Store(':memory:');let now=1000,n=0;const errors=[];
 let service=new PvpService({store,now:()=>now,onError:e=>errors.push(e)});
 const client=(name,token)=>{const c={messages:[],send(m){this.messages.push(structuredClone(m));},close(){}};service.handle(c,{type:'hello',version:PROTOCOL,name,token});c.token=c.messages.find(m=>m.type==='welcome')?.token;return c;};
 let clients=[client('A'),client('B')];
 const send=(seat,type,data={},ok=true)=>{const c=clients[seat],id=data.id||'r'+ ++n;service.handle(c,{type,id,...data});const ack=c.messages.filter(m=>m.id===id).at(-1);if(ok)assert.equal(ack?.ok,true,JSON.stringify(ack));return ack;};
 const start=(format='bo3')=>{const code=send(0,'create',{matchFormat:format}).data.code;send(1,'join',{code});send(0,'ready',{ready:true,deck:{preset:'blue-eyes-2016'}});send(1,'ready',{ready:true,deck:{preset:'dark'}});return service.rooms.get(code);};
 const surrender=(r,seat)=>send(seat,'surrender',{gameId:r.gameId});
 const choose=(r,seat,first=seat)=>send(seat,'match-first',{matchId:r.match.id,roundId:r.match.round.id,first});
 const submit=(r,seat,deck=r.match.decks[seat],extra={})=>send(seat,'match-side',{matchId:r.match.id,roundId:r.match.round.id,deck,...extra});
 t.after(()=>{store.close();assert.deepEqual(errors,[]);});
 return {store,send,start,surrender,choose,submit,client,get clients(){return clients;},get service(){return service;},advance(ms){now+=ms;service.tick();},restart(r){service.shutdown();now+=3600000;service=new PvpService({store,now:()=>now,onError:e=>errors.push(e)});clients=clients.map((c,i)=>client(String(i),c.token));return service.rooms.get(r.code);}};
}
test('BO3 authority: score, loser order, deck conservation, ready locks and 2:1',t=>{
 const s=setup(t),r=s.start();s.surrender(r,1);assert.deepEqual(r.match.score,[1,0]);assert.equal(r.status,'intermission');
 assert.equal(s.send(0,'match-first',{matchId:r.match.id,roundId:r.match.round.id,first:0},false).code,'MATCH');s.choose(r,1,1);
 const bad=structuredClone(r.match.decks[0]);bad.side.pop();assert.equal(s.send(0,'match-side',{matchId:r.match.id,roundId:r.match.round.id,deck:bad},false).code,'MATCH');
 const oldGame=r.gameId,oldRound=r.match.round.id;s.submit(r,0);const request=s.clients[0].messages.filter(m=>m.type==='ack').at(-1).id;
 s.send(0,'match-side',{id:request,matchId:r.match.id,roundId:oldRound,deck:bad});assert.equal(r.match.round.ready[0],true);
 s.submit(r,1);assert.equal(r.status,'playing');assert.notEqual(r.gameId,oldGame);assert.equal(r.engine.state.active,1);
 assert.equal(s.send(0,'act',{gameId:oldGame,revision:r.revision,action:{type:'end'}},false).code,'STALE');
 assert.equal(s.send(0,'match-side',{matchId:r.match.id,roundId:oldRound,deck:r.match.decks[0]},false).code,'MATCH');
 s.surrender(r,0);s.choose(r,0);s.submit(r,0);s.submit(r,1);s.surrender(r,1);
 assert.deepEqual(r.match.score,[2,1]);assert.equal(r.status,'finished');assert.equal(s.store.db.prepare('SELECT count(*) n FROM games').get().n,3);
 assert.deepEqual(s.store.game(r.gameId).match.score,[2,1]);
});
test('side projection is private to each seat and keeps public score order',t=>{
 const s=setup(t),r=s.start();s.surrender(r,1);s.choose(r,1);
 for(const seat of [0,1]){const v=s.service.view(r,s.service.sessions.get(s.clients[seat].sessionId));assert.deepEqual(v.match.score,seat?[0,1]:[1,0]);assert.deepEqual(v.siding.deck.side,r.match.decks[seat].side);assert.equal(v.game.state.players[1].deckSpec.side,undefined);assert.equal(v.match.decks,undefined);assert.equal(v.match.round.submitted,undefined);}
});
test('timeout defaults choose loser then keep previous legal decks',t=>{
 const s=setup(t),r=s.start();s.surrender(r,0);s.advance(30001);assert.equal(r.match.phase,'siding');assert.equal(r.match.round.nextFirst,0);s.advance(120001);assert.equal(r.match.gameIndex,2);assert.equal(r.status,'playing');assert.deepEqual(r.match.registered,r.match.decks);
});
test('restart retains submitted deck and freezes remaining intermission time',t=>{
 const s=setup(t);let r=s.start();s.surrender(r,1);s.choose(r,1);s.advance(12345);s.submit(r,0);const remaining=r.match.round.remainingMs,game=r.gameId;r=s.restart(r);assert.equal(r.match.round.ready[0],true);assert.equal(r.match.round.remainingMs,remaining);s.submit(r,1);assert.notEqual(r.gameId,game);assert.equal(r.match.gameIndex,2);assert.deepEqual(Match.restore(r.match),r.match);
});
test('disconnect budget spans games and expired intermission ends match without rewriting game',t=>{
 const s=setup(t),r=s.start();s.service.disconnect(s.clients[0]);s.advance(20000);const c=s.client('A',s.clients[0].token);s.clients[0]=c;s.surrender(r,0);s.choose(r,0);s.submit(r,0);s.submit(r,1);assert.equal(r.seats[0].disconnectRemaining,40000);
 s.surrender(r,1);const last=s.store.game(r.gameId).result;s.service.disconnect(c);s.advance(40001);assert.equal(r.status,'finished');assert.equal(r.result.kind,'disconnect');assert.deepEqual(s.store.game(r.gameId).result,last);assert.equal(s.store.game(r.gameId).match.result.winner,1);
});
test('match concession during siding keeps score and last game outcome',t=>{
 const s=setup(t),r=s.start();s.surrender(r,1);const game=s.store.game(r.gameId).result;s.send(0,'match-abandon',{matchId:r.match.id});assert.deepEqual(r.match.score,[1,0]);assert.equal(r.result.winner,1);assert.deepEqual(s.store.game(r.gameId).result,game);assert.equal(s.store.game(r.gameId).match.result.winner,1);
});
test('BO1 and BO3 quick queues cannot pair',t=>{
 const s=setup(t);s.send(0,'queue',{matchFormat:'bo1',deck:{preset:'blue'}});s.send(1,'queue',{matchFormat:'bo3',deck:{preset:'dark'}});assert.equal(s.service.queue.size,2);assert.equal(s.service.rooms.size,0);
});
test('historical game journal is seat-filtered and cannot query another match',t=>{
 const s=setup(t),r=s.start();s.surrender(r,1);const id=r.gameId;s.choose(r,1);s.submit(r,0);s.submit(r,1);
 for(const seat of [0,1]){const data=s.send(seat,'match-journal',{matchId:r.match.id,gameId:id}).data;assert.deepEqual(data.log,s.store.game(id).snapshot.state.log.map(item=>item.pvpLog?.[seat]).filter(Boolean));assert.equal(JSON.stringify(data).includes('"deckSpec"'),false);}
 assert.equal(s.send(0,'match-journal',{matchId:r.match.id,gameId:'other-match:1'},false).code,'MATCH');
});
test('storage failure never acknowledges siding and stops subsequent commands',t=>{
 const s=setup(t),r=s.start();s.surrender(r,1);s.choose(r,1);const commit=s.store.commit;s.store.commit=()=>{throw Object.assign(new Error('disk full'),{testFailure:true});};
 // This test installs its own expected error collector.
 s.service.onError=()=>{};assert.equal(s.send(0,'match-side',{matchId:r.match.id,roundId:r.match.round.id,deck:r.match.decks[0]},false).ok,undefined);assert.equal(s.service.healthy,false);s.store.commit=commit;
 assert.equal(s.send(1,'match-side',{matchId:r.match.id,roundId:r.match.round.id,deck:r.match.decks[1]},false).code,'UNAVAILABLE');
});
