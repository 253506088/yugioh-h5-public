(function(root){
  'use strict';
  const I=root.DuelI18n,{isMonster}=root.DuelData,CARDS=I.cards,CARD_LIST=root.DuelData.CARD_LIST,A=root.DuelArt;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const typeNames={monster:'效果',ritual:'仪式',fusion:'融合',synchro:'同调',xyz:'超量',link:'连接',pendulum:'灵摆',token:'衍生物',spell:'魔法',trap:'陷阱'};
  const serials=new Map(CARD_LIST.map((card,index)=>[card.id,index+1]));
  function kind(c){return I.term(c.type==='monster'&&!c.effect?'通常':typeNames[c.type]||c.type);}
  function subtype(c){return c.type==='spell'?I.term({normal:'通常魔法',quick:'速攻魔法',continuous:'永续魔法',equip:'装备魔法',field:'场地魔法',ritual:'仪式魔法'}[c.spellKind]||'通常魔法'):c.type==='trap'?I.term({normal:'通常陷阱',continuous:'永续陷阱',counter:'反击陷阱'}[c.trapKind]||'通常陷阱'):[I.term(c.race),kind(c),c.tuner?I.term('调整'):'',c.flip?I.term('反转'):'',c.spirit?I.term('灵魂'):'',c.toon?I.term('卡通'):'',c.effect&&c.type!=='monster'?I.term('效果'):(c.type==='pendulum'||c.pendulum)?I.term('通常'):''].filter(Boolean).join('／');}
  function card(id,instance=null){
    const c=CARDS[id];if(!c)return '';
    const monster=isMonster(c),n=c.rank||c.level||0,index=serials.get(id),frame=c.type==='monster'?(c.effect?'effect':'normal'):c.type;
    const stars=c.type==='link'?'<span class="pc-kind">LINK / EFFECT</span>':monster?Array.from({length:n},()=>'<span class="pc-star">'+(c.type==='xyz'?'✦':'★')+'</span>').join(''):'<span class="pc-kind">【'+subtype(c)+'】</span>';
    const arrows=c.type==='link'?'<span class="pc-link-arrows">'+['TL','T','TR','L','R','BL','B','BR'].map(d=>'<i class="link-arrow arrow-'+d+((c.arrows||[]).includes(d)?' on':'')+'"></i>').join('')+'</span>':'';
    return '<div class="playing-card type-'+c.type+(c.type==='monster'&&c.effect?' is-effect':'')+'" data-frame="'+frame+'" aria-hidden="true"><div class="pc-heading"><span class="pc-name'+(c.name.length>8?' long':'')+'">'+esc(c.name)+'</span><span class="pc-attribute">'+esc(c.attribute)+'</span></div><div class="pc-stars'+(c.type==='xyz'?' pc-ranks':'')+'"'+(n>8?' style="gap:1%;font-size:5cqw"':'')+'>'+stars+'</div>'+A.html(id,'pc-art')+arrows+((c.type==='pendulum'||c.pendulum)?'<div class="pc-pendulum"><b class="blue-scale">'+c.scale+'</b><p>'+esc(c.pendulumDescription)+'</p><b class="red-scale">'+c.scale+'</b></div>':'')+'<div class="pc-serial"><span>DUEL SANCTUARY</span><span>DS–'+String(index).padStart(3,'0')+'</span></div><div class="pc-textbox"><div class="pc-race">【'+subtype(c)+'】</div><p class="pc-description">'+esc(c.description)+'</p>'+(monster?'<div class="pc-values"><span><small>ATK/</small> '+c.atk+'</span><span><small>'+(c.type==='link'?'LINK/':'DEF/')+'</small> '+(c.type==='link'?c.linkRating:c.def)+'</span></div>':'')+'</div><div class="pc-foot"><span>HEART OF THE CARDS</span><b></b></div></div>';
  }
  function details(id,instance=null,engine=null){
    const original=CARDS[id];if(!original)return '';
    const c=instance?.asMonster?{...original,...instance.asMonster,type:'monster',effect:instance.asMonster.normal?null:original.effect}:original;
    const monster=isMonster(c),level=instance&&engine?engine.level(instance):c.level,scale=instance&&engine?.pendulumScale?engine.pendulumScale(instance):c.scale;
    let runtime='';
    if(instance&&engine){
      const tags=[];
      if(instance.asMonster)tags.push('临时怪兽状态 · 原卡种类保留');
      if(instance.overlays?.length)tags.push('超量素材 '+instance.overlays.length);
      if(engine.negated(instance))tags.push('效果无效中');
      if(instance.faceUpExtra)tags.push('表侧额外卡组');
      if(instance.counters)tags.push('魔力指示物 '+instance.counters);
      if(instance.wedge)tags.push('楔指示物 '+instance.wedge);
      if(tags.length)runtime='<div class="instance-tags">'+tags.map(t=>'<span>'+esc(t)+'</span>').join('')+'</div>';
    }
    const values=monster?'<div class="preview-stats"><div><small>ATK</small><b>'+((instance&&engine)?engine.attackValue(instance):c.atk)+'</b></div><div><small>'+(c.type==='link'?'LINK':'DEF')+'</small><b>'+(c.type==='link'?c.linkRating:(instance&&engine)?engine.defenseValue(instance):c.def)+'</b></div></div>':'';
    const compass=c.type==='link'?'<div class="link-details"><span class="link-mini-compass">'+['TL','T','TR','L','CENTER','R','BL','B','BR'].map(d=>'<i class="'+((c.arrows||[]).includes(d)?'on':'')+'">'+({TL:'↖',T:'↑',TR:'↗',L:'←',CENTER:'◆',R:'→',BL:'↙',B:'↓',BR:'↘'}[d])+'</i>').join('')+'</span><p>连接箭头决定从额外卡组登场的位置。<br>没有等级、阶级与守备力，只能表侧攻击。'+(instance?.linkProtection?'<b>I：P素材抗性：不会被对方效果破坏。</b>':'')+'</p></div>':'';
    return '<h2 class="card-name">'+esc(c.name)+'</h2><div class="card-en">'+esc(c.officialName)+'</div><div class="card-tags">'+(monster?'<span class="card-tag gold">'+esc(c.attribute)+(I.language==='en'?'':'属性')+'</span><span class="card-tag">'+esc(c.race)+'</span><span class="card-tag">'+(c.type==='link'?'LINK-'+c.linkRating:c.type==='xyz'?'阶级 '+c.rank:level+' 星')+' · '+kind(c)+(c.tuner?' / 调整':'')+'</span>':'<span class="card-tag gold">'+subtype(c)+'</span>')+((c.type==='pendulum'||c.pendulum)?'<span class="card-tag scale-tag">灵摆刻度 '+scale+'</span>':'')+'</div>'+values+runtime+compass+((c.type==='pendulum'||c.pendulum)?'<div class="pendulum-description"><h4>◈ 灵摆效果 · 刻度 '+scale+'</h4><p>'+esc(c.pendulumDescription)+'</p></div>':'')+'<p class="card-description'+(!c.effect?' flavor':'')+'">'+esc(c.description)+'</p>';
  }
  function coverage(c){
    if(!c?.early)return '';
    const ordinary=['效果已接入本作规则','通常怪兽：完整基础规则','指定素材融合','对应仪式与等级解放','沿用原有卡片实现；以本作卡片说明为准'],note=ordinary.includes(c.implementationNote)?'':c.implementationNote;
    return '<div class="card-coverage'+(c.implementationStatus==='pending'?' pending':'')+'"><b>OCG '+c.releaseYear+' · '+(c.implementationStatus==='pending'?'效果待落实':'可用于决斗')+'</b>'+(note?'<br>'+esc(note):'')+'<small>资料首发日期 '+esc(c.firstOCGDate)+' · YGOPRODeck</small>'+(c.type==='ritual'?'<small>仪式怪兽编入主卡组，由对应仪式魔法召唤。</small>':'')+'</div>';
  }
  const yearValues=[['all','全部年代'],...root.DuelData.earlyYears.map(y=>[String(y),y===1999?'1999 · 首年':y===2000?'2000 · 第二年':y===2001?'2001 · 第三年':String(y)]),...root.DuelData.earlyYears.map(y=>['through-'+y,'截至 '+y])];
  const yearOptions=value=>yearValues.map(([v,label])=>'<option value="'+v+'"'+(v===value?' selected':'')+'>'+label+'</option>').join('');
  const yearMatch=(c,value)=>value==='all'||(value.startsWith('through-')?!!c.releaseYear&&c.releaseYear<=Number(value.slice(8)):c.releaseYear===Number(value));
  root.DuelView={card,details:(id,instance,engine)=>details(id,instance,engine)+coverage(CARDS[id]),kind,subtype,escape:esc,yearOptions,yearMatch};
})(globalThis);
