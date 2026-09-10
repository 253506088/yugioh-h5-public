// One-time migration intermediate, retained for review. Maintain game-v2.js afterward.
import {readFile,writeFile} from 'node:fs/promises';
let s=(await readFile(new URL('../src/game-v2.js',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
function replace(a,b){if(!s.includes(a))throw new Error('Missing UI anchor: '+a.slice(0,70));s=s.replace(a,b);}
function fn(name,body){const start=s.indexOf('  function '+name+'(');if(start<0)throw new Error(name);const next=[...s.slice(start+3).matchAll(/^  (?:async )?function /gm)][0];s=s.slice(0,start)+body.trimEnd()+'\n'+s.slice(start+3+next.index);}
replace('  function renderZone(owner,zone) {\n    return engine.state.players[owner][zone].map((card,index)=>', '  function renderZone(owner,zone) {\n    const entries=engine.state.players[owner][zone].map((card,index)=>({card,index}));if(owner===1)entries.reverse();\n    return entries.map(({card,index})=>');
replace("(CARDS[card.id].type==='synchro'?'同调':'超量')+'召唤'", "({synchro:'同调',xyz:'超量',link:'连接'}[CARDS[card.id].type])+'召唤'");
replace("['pendulum','synchro','xyz'].includes(a.icon)","['pendulum','synchro','xyz','link'].includes(a.icon)");
replace("'需要满足素材、等级与召唤限制；融合怪兽通过相应魔法或效果登场。'", "'需要满足素材、等级或Link值与区域限制；融合怪兽通过相应魔法或效果登场。'");
const laneStart=s.indexOf("    $('#extra-lane').innerHTML=");const laneEnd=s.indexOf('\n',laneStart);s=s.slice(0,laneStart)+"    renderExtraLane();"+s.slice(laneEnd);
replace('    updateSoundButton();Art.refresh();','    updateSoundButton();Art.refresh();highlightLinkZones();');
fn('renderModernControls',String.raw`  function renderModernControls() {
    const s=engine.state,main=s.active===0&&s.winner===null&&!s.pending&&['main1','main2'].includes(s.phase),extra=main?engine.extraOptions(0):[],links=extra.filter(o=>o.type==='link'),pend=main?engine.pendulumCandidates(0):[],scales=engine.scales(0);
    $('#summon-toolbar').innerHTML='<button data-action="extra-menu"'+(!main?' disabled':'')+' class="summon-shortcut'+(extra.length?' available':'')+'">✧ 额外召唤 <b>'+extra.length+'</b></button><button data-action="link-menu"'+(!main?' disabled':'')+' class="summon-shortcut link-shortcut'+(links.length?' available':'')+'">⬡ 连接召唤 <b>'+links.length+'</b></button><button data-action="pendulum-summon"'+(!pend.length?' disabled':'')+' class="summon-shortcut pendulum-shortcut'+(pend.length?' available':'')+'">◈ 灵摆召唤 <b>'+pend.length+'</b></button><span class="scales-readout"><i>'+(scales[0]?.scale??'—')+'</i><span>〈 刻度 〉</span><i>'+(scales[1]?.scale??'—')+'</i></span>';
    $('#chain-status').innerHTML=s.chain.length?'<span>CHAIN '+s.chain.length+'</span>'+s.chain.map((l,i)=>'<b title="'+escape(window.DuelEffects.get(l.key)?.label)+'">'+(i+1)+' · '+escape(CARDS[l.sourceId].name)+'</b>').join('<i>→</i>'):s.pending?'<span>决策时机</span><b>'+escape(s.pending.title||'效果处理中')+'</b>':'<span>V3 · LINK THE FUTURE</span><b>融合 · 同调 · 超量 · 灵摆 · 连接</b>';
    const pieces=['exodia-head','exodia-left-arm','exodia-right-arm','exodia-left-leg','exodia-right-leg'],hasExodia=engine.deckInfo(0).cards.some(id=>pieces.includes(id));$('#exodia-tracker').hidden=!hasExodia;
    if(hasExodia)$('#exodia-tracker').innerHTML='<span>封印的记忆</span>'+pieces.map((id,i)=>'<b class="'+(s.players[0].hand.some(c=>c.id===id)?'collected':'')+'" title="'+escape(CARDS[id].name)+'">'+['頭','左腕','右腕','左足','右足'][i]+'</b>').join('');
  }
  function renderExtraLane() {
    $('#extra-lane').innerHTML=[0,1].map(slot=>{const f=engine.extraAt(slot);return '<div class="extra-dock shared-extra slot-'+slot+'" data-extra-slot="'+slot+'"><small>'+(f?(f.owner===0?'你':'对方')+' · ':'共享 · ')+'额外区 '+(slot===0?'Ⅰ':'Ⅱ')+'</small>'+(f?fieldCard(f.card,f.owner,'extraMonster',slot):'<div class="zone extra-empty"><span>◇</span></div>')+'</div>';}).join('')+'<div class="extra-orbit">'+icon('eye')+'<span>LINK NETWORK</span></div>';
  }
  function highlightLinkZones() {
    const layer=$('#link-network-lines');if(!layer)return;layer.innerHTML='';$$('#duel-board .link-pointed,#duel-board .co-linked').forEach(el=>el.classList.remove('link-pointed','co-linked'));
    const f=selectedUid?engine.find(selectedUid):null;if(!f||!['monsters','extraMonster'].includes(f.zone)||CARDS[f.card.id].type!=='link'||!f.card.faceUp)return;
    const source=$('#duel-board [data-card-uid="'+f.card.uid+'"]');if(!source)return;
    const base=$('#duel-board').getBoundingClientRect(),origin=source.getBoundingClientRect(),start={x:origin.left+origin.width/2-base.left,y:origin.top+origin.height/2-base.top},co=engine.coLinked(f.card.uid);
    for(const p of window.DuelLinkRules.arrowPoints(f)){
      let target=null;
      if([0,2].includes(p.y)&&p.x>=0&&p.x<=4){const owner=p.y===0?0:1,index=owner===0?p.x:4-p.x;target=$('#duel-board [data-owner="'+owner+'"][data-zone="monsters"][data-slot="'+index+'"],#duel-board [data-empty-owner="'+owner+'"][data-empty-zone="monsters"][data-slot="'+index+'"]');}
      else if(p.y===1&&[1,3].includes(p.x))target=$('.extra-dock[data-extra-slot="'+(p.x===1?0:1)+'"] .zone');
      if(!target)continue;target.classList.add('link-pointed');const mutual=co.includes(target.dataset.cardUid);if(mutual)target.classList.add('co-linked');const r=target.getBoundingClientRect(),x=r.left+r.width/2-base.left,y=r.top+r.height/2-base.top;
      layer.innerHTML+='<path class="'+(mutual?'mutual':'')+'" d="M '+start.x+' '+start.y+' L '+x+' '+y+'"/><circle cx="'+x+'" cy="'+y+'" r="4"/>';
    }
    layer.setAttribute('viewBox','0 0 '+base.width+' '+base.height);
  }`);
replace("    positionPopover(liveElement || element || $('#card-preview'));", "    positionPopover(liveElement || element || $('#card-preview'));highlightLinkZones();");
replace("  function showPile(owner,kind) {", "  function showPile(owner,kind,onlyType=null) {");
replace("const p=engine.state.players[owner],cards=[...(p[kind]||[])].reverse();", "const p=engine.state.players[owner],cards=[...(p[kind]||[])].filter(c=>!onlyType||CARDS[c.id].type===onlyType).reverse();");
replace("同调与超量怪兽可在素材满足时直接召唤。融合怪兽需要相应魔法或效果；表侧灵摆卡通过灵摆召唤返回。", "同调、超量与Link在素材满足时可以召唤。Link需要共享额外区或箭头指向的主区；融合由相应效果发动，表侧灵摆通过灵摆召唤返回。");
s=s.replaceAll("['fusion','融合'],['synchro','同调'],['xyz','超量'],['pendulum','灵摆']", "['fusion','融合'],['synchro','同调'],['xyz','超量'],['link','连接'],['pendulum','灵摆']");
replace("'TEN PATHS · ONE DESTINY'", "'ELEVEN PATHS · ONE DESTINY'");
s=s.replaceAll('十套预设','11套预设');s=s.replaceAll('所收录的176张卡','所收录的204张卡');s=s.replaceAll('已收录的176张卡','已收录的204张卡');
replace("'选择等级位于左右刻度之间的怪兽。手牌使用主怪兽区；表侧额外的灵摆使用额外怪兽区。'", "'手牌使用主怪兽区；表侧额外的灵摆需要共享额外区或Link箭头指向的主区，且等级位于两刻度之间。'");
replace("p.purpose==='extra'?'选择场上的素材。可以手动组合，也可以点选下方已校验的组合。'", "['extra','link-effect'].includes(p.purpose)?'选择素材，再选择合法召唤区域。Link怪兽作为素材可计为1或自身Link值，合计须精确等于目标Link值。' ");
replace("position:p.action?.position||'attack'", "position:p.action?.position||'attack',zone:null");
replace("(c.mandatory?'<em class=\"mandatory-badge\">强制</em>':'')", "(c.mandatory?'<em class=\"mandatory-badge\">'+(p.kind==='order'?'强制':'必选')+'</em>':'')");
replace("escape(c.detail||'')", "escape((c.zone?({hand:'手牌',deck:'卡组',grave:'墓地',extra:'额外卡组',monsters:'场上',extraMonster:'额外怪兽区',overlays:'超量素材',banished:'除外区',spells:'魔陷区'}[c.zone]||c.zone)+' · ':'')+(c.detail||''))");
const summonOld="    if(p.kind==='materials'&&['extra','fusion','pendulum'].includes(p.purpose))$('#pick-feedback').insertAdjacentHTML('beforebegin','<div class=\"summon-position-choice\"><span>出场表示</span><div class=\"segmented-control\"><button class=\"active\" data-action=\"summon-position\" data-position=\"attack\">表侧攻击</button><button data-action=\"summon-position\" data-position=\"defense\">表侧守备</button></div></div>');";
replace(summonOld,String.raw`    if(p.kind==='materials'&&['extra','fusion','pendulum','link-effect'].includes(p.purpose)){
      const isLink=CARDS[engine.find(p.uid)?.card.id]?.type==='link';
      $('#pick-feedback').insertAdjacentHTML('beforebegin','<div class="summon-position-choice"><span>出场表示</span>'+(isLink?'<b class="link-only-position">LINK · 仅表侧攻击</b>':'<div class="segmented-control"><button class="active" data-action="summon-position" data-position="attack">表侧攻击</button><button data-action="summon-position" data-position="defense">表侧守备</button></div>')+'</div>'+(['extra','fusion','link-effect'].includes(p.purpose)?'<div class="summon-zone-picker" id="summon-zone-picker"></div>':''));
      if(p.spellId?.requiredUid){const card=engine.find(p.spellId.requiredUid)?.card;$('#pick-feedback').insertAdjacentHTML('beforebegin','<p class="tear-material-note">必须包含墓地的「'+escape(CARDS[card?.id]?.name||'触发卡片')+'」。素材按点选顺序放回卡组底部。</p>');}
    }`);
fn('updatePicks',String.raw`  function updatePicks() {
    const p=engine.state.pending;if(!p||!selectionState)return;
    const selected=selectionState.selected,valid=engine.validatePick(p,selected);
    $$('.selection-card[data-action="pending-pick"]').forEach(el=>{const i=selected.indexOf(el.dataset.uid);el.classList.toggle('chosen',i>=0);el.setAttribute('aria-pressed',String(i>=0));el.querySelector('.pick-number').textContent=i>=0?i+1:'';});
    $('#pending-confirm').disabled=!valid.valid;$('#pick-feedback').textContent='已选 '+selected.length+' 项 · '+(valid.valid?'选择合法，可以确认':valid.message);$('#pick-feedback').classList.toggle('valid',valid.valid);
    const candidates=p.candidates||p.group?.candidates||[],last=candidates.find(c=>c.uid===selected.at(-1)),extra=engine.find(p.uid)?.card,target=CARDS[extra?.id],materials=selected.map(uid=>engine.find(uid)?.card).filter(Boolean);let materialNote='';
    if(['extra','link-effect'].includes(p.purpose)){
      if(target?.type==='link')materialNote='素材可计值：'+materials.map(c=>CARDS[c.id].type==='link'?'(1 / '+CARDS[c.id].linkRating+')':'1').join(' ＋ ')+' → LINK-'+target.linkRating;
      else materialNote=target?.type==='synchro'?'等级合计 '+materials.reduce((n,c)=>n+engine.level(c),0)+' → 目标 '+target.level+' 星':materials.length===1&&CARDS[materials[0].id].type==='xyz'?'叠放升阶 · 继承已有素材':materials.map(c=>'LV '+engine.level(c)).join(' ＋ ')+' → RANK '+(target?.rank||'');
    }
    if(last?.cardId&&$('#pick-inspector'))$('#pick-inspector').innerHTML=detailsHTML(last.cardId,engine.find(last.uid)?.card)+(materialNote?'<p class="level-equation">'+escape(materialNote)+'</p>':'');
    const picker=$('#summon-zone-picker');if(picker){const zones=valid.valid&&extra?engine.freeZones(p.owner,extra,{materials:selected}):[];if(!zones.includes(selectionState.zone))selectionState.zone=zones[0]??null;picker.innerHTML='<span>召唤区域</span><div>'+ (zones.length?zones.map(z=>'<button data-action="summon-zone" data-zone="'+z+'" class="'+(selectionState.zone===z?'active':'')+'">'+zoneName(p.owner,z)+'</button>').join(''):'<small>选择合法素材后显示可用区域</small>')+'</div>';}
  }
  function zoneName(owner,zone) {return typeof zone==='number'?'主怪兽区 '+(zone+1):'共享额外区 '+(engine.extraSlot(owner,zone)===0?'Ⅰ':'Ⅱ');}`);
replace("      case 'extra-menu':showExtraMenu();break;", "      case 'extra-menu':showExtraMenu();break;\n      case 'link-menu':showPile(0,'extra','link');break;");
replace("      case 'summon-position':", "      case 'summon-zone':if(selectionState){selectionState.zone=/^[0-4]$/.test(b.dataset.zone)?Number(b.dataset.zone):b.dataset.zone;updatePicks();}break;\n      case 'summon-position':");
replace("const uids=[...selectionState.selected],position=selectionState.position;", "const uids=[...selectionState.selected],position=selectionState.position,zone=selectionState.zone;");
replace("dispatch({type:'choose',uids,position});", "dispatch({type:'choose',uids,position,...(zone!==null?{zone}:{})});");
s=s.replaceAll("['special','synchro','xyz','pendulum','fusion']", "['special','synchro','xyz','link','pendulum','fusion']");
s=s.replaceAll("['summon','special','synchro','xyz','pendulum','fusion']", "['summon','special','synchro','xyz','link','pendulum','fusion']");
replace("titles={fusion:'FUSION SUMMON'", "titles={link:'LINK SUMMON',fusion:'FUSION SUMMON'");
replace("  window.addEventListener('resize', hidePopover, { passive: true });", "  window.addEventListener('resize', () => {hidePopover();requestAnimationFrame(highlightLinkZones);}, { passive: true });");
replace("if (!restored) startGame({ deck: 'hero', opponentDeck: 'blackwing'", "if (!restored) startGame({ deck: 'tearlaments', opponentDeck: 'blackwing'");
s=s.replaceAll('duel-sanctuary-welcomed-v2','duel-sanctuary-welcomed-v3');
// Keep the already working guide, replace the obsolete scope and append Link-specific details.
replace('围绕所收录的204张卡实现融合、同调、超量、灵摆与相应连锁。采用每方一个额外怪兽区的场地布局；融合、同调、超量也可使用主怪兽区。不采用赛事禁限卡表，没有连接、仪式以及未收录卡片的规则。', '围绕所收录的204张卡实现融合、同调、超量、灵摆、连接与相应连锁。场地具有两个共享额外怪兽区，可经互相连接构成Extra Link。不采用赛事禁限卡表，没有仪式以及未收录卡片的规则。');
s=s.replaceAll('表侧额外的灵摆只能使用本方空余额外怪兽区','表侧额外的灵摆只能使用可用的共享额外区或Link箭头指向的主区');
s=s.replaceAll('手牌使用主怪兽区；表侧额外的灵摆只能使用本方空余额外怪兽区','手牌使用主怪兽区；表侧额外的灵摆需要合法的额外区或Link箭头');
replace("['超量召唤','同等级怪兽叠放", "['连接召唤','素材Link值必须精确满足目标。普通怪兽计1，Link怪兽计1或自身Link值，并满足最少素材数、属性与名称条件。只能表侧攻击，无等级、阶级与守备力。'],['箭头与区域','从额外连接召唤，须使用可用共享额外区或箭头指向的主区。计算的是素材离场后的箭头。两张Link互相指向才是互相连接；连通两个额外区的互相连接路径允许Extra Link。'],['珠泪送墓','珠泪人鱼被效果送墓才可发动融合。丢弃代价、连接／同调素材、移除素材与回合弃牌不算效果送墓。珠泪融合必须包含墓地触发卡；若该卡先被除外，融合不再进行。'],['超量召唤','同等级怪兽叠放");
await writeFile(new URL('../src/game-v2.js',import.meta.url),s);console.log('V3 UI migration applied.');
