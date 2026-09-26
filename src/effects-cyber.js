(function(root){ 'use strict'; const E=root.DuelEffects,D=root.DuelData,H=E.H;
const {CARDS,isMonster,isExtra}=D;
const {source,self,first,args,group,deck,grave,hand,monsters,specialable,once}=H;
const machine=c=>isMonster(CARDS[c.id])&&CARDS[c.id].race==='机械族';
const cyberSpell=c=>['spell','trap'].includes(CARDS[c.id].type)&&/^Cyber(?!netic)/.test(CARDS[c.id].officialName);
const namedCyber=(e,c,zone=null)=>e.cardNameId(c,zone)==='cyber-dragon';
E.register('cyber-dragon','special',{label:'仅对方有怪兽，特殊召唤电子龙',zones:['hand'],inherent:true,
  condition:(e,c)=>e.monsters(c.owner).length===0&&e.monsters(1-c.owner).length>0&&e.canSpecial(c.owner,source(e,c).card)&&e.freeMain(c.owner)>0,
  resolve:(e,c)=>e.special(c.owner,c.uid,{via:'effect'}),aiScore:1100});
E.trigger('cyber-core','search',{label:'龙核：检索电子魔法／陷阱',once:once('one-effect'),condition:(e,c)=>deck(e,c.owner,cyberSpell).length>0,resolve:(e,c)=>H.searchChoice(e,c,cyberSpell)});
E.register('cyber-core','recruit',{label:'除外龙核，从卡组展开电子龙',zones:['grave'],once:once('one-effect'),
  condition:(e,c)=>!e.monsters(c.owner).length&&e.monsters(1-c.owner).length>0&&specialable(e,c.owner,deck(e,c.owner,H.cyber)).length>0,
  cost:(e,c)=>e.move(c.uid,'banished',{kind:'cost-banish',source:c.source,byOwner:c.owner}),
  resolve:(e,c)=>H.specialChoice(e,c,deck(e,c.owner,H.cyber)),aiScore:1150});
E.trigger('cyber-herz','level',{label:'龙芯：变为5星',once:once('one-effect'),resolve:(e,c)=>{const m=self(e,c);if(m)m.levelOverride={value:5,until:e.state.turn};e.addLock(c.owner,'machine');},
  aiTrigger:(e,c)=>e.monsters(c.owner).some(m=>m.uid!==c.uid&&e.level(m)===5)||hand(e,c.owner,m=>m.id==='galaxy-soldier'||m.id==='cyber-dragon').length>0});
E.trigger('cyber-herz','recover',{label:'龙芯：取得其他电子龙',zones:['grave'],once:once('one-effect'),
  condition:(e,c)=>H.cards(e,c.owner,['deck','grave'],m=>m.uid!==c.uid&&namedCyber(e,m)).length>0,
  resolve:(e,c)=>{const list=H.cards(e,c.owner,['deck','grave'],m=>m.uid!==c.uid&&namedCyber(e,m));if(list.length)e.queueChoice(c.owner,'选择加入手牌的电子龙',H.options(e,c,list),1,1,'cyber-herz-recover',{source:c.source,role:'search'});}});
E.op('cyber-herz-recover',(e,t)=>{const f=e.find(t.picks[0]);if(!f)return;if(f.zone==='deck')e.search(t.owner,[f.card.uid]);else if(f.zone==='grave')e.move(f.card.uid,'hand',{kind:'effect-return',source:t.context.source,byOwner:t.owner});});
E.register('cyber-nachster','special',{label:'丢弃怪兽，特殊召唤次代星',zones:['hand'],once:once('special'),
  condition:(e,c)=>e.canSpecial(c.owner,source(e,c).card)&&e.freeMain(c.owner)>0,
  inputs:(e,c)=>[group(e,c,'cost','选择丢弃的其他怪兽',hand(e,c.owner,m=>m.uid!==c.uid&&isMonster(CARDS[m.id])),1,1,{role:'cost'})],
  cost:(e,c)=>H.discard(e,c,args(c,'cost')),resolve:(e,c)=>e.special(c.owner,c.uid,{via:'effect'}),aiScore:900});
E.trigger('cyber-nachster','revive',{label:'次代星：复活攻守为2100的机械',once:once('revive'),
  inputs:(e,c)=>[group(e,c,'target','选择墓地的机械族',specialable(e,c.owner,grave(e,c.owner,m=>machine(m)&&(CARDS[m.id].atk===2100||CARDS[m.id].def===2100)),'revive'),1,1,{role:'special'})],
  resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='grave')e.special(c.owner,f.card.uid,{via:'revive'});e.addLock(c.owner,'machine');}});
