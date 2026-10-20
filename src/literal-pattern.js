/* Factor shared prefixes without changing leftmost / longest literal matching. */
(function(root){
 'use strict';
 const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 function compile(values){
  const words=[...new Set(values)].filter(Boolean).sort();
  if(!words.length)return null;
  function range(from,to,depth){
   const first=words[from],last=words[to-1];
   if(to-from===1)return escape(first.slice(depth));
   let end=depth;
   while(end<first.length&&first[end]===last[end])end++;
   const prefix=escape(first.slice(depth,end)),terminal=first.length===end;
   const branches=[];
   for(let i=from+(terminal?1:0);i<to;){
    let next=i+1;while(next<to&&words[next][end]===words[i][end])next++;
    branches.push(range(i,next,end));i=next;
   }
   // A longer name wins when another name is its prefix, just like the old
   // length-sorted alternatives. Literal punctuation remains escaped.
   if(terminal)branches.push('');
   return prefix+(branches.length===1?branches[0]:'(?:'+branches.join('|')+')');
  }
  return new RegExp(range(0,words.length,0),'g');
 }
 root.DuelLiteralPattern=compile;
 if(typeof module!=='undefined')module.exports=compile;
})(globalThis);
