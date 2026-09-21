/* 2009–2012 shared effect vocabulary. Every registration names a real card;
 * no runtime parsing of card text and no fallback that marks missing rules done.
 * Delayed operations and choices contain only JSON, so replay/save use the same
 * executable path as a live duel. */
(function(root){
 'use strict';
 const X=root.Duel2008,{D,E,H,C,I,is,A,Q,R,S,T,passive,mark,allM,allS,allF,monster,ownM,foeM,hand,deck,grave,first,args,self,src,active,has,extend,g,choose,target,moved,destroy,pay,once,onEntry,onMove,onFlip,onEnd,onStandby,onDamage,onBattleWin,revive,search,specialChoice,series,guard,defer}=X,{CARDS}=D;
 const field=z=>['monsters','extraMonster','spells','fieldSpell'].includes(z);
 // The small builders below declare their operations from their authored
 // resolver code. This is independent of localized/display card text.
 for(const method of ['register','quick','trigger','spell','trap']){const original=E[method];E[method]=function(...args){const at=args.length-1,s=args[at],body=String(s?.resolve||'');if(s&&typeof s==='object')args[at]={...(s.destroys===undefined?{destroys:/\bdestroy\s*\(|\bdestroyTargets\s*\(/.test(body)}:{}),...(s.summons===undefined?{summons:/\b(?:specialChoice|revive|special|createTokens|fusions)\s*\(/.test(body)}:{}),...s};return original.apply(this,args);};}
 const card=(e,uid)=>e.find(uid)?.card,def=m=>CARDS[m?.id],race=r=>(e,m)=>monster(m)&&e.race(m)===r,attr=a=>(e,m)=>monster(m)&&e.hasAttribute(m,a),arch=n=>m=>series(m,n),alive=(e,c)=>!!self(e,c)&&active(e,self(e,c));
 const names=(...list)=>m=>list.some(n=>is(m,n)),gy=e=>[...grave(e,0),...grave(e,1)],isGY=(e,v)=>v.to==='grave',fromField=(e,v)=>v.to==='grave'&&field(v.from),destroyed=(e,v)=>v.to==='grave'&&['battle','destroy'].includes(v.kind),discarded=(e,v)=>v.to==='grave'&&/discard/.test(v.kind),noHand=(e,c)=>!hand(e,c.owner).length;
 const groups={koaki:['核成','Koa\'ki Meiru'],earthbound:['地缚神','Earthbound Immortal'],infernity:['永火','Infernity'],dragunity:['龙骑兵团','Dragunity'],reptilianne:['爬虫妖','Reptilianne'],fortune:['命运女郎','Fortune Lady'],scrap:['废铁','Scrap'],karakuri:['机巧','Karakuri'],watt:['电气','Watt'],gishki:['遗式','Gishki'],gusto:['薰风','Gusto'],lavals:['熔岩','Laval'],gemknight:['宝石骑士','Gem-Knight'],vylon:['大日','Vylon'],nordic:['极星','Nordic'],tg:['科技属','T.G.'],steelswarm:['侵略魔人','Steelswarm'],lswarm:['入魔','lswarm'],constellar:['星圣','Constellar'],windup:['发条','Wind-Up'],inzektor:['甲虫装机','Inzektor'],hieratic:['圣刻','Hieratic'],madolche:['魔偶甜点','Madolche'],spellbook:['魔导书','Spellbook'],prophecy:['魔导','Prophecy'],mermail:['水精鳞','Mermail'],atlantean:['海皇','Atlantean'],firefist:['炎星','Fire Fist'],hazy:['阳炎兽','Hazy Flame'],evol:['进化','Evol'],photon:['光子','Photon'],heroic:['英豪','Heroic'],chronomaly:['先史遗产','Chronomaly'],heraldic:['纹章兽','Heraldic Beast']};
 for(const [key,[label,n]] of Object.entries(groups)){D.families[key]=label;for(const c of D.CARD_LIST)if(series(c,n))c.families=[...new Set([...(c.families||[]),key])];}
 for(const c of D.CARD_LIST.filter(c=>c.releaseYear>=2009&&c.releaseYear<=2012)){
  if(c.type==='fusion'&&/Must be Fusion Summoned/.test(c.originalDescription))c.fusionOnly=true;
  if(c.type==='synchro'&&/Must be Synchro Summoned, and cannot/.test(c.originalDescription))c.specialOnly='synchro';
  if(c.type==='xyz'&&!c.originalDescription.split(/[\r\n]+/).slice(1).join('').trim()){c.effect=null;mark(c.officialName,'通常超量怪兽：阶级、数量和素材条件完整校验');}
 }
 const stat=(e,uid,key,amount,{set=false,mul=false,permanent=false}={})=>{if(card(e,uid))e.modify(uid,key,set?'set':mul?'mul':'add',amount,permanent?null:e.state.turn);};
 function effect(name,pool,resolve,{mode='era-effect',quick=false,detach=0,discard=0,fee=0,tribute=0,banish=null,send=null,oncePerTurn=true,role='destroy',min=1,max=min,...spec}={}){
  return (quick?Q:A)(name,mode,{once:oncePerTurn?H.once(mode,'card'):undefined,condition:(e,c)=>e.state.players[c.owner].lp>fee&&(!detach||(e.detachCapacity?e.detachCapacity(c.uid):card(e,c.uid)?.overlays.length||0)>=detach),
   inputs:(e,c)=>[...(detach?[H.detachInput(e,c,detach)]:[]),...(discard?[g(e,c,'discard','选择丢弃的手牌',hand(e,c.owner,m=>m.uid!==c.uid),discard,discard,'cost')]:[]),...(tribute?[g(e,c,'tribute','选择解放的怪兽',ownM(e,c).filter(m=>e.canTribute(m,c.owner)),tribute,tribute,'cost')]:[]),...(banish?[g(e,c,'banish','选择除外的卡片',banish(e,c),1,1,'cost')]:[]),...(send?[g(e,c,'send','选择送墓的卡片',send(e,c),1,1,'cost')]:[]),...(pool?[g(e,c,'target','选择效果对象',pool(e,c),min,max,role)]:[])],
   cost:(e,c)=>{if(fee)pay(e,c,fee);if(detach)e.detach(c.uid,args(c,'cost'));if(discard)H.discard(e,c,args(c,'discard'));if(tribute)X.tribute(e,c,args(c,'tribute'));if(banish)moved(e,c,args(c,'banish'),'banished','cost-banish');if(send)H.sendCost(e,c,args(c,'send'));},banishesCost:!!banish||!!spec.cost&&/banished|banishPay/.test(String(spec.cost)),resolve,aiScore:800,...spec});
 }
 const cast=(name,pool,resolve,spec={})=>(C(name).type==='trap'?T:S)(name,{...(pool?{inputs:target('选择效果对象',pool,spec.role||'target',spec.min||1,spec.max||spec.min||1)}:{}),resolve,aiScore:700,...spec});
 const events=new Map();
 function watch(name,mode,type,test,spec,{zones=['monsters','extraMonster','spells','fieldSpell'],mandatory=false}={}){
  R(name,mode,{zones,...spec});let list=events.get(type);if(!list){list=[];events.set(type,list);E.on(type,(e,v)=>{for(const h of events.get(type))for(const p of [0,1])for(const f of e.refs(p,h.zones))if(f.card.id===h.id&&(!field(f.zone)||active(e,f.card))&&h.test(e,v,f))e.addTrigger(f.card.uid,h.id+'::'+h.mode,v,{owner:p,mandatory:h.mandatory});});}list.push({id:I(name),mode,zones,test,mandatory});
 }
 const entrySearch=(name,pred,kinds=['normal'],spec={})=>onEntry(name,E.get(I(name)+'::era-search')?'era-search-'+kinds.join('-'):'era-search',{resolve:(e,c)=>search(e,c,deck(e,c.owner,m=>pred(e,m,c))),...spec},kinds);
 const entryRecruit=(name,pred,kinds=['normal'],spec={})=>onEntry(name,'era-recruit',{summons:true,resolve:(e,c)=>specialChoice(e,c,deck(e,c.owner,m=>pred(e,m,c)),{shuffle:true,...spec.summonOptions}),...spec},kinds);
 const entryReturn=(name,pred,kinds=['normal'],spec={})=>onEntry(name,'era-recover',{inputs:target('选择回收的卡片',(e,c)=>grave(e,c.owner,m=>pred(e,m,c)),'search'),resolve:(e,c)=>moved(e,c,args(c),'hand','effect-return'),...spec},kinds);
 const sent=(name,resolve,test=fromField,spec={})=>onMove(name,'era-sent',{resolve,...spec},test);
 const sentRecruit=(name,pred,test=destroyed,spec={})=>sent(name,(e,c)=>specialChoice(e,c,deck(e,c.owner,m=>pred(e,m,c)),{shuffle:true,...spec.summonOptions}),test,{summons:true,...spec});
 const sentSearch=(name,pred,test=isGY,spec={})=>sent(name,(e,c)=>search(e,c,deck(e,c.owner,m=>pred(e,m,c))),test,spec);
 const specialSelf=(name,condition=()=>true,options={})=>X.handSpecial(name,condition,options.pool||null,options.count||0,options);
 const summonCost=(name,pool,count=1,options={})=>specialSelf(name,options.condition||(()=>true),{pool,count,...options});
 const aura=(name,pred,amount,keys=['atk'])=>passive(name,{stat:(e,s,m,k)=>keys.includes(k)&&pred(e,m,s)?typeof amount==='function'?amount(e,m,s,k):amount:0});
 const ownAura=(name,amount,keys=['atk'])=>aura(name,(e,m,s)=>m.uid===s.card.uid,amount,keys);
 const protect=(name,predicate)=>guard('protect',name,predicate);
 const quickNegate=(name,kind='any',{fee=0,detach=0,cost,inputs,condition=()=>true,...spec}={})=>Q(name,'era-negate',{main:false,condition:(e,c)=>{const l=c.event.window?.chainLast;return !!l&&l.owner!==c.owner&&(kind==='any'||kind.split('/').includes(l.source.effectType))&&e.state.players[c.owner].lp>fee&&(!detach||(card(e,c.uid)?.overlays.length||0)>=detach)&&condition(e,c);},inputs:inputs||(detach?(e,c)=>[H.detachInput(e,c,detach)]:undefined),cost:(e,c)=>{if(fee)pay(e,c,fee);if(detach)e.detach(c.uid,args(c,'cost'));cost?.(e,c);},resolve:X.negate,aiResponse:()=>1700,...spec});
 function xyz(name,pool,resolve,spec={}){return effect(name,pool,resolve,{detach:1,...spec});}
 function revivalSpell(name,pred,options={}){cast(name,(e,c)=>grave(e,c.owner,m=>monster(m)&&pred(e,m,c)&&e.canSpecial(c.owner,m,{via:'revive'})),(e,c)=>{for(const uid of args(c)){const m=revive(e,c,uid,options);if(m){if(options.negated)m.effectNegated=true;if(options.end)X.delayMove(e,c,m,options.end);if(C(name).spellKind==='equip'||C(name).trapKind==='continuous'){const s=card(e,c.uid);if(s){s.equipTarget=m.uid;s.eraRevivalLink=m.uid;}}} }},{summons:true,condition:(e,c)=>e.freeMain(c.owner)>0,...options});}
 // Unrestricted monster equips also accept Tokens, which are outside CARD_LIST.
 function equip(name,pred,options={}){X.equip(name,{...(pred===monster?{}:{names:D.CARD_LIST.filter(c=>monster(c)&&pred(c)).map(c=>c.officialName)}),...options});}
 function endBanish(name,pool,count=1){onEnd(name,{inputs:(e,c)=>[g(e,c,'cost','选择除外的卡片',pool(e,c),count,count,'cost')],cost:(e,c)=>moved(e,c,args(c,'cost'),'banished','cost-banish'),resolve:(e,c)=>revive(e,c,c.uid,{position:'defense'})},{zones:['grave']});}
 const lock=(e,p,key,value=true,turn=e.state.turn)=>{const a=e.state.players[p];(a.eraLocks||={})[key]={value,turn};},locked=(e,p,key)=>(e.state.players[p].eraLocks?.[key]?.turn??-1)>=e.state.turn?e.state.players[p].eraLocks[key].value:false;
 const negateMonster=(e,uid,until=e.state.turn)=>{const m=card(e,uid);if(m){m.eraNegatedUntil=until;}};
 extend('negated',function(prior,m){return !!m&&m.eraNegatedUntil>=this.state.turn||prior.call(this,m);});
 extend('canSpecial',function(prior,p,m,o={}){if(!m||!prior.call(this,p,m,o))return false;const restriction=locked(this,p,'special');return !locked(this,p,'noSpecial')&&(!restriction||(restriction.type?def(m).type===restriction.type:restriction.race?this.race(m)===restriction.race:restriction.attribute?this.hasAttribute(m,restriction.attribute):series(m,restriction.series)));});
 extend('canNormal',function(prior,m,p=this.state.active){return !locked(this,p,'noNormal')&&prior.call(this,m,p);});
 extend('earlyCanUse',function(prior,c,a){return prior.call(this,c,a)&&!(locked(this,c.owner,'noMonsterEffects')&&c.source.effectType==='monster')&&!(a.cardActivation&&locked(this,c.owner,CARDS[c.sourceId]?.type==='trap'?'noTraps':'noSpells'));});
 extend('canAttack',function(prior,m,p=this.state.active,t=null){return prior.call(this,m,p,t)&&!locked(this,p,'noAttacks')&&!(m.eraNoAttackUntil>=this.state.turn);});
 extend('move',function(prior,uid,to,o={}){const f=this.find(uid),was=f&&field(f.zone),m=f?.card;const r=prior.call(this,uid,to,o);if(r&&was&&r.to!==r.from&&m){delete m.eraNegatedUntil;delete m.eraNoAttackUntil;delete m.eraFlags;delete m.eraCounters;}return r;});
 extend('setPosition',function(prior,uid,pos,s,down=false){const r=prior.call(this,uid,pos,s,down);if(r&&down){const m=card(this,uid);delete m.eraNegatedUntil;delete m.eraFlags;delete m.eraCounters;}return r;});
 E.on('move',(e,v)=>{if(!field(v.from))return;for(const m of allS(e))if(m.eraRevivalLink===v.uid&&v.kind==='destroy')e.destroy(m.uid,src(e,m));if(v.previous?.eraRevivalLink)e.destroy(v.previous.eraRevivalLink,v.source);});
 extend('describe',function(prior,m,...a){return {...prior.call(this,m,...a),...Object.fromEntries(Object.entries(m).filter(([k])=>k.startsWith('era')))};});
 const api={...X,field,card,def,race,attr,arch,names,gy,isGY,fromField,destroyed,discarded,noHand,alive,stat,effect,cast,S:cast,T:cast,watch,entrySearch,entryRecruit,entryReturn,sent,sentRecruit,sentSearch,specialSelf,summonCost,aura,ownAura,protect,quickNegate,xyz,revivalSpell,equip,endBanish,lock,locked,negateMonster};root.DuelChronicle=api;
 if(typeof module!=='undefined')module.exports=api;
})(globalThis);
