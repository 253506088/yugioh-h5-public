/* Fiendsmith: real discard, shuffle, Equip and Fusion resources. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,C,I,A,Q,onEntry,onMove,passive,extend,card,def,monster,is,series,hand,deck,grave,ownM,args,first,g,target,moved,revive,search,cast}=X,Y=X.year2024,{limit,lightFiend,choiceContext}=Y;
 const engraver='Fiendsmith Engraver',tract="Fiendsmith's Tract",requiem="Fiendsmith's Requiem",sequence="Fiendsmith's Sequence",lacrima="Fiendsmith's Lacrima",desirae="Fiendsmith's Desirae",fiend=m=>monster(m)&&series(m,'Fiendsmith');
 const shufflePool=(e,c)=>grave(e,c.owner,m=>m.uid!==c.uid&&lightFiend(e,m));
 A(engraver,'y24-search',{zones:['hand'],once:limit('engraver-search'),deckInteraction:true,cost:(e,c)=>H.discard(e,c,[c.uid]),resolve:(e,c)=>search(e,c,deck(e,c.owner,m=>Y.st(m)&&series(m,'Fiendsmith'))),aiScore:1700});
 A(engraver,'y24-send',{once:limit('engraver-send'),inputs:(e,c)=>[g(e,c,'equip','选择送墓的魔锻装备',e.spells(c.owner).filter(m=>m.faceUp&&m.equipTarget&&series(m,'Fiendsmith'))),g(e,c,'target','选择送去墓地的怪兽',X.allM(e))],resolve:(e,c)=>{if(first(c,'equip')&&first(c))moved(e,c,[...args(c,'equip'),...args(c)],'grave','effect-send');},aiScore:1400});
 A(engraver,'y24-revive',{zones:['grave'],once:limit('engraver-revive'),summons:true,inputs:(e,c)=>[g(e,c,'cost','选择洗回的光属性恶魔族',shufflePool(e,c),1,1,'cost')],cost:(e,c)=>Y.shuffle(e,c,args(c,'cost'),'cost-return'),resolve:(e,c)=>revive(e,c,c.uid),aiScore:1600});
 cast(tract,null,(e,c)=>Y.pick(e,c,'选择检索的光属性恶魔族',deck(e,c.owner,m=>lightFiend(e,m)),'y24-tract-search'),{once:limit('tract-search'),deckInteraction:true,aiScore:1700});
 E.op('y24-tract-search',(e,t)=>{const c=choiceContext(t);moved(e,c,t.picks,'hand','effect-search');e.shuffle(e.state.players[t.owner].deck);if(t.picks[0]&&e.find(t.picks[0])?.zone==='hand')Y.chooseDiscard(e,c);});
 const tractProfile={zones:['hand','monsters','extraMonster'],y24Fiendsmith:true};
 A(tract,'y24-fusion',{zones:['grave'],once:limit('tract-fusion'),summons:true,banishesCost:true,condition:(e,c)=>e.fusions(c.owner,tractProfile).length>0,cost:(e,c)=>moved(e,c,[c.uid],'banished','cost-banish'),resolve:(e,c)=>Y.fusionChoice(e,c,tractProfile),aiScore:1900});
 Q(requiem,'y24-recruit',{once:limit('requiem-recruit'),summons:true,deckInteraction:true,condition:(e,c)=>H.mainPhase(e)&&e.canTribute(card(e,c.uid),c.owner),cost:(e,c)=>X.tribute(e,c,[c.uid]),resolve:(e,c)=>X.specialChoice(e,c,[...hand(e,c.owner),...deck(e,c.owner)].filter(fiend),{shuffle:true}),aiScore:1800,aiResponse:()=>1400});
 extend('canSpecial',function(prior,p,m,o={}){return !(is(m,requiem)&&this.wasUsed(p,m,'y24-requiem-summon','name'))&&prior.call(this,p,m,o);});
 extend('special',function(prior,p,u,o={}){const m=card(this,u),r=prior.call(this,p,u,o);if(r&&is(m,requiem))this.useKey(p,m,'y24-requiem-summon','name');return r;});
 for(const n of [requiem,sequence])A(n,'y24-equip',{zones:['monsters','extraMonster','grave'],once:limit(n+'-equip'),condition:(e,c)=>e.freeSpellZones(c.owner).length>0,inputs:target('选择装备的光属性恶魔族',(e,c)=>ownM(e,c).filter(m=>m.faceUp&&m.uid!==c.uid&&lightFiend(e,m)&&def(m).type!=='link'),'own-boost'),resolve:(e,c)=>e.equipMonster(c.uid,first(c),c.owner,c.source),aiScore:1100});
 // Equip effects apply in the S/T Zone. Monster effects remain inactive there.
 passive(requiem,{stat:(e,s,m,k)=>k==='atk'&&s.zone==='spells'&&s.card.equipTarget===m.uid&&!e.unaffected(m,X.src(e,s.card))?600:0});
 extend('canTarget',function(prior,m,s){return !(s?.owner!==this.find(m.uid)?.owner&&this.activeEquip(m).some(q=>is(q,sequence)&&!this.negated(q)&&!this.unaffected(m,X.src(this,q))))&&prior.call(this,m,s);});
 const profile=Y.fusionProfile(['grave'],'fiend');
 A(sequence,'y24-fusion',{once:limit('sequence-fusion'),summons:true,condition:(e,c)=>e.fusions(c.owner,profile).length>0,resolve:(e,c)=>Y.fusionChoice(e,c,profile),aiScore:2200});
 passive(lacrima,{stat:(e,s,m,k)=>k==='atk'&&e.find(m.uid)?.owner!==s.owner?-600:0});
 onEntry(lacrima,'y24-recover',{once:limit('lacrima-recover'),summons:true,inputs:(e,c)=>[...target('选择回收的光属性恶魔族',(e,c)=>[...grave(e,c.owner),...Y.ban(e,c.owner)].filter(m=>lightFiend(e,m)),'special')(e,c),H.customGroup('mode','选择处理方式',[{uid:'hand',label:'加入手牌',value:800},{uid:'special',label:'特殊召唤',value:1600}])],resolve:(e,c)=>first(c,'mode')==='special'?revive(e,c,first(c)):moved(e,c,args(c),'hand','effect-return')},['fusion']);
 onMove(lacrima,'y24-burn',{once:limit('lacrima-burn'),inputs:(e,c)=>[g(e,c,'cost','选择洗回的光属性恶魔族',shufflePool(e,c),1,1,'cost')],cost:(e,c)=>Y.shuffle(e,c,args(c,'cost'),'cost-return'),resolve:(e,c)=>e.damage(1-c.owner,1200,'效果')},(e,v)=>v.to==='grave');
 Q(desirae,'y24-negate',{once:limit('desirae-negate'),condition:(e,c)=>e.activeEquip(card(e,c.uid)).some(m=>def(m).linkRating),resolve:(e,c)=>{const n=e.activeEquip(card(e,c.uid)).reduce((s,m)=>s+(def(m).linkRating||0),0);if(n)Y.pick(e,c,'选择效果无效的表侧卡片',X.allF(e).filter(m=>m.faceUp),'y24-desirae-negate',{role:'destroy'},1,n);},aiScore:1500,aiResponse:()=>2100});
 E.op('y24-desirae-negate',(e,t)=>{for(const u of t.picks){const m=card(e,u);if(m?.faceUp&&X.field(e.find(u)?.zone)&&!e.unaffected(m,t.context.source))m.eraNegatedUntil=e.state.turn;}});
 onMove(desirae,'y24-send',{once:limit('desirae-send'),inputs:(e,c)=>[g(e,c,'cost','选择洗回的光属性恶魔族',shufflePool(e,c),1,1,'cost'),...target('选择送去墓地的卡片',X.allF)(e,c)],cost:(e,c)=>Y.shuffle(e,c,args(c,'cost'),'cost-return'),resolve:(e,c)=>moved(e,c,args(c),'grave','effect-send')},(e,v)=>v.to==='grave');
})(globalThis);
