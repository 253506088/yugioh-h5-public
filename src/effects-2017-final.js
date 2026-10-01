/* Final registration metadata: inspect authored operations, never card text. */
(function(root){'use strict';const X=root.DuelChronicle,{D,E,C}=X;
 for(const a of Object.values(E.defs))if(a.deckInteraction===undefined){const body=String(a.resolve||'');a.deckInteraction=/\b(?:searchChoice|entrySearch|draw|mill)\s*\(/.test(body)||/\bdeck\s*\(/.test(body)&&/\b(?:search|specialChoice|revive|special|send|moved|choose|pickSend)\s*\(/.test(body);}
 for(const a of Object.values(E.defs))if(D.CARDS[a.id]?.releaseYear===2017&&!a.cardActivation&&a.zones.length&&a.zones.every(z=>['spells','fieldSpell'].includes(z)))a.requiresField=true;
 // These older handlers establish delayed draws/recruitment via a continuation.
 for(const n of ['Maxx "C"','Machine Duplication','One for One','Reinforcement of the Army','Terraforming'])for(const a of E.byCard?.[C(n)?.id]||[])if(a.mode==='cast'||n==='Maxx "C"')a.deckInteraction=true;
 const copies=root.DuelChronicleCopies;if(copies?.registerCopies){const list=copies.copyable(y=>y===2017);copies.registerCopies(list);copies.registerCopies(copies.copyable(y=>y===2016).filter(a=>a.mode.startsWith('y17-')));copies.sourceEffects2017=list.length;}
 for(const [id,notes]of X.year2017.notes)D.CARDS[id].implementationNote=[...notes].join(' ');
})(globalThis);
