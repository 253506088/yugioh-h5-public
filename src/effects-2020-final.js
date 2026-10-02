/* Register copies after every authored effect, before field copies and destiny. */
(function(root){'use strict';const X=root.DuelChronicle,{D,E}=X;
 for(const a of Object.values(E.defs))if(a.mode.startsWith('y20-')&&!a.cardActivation&&a.requiresField===undefined&&a.zones.length&&a.zones.every(z=>['spells','fieldSpell'].includes(z)))a.requiresField=true;
 const copies=root.DuelChronicleCopies;if(copies?.registerCopies){copies.registerCopies(copies.copyable(y=>y===2020));copies.registerCopies(copies.copyable(y=>y<2020).filter(a=>a.mode.startsWith('y20-')));copies.sourceEffects2020=0;for(const key of Object.keys(copies).filter(k=>/^sourceEffects\d{4}$/.test(k)))copies[key]=copies.copyable(y=>y===Number(key.slice(-4))).length;}
 for(const [id,notes]of X.year2017.notes)if(notes.size)D.CARDS[id].implementationNote=[...notes].join(' ');
})(globalThis);
