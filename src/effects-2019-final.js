/* Run after the year's authored effect registrations. */
(function(root){'use strict';const X=root.DuelChronicle,{D,E}=X;
 for(const a of Object.values(E.defs))if(a.mode.startsWith('y19-')&&!a.cardActivation&&a.requiresField===undefined&&a.zones.length&&a.zones.every(z=>['spells','fieldSpell'].includes(z)))a.requiresField=true;
 const copies=root.DuelChronicleCopies;if(copies?.registerCopies){const list=copies.copyable(y=>y===2019);copies.registerCopies(list);copies.registerCopies(copies.copyable(y=>y<2019).filter(a=>a.mode.startsWith('y19-')));copies.sourceEffects2019=list.length;}
 if(copies)for(const key of Object.keys(copies).filter(k=>/^sourceEffects\d{4}$/.test(k)))copies[key]=copies.copyable(y=>y===Number(key.slice(-4))).length;
 for(const [id,notes]of X.year2017.notes)if(notes.size)D.CARDS[id].implementationNote=[...notes].join(' ');
})(globalThis);
