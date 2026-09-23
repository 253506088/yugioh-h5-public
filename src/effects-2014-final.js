/* 2014 closing step, loaded after every 2014 volume. Copy hosts (Hundred Eyes
 * Dragon, Majestic Star Dragon …) learn the 2014 activated monster effects, and
 * per-card adaptation notes survive later boilerplate registrations. */
(function(root){
 'use strict';
 const X=root.DuelChronicle,{D,E}=X,copies=root.DuelChronicleCopies;
 if(copies?.registerCopies){const list=copies.copyable(y=>y===2014);copies.registerCopies(list);copies.sourceEffects2014=list.length;}
 const notes=new Map();
 for(const a of Object.values(E.defs))if(!a.chronicleCopyOf&&a.note?.startsWith('本作适配')&&D.CARDS[a.id]?.releaseYear===2014){const set=notes.get(a.id)||new Set();set.add(a.note);notes.set(a.id,set);}
 for(const [id,set] of notes)D.CARDS[id].implementationNote=[...set].join(' ');
 if(typeof module!=='undefined')module.exports=X;
})(globalThis);
