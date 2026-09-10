/* Pure board geometry. Coordinates are from player 0's perspective. */
(function(root){
  'use strict';
  const D=root.DuelData?.linkExpansionLoaded?root.DuelData:require('./link-cards.js'),{CARDS}=D;
  const directions={TL:[-1,1],T:[0,1],TR:[1,1],L:[-1,0],R:[1,0],BL:[-1,-1],B:[0,-1],BR:[1,-1]};
  const same=(a,b)=>a&&b&&a.x===b.x&&a.y===b.y;
  const mainPoint=(owner,index)=>({x:owner===0?index:4-index,y:owner===0?0:2});
  const extraPoint=slot=>({x:slot===0?1:3,y:1});
  const point=ref=>ref.zone==='extraMonster'?extraPoint(ref.card.extraSlot??ref.owner):mainPoint(ref.owner,ref.index);
  function arrowPoints(ref){const sign=ref.owner===0?1:-1,p=point(ref);return (CARDS[ref.card.id].arrows||[]).map(d=>({x:p.x+directions[d][0]*sign,y:p.y+directions[d][1]*sign,direction:d}));}
  const refs=(e,excluded=[])=>[0,1].flatMap(p=>e.refs(p,['monsters','extraMonster'])).filter(f=>!excluded.includes(f.card.uid)&&f.card.faceUp&&CARDS[f.card.id].type==='link');
  function pointsTo(source,target){return arrowPoints(source).some(p=>same(p,point(target)));}
  function pointedMain(e,owner,sourceUid=null,excluded=[]){const links=refs(e,excluded).filter(f=>!sourceUid||f.card.uid===sourceUid);return [0,1,2,3,4].filter(i=>links.some(f=>arrowPoints(f).some(p=>same(p,mainPoint(owner,i)))));}
  function coLinked(e,uid,excluded=[]){const list=refs(e,excluded),source=list.find(f=>f.card.uid===uid);return source?list.filter(f=>f.card.uid!==uid&&pointsTo(source,f)&&pointsTo(f,source)).map(f=>f.card.uid):[];}
  function extraLink(e,owner,slot,candidate,excluded=[]){
    const list=refs(e,excluded),virtual={owner,zone:'extraMonster',index:slot,card:{...candidate,extraSlot:slot,faceUp:true}};
    list.push(virtual);const endpoints=[0,1].map(i=>list.find(f=>f.owner===owner&&f.zone==='extraMonster'&&(f.card.extraSlot??f.owner)===i));
    if(endpoints.some(x=>!x))return false;
    const reached=new Set([endpoints[0].card.uid]),queue=[endpoints[0]];
    while(queue.length){const f=queue.shift();for(const other of list)if(!reached.has(other.card.uid)&&pointsTo(f,other)&&pointsTo(other,f)){reached.add(other.card.uid);queue.push(other);}}
    return reached.has(endpoints[1].card.uid);
  }
  function materialWeights(material){const n=CARDS[material.id].linkRating;return n&&n!==1?[1,n]:[1];}
  function ratingTotals(materials){let totals=new Set([0]);for(const m of materials){const next=new Set();for(const n of totals)for(const weight of materialWeights(m))next.add(n+weight);totals=next;}return totals;}
  root.DuelLinkRules={directions,mainPoint,extraPoint,point,arrowPoints,pointsTo,pointedMain,coLinked,extraLink,materialWeights,ratingTotals};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.DuelLinkRules;
})(globalThis);
