/* Cyberse dependencies of the 2025 Maliss route. */
(function(root){'use strict';const X=root.DuelChronicle,{D,E,H,A,passive,extend,card,def,is,grave,args,first,target,revive,lock,locked}=X,Y=X.year2025;
 const cyber=(e,m)=>e.race(m)==='电子界族',splash='Splash Mage',trans='Transcode Talker';
 E.on('summon',(e,v)=>{const m=card(e,v.uid);if(m&&Y.specialKind(v.kind)&&!cyber(e,m))e.state.players[v.owner].y25NonCyberseTurn=e.state.turn;});
 A(splash,'y25-revive',{once:Y.limit('splash-revive'),summons:true,inputs:target('选择复活的电子界族',(e,c)=>grave(e,c.owner,m=>cyber(e,m)&&def(m).type!=='link'),'special'),resolve:(e,c)=>{revive(e,c,first(c),{position:'defense',negated:true});lock(e,c.owner,'y25Cyberse');},aiScore:1800});
 const linked=(e,m)=>Y.points(e,m.uid).filter(q=>e.pointsTo(q.uid,m.uid)),boosted=(e,s,m)=>linked(e,s.card).length&&(s.card.uid===m.uid||linked(e,s.card).some(q=>q.uid===m.uid));
 passive(trans,{stat:(e,s,m,k)=>k==='atk'&&boosted(e,s,m)?500:0});
 extend('canTarget',function(prior,m,s){const f=this.find(m.uid);return !(f&&Y.fm(f.zone)&&s?.owner!==f.owner&&Y.live(this,trans,f.owner).some(v=>boosted(this,v,m)))&&prior.call(this,m,s);});
 A(trans,'y25-revive',{once:Y.limit('transcode-revive'),summons:true,condition:(e,c)=>e.state.players[c.owner].y25NonCyberseTurn!==e.state.turn&&Y.zones(e,c).length>0,inputs:target('选择复活的电子界连接怪兽',(e,c)=>grave(e,c.owner,m=>cyber(e,m)&&def(m).type==='link'&&def(m).linkRating<=3&&!is(m,trans)),'special'),cost:(e,c)=>lock(e,c.owner,'y25Cyberse'),resolve:(e,c)=>{if(Y.zones(e,c).length)revive(e,c,first(c),{zone:Y.zones(e,c)[0]});},aiScore:1850});
 extend('canSpecial',function(prior,p,m,o={}){return !(locked(this,p,'y25Cyberse')&&!cyber(this,m))&&prior.call(this,p,m,o);});
 const parallel='Parallel eXceed';
 X.watch(parallel,'y25-special','summon',(e,v,f)=>v.owner===f.owner&&v.kind==='link',{once:Y.limit('parallel-special'),summons:true,condition:(e,c)=>Y.zones(e,{...c,uid:c.event.uid}).length>0,resolve:(e,c)=>{const f=e.find(c.event.uid);if(!f||!Y.fm(f.zone)||!f.card.faceUp)return;const zones=Y.zones(e,{...c,uid:f.card.uid});if(zones.length)e.queueChoice(c.owner,'选择连接箭头指向的区域',zones.map(z=>({uid:String(z),label:String(z+1)})),1,1,'y25-parallel-zone',{source:c.source,uid:c.uid,link:f.card.uid,generation:f.card.generation});}},{zones:['hand']});
 E.op('y25-parallel-zone',(e,t)=>{const f=e.find(t.context.link),z=Number(t.picks[0]);if(f&&Y.fm(f.zone)&&f.card.generation===t.context.generation&&Y.zones(e,{owner:t.owner,uid:f.card.uid}).includes(z))revive(e,Y.choiceContext(t),t.context.uid,{via:'effect',zone:z});});
 X.onEntry(parallel,'y25-recruit',{once:Y.limit('parallel-recruit'),summons:true,deckInteraction:true,resolve:(e,c)=>X.specialChoice(e,c,X.deck(e,c.owner,m=>is(m,parallel)),{shuffle:true})},['normal','special']);
 E.on('summon',(e,v)=>{const m=card(e,v.uid);if(m&&is(m,parallel)&&v.effectSource?.id===D.cardByName(parallel).id)m.y25Parallel=true;});
 extend('level',function(prior,m,...a){return m?.y25Parallel?4:prior.call(this,m,...a);});
 for(const method of ['originalAttack','originalDefense'])extend(method,function(prior,m,...a){const n=prior.call(this,m,...a);return m?.y25Parallel?n/2:n;});
})(globalThis);
