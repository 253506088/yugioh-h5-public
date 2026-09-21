/* 2013 shared effect vocabulary. Every registration names a real card; there is
 * no runtime parsing of card text and no fallback that marks missing rules done.
 * Delayed operations and choices contain only JSON, so a saved duel and a live
 * duel use the same executable path. */
(function(root){
 'use strict';
 const X=root.DuelChronicle,{D,E,H,C,I,is,A,Q,R,S,T,mark,passive,allM,allS,allF,monster,face,ownM,foeM,exact,moved,destroy,chosen,choose,g,target,pay,once,races,attrs,onEntry,onFlip,onMove,onEnd,onStandby,onDamage,onBattleWin,src,active,ctx,GYbattle,GYfield,discardCost,tributeInput,tribute,burn,field,card,def,race,attr,arch,names,gy,isGY,fromField,destroyed,discarded,noHand,alive,stat,effect,cast,watch,entrySearch,entryRecruit,entryReturn,sent,sentRecruit,sentSearch,specialSelf,summonCost,aura,ownAura,protect,quickNegate,xyz,revivalSpell,equip,endBanish,lock,locked,negateMonster,rule,extend,first,args,self,hand,deck,grave,search,specialChoice,revive,series,guard,defer,has,raw,rawHas}=X,{CARDS}=D;
 // Series labels let both decks and the archive filter the 2013 themes.
 const dragonruler=m=>series(m,'Dragon Ruler'),mecha=m=>series(m,'Mecha Phantom Beast'),spellbookTeam=m=>series(m,'Spellbook'),prophecy13=m=>series(m,'Prophecy'),evilswarm=m=>series(m,'Evilswarm'),nobleKnight=m=>series(m,'Noble Knight'),nobleArms=m=>series(m,'Noble Arms'),bujin=m=>series(m,'Bujin'),bujingi=m=>series(m,'Bujingi'),boxer=m=>series(m,'Battlin\' Boxer'),firefist13=m=>series(m,'Fire Fist')||series(m,'Fire Formation'),chronomaly13=m=>series(m,'Chronomaly'),gimmick=m=>series(m,'Gimmick Puppet'),sylvan=m=>series(m,'Sylvan'),fireking=m=>series(m,'Fire King'),archfiend13=m=>series(m,'Archfiend'),vampire=m=>series(m,'Vampire'),gorgonic=m=>series(m,'Gorgonic'),coach=m=>series(m,'Coach'),umbral=m=>series(m,'Umbral Horror'),traptrix=m=>series(m,'Traptrix'),starSeraph=m=>series(m,'Star Seraph'),galaxy=m=>series(m,'Galaxy'),mythic=m=>series(m,'Mythic'),ghostrick=m=>series(m,'Ghostrick'),gagaga13=m=>series(m,'Gagaga'),dododo13=m=>series(m,'Dododo'),zubaba13=m=>series(m,'Zubaba'),heraldic13=m=>series(m,'Heraldic Beast'),ninja13=m=>series(m,'Ninja');
 const groups={dragonruler:['征龙','Dragon Ruler'],mecha:['幻兽机','Mecha Phantom Beast'],nobleknight:['圣骑士','Noble Knight'],noblearms:['圣剑','Noble Arms'],bujin:['武神','Bujin'],bujingi:['武神器','Bujingi'],boxer:['燃烧拳击手','Battlin\' Boxer'],chronomaly2013:['先史遗产','Chronomaly'],gimmick:['机关傀儡','Gimmick Puppet'],sylvan:['森罗','Sylvan'],fireking:['炎王','Fire King'],archfiend13:['恶魔','Archfiend'],vampire:['吸血鬼','Vampire'],gorgonic:['石像鬼','Gorgonic'],coach:['教练','Coach'],umbral:['阴影','Umbral Horror'],traptrix:['虫惑魔','Traptrix'],starseraph:['星辉士','Star Seraph'],ghostrick:['鬼计','Ghostrick'],mythic:['神话','Mythic'],galaxyeyes:['银河眼','Galaxy'],obeliskforce:['方界','Obelisk Force']};
 for(const [key,[label,n]] of Object.entries(groups)){D.families[key]=label;for(const c of D.CARD_LIST)if(series(c,n))c.families=[...new Set([...(c.families||[]),key])];}
 // Generic 2013 rules that follow from the stored text alone.
 for(const c of D.CARD_LIST.filter(c=>c.releaseYear===2013)){
  if(c.type==='fusion'&&/Must be Fusion Summoned/.test(c.originalDescription||''))c.fusionOnly=true;
  if(c.type==='xyz'&&/Must be Xyz Summoned/.test(c.originalDescription||''))c.specialOnly='xyz';
  if((c.type==='synchro'||c.type==='xyz')&&!c.originalDescription.split(/[\r\n]+/).slice(1).join('').trim()){c.effect=null;mark(c.officialName,c.type==='xyz'?'通常超量怪兽：阶级、数量和素材条件完整校验':'通常同调怪兽：专用素材条件与等级校验');}
 }
 X.token('era-mpb-token','幻兽机衍生物','Mecha Phantom Beast Token',3,0,0,'风','机械族');
 // The shared 2013 vocabulary is published before the per-category parts load,
 // so a part file can destructure it exactly like the 2009—2012 volumes do.
 const discardSelfAnd=(e,c,title,pred,n=1)=>[g(e,c,'cost',title,[self(e,c),...hand(e,c.owner,m=>m.uid!==c.uid&&pred(e,m))],n+1,n+1,'cost')];
 const mpbTokens=(e,c,n=1)=>e.createTokens(c.owner,'era-mpb-token',n)||[];
 const hasMpbToken=(e,owner)=>ownM(e,{owner}).some(m=>m.faceUp&&m.id==='era-mpb-token');
 // "While you control a Mecha Phantom Beast Token, this card cannot be destroyed
 // by battle or card effects" is shared by the whole archetype.
 const mpbProtect=name=>protect(name,(e,m)=>hasMpbToken(e,e.find(m.uid)?.owner));
 const movePicks=(e,t,to,kind)=>{moved(e,t,t.picks,to,kind);e.shuffle(e.state.players[t.owner].deck);};
 Object.assign(X,{discardSelfAnd,mpbTokens,hasMpbToken,mpbProtect,movePicks,mecha});
 // --- Dragon Ruler (征龙) --------------------------------------------------
 // The four large rulers share one lock per card name across all of their
 // printed effects, so using the Summon effect also turns off the banished
 // search and the discard payoff for that turn.
 const rulers=[['Blaster, Dragon Ruler of Infernos','炎'],['Redox, Dragon Ruler of Boulders','地'],['Tempest, Dragon Ruler of Storms','风'],['Tidal, Dragon Ruler of Waterfalls','水']];
 const dragonMaterial=(e,m,a)=>!!m&&m.id!=='era-mpb-token'&&(e.hasAttribute(m,a)||e.race(m)==='龙族');
 const rulerPool=(e,c,a)=>H.cards(e,c.owner,['hand','grave'],m=>m.uid!==c.uid&&monster(m)&&dragonMaterial(e,m,a));
 const rulerPayoff={
  'Blaster, Dragon Ruler of Infernos':{pool:(e,c)=>[...e.field(1-c.owner),...e.field(c.owner)].map(f=>f.uid),cards:(e,c)=>[...e.field(1-c.owner),...e.field(c.owner)].map(f=>f.card),resolve:(e,c)=>destroy(e,c,args(c,'target')),title:'选择破坏的卡片'},
  'Redox, Dragon Ruler of Boulders':{pool:(e,c)=>grave(e,c.owner,monster).map(m=>m.uid),cards:(e,c)=>grave(e,c.owner,monster),resolve:(e,c)=>revive(e,c,first(c,'target')),title:'选择复活的怪兽'},
  'Tempest, Dragon Ruler of Storms':{pool:(e,c)=>deck(e,c.owner,m=>e.race(m)==='龙族').map(m=>m.uid),cards:(e,c)=>deck(e,c.owner,m=>e.race(m)==='龙族'),resolve:(e,c)=>search(e,c,args(c,'target')),title:'选择检索的龙族'},
  'Tidal, Dragon Ruler of Waterfalls':{pool:(e,c)=>deck(e,c.owner,monster).map(m=>m.uid),cards:(e,c)=>deck(e,c.owner,monster),resolve:(e,c)=>{moved(e,c,args(c,'target'),'grave','effect-send');e.shuffle(e.state.players[c.owner].deck);},title:'选择送去墓地的怪兽'}
 };
 for(const [name,attribute] of rulers){
  const id=I(name),rulerLock=H.once('dragonruler-'+id,'name'),payoff=rulerPayoff[name];
  summonCost(name,(e,c)=>rulerPool(e,c,attribute),2,{zones:['hand','grave'],banish:true,position:'attack',condition:(e,c)=>rulerPool(e,c,attribute).length>=2});
  E.get(id+'::gx-special').once=rulerLock;
  effect(name,(e,c)=>payoff.pool(e,c),payoff.resolve,{mode:'era-ruler-payoff',zones:['hand'],once:rulerLock,role:'destroy',min:0,max:1,
   inputs:(e,c)=>[...discardSelfAnd(e,c,'选择丢弃自身与1只'+attribute+'属性怪兽',(e2,m)=>e2.hasAttribute(m,attribute)),...(payoff.pool(e,c).length?[g(e,c,'target',payoff.title,payoff.cards?payoff.cards(e,c):payoff.pool(e,c),0,1,'target')]:[])],
   cost:(e,c)=>H.discard(e,c,args(c,'cost'))});
  onMove(name,'era-banished-search',{inputs:target('选择检索的'+attribute+'属性龙族',(e,c)=>deck(e,c.owner,m=>e.race(m)==='龙族'&&e.hasAttribute(m,attribute)),'search'),resolve:(e,c)=>search(e,c,args(c))},(e,v)=>v.to==='banished');
  onEnd(name,{oncePerTurn:false,resolve:(e,c)=>{if(self(e,c)?.summonKind&&self(e,c).summonKind!=='normal')moved(e,c,[c.uid],'hand','effect-return');}},{opponent:true,mandatory:true});
 }
 // The small rulers summon their own large ruler from the Deck; that ruler
 // cannot attack during the turn it arrives.
 for(const [name,ruler] of [['Reactan, Dragon Ruler of Pebbles','Redox, Dragon Ruler of Boulders'],['Stream, Dragon Ruler of Droplets','Tidal, Dragon Ruler of Waterfalls'],['Burner, Dragon Ruler of Sparks','Blaster, Dragon Ruler of Infernos'],['Lightning, Dragon Ruler of Drafts','Tempest, Dragon Ruler of Storms']]){
  const attribute=CARDS[I(ruler)].attribute;
  effect(name,null,(e,c)=>{const list=deck(e,c.owner,m=>is(m,ruler));if(!list.length)return;const m=revive(e,c,list[0].uid,{via:'dragonruler:'+I(name)});if(m)m.eraNoAttackUntil=e.state.turn;e.shuffle(e.state.players[c.owner].deck);},{mode:'era-small-ruler',zones:['hand'],summons:true,role:'special',
   inputs:(e,c)=>discardSelfAnd(e,c,'选择丢弃自身与1只龙族或'+attribute+'怪兽',(e2,m)=>e2.race(m)==='龙族'||e2.hasAttribute(m,attribute)),
   cost:(e,c)=>H.discard(e,c,args(c,'cost'))});
 }
 // --- Spellbook of Judgment (魔导书的神判) ---------------------------------
 // Spell Cards activated by the same player after this card resolves are counted
 // during the End Phase; that same count caps the summoned Spellcaster's Level.
 const judgmentOf=e=>allS(e).find(m=>m.faceUp&&m.eraJudgment);
 E.on('era-activation',(e,v)=>{const s=judgmentOf(e);if(!s)return;const owner=e.find(s.uid)?.owner;if(v.owner!==owner||v.uid===s.uid)return;if(def({id:v.id})?.type!=='spell')return;s.eraJudgment.count=(s.eraJudgment.count||0)+1;});
 E.op('era-judgment-search',(e,t)=>{const picks=(t.picks||[]).slice();if(!picks.length)return;movePicks(e,t,'hand','effect-search');const limit=picks.length,list=deck(e,t.owner,m=>e.race(m)==='魔法师族'&&e.level(m)>0&&e.level(m)<=limit);if(list.length&&e.freeMain(t.owner)>0)choose(e,{owner:t.owner,source:t.context.source},'选择特殊召唤的魔法师族',list,0,1,'era-judgment-summon',{role:'special',via:'spellbook-judgment'});});
 E.op('era-judgment-summon',(e,t)=>{if(t.picks[0]&&revive(e,{owner:t.owner,source:t.context.source},t.picks[0],{via:'spellbook-judgment'}))e.shuffle(e.state.players[t.owner].deck);});
 cast('Spellbook of Judgment',null,(e,c)=>{const s=card(e,c.uid);if(s)s.eraJudgment={turn:e.state.turn,count:0};},{zones:['hand'],once:H.once('spellbook-judgment','card'),role:'search'});
 onEnd('Spellbook of Judgment',{oncePerTurn:false,zones:['spells'],condition:(e,c)=>card(e,c.uid)?.eraJudgment?.turn===e.state.turn,resolve:(e,c)=>{const s=card(e,c.uid),n=Math.min(6,s?.eraJudgment?.count||0);if(s)delete s.eraJudgment;if(!n)return;const list=deck(e,c.owner,m=>def(m).type==='spell'&&series(m,'Spellbook')&&!is(m,'Spellbook of Judgment'));if(list.length)choose(e,c,'选择加入手牌的魔导书',list,0,Math.min(n,list.length),'era-judgment-search',{role:'search',judgmentCount:n});}},{mandatory:true});
 Object.assign(X,{dragonruler,mecha,spellbookTeam,prophecy13,evilswarm,nobleKnight,nobleArms,bujin,bujingi,boxer,firefist13,chronomaly13,gimmick,sylvan,fireking,archfiend13,vampire,gorgonic,coach,umbral,traptrix,starSeraph,galaxy,mythic,ghostrick,gagaga13,dododo13,zubaba13,heraldic13,ninja13,discardSelfAnd,mpbTokens,hasMpbToken,mpbProtect,movePicks});
 if(typeof module!=='undefined')for(const part of ['monsters','monsters-extra','mecha','extra','firefist','sylvan','themes','gagaga','spells','traps'])require('./effects-2013-'+part+'.js');
 if(typeof module!=='undefined')module.exports=X;
})(globalThis);
