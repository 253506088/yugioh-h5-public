/* Copied activated monster effects are registered once at load time. Saved
 * states retain only copied card identity, expiry and the ordinary choice data. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,C,I,card}=X;
 const names=['Hundred Eyes Dragon','Majestic Star Dragon','The Tyrant Neptune','Dragon Knight Draco-Equiste','Gem-Knight Master Diamond','Blackwing - Aurora the Northern Lights','Number 8: Heraldic King Genom-Heritage','Number 69: Heraldry Crest','One-Eyed Skill Gainer'];
 const hosts=new Set(names.map(I));
 const original=Object.values(E.defs).filter(a=>!a.trigger&&!a.cardActivation&&!a.inherent&&!a.supersededByOriginal&&!a.mode.startsWith('copied:')&&a.zones.includes('monsters')&&!hosts.has(a.id)&&D.CARDS[a.id]?.releaseYear<=2013);
 for(const name of names)for(const a of original){const {id,key,mode,...spec}=a,adapt=c=>({...c,sourceId:id});
  E.register(I(name),'copied:'+key,{...spec,chronicleCopyOf:key,copyTargetId:id,label:a.label,once:spec.once?{...spec.once,...(spec.once.scope==='name'?{cardId:id}:{})}:undefined,
   condition:(e,c)=>{const m=H.self(e,c),copy=m?.gxCopy;return copy?.id===id&&copy.turn>=e.state.turn&&!(name==='Majestic Star Dragon'&&m.eraMajesticCopyTurn===e.state.turn)&&(!a.condition||a.condition(e,adapt(c)));},
   inputs:a.inputs?(e,c)=>a.inputs(e,adapt(c)):undefined,cost:(e,c)=>{const adapted=adapt(c);a.cost?.(e,adapted);const sourceId=c.sourceId;Object.assign(c,adapted,{sourceId});const m=H.self(e,c);if(m&&name==='Majestic Star Dragon')m.eraMajesticCopyTurn=e.state.turn;},resolve:(e,c)=>a.resolve(e,adapt(c))});
 }
 const eyes=E.get(I('Hundred Eyes Dragon')+'::era-effect'),eyeResolve=eyes.resolve;eyes.resolve=(e,c)=>{eyeResolve(e,c);const m=H.self(e,c);if(m)m.gxCopy={id:c.eraCopied,turn:e.state.turn};};
 const majestic=E.get(I('Majestic Star Dragon')+'::era-effect'),majesticResolve=majestic.resolve;majestic.resolve=(e,c)=>{const target=card(e,H.first(c));majesticResolve(e,c);const m=H.self(e,c);if(m&&target)m.gxCopy={id:target.id,turn:e.state.turn};};
 for(const name of names)C(name).implementationNote='本作适配：复制已登记的主动及快速怪兽效果，保留其代价、目标和次数；不复制独立诱发、被动效果或递归复制器。';
 // Do not let later boilerplate registration erase a specific adaptation note.
 const notesById=new Map();for(const a of Object.values(E.defs))if(!a.chronicleCopyOf&&a.note?.startsWith('本作适配')){const notes=notesById.get(a.id)||new Set();notes.add(a.note);notesById.set(a.id,notes);}
 for(const c of D.CARD_LIST.filter(c=>c.releaseYear>=2009&&c.releaseYear<=2013&&!hosts.has(c.id))){const notes=notesById.get(c.id);if(notes?.size)c.implementationNote=[...notes].join(' ');}
 root.DuelChronicleCopies={hosts:[...hosts],sourceEffects:original.length};
})(globalThis);
