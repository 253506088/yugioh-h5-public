/* Presentation only. All legality and random choices belong to the engine. */
(function(root){
  'use strict';
  const R=root.DuelRuleModes;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const tr=(zh,en,ja)=>({'zh-CN':zh,en,ja}[root.DuelI18n.language]||zh);
  const name=id=>R.name(id,root.DuelI18n.language);
  const summary=id=>R.summary(id,root.DuelI18n.language);
  const detail=id=>R.detail(id,root.DuelI18n.language);
  const categories={all:['全部法则','All decrees','すべて'],battle:['战斗','Battle','戦闘'],stat:['数值','Stats','数値'],draw:['抽卡','Draw','ドロー'],limit:['节奏','Pacing','制限'],guard:['庇护','Protection','耐性'],chance:['命运','Chance','運命'],reuse:['轮回','Recurrence','循環']};
  const label=a=>tr(...a);
  const badge=()=>'<span class="fate-seal">'+tr('双方生效 · 无法无效','BOTH PLAYERS · CANNOT BE NEGATED','双方に適用・無効化不可')+'</span>';
  function create(ctx){
    let category='all',query='';
    function show(){
      const active=R.active(ctx.engine()),r=R.get(active);
      ctx.open('rule-gallery',tr('天命法则','Fate Decree','天命の掟'),'25 DECREES · ONE SHARED DESTINY',
        '<div class="fate-gallery" data-i18n-skip><section class="fate-hero"><div class="fate-astrolabe" aria-hidden="true"><span>✦</span><i>25</i></div><div><span class="fate-kicker">A DIFFERENT KIND OF DUEL</span><h2>'+tr('这一次，规则也加入战局。','This time, the rules join the duel.','今度は、ルールも決闘に加わる。')+'</h2><p>'+tr('每局从 25 条法则中等概率抽取一条。<br>贯穿整场，对双方生效，无法被卡片无效。','One of 25 decrees is drawn at the start of each duel.<br>It affects both players for the entire game.','毎回25の掟から1つを抽選。<br>決闘中ずっと双方に適用され、無効にはできない。')+'</p>'+badge()+'</div></section>'+
        (r?'<button class="fate-current" data-action="rule-details"><span>'+esc(r.glyph)+'</span><div><small>'+tr('当前对局','CURRENT DUEL','現在の決闘')+'</small><strong>'+esc(name(active))+'</strong><p>'+esc(summary(active))+'</p></div><b>↗</b></button>':'')+
        '<div class="fate-gallery-tools"><div class="fate-filters" role="group" aria-label="'+tr('规则分类','Categories','カテゴリー')+'">'+Object.entries(categories).map(([id,a])=>'<button data-fate-filter="'+id+'" aria-pressed="'+(category===id)+'" class="'+(category===id?'active':'')+'">'+label(a)+'</button>').join('')+'</div><input id="fate-search" type="search" value="'+esc(query)+'" placeholder="'+tr('搜索法则…','Search decrees…','掟を検索…')+'" aria-label="'+tr('搜索法则','Search decrees','掟を検索')+'"></div><div class="fate-grid" id="fate-grid"></div><p id="fate-count" class="fate-count" role="status"></p></div>',
        '<button class="secondary-button" data-action="close-modal">'+tr('返回','Back','戻る')+'</button><button class="primary-button fate-launch" data-action="new-fate-game">✦ '+tr('开始天命对局','Start a Fate duel','天命の決闘を始める')+'</button>','fate-modal');
      updateGrid();
    }
    function updateGrid(){
      const grid=document.getElementById('fate-grid');if(!grid)return;
      const list=R.RULES.filter(r=>(category==='all'||r.tone===category)&&[name(r.id),summary(r.id),detail(r.id)].join(' ').toLowerCase().includes(query.toLowerCase()));
      grid.innerHTML=list.map(r=>'<button class="fate-card tone-'+r.tone+'" data-fate-detail="'+r.id+'"><span class="fate-card-top"><i>'+esc(r.glyph)+'</i><small>'+String(R.RULES.indexOf(r)+1).padStart(2,'0')+' / 25</small></span><strong>'+esc(name(r.id))+'</strong><p>'+esc(summary(r.id))+'</p><span class="fate-card-tail">'+label(categories[r.tone])+'<b>↗</b></span></button>').join('');
      document.getElementById('fate-count').textContent=list.length+' / 25 '+tr('条法则 · 点击查看完整说明','decrees · Select one to read the full rule','の掟・選択して詳細を表示');
    }
    function showDetail(id=R.active(ctx.engine())){
      const r=R.get(id);if(!r)return;
      const active=R.active(ctx.engine())===id;
      const affinity=id==='element'?'<div class="fate-elements"><b>'+tr('神 → 其余全部属性','DIVINE → every other Attribute','神 → 他のすべての属性')+'</b><span>'+tr('光 ⇄ 暗：双方 ×2','LIGHT ⇄ DARK: both ×2','光 ⇄ 闇：双方 ×2')+'</span><span>'+tr('炎 → 风 → 地 → 水 → 炎','FIRE → WIND → EARTH → WATER → FIRE','炎 → 風 → 地 → 水 → 炎')+'</span><small>'+tr('克制 ×2 · 被克制 ×½（向上取整）· 无相克 ×1','Favoured ×2 · Disfavoured ×½ (ceil) · Neutral ×1','有利 ×2・不利 ×½（切り上げ）・相性なし ×1')+'</small></div>':'';
      ctx.open('rule-detail',esc(name(id)),'DECREE '+String(R.RULES.indexOf(r)+1).padStart(2,'0')+' / 25',
        '<article class="fate-detail tone-'+r.tone+'" data-i18n-skip data-rule-id="'+id+'"><div class="fate-detail-glyph">'+esc(r.glyph)+'</div>'+badge()+'<h2>'+esc(summary(id))+'</h2><p>'+esc(detail(id))+'</p>'+affinity+(active?statusHTML(ctx.engine()):'')+'</article>',
        '<button class="secondary-button" data-action="rule-gallery">'+tr('全部法则','All decrees','すべての掟')+'</button><button class="primary-button" data-action="close-modal">'+tr('返回','Back','戻る')+'</button>','fate-detail-modal');
    }
    function statusHTML(e){return '<div class="fate-status">'+R.status(e,root.DuelI18n.language).map(s=>'<span>'+(s.owner===null?'':esc(root.DuelI18n.player(s.owner,e))+' · ')+esc(s.text)+'</span>').join('')+'</div>';}
    function setup(value='off'){
      return '<section class="fate-setup" data-i18n-skip><div><span class="fate-kicker">DUEL RULES</span><strong>'+tr('为决斗加入一点变数。','Let fate change the game.','決闘に、運命の変化を。')+'</strong></div><div class="fate-mode-options">'+[['off',tr('经典规则','Classic rules','通常ルール')],['random',tr('✦ 天命法则','✦ Fate Decree','✦ 天命の掟')]].map(([v,l])=>'<button data-action="choose-rule-mode" data-value="'+v+'" aria-pressed="'+(v===value)+'" class="'+(v===value?'active':'')+'">'+l+'</button>').join('')+'</div><p>'+tr('每局随机 1 条常驻法则，双方共享，无法无效。','One random, shared decree per duel. It cannot be negated.','毎回1つの掟を抽選。双方に適用され、無効化不可。')+' <button data-action="rule-gallery">'+tr('查看全部 25 条 →','Explore all 25 →','25の掟を見る →')+'</button></p></section>';
    }
    function render(){
      const home=document.querySelector('.fate-home');if(home){home.querySelector('strong').textContent=tr('天命法则','Fate Decree','天命の掟');home.querySelector('p').textContent=tr('25 条不可无效的法则。每次开局，命运重新洗牌。','25 unnegatable decrees. A new fate with every duel.','25の無効化できない掟。毎回、新たな運命が始まる。');}
      const e=ctx.engine(),id=R.active(e),r=R.get(id),bar=document.getElementById('fate-duel-bar');if(!bar)return;
      bar.hidden=!r;document.body.classList.toggle('fate-duel',!!r);if(!r)return;
      const actions=!ctx.spectating()?e.ruleActions?.(0)||[]:[];
      bar.innerHTML='<button class="fate-bar-rule" data-action="rule-details" title="'+esc(detail(id))+'"><i>'+esc(r.glyph)+'</i><span><small>'+tr('天命法则 · 无法无效','FATE DECREE · UNNEGATABLE','天命の掟・無効化不可')+'</small><strong>'+esc(name(id))+'</strong></span><p>'+esc(summary(id))+'</p><b>ⓘ</b></button>'+statusHTML(e)+actions.map(a=>'<button class="fate-rule-action" data-action="perform-rule" data-rule-key="'+a.key+'">'+tr('苦肉：支付 '+a.cost+' LP 抽 1 张','Pay '+a.cost+' LP · Draw 1',a.cost+' LPを払い1枚ドロー')+'</button>').join('');
      if(id==='cannon')for(const p of [0,1])document.querySelector('#'+(p?'opponent':'player')+'-monsters [data-slot="2"]')?.classList.add('fate-cannon-zone');
      for(const m of [0,1].flatMap(p=>e.monsters(p)))if(m.ruleWanted){const card=document.querySelector('#duel-board [data-card-uid="'+m.uid+'"]');if(card){card.classList.add('fate-wanted');card.insertAdjacentHTML('beforeend','<span class="fate-wanted-mark">'+tr('通缉犯','WANTED','指名手配')+'</span>');}}
      const attacker=e.find(ctx.attacking?.())?.card;
      if(id==='element'&&attacker&&e.ruleBattleValue)for(const target of e.monsters(1-e.find(attacker.uid).owner).filter(m=>m.faceUp)){
        const a=e.ruleBattleValue(attacker,target,attacker.uid),b=e.ruleBattleValue(target,attacker,attacker.uid),node=document.querySelector('#duel-board [data-card-uid="'+target.uid+'"]');
        node?.insertAdjacentHTML('beforeend','<span class="fate-matchup">'+a+' : '+b+'</span>');
      }
    }
    function reveal(){
      const e=ctx.engine(),id=R.active(e),r=R.get(id);if(!r)return;
      const node=document.getElementById('fate-reveal');node.hidden=false;node.dataset.ruleId=id;
      node.innerHTML='<span>FATE HAS SPOKEN</span><i>'+esc(r.glyph)+'</i><strong>'+esc(name(id))+'</strong><p>'+esc(summary(id))+'</p><small>'+tr('本局双方共享这一条法则','One decree. Both duelists.','この決闘で双方に適用')+'</small>';
      clearTimeout(reveal.timer);reveal.timer=setTimeout(()=>{node.hidden=true;},ctx.reducedMotion()?2400:4000);
    }
    document.addEventListener('input',event=>{if(event.target.id==='fate-search'){query=event.target.value;updateGrid();}});
    document.addEventListener('click',event=>{const f=event.target.closest('[data-fate-filter]'),d=event.target.closest('[data-fate-detail]');if(f){category=f.dataset.fateFilter;for(const b of document.querySelectorAll('[data-fate-filter]')){const on=b===f;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));}updateGrid();}if(d)showDetail(d.dataset.fateDetail);});
    return {show,showDetail,setup,render,reveal};
  }
  root.DuelRuleUI={create};
})(globalThis);