E.trigger('cyber-drei','levels',{label:'三型：电子龙等级变为5',resolve:(e,c)=>{for(const m of e.monsters(c.owner))if(m.faceUp&&namedCyber(e,m))m.levelOverride={value:5};e.addLock(c.owner,'machine');}});
E.trigger('cyber-drei','protect',{label:'三型被除外：保护1只电子龙',zones:['banished'],
  inputs:(e,c)=>[group(e,c,'target','选择受保护的电子龙',monsters(e,c.owner,m=>m.faceUp&&namedCyber(e,m)),1,1,{role:'own-boost'})],
  resolve:(e,c)=>{const f=H.legalTarget(e,c,first(c));if(f){f.card.effectProtectedUntil=e.state.turn;f.card.battleProtectedUntil=e.state.turn;}}});
E.trigger('cyber-vier','special',{label:'四型：从手牌守备表示特殊召唤',zones:['hand'],once:once('special'),condition:(e,c)=>e.canSpecial(c.owner,source(e,c).card)&&e.freeMain(c.owner)>0,
  resolve:(e,c)=>{if(e.find(c.uid)?.zone==='hand')e.special(c.owner,c.uid,{via:'effect',position:'defense'});}});
E.register('galaxy-soldier','special',{label:'光属性怪兽送墓，展开银河战士',zones:['hand'],condition:(e,c)=>e.canSpecial(c.owner,source(e,c).card)&&e.freeMain(c.owner)>0,
  inputs:(e,c)=>[group(e,c,'cost','选择送墓的其他光属性怪兽',hand(e,c.owner,m=>m.uid!==c.uid&&isMonster(CARDS[m.id])&&CARDS[m.id].attribute==='光'&&H.canSendGY(e,m)),1,1,{role:'send-cost'})],
  cost:(e,c)=>H.sendCost(e,c,args(c,'cost')),resolve:(e,c)=>e.special(c.owner,c.uid,{via:'effect',position:'defense'}),aiScore:950});
E.trigger('galaxy-soldier','search',{label:'银河战士：检索银河怪兽',once:once('search'),condition:(e,c)=>deck(e,c.owner,m=>CARDS[m.id].family==='galaxy').length>0,resolve:(e,c)=>H.searchChoice(e,c,m=>CARDS[m.id].family==='galaxy')});
E.spell('cyber-emergency',{label:'检索电子龙怪兽',once:once('activate'),onlyActivate:true,
  condition:(e,c)=>deck(e,c.owner,m=>H.cyber(m)||(machine(m)&&CARDS[m.id].attribute==='光'&&CARDS[m.id].noNormal)).length>0,
  resolve:(e,c)=>H.searchChoice(e,c,m=>H.cyber(m)||(machine(m)&&CARDS[m.id].attribute==='光'&&CARDS[m.id].noNormal)),aiScore:1300});
E.trigger('cyber-emergency','recover',{label:'发动被无效：丢弃手牌，回收紧急呼救',zones:['grave'],
  inputs:(e,c)=>[group(e,c,'cost','选择丢弃的手牌',hand(e,c.owner),1,1,{role:'cost'})],cost:(e,c)=>H.discard(e,c,args(c,'cost')),
  resolve:(e,c)=>{if(e.find(c.uid)?.zone==='grave')e.move(c.uid,'hand',{kind:'effect-return',source:c.source,byOwner:c.owner});}});
E.spell('cyber-revsystem',{label:'再生电子龙，并赋予效果破坏抗性',
  condition:(e,c)=>specialable(e,c.owner,H.cards(e,c.owner,['hand','grave'],m=>namedCyber(e,m)),'revive').length>0,
  resolve:(e,c)=>{const list=specialable(e,c.owner,H.cards(e,c.owner,['hand','grave'],m=>namedCyber(e,m)),'revive');if(list.length)e.queueChoice(c.owner,'选择特殊召唤的电子龙',H.options(e,c,list),1,1,'cyber-revsystem-special',{source:c.source,role:'special'});},aiScore:900});
