/* Metadata describes authored operations; never unlock cards by parsing text. */
(function(root){'use strict';const X=root.DuelChronicle,{D,E}=X;
 for(const a of Object.values(E.defs)){
  const body=String(a.resolve||''),inputs=String(a.inputs||''),condition=String(a.condition||'');
  if(a.graveInteraction===undefined)a.graveInteraction=/grave|\bgy\(|\bGY\b/.test(body+inputs)&&/revive|special|search|hand|deck|banish|back\(/.test(body);
  if(a.deckInteraction===undefined)a.deckInteraction=/\b(?:searchChoice|entrySearch|draw|mill)\s*\(/.test(body)||/\bdeck\s*\(/.test(body)&&/\b(?:search|specialChoice|revive|special|send|moved|choose|pickSend)\s*\(/.test(body);
  if(a.inflictsDamage===undefined)a.inflictsDamage=/\b(?:damage|burn)\s*\(/.test(body);
  if(a.mode.startsWith('y18-')&&!a.cardActivation&&a.zones.length&&a.zones.every(z=>['spells','fieldSpell'].includes(z)))a.requiresField=true;
 }
 X.extend('earlyNegatesLink',function(prior,l,...a){return X.year2018.protectedLink(this,l)?false:prior.call(this,l,...a);});
 X.extend('negated',function(prior,m){const l=this.state.resolvingLink;return m&&l?.uid===m.uid&&X.year2018.protectedLink(this,l)?false:prior.call(this,m);});
 const copies=root.DuelChronicleCopies;if(copies?.registerCopies){const list=copies.copyable(y=>y===2018);copies.registerCopies(list);copies.registerCopies(copies.copyable(y=>y<2018).filter(a=>a.mode.startsWith('y18-')));copies.sourceEffects2018=list.length;}
 for(const [id,notes]of X.year2017.notes)if(notes.size)D.CARDS[id].implementationNote=[...notes].join(' ');
})(globalThis);
