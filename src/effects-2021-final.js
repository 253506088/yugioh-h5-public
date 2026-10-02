/* Finalize authored effects before the copy hosts and destiny layer. */
(function(root){'use strict';const X=root.DuelChronicle,{D,E}=X;
 for(const a of Object.values(E.defs))if(a.mode.startsWith('y21-')&&!a.cardActivation&&a.requiresField===undefined&&a.zones.length&&a.zones.every(z=>['spells','fieldSpell'].includes(z)))a.requiresField=true;
 const copies=root.DuelChronicleCopies;if(copies?.registerCopies){copies.registerCopies(copies.copyable(y=>y===2021));copies.registerCopies(copies.copyable(y=>y<2021).filter(a=>a.mode.startsWith('y21-')));copies.sourceEffects2021=0;for(const k of Object.keys(copies).filter(k=>/^sourceEffects\d{4}$/.test(k)))copies[k]=copies.copyable(y=>y===Number(k.slice(-4))).length;}
 for(const[id,notes]of X.year2017.notes)if(notes.size)D.CARDS[id].implementationNote=[...notes].join(' ');
})(globalThis);