E.op('cyber-revsystem-special',(e,t)=>{const f=e.find(t.picks[0]);if(!f||!['hand','grave'].includes(f.zone))return;const summoned=e.special(t.owner,f.card.uid,{via:'revive'});if(summoned)summoned.effectIndestructible=true;});
E.spell('machine-duplication',{label:'复制当前名称相同的机械族',
  inputs:(e,c)=>[group(e,c,'target','选择攻击力500以下的机械族',monsters(e,c.owner,m=>m.faceUp&&machine(m)&&e.attackValue(m)<=500&&specialable(e,c.owner,deck(e,c.owner,x=>x.id===e.cardNameId(m))).length>0),1,1,{role:'own-boost'})],
  resolve:(e,c)=>{
    const f=H.legalTarget(e,c,first(c),(m,f)=>f.owner===c.owner&&H.fieldZone(f.zone)&&m.faceUp&&machine(m));if(!f)return;
    const name=e.cardNameId(f.card),list=specialable(e,c.owner,deck(e,c.owner,m=>m.id===name)),count=Math.min(2,e.freeMain(c.owner),list.length);
    if(count)e.queueChoice(c.owner,'选择机械复制术展开的怪兽',H.options(e,c,list),1,count,'special-selected',{source:c.source,role:'special',via:'effect'});
  },aiScore:1400});
E.trigger('chimeratech-rampage','backrow',{label:'狂暴龙：破坏魔法／陷阱',
  inputs:(e,c)=>[group(e,c,'target','按融合素材数选择后场',[0,1].flatMap(p=>e.spells(p)),1,Math.min([0,1].flatMap(p=>e.spells(p)).length,c.event.materials.length),{role:'destroy'})],
  resolve:H.destroyTargets});
E.register('chimeratech-rampage','attacks',{label:'送墓最多2只光机械，增加攻击次数',once:once('attacks','card'),
  inputs:(e,c)=>[group(e,c,'cost','选择送墓的光属性机械族',deck(e,c.owner,m=>machine(m)&&CARDS[m.id].attribute==='光'&&H.canSendGY(e,m)),1,2,{role:'send-deck'})],
  cost:(e,c)=>{c.sentCount=args(c,'cost').length;H.sendCost(e,c,args(c,'cost'));e.shuffle(e.state.players[c.owner].deck);},
  resolve:(e,c)=>{const m=self(e,c);if(m)m.extraAttacks=(m.extraAttacks||0)+c.sentCount;},aiScore:1700});
E.trigger('chimeratech-overdragon','send-all',{label:'超载龙：将自己其他卡全部送墓',mandatory:true,
  resolve:(e,c)=>{for(const m of[...e.field(c.owner)])if(m.uid!==c.uid&&!e.unaffected(m,c.source))e.move(m.uid,'grave',{kind:'effect-send',source:c.source,byOwner:c.owner});}});
function novaTargets(e,c,includeAllCosts=false){
  const main=grave(e,c.owner,m=>namedCyber(e,m)&&e.canSpecial(c.owner,m,{via:'revive'}));
  const overlay=source(e,c)?.card.overlays||[],selected=includeAllCosts?overlay:overlay.filter(m=>args(c,'cost').includes(m.uid));
  const extra=selected.filter(m=>m.originalOwner===c.owner&&namedCyber(e,m,'grave')&&(!isExtra(CARDS[m.id])||m.properlySummoned)&&e.canSpecial(c.owner,m,{via:'revive'}));
  return [...main,...extra];
}
E.register('cyber-nova','revive',{label:'新星：移除1素材，复活电子龙',once:once('revive','card'),targetAfterCost:true,
  condition:(e,c)=>(source(e,c)?.card.overlays.length||0)>0&&e.freeMain(c.owner)>0&&novaTargets(e,c,true).length>0,
  inputs:(e,c)=>{
    const existing=grave(e,c.owner,m=>namedCyber(e,m)&&e.canSpecial(c.owner,m,{via:'revive'}));
    const costs=(source(e,c)?.card.overlays||[]).filter(m=>existing.length||(m.originalOwner===c.owner&&namedCyber(e,m,'grave')));
    return [group(e,c,'cost','选择移除的超量素材',costs,1,1,{role:'cost'}),group(e,c,'target','选择复活的电子龙（可选刚移除的素材）',novaTargets(e,c),1,1,{role:'special'})];
  },cost:(e,c)=>e.detach(c.uid,args(c,'cost')),
  resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='grave'&&namedCyber(e,f.card)&&e.freeMain(c.owner))e.special(c.owner,f.card.uid,{via:'revive'});},aiScore:1250});
E.quick('cyber-nova','boost',{label:'新星：除外电子龙，攻击力＋2100',once:once('boost','card'),damageStep:true,
  inputs:(e,c)=>[group(e,c,'cost','选择除外的电子龙',H.cards(e,c.owner,['hand','monsters','extraMonster'],m=>(e.find(m.uid).zone==='hand'||m.faceUp)&&namedCyber(e,m)),1,1,{role:'cost'})],
  cost:(e,c)=>{for(const uid of args(c,'cost'))e.move(uid,'banished',{kind:'cost-banish',source:c.source,byOwner:c.owner});},
  resolve:(e,c)=>{const m=self(e,c);if(m)e.modify(m.uid,'atk','add',2100,e.state.turn,c.source);},aiScore:()=>-100,
  aiResponse:(e,c,w)=>w.attack&&(w.attack.uid===c.uid||w.attack.target===c.uid)?1500:0});
