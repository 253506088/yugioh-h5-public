const H=require('./gx-helpers.cjs');
function act(e,a){const r=e.act(a);H.assert.equal(r.ok,true,JSON.stringify(a)+' / '+r.error);}
function drain(e,pick){let n=0;while(e.state.pending&&e.state.winner===null&&n++<240){const p=e.state.pending;act(e,pick?.(p,e)||(p.kind==='window'?{type:'pass'}:e.chooseAI(p)));}H.assert.ok(n<240);e.assertState();}
function use(e,m,mode='cast',choices={},pick){act(e,{type:'activate',uid:m.uid,key:m.id+'::'+mode,choices});drain(e,pick);}
function trigger(e,fn,pick){fn();e.pump();drain(e,pick);}
const source=(e,n='Raigeki',owner=1)=>({id:H.D.cardByName(n).id,owner,effectType:'spell'});
module.exports={...H,act,drain,use,trigger,source};
