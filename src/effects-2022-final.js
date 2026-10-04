/* Copy hosts load after every authored annual ability. */
(function(root){'use strict';const X=root.DuelChronicle,{D,E}=X;
 // Response classification must follow the selected branch, including named
 // continuations, rather than advertising every branch as a Summon.
 E.get(X.I('Spright Smashers')+'::cast').summons=(e,c)=>['springans','therion'].includes(X.first(c,'mode'));
 E.get(X.I('Spright Smashers')+'::cast').deckInteraction=(e,c)=>X.first(c,'mode')==='springans';
 E.get(X.I('Spright Double Cross')+'::cast').summons=(e,c)=>X.first(c,'mode')==='revive';
 E.get(X.I('Keldo the Sacred Protector')+'::y22-special').deckInteraction=true;
 E.get(X.I('Toadally Awesome')+'::y22-standby').deckInteraction=true;
 for(const a of Object.values(E.defs))if(a.mode.startsWith('y22-')&&!a.cardActivation&&a.requiresField===undefined&&a.zones.length&&a.zones.every(z=>['spells','fieldSpell'].includes(z)))a.requiresField=true;
 const copies=root.DuelChronicleCopies;if(copies?.registerCopies){copies.registerCopies(copies.copyable(y=>y===2022));copies.registerCopies(copies.copyable(y=>y<2022).filter(a=>a.mode.startsWith('y22-')));copies.sourceEffects2022=0;for(const k of Object.keys(copies).filter(k=>/^sourceEffects\d{4}$/.test(k)))copies[k]=copies.copyable(y=>y===Number(k.slice(-4))).length;}
 for(const[id,notes]of X.year2017.notes)if(notes.size)D.CARDS[id].implementationNote=[...notes].join(' ');
})(globalThis);