E.trigger('cyber-nova','fusion',{label:'新星：从额外卡组呼唤机械融合',zones:['grave'],
  condition:(e,c)=>e.state.players[c.owner].extra.some(m=>CARDS[m.id].type==='fusion'&&machine(m)&&e.canSpecial(c.owner,m)&&e.freeZones(c.owner,m).length),
  resolve:(e,c)=>H.specialChoice(e,c,e.state.players[c.owner].extra.filter(m=>CARDS[m.id].type==='fusion'&&machine(m)))});
E.register('cyber-infinity','absorb',{label:'无限：将攻击表示怪兽变成素材',once:once('absorb','card'),
  inputs:(e,c)=>[group(e,c,'target','选择吸收的攻击表示怪兽',[0,1].flatMap(p=>monsters(e,p,m=>m.uid!==c.uid&&CARDS[m.id].type!=='token'&&m.faceUp&&m.position==='attack')),1,1,{role:'destroy'})],
  resolve:(e,c)=>{const m=self(e,c),f=H.legalTarget(e,c,first(c),(m,f)=>H.fieldZone(f.zone)&&CARDS[m.id].type!=='token'&&m.faceUp&&m.position==='attack');if(m&&f)e.attach(m.uid,f.card.uid,c.source);},
  aiScore:(e,c)=>monsters(e,1-c.owner,m=>CARDS[m.id].type!=='token'&&m.faceUp&&m.position==='attack'&&!e.unaffected(m,c.source)).length?1450:-100});
E.quick('cyber-infinity','negate',{label:'无限：移除1素材，无效发动并破坏',main:false,damageStep:true,once:once('negate','card'),
  condition:(e,c)=>!!c.event.window?.chainLast&&(source(e,c)?.card.overlays.length||0)>0,
  inputs:(e,c)=>[H.detachInput(e,c,1)],cost:(e,c)=>e.detach(c.uid,args(c,'cost')),
  resolve:(e,c)=>e.negateLink(c.responseTo,c.source,true,true),aiResponse:(e,c,w)=>w.chainLast?.owner!==c.owner?2300:0});
E.on('summon',(e,v)=>{
  if(v.kind==='flip')return;
  if(v.kind==='normal'){
    if(v.id==='cyber-core')e.addTrigger(v.uid,'cyber-core::search',v);
    if(v.id==='cyber-drei')e.addTrigger(v.uid,'cyber-drei::levels',v);
  }
  if(v.id==='cyber-herz'&&v.kind!=='normal')e.addTrigger(v.uid,'cyber-herz::level',v);
  if(v.id==='cyber-nachster')e.addTrigger(v.uid,'cyber-nachster::revive',v);
  if(v.id==='galaxy-soldier'&&v.kind!=='normal')e.addTrigger(v.uid,'galaxy-soldier::search',v);
  const summoned=e.find(v.uid)?.card;
  if(summoned&&namedCyber(e,summoned))for(const m of hand(e,v.owner,m=>m.id==='cyber-vier'))e.addTrigger(m.uid,'cyber-vier::special',v,{owner:v.owner,priority:30});
  if(v.kind==='fusion'){
    if(v.id==='chimeratech-rampage')e.addTrigger(v.uid,'chimeratech-rampage::backrow',v);
    if(v.id==='chimeratech-overdragon')e.addTrigger(v.uid,'chimeratech-overdragon::send-all',v,{mandatory:true});
  }
});
E.on('move',(e,v)=>{
  if(v.id==='cyber-herz'&&v.to==='grave')e.addTrigger(v.uid,'cyber-herz::recover',v);
  if(v.id==='cyber-drei'&&v.to==='banished')e.addTrigger(v.uid,'cyber-drei::protect',v);
  if(v.id==='cyber-nova'&&v.to==='grave'&&v.source&&v.byOwner!==v.previous.owner&&!String(v.kind).startsWith('cost')&&!['battle','rule-material','detach'].includes(v.kind))e.addTrigger(v.uid,'cyber-nova::fusion',v);
});
E.on('activation-negated',(e,v)=>{if(v.id==='cyber-emergency'&&v.byOwner!==v.owner&&e.find(v.uid)?.zone==='grave')e.addTrigger(v.uid,'cyber-emergency::recover',v,{owner:v.owner});});
})(typeof globalThis!=='undefined'?globalThis:this);
