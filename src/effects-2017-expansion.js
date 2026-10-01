/* 2017 second wave: Cyberse starters and broadly usable support.
 * All choices and once-per-duel records are serializable engine state. */
(function(root){
 'use strict';
 const X=root.DuelChronicle,{E,H,A,passive,onEntry,onMove,cast,card,def,monster,ownM,foeM,allM,allS,hand,deck,grave,args,first,target,g,moved,destroy,revive,search,specialChoice,series,is,field}=X;
 const {limit}=X.year2017;
 const cyber=(e,m)=>monster(m)&&e.race(m)==='电子界族';
 const room=(e,c)=>e.freeMain(c.owner)>0;
 const arrowZones=(e,c)=>e.linkedZones(c.owner).filter(z=>!e.state.players[c.owner].monsters[z]);
 A('Cyberse Converter','y17-summon',{zones:['hand'],inherent:true,summons:true,once:limit('converter'),condition:(e,c)=>room(e,c)&&ownM(e,c).length>0&&ownM(e,c).every(m=>m.faceUp&&cyber(e,m)),resolve:(e,c)=>revive(e,c,c.uid,{via:'effect'}),aiScore:1050});
 onEntry('Cyberse Converter','y17-race',{inputs:target('选择效果对象',(e,c)=>ownM(e,c).filter(m=>m.faceUp),'own-boost'),resolve:(e,c)=>{const m=card(e,first(c));if(m?.faceUp&&!e.unaffected(m,c.source))m.y17CyberseTurn=e.state.turn;}},['normal']);
 X.extend('race',function(prior,m,...a){return m?.y17CyberseTurn===this.state.turn?'电子界族':prior.call(this,m,...a);});
 X.extend('setPosition',function(prior,u,pos,s,down=false){const r=prior.call(this,u,pos,s,down);if(r&&down&&card(this,u))delete card(this,u).y17CyberseTurn;return r;});
 A('Underclock Taker','y17-weaken',{once:H.once('y17-underclock','card'),inputs:(e,c)=>[g(e,c,'linked','选择效果对象',X.year2017.points(e,c.uid).filter(m=>m.faceUp),1,1,'own-boost'),g(e,c,'target','选择效果对象',foeM(e,c).filter(m=>m.faceUp))],resolve:(e,c)=>{const m=card(e,first(c,'linked')),t=card(e,first(c));if(m?.faceUp&&t?.faceUp&&field(e.find(m.uid)?.zone)&&field(e.find(t.uid)?.zone))e.modify(t.uid,'atk','add',-e.attackValue(m),e.state.turn,c.source);},aiScore:850});
 A('Link Infra-Flier','y17-summon',{zones:['hand'],inherent:true,summons:true,once:limit('infra'),condition:(e,c)=>arrowZones(e,c).length>0,resolve:(e,c)=>{const zone=arrowZones(e,c)[0];if(zone!==undefined)revive(e,c,c.uid,{via:'effect',zone});},aiScore:1050});
 X.extend('linkValid',function(prior,p,m,ms,...a){return (!is(m,'Linkerbell')||this.state.players[p].extra.length>=this.state.players[1-p].extra.length+3)&&prior.call(this,p,m,ms,...a);});
 X.mark('Linkerbell');
 passive('Code Talker',{stat:(e,s,m,k)=>s.card.uid===m.uid&&k==='atk'?X.year2017.points(e,m.uid).length*500:0,protect:(e,s,m,source,battle)=>s.card.uid===m.uid&&(battle||source?.owner!==s.owner)&&X.year2017.points(e,m.uid).length>0});
 onEntry('Motivating Captain','y17-revive',{summons:true,condition:room,inputs:target('选择效果对象',(e,c)=>grave(e,c.owner,m=>monster(m)&&e.level(m)>0&&e.level(m)<=4&&e.canSpecial(c.owner,m,{via:'revive'})),'special'),resolve:(e,c)=>{const m=revive(e,c,first(c),{position:'defense'});if(m)m.effectNegated=true;}},['normal']);
 passive('Launcher Commander',{stat:(e,s,m)=>s.card.uid!==m.uid&&e.find(m.uid)?.owner===s.owner&&cyber(e,m)?300:0});
 A('Launcher Commander','y17-destroy',{once:H.once('y17-launcher','card'),inputs:(e,c)=>[g(e,c,'cost','选择解放的怪兽',ownM(e,c).filter(m=>m.faceUp&&cyber(e,m)&&e.canTribute(m,c.owner)),1,1,'cost'),...target('选择效果对象',(e,c)=>foeM(e,c).filter(m=>m.faceUp))(e,c)],cost:(e,c)=>X.tribute(e,c,args(c,'cost')),resolve:(e,c)=>destroy(e,c,args(c)),aiScore:900});

 A('Backup Secretary','y17-summon',{zones:['hand'],inherent:true,summons:true,once:limit('secretary'),condition:(e,c)=>room(e,c)&&ownM(e,c).some(m=>m.faceUp&&cyber(e,m)),resolve:(e,c)=>revive(e,c,c.uid,{via:'effect'}),aiScore:1050});
 X.handSpecial('Hack Worm',(e,c)=>!foeM(e,c).length);
 onEntry('Draconnet','y17-recruit',{deckInteraction:true,summons:true,condition:room,resolve:(e,c)=>specialChoice(e,c,[...hand(e,c.owner),...deck(e,c.owner)].filter(m=>monster(m)&&e.isNormalMonster(m)&&e.level(m)<=2),{via:'effect',position:'defense',shuffle:true})},['normal']);
 A('RAM Clouder','y17-revive',{once:limit('ram'),summons:true,inputs:(e,c)=>[g(e,c,'cost','选择解放的怪兽',ownM(e,c).filter(m=>e.canTribute(m,c.owner)),1,1,'cost'),...target('选择效果对象',(e,c)=>grave(e,c.owner,m=>cyber(e,m)&&e.canSpecial(c.owner,m,{via:'revive'})),'special')(e,c)],cost:(e,c)=>X.tribute(e,c,args(c,'cost')),resolve:(e,c)=>revive(e,c,first(c)),aiScore:1000});
 onEntry('ROM Cloudia','y17-recover',{inputs:target('选择效果对象',(e,c)=>grave(e,c.owner,m=>cyber(e,m)&&!is(m,'ROM Cloudia')),'search'),resolve:(e,c)=>moved(e,c,args(c),'hand','effect-return')},['normal']);
 onMove('ROM Cloudia','y17-recruit',{deckInteraction:true,summons:true,condition:room,resolve:(e,c)=>specialChoice(e,c,deck(e,c.owner,m=>cyber(e,m)&&e.level(m)<=4&&!is(m,'ROM Cloudia')),{via:'effect',shuffle:true})},(e,v)=>['battle','destroy'].includes(v.kind));
 onMove('Flame Bufferlo','y17-draw',{once:limit('bufferlo'),deckInteraction:true,inputs:(e,c)=>[g(e,c,'cost','选择丢弃的手牌',hand(e,c.owner,m=>cyber(e,m)),1,1,'cost')],cost:(e,c)=>H.discard(e,c,args(c,'cost')),resolve:(e,c)=>e.draw(c.owner,2)},(e,v)=>field(v.from)&&v.previous?.faceUp);
 for(const zone of ['grave','banished'])onMove('Dotscaper','y17-'+zone,{once:{...limit('dotscaper-'+zone),duel:true},summons:true,condition:(e,c)=>room(e,c)&&!X.locked(e,c.owner,'y17Dotscaper'),cost:(e,c)=>X.lock(e,c.owner,'y17Dotscaper'),resolve:(e,c)=>revive(e,c,c.uid,{via:'effect'})},(e,v)=>v.to===zone);
 onEntry('Nimble Beaver','y17-recruit',{deckInteraction:true,summons:true,condition:room,resolve:(e,c)=>specialChoice(e,c,[...deck(e,c.owner),...grave(e,c.owner)].filter(m=>monster(m)&&series(m,'Nimble')&&e.level(m)<=3),{via:'effect',shuffle:true})},['normal']);
 onEntry('Samurai Skull','y17-send',{deckInteraction:true,condition:(e,c)=>deck(e,c.owner,m=>monster(m)&&e.race(m)==='不死族').length>0,resolve:(e,c)=>X.choose(e,c,'选择送墓的卡片',deck(e,c.owner,m=>monster(m)&&e.race(m)==='不死族'),1,1,'early-move',{to:'grave',kind:'effect-send',shuffle:true,role:'search'})},['normal']);
 onMove('Samurai Skull','y17-recruit',{deckInteraction:true,summons:true,condition:room,resolve:(e,c)=>specialChoice(e,c,deck(e,c.owner,m=>monster(m)&&e.race(m)==='不死族'&&e.level(m)<=4&&!is(m,'Samurai Skull')),{via:'effect',shuffle:true})},(e,v)=>field(v.from)&&v.previous?.faceUp&&v.owner===v.previous?.originalOwner&&v.byEffect&&v.source?.owner===1-v.owner);

 const opposingDamage=v=>v.battle||((v.effectSource||v.source)?.owner===1-v.owner);
 E.on('damage',(e,v)=>{if(v.amount>0&&opposingDamage(v))X.lock(e,v.owner,'y17BeaconDamage');});
 cast('Cyberse Beacon',null,(e,c)=>search(e,c,deck(e,c.owner,m=>cyber(e,m)&&e.level(m)<=4)),{once:limit('beacon'),deckInteraction:true,condition:(e,c)=>X.locked(e,c.owner,'y17BeaconDamage')&&deck(e,c.owner,m=>cyber(e,m)&&e.level(m)<=4).length>0});
 cast('Backup Squad',null,()=>{});
 X.watch('Backup Squad','y17-draw','damage',(e,v,f)=>v.owner===f.owner&&v.amount>=1000&&(v.battle?v.attack?.owner===1-v.owner:opposingDamage(v)),{deckInteraction:true,resolve:(e,c)=>e.draw(c.owner,Math.floor(c.event.amount/1000))},{zones:['spells'],mandatory:true});
 cast('Recall',null,(e,c)=>{e.draw(1-c.owner,1);e.negateLink(c.responseTo,c.source,true,true);},{main:false,deckInteraction:true,condition:(e,c)=>{const l=c.event.window?.chainLast;return l?.owner===1-c.owner&&l.source.effectType==='monster';},aiResponse:()=>1400});

 cast('Hey, Trunade!',null,(e,c)=>moved(e,c,allS(e).filter(m=>!m.faceUp).map(m=>m.uid),'hand','effect-return'));
 X.revivalSpell('Back to the Front',(e,m)=>def(m).type!=='link',{position:'defense'});
 cast('Oops!',(e,c)=>e.field(c.owner),(e,c)=>destroy(e,c,args(c)));
 cast('Rainbow Bridge',null,(e,c)=>search(e,c,deck(e,c.owner,m=>['spell','trap'].includes(def(m).type)&&series(m,'Crystal'))),{deckInteraction:true,condition:(e,c)=>deck(e,c.owner,m=>['spell','trap'].includes(def(m).type)&&series(m,'Crystal')).length>0});
 cast('Gravity Lash',(e,c)=>allM(e).filter(m=>m.faceUp&&def(m).type!=='link'),(e,c)=>{const m=card(e,first(c));if(m?.faceUp)e.modify(m.uid,'atk','add',-e.defenseValue(m),e.state.turn,c.source);});
 passive('Mistar Boy',{stat:(e,s,m)=>e.attribute(m)==='水'?500:e.attribute(m)==='炎'?-400:0});
 onMove('Mistar Boy','y17-recover',{once:limit('mistar'),inputs:target('选择效果对象',(e,c)=>grave(e,c.owner,m=>monster(m)&&e.attribute(m)==='水'),'search'),resolve:(e,c)=>moved(e,c,args(c),'hand','effect-return')},(e,v)=>['battle','destroy'].includes(v.kind));
})(globalThis);
