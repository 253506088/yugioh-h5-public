(function(root){
  'use strict';
  const E=root.DuelDeckEditor||(typeof require==='function'?require('./deck-editor.js'):null),clone=v=>JSON.parse(JSON.stringify(v));
  const need=(ok,message)=>{if(!ok)throw Error(message);},uuid=()=>root.crypto?.randomUUID?.()||'match-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  function create({decks,format='bo1',first=0,id=uuid(),ruleMode='off',now=Date.now()}){
    need(['bo1','bo3'].includes(format)&&[0,1].includes(first),'比赛设置无效。');need(decks?.length===2,'需要两副卡组。');
    const registered=decks.map(d=>E.normalize(d));for(const d of registered)need(E.check(d).valid,E.check(d).errors.join('\n'));
    return {version:1,id,format,ruleMode,phase:'playing',registered:clone(registered),decks:clone(registered),score:[0,0],draws:0,gameIndex:1,gameId:id+':1',first,games:[],startedAt:now,result:null};
  }
  function record(m,{gameId=m.gameId,winner,kind='special',turn=0,now=Date.now()}){
    if(m.games.some(g=>g.id===gameId))return false;
    need(m.phase==='playing'&&gameId===m.gameId,'本局已经结束。');need([0,1,'draw'].includes(winner),'胜负数据无效。');
    const aborted=['limit','abandoned','error'].includes(kind);
    m.games.push({id:gameId,index:m.gameIndex,first:m.first,winner,kind,turn,finishedAt:now});
    if(!aborted&&winner!=='draw'){m.score[winner]++;m.draws=0;}else if(!aborted)m.draws++;
    if(aborted||m.format==='bo1'||m.score.some(n=>n>=2)||m.draws>=3){m.phase='finished';m.result={winner:aborted?'draw':winner,kind,status:aborted?'aborted':winner==='draw'?'draw':'win',finishedAt:now};return true;}
    m.phase=winner==='draw'?'siding':'choosing-first';m.round={id:m.id+':side:'+m.gameIndex,chooser:winner==='draw'?null:1-winner,nextFirst:m.first,ready:[false,false],submitted:[null,null],remainingMs:winner==='draw'?120000:30000};return true;
  }
  function choose(m,seat,first){need(m.phase==='choosing-first'&&m.round.chooser===seat&&[0,1].includes(first),'当前不能选择先后攻。');m.round.nextFirst=first;m.round.remainingMs=120000;m.phase='siding';}
  function submit(m,seat,deck){need(m.phase==='siding'&&[0,1].includes(seat)&&!m.round.ready[seat],'本轮构筑已锁定或换备尚未开始。');const d=E.normalize(deck),result=E.check(d,m.registered[seat]);need(result.valid,result.errors.join('\n'));m.round.submitted[seat]=clone({...m.decks[seat],cards:d.cards,extra:d.extra,side:d.side});m.round.ready[seat]=true;}
  function next(m){need(m.phase==='siding'&&m.round.ready.every(Boolean),'双方尚未准备。');m.decks=clone(m.round.submitted);m.first=m.round.nextFirst;m.gameIndex++;m.gameId=m.id+':'+m.gameIndex;m.phase='playing';delete m.round;return m;}
  function abandon(m,seat,kind='match-surrender',now=Date.now()){if(m.phase==='finished')return false;need([0,1,'draw'].includes(seat),'席位无效。');m.phase='finished';m.result={winner:seat==='draw'?'draw':1-seat,kind,status:seat==='draw'?'aborted':'win',finishedAt:now};delete m.round;return true;}
  function publicView(m,viewer=0){if(!m)return null;const other=1-viewer,map=s=>s==='draw'||s===null?s:Number(s!==viewer);return {id:m.id,format:m.format,phase:m.phase,score:[m.score[viewer],m.score[other]],gameIndex:m.gameIndex,gameId:m.gameId,first:map(m.first),games:m.games.map(g=>({...g,first:map(g.first),winner:map(g.winner)})),result:m.result?{...m.result,winner:map(m.result.winner)}:null,round:m.round?{id:m.round.id,chooser:map(m.round.chooser),nextFirst:map(m.round.nextFirst),ready:[m.round.ready[viewer],m.round.ready[other]],remainingMs:m.round.remainingMs}:null};}
  function restore(input){
    need(input&&input.version===1&&typeof input.id==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(input.id)&&['playing','choosing-first','siding','finished'].includes(input.phase),'比赛存档版本或阶段无效。');
    const m=clone(input);create({decks:m.registered,format:m.format,first:m.first});need(m.decks?.length===2,'比赛构筑无效。');m.decks.forEach((d,i)=>need(E.check(d,m.registered[i]).valid,'比赛构筑不守恒。'));
    need(Array.isArray(m.games)&&m.games.length<=1000&&Number.isInteger(m.gameIndex)&&m.gameIndex>0&&m.gameId===m.id+':'+m.gameIndex,'比赛局号无效。');
    const score=[0,0],seen=new Set();let draws=0;
    for(const [i,g] of m.games.entries()){need(g.id===m.id+':'+(i+1)&&g.index===i+1&&!seen.has(g.id)&&[0,1,'draw'].includes(g.winner)&&[0,1].includes(g.first),'比赛记录无效。');seen.add(g.id);if(!['limit','abandoned','error'].includes(g.kind)){if(g.winner==='draw')draws++;else{score[g.winner]++;draws=0;}}}
    need(JSON.stringify(score)===JSON.stringify(m.score)&&draws===m.draws,'比赛比分与记录不一致。');need(m.games.length===m.gameIndex-(m.phase==='playing'?1:0)||m.phase==='finished'&&m.games.length===m.gameIndex-1,'比赛记录数量不一致。');
    if(['choosing-first','siding'].includes(m.phase)){const r=m.round;need(r&&r.id===m.id+':side:'+m.gameIndex&&r.ready?.length===2&&r.submitted?.length===2&&[0,1].includes(r.nextFirst)&&Number.isFinite(r.remainingMs)&&r.remainingMs>=0&&r.remainingMs<=120000,'局间存档无效。');for(const seat of [0,1])need(typeof r.ready[seat]==='boolean'&&(!r.ready[seat]||E.check(r.submitted[seat],m.registered[seat]).valid),'换备存档无效。');}
    need(m.score.every(n=>n>=0&&n<=(m.format==='bo1'?1:2))&&m.draws<=3,'比赛已超过结束条件。');
    if(m.phase!=='finished')need(!m.result&&m.score.every(n=>n<2)&&m.draws<3&&(m.format==='bo3'||m.games.length===0),'比赛结束阶段不一致。');
    if(m.phase==='choosing-first')need(m.games.at(-1).winner!=='draw'&&m.round.chooser===1-m.games.at(-1).winner&&m.round.ready.every(v=>!v),'先后攻选择权无效。');
    if(m.phase==='finished')need(m.result&&['win','draw','aborted'].includes(m.result.status)&&[0,1,'draw'].includes(m.result.winner),'整场结果无效。');return m;
  }
  const api={create,record,choose,submit,next,abandon,publicView,restore,uuid};root.DuelMatch=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
