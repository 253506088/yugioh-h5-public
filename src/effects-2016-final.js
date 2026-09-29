/* The public implementation note collects every declared adaptation. */
(function(root){'use strict';const X=root.DuelChronicle,{D,E}=X,copies=root.DuelChronicleCopies;
 if(copies?.registerCopies){const list=copies.copyable(y=>y===2016);copies.registerCopies(list);copies.sourceEffects2016=list.length;}
 const notes=new Map(X.year2016.authoredNotes);for(const a of Object.values(E.defs))if(!a.chronicleCopyOf&&a.note?.startsWith('本作适配')&&D.CARDS[a.id]?.releaseYear===2016){const s=notes.get(a.id)||new Set();s.add(a.note);notes.set(a.id,s);}
 for(const [id,s] of notes)D.CARDS[id].implementationNote=[...s].join(' ');
})(globalThis);
