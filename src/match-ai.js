(function(root){
  'use strict';
  const D=root.DuelData,E=root.DuelDeckEditor||(typeof require==='function'?require('./deck-editor.js'):null);
  // Deliberately accepts no engine or opponent construction. Generic back-row tools
  // can be exchanged without dismantling Ritual/Fusion or archetype components.
  function plan(deck,publicIds=[]){
    let next=E.normalize(deck);const observed=publicIds.map(id=>D.CARDS[id]).filter(Boolean);
    if(observed.length<2)return next;
    const backrow=observed.filter(c=>['spell','trap'].includes(c.type)).length;
    const score=id=>{const c=D.CARDS[id],name=c?.officialName||c?.en||c?.name||'';
      if(/Mystical Space Typhoon|Twin Twisters|Dust Tornado|Harpie's Feather Duster/.test(name))return backrow>=2?4:0;
      if(/Swords of Revealing Light|Mirror Force|Torrential Tribute|Bottomless Trap Hole/.test(name))return observed.filter(D.isMonster).length>=3?3:0;return 0;};
    let changes=0;
    for(const id of [...next.side].sort((a,b)=>score(b)-score(a))){if(changes>=2||score(id)<=0||D.isExtra(D.CARDS[id]))continue;
      const index=next.cards.findIndex(x=>D.CARDS[x].family==='generic'&&['spell','trap'].includes(D.CARDS[x].type)&&score(x)<score(id));
      if(index<0)continue;try{next=E.move(next,[{from:'cards',index,to:'side'},{from:'side',index:next.side.indexOf(id),to:'cards'}],{registered:deck});changes++;}catch{}}
    return next;
  }
  // Observe visibility at log emission, not by looking through the final deck.
  const proto=root.DuelEngine?.prototype;
  if(proto&&!proto.matchObservationInstalled){const log=proto.log;proto.matchObservationInstalled=true;proto.log=function(...args){log.apply(this,args);const item=this.state.log[0],f=item?.uid&&this.find(item.uid);if(!f||item.hidden||item.kind==='set'||item.cardId!==f.card.id)return;
    const publicZone=['grave','overlays'].includes(f.zone)||['monsters','spells','extraMonster','fieldSpell','banished'].includes(f.zone)&&f.card.faceUp!==false||f.zone==='extra'&&f.card.faceUpExtra;
    if(!publicZone)return;const seen=this.state.matchPublicSeen||=[[],[]];for(const viewer of [0,1])if(viewer!==f.owner&&!seen[viewer].includes(f.card.id))seen[viewer].push(f.card.id);
  };}
  root.DuelMatchAI={plan};if(typeof module!=='undefined')module.exports=root.DuelMatchAI;
})(globalThis);
