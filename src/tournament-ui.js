(function (root) {
  'use strict';
  const T = root.DuelTournament, I = root.DuelI18n, Art = root.DuelArt, Decks = root.DuelDecks;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const tr = (zh, en, ja) => I.language === 'en' ? en : I.language === 'ja' ? ja : zh;
  const symbol = name => '<svg class="icon" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  const trophy = '<svg class="t-trophy" viewBox="0 0 160 180" fill="none" aria-hidden="true"><path class="t-trophy-aura" d="m80 6 68 39v79l-68 39-68-39V45Z"/><path d="M51 39h58v35c0 24-13 39-29 43-16-4-29-19-29-43V39Z" fill="currentColor" fill-opacity=".08"/><path d="M51 48H32v15c0 21 11 32 29 35m48-50h19v15c0 21-11 32-29 35M51 39h58v35c0 24-13 39-29 43-16-4-29-19-29-43V39ZM80 118v26m-20 1h40l7 13H53l7-13Z" stroke="currentColor" stroke-width="2"/><path d="m80 55 6 12 14 2-10 10 2 14-12-7-12 7 2-14-10-10 14-2 6-12Z" fill="currentColor"/><path d="M20 23v12m-6-6h12m103 87v10m-5-5h10M121 17v8m-4-4h8" stroke="currentColor" stroke-width="1.5"/></svg>';
  const number = n => Number(n || 0).toLocaleString('en-US');
  const freshSeed = () => (root.crypto?.getRandomValues(new Uint32Array(1))[0] || Date.now() % 4294967295) || 1;
  const roundName = (size, round) => {
    const n = size / 2 ** round;
    return n === 2 ? tr('决赛', 'FINAL', '決勝') : n === 4 ? tr('半决赛', 'SEMIFINALS', '準決勝') : n === 8 ? tr('八强赛', 'QUARTERFINALS', '準々決勝') : tr(n + ' 强赛', 'ROUND OF ' + n, n + ' 強');
  };
  const statusName = (match, cup) => ({waiting:tr('等待晋级', 'Awaiting winners', '進出待ち'), ready:tr('即将开赛', 'Up next', '開始待ち'),
    running:cup.status === 'paused' ? tr('已暂停', 'Paused', '一時停止') : tr('进行中', 'LIVE', '対戦中'),
    complete:tr('已结束', 'Finished', '終了'), bye:tr('轮空晋级', 'Bye', '不戦勝'), error:tr('需要重赛', 'Retry needed', '再試合が必要')})[match.status];
  const countLabel = n => tr(n + ' 名机器人', n + ' robots', n + ' 体のロボット');

  function create(host) {
    const node = document.getElementById('tournament-screen'), dock = document.getElementById('tournament-viewer-bar');
    const repository = new root.DuelTournamentStorage.Repository();
    const unsaved = new Map();
    let cup = null, stage = 'setup', visible = false, setupTab = 'roster', arenaTab = 'bracket', filter = 'all';
    let zoom = 'fit', selectedMatch = null, timer = null, playTimer = null, seekToken = 0, view = null;
    let renderedStatus = '', lastPaint = 0, lastViewPaint = 0, interactionUntil = 0, saveError = '', savedAt = 0, saving = false;
    let savedRevision = -1, saveQueue = Promise.resolve(), history = [], loading = true, navigationBusy = false;
    let draft = {count:16, seed:freshSeed(), name:'', deckIds:[], pool:'all', duplicates:true, concurrency:4, pace:'fast', difficulty:'standard'};
    try { const saved = JSON.parse(localStorage.getItem('duel-sanctuary-tournament-setup-v1') || 'null'); if (saved) draft = {...draft, ...saved}; } catch {}
    if (!Number.isInteger(draft.count) || draft.count < 2 || draft.count > 64) draft.count = 16;

    function deckName(spec) { return I.deck(spec)?.name || spec?.name || ''; }
    function name(entrant, source = cup) {
      if (!entrant) return tr('等待晋级者', 'Awaiting winner', '勝者待ち');
      const base = deckName(source.data.decks[entrant.deckId]);
      return base + (entrant.copy ? tr(' ' + entrant.copy + '号', ' #' + entrant.copy, ' ' + entrant.copy + '号') : '');
    }
    function available() { return Decks.list(); }
    function pool() { return available().filter(d => draft.pool === 'custom' ? d.custom : draft.pool === 'preset' ? d.preset : true); }
    function saveDraft() { try { localStorage.setItem('duel-sanctuary-tournament-setup-v1', JSON.stringify(draft)); } catch {} }
    function ensureRoster() {
      const decks = available();
      if (!Array.isArray(draft.deckIds)) draft.deckIds = [];
      draft.deckIds = draft.deckIds.filter(id => decks.some(d => d.id === id)).slice(0, draft.count);
      if (draft.deckIds.length < draft.count) {
        const fill = T.randomRoster(pool().length ? pool() : decks, draft.count, draft.seed, true);
        while (draft.deckIds.length < draft.count) draft.deckIds.push(fill[draft.deckIds.length]);
      }
      saveDraft();
    }
    function option(value, label, current) { return '<option value="' + esc(value) + '"' + (String(value) === String(current) ? ' selected' : '') + '>' + esc(label) + '</option>'; }
    function deckOptions(current) {
      const list = available();
      return [[false, tr('本地预设', 'Local presets', 'プリセット')], [true, tr('我的自定义卡组', 'My custom decks', '自作デッキ')]].map(([custom, title]) =>
        '<optgroup label="' + title + '">' + list.filter(d => !!d.custom === custom).map(d => option(d.id, deckName(d), current)).join('') + '</optgroup>').join('');
    }
    function paceOptions(current) { return [['normal', tr('沉浸 · 逐步对决', 'Immersive', 'じっくり')], ['fast', tr('快速 · 推荐', 'Fast · recommended', '高速・おすすめ')], ['turbo', tr('极速 · 快速决出冠军', 'Turbo', '最速')]].map(([v, label]) => option(v, label, current)).join(''); }
    function concurrencyOptions(current) { return [1, 2, 4, 8].map(n => option(n, n === 1 ? tr('串行 · 一场接一场', 'Sequential · one match', '順番に1試合ずつ') : tr('并行 · ' + n + ' 场同时', 'Parallel · ' + n + ' matches', n + ' 試合同時'), current)).join(''); }
    function rules() {
      return '<details class="t-rules"><summary>' + symbol('book') + tr('赛制与保存说明', 'Rules & saves', 'ルールと保存') + '</summary><div><p>' + tr('单败淘汰，每场胜者晋级；人数不是 2 的幂时，自动均匀分配轮空。机器人猜拳决定先后手，每场重新洗牌。', 'Single elimination. Byes fill uneven brackets. Each duel starts with seeded rock-paper-scissors and a fresh shuffle.', 'シングルエリミネーション。不足枠は均等に不戦勝を配置。毎試合じゃんけんで先攻を決め、シャッフルします。') + '</p><p>' + tr('平局最多重赛 2 次。单局超过 160 回合或达到 2,400 步时，按 LP、累计伤害、赛前种子抽签依次裁定；裁定会明确标记。异常场次保留录像，可重赛，其余同轮比赛继续。', 'Draws are replayed up to twice. At 160 turns or 2,400 actions, LP, damage, then a seeded draw break ties. Adjudicated results are labeled. Failed matches keep their recordings and can be retried.', '引き分けは2回まで再試合。160ターンまたは2,400手でLP、与ダメージ、シード抽選の順に判定し、判定結果を明記します。エラー時は記録を保持して再試合できます。') + '</p><p>' + tr('赛事、卡组快照和全部录像保存在当前浏览器，独立于普通决斗。刷新后暂停恢复；清理浏览器数据会移除存档，可导出 JSON 长期保留并重新导入。', 'Events, deck snapshots and full recordings are saved in this browser, separately from your regular duel. Reloading restores a paused event. Export JSON before clearing browser data; it can be imported later.', '大会・デッキ構成・全リプレイを通常デュエルとは別にブラウザへ保存。再読込後は一時停止で復帰します。ブラウザデータの削除前にJSONを書き出してください。') + '</p></div></details>';
    }
    function saveNotice() {
      return saveError ? '<div class="t-save-error" role="alert">' + symbol('shield') + '<span>' + tr('赛事尚未保存。请导出备份。', 'Event not saved. Export a backup.', '未保存です。バックアップを書き出してください。') + '<small>' + esc(saveError) + '</small></span><button data-t-action="export">' + tr('导出备份', 'Export backup', '書き出す') + '</button><button data-t-action="save">' + tr('重试保存', 'Retry save', '再保存') + '</button></div>' : '';
    }
    function renderSetup() {
      ensureRoster();
      const list = available(), custom = list.filter(d => d.custom).length, rounds = Math.ceil(Math.log2(draft.count));
      const names = new Map(), seen = new Map();
      draft.deckIds.forEach(id => { const d = list.find(d => d.id === id); names.set(d.name, (names.get(d.name) || 0) + 1); });
      const roster = draft.deckIds.map((id, index) => {
        const d = list.find(d => d.id === id), copyNumber = (seen.get(d.name) || 0) + 1; seen.set(d.name, copyNumber);
        const label = deckName(d) + (names.get(d.name) > 1 ? tr(' ' + copyNumber + '号', ' #' + copyNumber, ' ' + copyNumber + '号') : '');
        return '<article class="t-seat"><div class="t-seat-top"><span>BOT ' + String(index + 1).padStart(2, '0') + '</span><small class="' + (d.custom ? 'is-custom' : '') + '">' + (d.custom ? tr('自定义', 'CUSTOM', '自作') : tr('预设', 'PRESET', '標準')) + '</small></div><div class="t-seat-identity">' + Art.html(d.ace, 't-seat-art') + '<div><strong title="' + esc(label) + '">' + '<span class="t-name-main">' + esc(deckName(d)) + '</span>' + (names.get(d.name) > 1 ? '<b class="t-copy-no">' + tr(' ' + copyNumber + '号', ' #' + copyNumber, ' ' + copyNumber + '号') + '</b>' : '') + '</strong><small>' + d.cards.length + ' + ' + d.extra.length + ' · ' + esc(I.text(d.mechanic || tr('自由构筑', 'Custom build', '自由構築'))) + '</small></div></div><label class="t-sr" for="t-seat-' + index + '">' + tr('席位 ' + (index + 1) + ' 的卡组', 'Deck for seat ' + (index + 1), '席 ' + (index + 1) + ' のデッキ') + '</label><select id="t-seat-' + index + '" data-t-field="seat" data-seat="' + index + '">' + deckOptions(id) + '</select></article>';
      }).join('');
      node.innerHTML = '<div class="t-page t-setup"><div class="t-topline"><span><i></i> SANCTUARY / BOT ARENA</span><button data-t-action="history">' + symbol('history') + tr('赛事档案', 'Event archive', '大会履歴') + '</button></div><header class="t-hero"><div><span class="t-eyebrow">SINGLE ELIMINATION · LAST BOT STANDING</span><h1>' + tr('让卡组，<br>争夺最后的王座。', 'One bracket.<br>One last bot standing.', '最後の王座を、<br>そのデッキで。') + '</h1><p>' + tr('召集你的机器人，抽签、交锋、晋级。<br>每一次逆转，都有迹可循。', 'Gather your bots. Draw the bracket. Follow every duel.<br>Every comeback has a replay.', 'ロボットを集め、組み合わせを決め、勝ち進む。<br>すべての逆転をリプレイに。') + '</p><div class="t-hero-tags"><span>' + tr('2–64 人自由配置', '2–64 contenders', '2〜64体で開催') + '</span><span>' + tr('实时晋级图', 'Live bracket', 'リアルタイム対戦表') + '</span><span>' + tr('完整录像', 'Full replays', '完全リプレイ') + '</span></div></div><div class="t-hero-emblem">' + trophy + '<span>THE LAST BOT</span><small>' + countLabel(draft.count) + ' / ' + tr('一个冠军', 'ONE CHAMPION', '王者は1体') + '</small></div></header>' + saveNotice() + '<div class="t-setup-layout"><aside class="t-panel t-config"><div class="t-section-heading"><span class="t-section-number">01</span><h2>' + tr('定义你的赛事', 'Make it your tournament', '大会を設定') + '</h2></div><label class="t-field-label" for="t-name">' + tr('赛事名称', 'Event name', '大会名') + '</label><input id="t-name" data-t-field="name" maxlength="60" value="' + esc(draft.name) + '" placeholder="' + tr('机器人死斗大会', 'Last Bot Standing', 'ロボット決闘大会') + '"><label class="t-field-label" for="t-count">' + tr('参赛机器人', 'Contenders', '参加数') + '</label><div class="t-count-row">' + [4, 8, 16, 32, 64].map(n => '<button data-t-action="count" data-value="' + n + '" class="' + (draft.count === n ? 'active' : '') + '" aria-pressed="' + (draft.count === n) + '">' + n + '</button>').join('') + '</div><div class="t-custom-count"><span>' + tr('自定义人数', 'Custom count', '任意の人数') + '</span><input id="t-count" data-t-field="count" type="number" min="2" max="64" step="1" value="' + draft.count + '"><small>2–64</small></div><label class="t-field-label" for="t-pool">' + tr('随机卡组池', 'Random deck pool', '抽選するデッキ') + '</label><select id="t-pool" data-t-field="pool">' + option('all', tr('全部本地卡组', 'All local decks', '全ローカルデッキ') + ' · ' + list.length, draft.pool) + option('preset', tr('仅预设卡组', 'Presets only', 'プリセットのみ'), draft.pool) + option('custom', tr('仅自定义卡组', 'Custom decks only', '自作デッキのみ') + ' · ' + custom, draft.pool) + '</select><label class="t-checkbox"><input type="checkbox" data-t-field="duplicates"' + (draft.duplicates ? ' checked' : '') + '><span>' + tr('允许重复卡组，自动编号', 'Allow duplicates with bot numbers', '同じデッキを許可し、自動採番') + '</span></label><label class="t-field-label" for="t-concurrency">' + tr('比赛调度', 'Match scheduling', '試合の進行') + '</label><select id="t-concurrency" data-t-field="concurrency">' + concurrencyOptions(draft.concurrency) + '</select><label class="t-field-label" for="t-pace">' + tr('对决节奏', 'Duel pace', '進行速度') + '</label><select id="t-pace" data-t-field="pace">' + paceOptions(draft.pace) + '</select><details class="t-advanced"><summary>' + tr('更多设置', 'More settings', '詳細設定') + '</summary><label class="t-field-label" for="t-seed">' + tr('抽签种子', 'Draw seed', '抽選シード') + '</label><input id="t-seed" data-t-field="seed" type="number" min="1" max="4294967295" value="' + draft.seed + '"><p>' + tr('相同种子与卡组池，可复现随机名单。', 'Same seed and pool reproduce the roster.', '同じシードとデッキプールで名簿を再現できます。') + '</p><label class="t-field-label" for="t-difficulty">' + tr('机器人难度', 'Bot difficulty', '難易度') + '</label><select id="t-difficulty" data-t-field="difficulty">' + option('standard', tr('标准', 'Standard', '標準'), draft.difficulty) + option('casual', tr('休闲', 'Casual', 'カジュアル'), draft.difficulty) + '</select></details><button class="t-button t-random-button" data-t-action="random">' + symbol('refresh') + tr('随机填满席位', 'Randomize roster', 'ランダムに選ぶ') + '</button></aside><section class="t-panel t-roster-panel"><div class="t-roster-heading"><div class="t-section-heading"><span class="t-section-number">02</span><div><h2>' + tr('你的参赛阵容', 'Your contenders', '参加ロボット') + '</h2><p>' + tr('每个席位均可指定卡组，包括你保存的自定义构筑。', 'Choose any local or saved custom deck for each seat.', '各席にプリセットまたは保存済みの自作デッキを指定できます。') + '</p></div></div><button class="t-text-button" data-t-action="shuffle">' + symbol('refresh') + tr('打乱签位', 'Shuffle seats', '席順をシャッフル') + '</button></div><div class="t-tabs" role="tablist">' + [['roster', tr('参赛席位', 'Roster', '参加者')], ['preview', tr('对阵预览', 'Bracket preview', '組み合わせ')]].map(([v, label]) => '<button role="tab" aria-selected="' + (setupTab === v) + '" class="' + (setupTab === v ? 'active' : '') + '" data-t-action="setup-tab" data-value="' + v + '">' + label + '</button>').join('') + '<span>' + countLabel(draft.count) + '</span></div>' + (setupTab === 'roster' ? '<div class="t-roster-grid">' + roster + '</div>' : '<div class="t-preview-chart">' + chartHTML(T.create({...draft, name:draft.name || tr('机器人死斗大会', 'Last Bot Standing', 'ロボット決闘大会')})) + '</div>') + '<footer class="t-roster-footer"><div><strong>' + tr(draft.count + ' 人入场 · ' + (draft.count - 1) + ' 场定胜负', draft.count + ' bots · ' + (draft.count - 1) + ' decisive matches', draft.count + ' 体・' + (draft.count - 1) + ' 試合') + '</strong><span>' + tr(rounds + ' 轮淘汰，最后一位加冕。', rounds + ' rounds. One champion.', rounds + ' ラウンドを勝ち抜き、王者へ。') + (2 ** rounds !== draft.count ? tr(' 自动安排轮空。', ' Byes included.', ' 不戦勝を自動配置。') : '') + '</span></div><button class="t-button t-primary" data-t-action="start">' + tr('开始死斗', 'Start tournament', '大会を開始') + symbol('arrow') + '</button></footer></section></div>' + rules() + '</div>';
      Art.refresh(node); fitChart();
    }

    function chartLayout(source) {
      const levels = Math.log2(source.data.size) - 1, width = 188, step = 226, columns = Math.max(1, levels * 2 + 1);
      const area = Math.max(248, source.data.size / 4 * 112), top = 52, positions = new Map();
      for (const match of source.matches) {
        const count = source.data.size / 2 ** (match.round + 1), final = count === 1, right = !final && match.index >= count / 2;
        const local = right ? match.index - count / 2 : match.index;
        positions.set(match.id, {x:(final ? levels : right ? columns - 1 - match.round : match.round) * step,
          y:top + (final ? area / 2 : (local + .5) * area / (count / 2)) - 43, width, height:86, right});
      }
      return {positions, width:(columns - 1) * step + width, height:top + area + 74, levels, columns, step};
    }
    function matchContent(match, source) {
      const game = match.games.at(-1), state = source.engines.get(match.id)?.state || game?.final?.state || game?.current?.state;
      return '<span class="t-match-heading"><small>' + (match.round === Math.log2(source.data.size) - 1 ? tr('冠军战', 'TITLE MATCH', '王座決定戦') : 'M' + String(source.matches.indexOf(match) + 1).padStart(2, '0')) + '</small><span class="t-match-state ' + match.status + '">' + (match.status === 'running' && source.status === 'running' ? '<i></i>' : '') + statusName(match, source) + '</span></span>' + match.entrants.map((id, side) => {
        const p = source.participant(id), deck = p && source.data.decks[p.deckId], won = id && match.winnerId === id;
        return '<span class="t-entrant' + (won ? ' winner' : match.winnerId && id ? ' eliminated' : !id ? ' empty' : '') + '"><small class="t-seed">' + (p ? String(p.seed).padStart(2, '0') : '—') + '</small>' + (p ? Art.html(deck.ace, 't-bracket-art') : '<span class="t-unknown">?</span>') + '<strong title="' + esc(name(p, source)) + '">' + (match.status === 'bye' && !id ? tr('轮空席位', 'BYE', '空き枠') : esc(p ? deckName(deck) : name(p, source))) + '</strong>' + (p?.copy ? '<b class="t-copy-no">' + tr(p.copy + '号', '#' + p.copy, p.copy + '号') + '</b>' : '') + '<span class="t-score">' + (won ? '✓' : state ? number(state.players[side].lp) : '—') + '</span></span>';
      }).join('');
    }
    function chartHTML(source) {
      const layout = chartLayout(source), positions = layout.positions, final = source.matches.at(-1), finalPos = positions.get(final.id);
      let paths = '', labels = '';
      for (const match of source.matches) for (const id of match.sources) {
        const from = positions.get(id), to = positions.get(match.id), forward = from.x < to.x;
        const x1 = from.x + (forward ? from.width : 0), x2 = to.x + (forward ? 0 : to.width), y1 = from.y + 43, y2 = to.y + 43, middle = (x1 + x2) / 2;
        const resolved = source.match(id).winnerId;
        paths += '<path class="' + (resolved ? 'resolved' : '') + '" d="M' + x1 + ',' + y1 + 'H' + middle + 'V' + y2 + 'H' + x2 + '"/>';
      }
      for (let col = 0; col < layout.columns; col++) {
        const round = col <= layout.levels ? col : layout.columns - col - 1;
        labels += '<div class="t-round-label' + (round === layout.levels ? ' final' : '') + '" style="left:' + (col * layout.step) + 'px;width:188px">' + roundName(source.data.size, round) + '<small>' + (round === layout.levels ? 'GRAND FINAL' : 'ROUND ' + (round + 1)) + '</small></div>';
      }
      const champion = source.participant(source.data.championId);
      return '<div class="t-chart-scroll" id="t-chart-scroll" tabindex="0" aria-label="' + tr('淘汰赛晋级图，可横向与纵向滚动', 'Elimination bracket, scroll in either direction', 'トーナメント表。縦横にスクロール可能') + '"><div class="t-chart-size" data-width="' + layout.width + '" data-height="' + layout.height + '"><div class="t-chart-canvas" style="width:' + layout.width + 'px;height:' + layout.height + 'px"><svg class="t-connectors" width="' + layout.width + '" height="' + layout.height + '" aria-hidden="true">' + paths + '</svg>' + labels + '<div class="t-bracket-crown' + (champion ? ' crowned' : '') + '" style="left:' + finalPos.x + 'px;top:' + (finalPos.y - 117) + 'px">' + trophy + '</div>' + source.matches.map(match => {
        const p = positions.get(match.id);
        return '<button class="t-match ' + match.status + (match.id === selectedMatch ? ' selected' : '') + '" data-t-action="match" data-match="' + match.id + '" style="left:' + p.x + 'px;top:' + p.y + 'px" aria-label="' + esc(roundName(source.data.size, match.round) + ' · ' + match.entrants.map(id => name(source.participant(id), source)).join(' VS ') + ' · ' + statusName(match, source)) + '">' + matchContent(match, source) + '</button>';
      }).join('') + '<div class="t-champion-caption" style="left:' + finalPos.x + 'px;top:' + (finalPos.y + 103) + 'px"><small>' + (champion ? 'CHAMPION' : 'ONE WILL REMAIN') + '</small><strong>' + (champion ? esc(name(champion, source)) : tr('王座，虚位以待。', 'The throne awaits.', '王座は勝者を待つ。')) + '</strong></div></div></div></div>';
    }
    function fitChart() {
      const scroll = node.querySelector('.t-chart-scroll'), size = node.querySelector('.t-chart-size');
      if (!scroll || !size) return;
      const w = Number(size.dataset.width), h = Number(size.dataset.height), narrow = innerWidth < 760;
      const ratio = zoom === 'fit' ? Math.min(1, Math.max(narrow ? .82 : .42, Math.min((scroll.clientWidth - 28) / w, (Math.max(300, innerHeight - (stage === 'setup' ? 280 : 325))) / h))) : zoom;
      size.style.width = w * ratio + 'px'; size.style.height = h * ratio + 'px';
      size.firstElementChild.style.transform = 'scale(' + ratio + ')';
      const label = node.querySelector('#t-zoom-label'); if (label) label.textContent = Math.round(ratio * 100) + '%';
      size.dataset.scale = ratio;
    }
    function liveCards() {
      let matches = cup.matches.filter(m => m.status === 'running' || m.status === 'error');
      if (!matches.length) matches = [...cup.matches].reverse().filter(m => m.status === 'complete').slice(0, 4).reverse();
      if (!matches.length) return '<div class="t-live-empty">' + symbol('swords') + '<p>' + tr('开赛后，这里会显示每一场正在进行的决斗。', 'Live duels will appear here when the tournament starts.', '開始すると進行中の試合がここに表示されます。') + '</p></div>';
      const active = new Set(cup.eligible().map(m => m.id));
      return matches.slice(0, 8).map(match => {
        const game = match.games.at(-1), s = cup.engines.get(match.id)?.state || game?.final?.state || game?.current?.state;
        const status = match.status === 'running' && !active.has(match.id) ? tr('等待调度', 'On hold', '待機中') : statusName(match, cup);
        return '<article class="t-live-card ' + match.status + '"><header><span>' + roundName(cup.data.size, match.round) + ' · M' + String(cup.matches.indexOf(match) + 1).padStart(2, '0') + '</span><small>' + status + '</small></header>' + match.entrants.map((id, side) => {
          const p = cup.participant(id), spec = cup.data.decks[p.deckId], lp = s?.players[side].lp ?? 8000;
          return '<div class="t-live-player">' + Art.html(spec.ace, 't-live-art') + '<div><strong>' + esc(name(p)) + (match.winnerId === p.id ? '<b> ✓</b>' : '') + '</strong><div class="t-mini-lp"><i style="width:' + Math.max(0, Math.min(100, lp / 80)) + '%"></i></div></div><span>' + number(lp) + '<small>LP</small></span></div>';
        }).join('') + '<footer><span>TURN ' + String(s?.turn || 1).padStart(2, '0') + (game?.verdict && game.verdict.kind !== 'normal' ? ' · ' + tr('赛制裁定', 'ADJUDICATED', '判定') : '') + '</span><button data-t-action="' + (match.status === 'error' ? 'retry' : 'watch') + '" data-match="' + match.id + '">' + (match.status === 'error' ? tr('保留录像并重赛', 'Retry match', '記録を残して再試合') : match.status === 'complete' ? tr('看录像 ↗', 'Replay ↗', 'リプレイ ↗') : tr('进入观战 ↗', 'Watch ↗', '観戦 ↗')) + '</button></footer></article>';
      }).join('');
    }
    function matchList() {
      return '<div class="t-match-filters">' + [['all', tr('全部场次', 'All matches', 'すべて')], ['running', tr('正在对决', 'Live', '対戦中')], ['complete', tr('录像回廊', 'Replays', 'リプレイ')], ['waiting', tr('等待开赛', 'Upcoming', '開始待ち')]].map(([v, label]) => '<button class="' + (filter === v ? 'active' : '') + '" data-t-action="filter" data-value="' + v + '">' + label + '</button>').join('') + '</div><div class="t-match-list">' + cup.matches.filter(m => filter === 'all' || filter === 'waiting' ? filter === 'all' || ['waiting', 'ready', 'bye'].includes(m.status) : filter === 'running' ? ['running', 'error'].includes(m.status) : m.status === filter).map(m => {
        const game = m.games.at(-1), result = game?.verdict;
        return '<article class="t-match-row"><div class="t-row-round"><b>M' + String(cup.matches.indexOf(m) + 1).padStart(2, '0') + '</b><small>' + roundName(cup.data.size, m.round) + '</small></div><div class="t-row-pair">' + m.entrants.map(id => '<strong class="' + (m.winnerId === id && id ? 'winner' : '') + '">' + (m.status === 'bye' && !id ? tr('轮空', 'BYE', '不戦勝') : esc(name(cup.participant(id)))) + '</strong>').join('<em>VS</em>') + '</div><div class="t-row-result"><span>' + statusName(m, cup) + '</span><small>' + (result && result.kind !== 'normal' ? tr('赛制裁定 · ', 'Ruling · ', '判定・') : '') + (game?.final ? 'TURN ' + game.final.state.turn : m.games.length ? tr('全程录制中', 'Recording', '記録中') : '—') + '</small></div><button class="t-button" data-t-action="watch" data-match="' + m.id + '"' + (!m.games.length ? ' disabled' : '') + '>' + (m.status === 'running' ? tr('观战', 'Watch', '観戦') : tr('录像', 'Replay', '再生')) + symbol('arrow') + '</button>' + (m.status === 'error' ? '<button class="t-text-button" data-t-action="retry" data-match="' + m.id + '">' + tr('重赛', 'Retry', '再試合') + '</button>' : '') + '</article>';
      }).join('') + '</div>';
    }
    function standings() {
      const rows = cup.data.participants.map(p => {
        const loss = cup.matches.find(m => m.status === 'complete' && m.entrants.includes(p.id) && m.winnerId !== p.id);
        const wins = cup.matches.filter(m => m.status === 'complete' && m.winnerId === p.id).length;
        const champion = cup.data.championId === p.id;
        const damage = cup.matches.reduce((total, m) => { const side = m.entrants.indexOf(p.id); return total + (side < 0 ? 0 : m.games.reduce((n, g) => n + (g.final?.state.damage[side] || 0), 0)); }, 0);
        return {p, loss, wins, champion, damage, rank:champion ? 1 : loss ? cup.data.size / 2 ** (loss.round + 1) + 1 : 0};
      }).sort((a, b) => (a.rank || 1) - (b.rank || 1) || b.wins - a.wins || a.p.seed - b.p.seed);
      return '<div class="t-standings"><table><thead><tr><th>' + tr('名次', 'Rank', '順位') + '</th><th>' + tr('参赛机器人', 'Contender', 'ロボット') + '</th><th>' + tr('胜场', 'Wins', '勝利') + '</th><th>' + tr('累计伤害', 'Damage', '与ダメージ') + '</th><th>' + tr('状态', 'Status', '状態') + '</th></tr></thead><tbody>' + rows.map(row => '<tr class="' + (row.champion ? 'champion' : '') + '"><td>' + (row.rank ? String(row.rank).padStart(2, '0') : '—') + '</td><td><div>' + Art.html(cup.data.decks[row.p.deckId].ace, 't-standing-art') + '<strong>' + esc(name(row.p)) + '</strong></div></td><td>' + row.wins + '</td><td>' + number(row.damage) + '</td><td><span class="' + (row.champion ? 't-gold' : row.loss ? 't-muted' : 't-teal') + '">' + (row.champion ? tr('冠军', 'CHAMPION', '優勝') : row.loss ? tr('已淘汰', 'Eliminated', '敗退') : tr('仍在征途', 'Contending', '勝ち残り')) + '</span></td></tr>').join('') + '</tbody></table></div>';
    }
    function selectionPanel() {
      const m = cup.match(selectedMatch);
      if (!m || m.games.length) return '';
      return '<div class="t-selection-note"><strong>' + m.entrants.map(id => esc(name(cup.participant(id)))).join(' <em>VS</em> ') + '</strong><p>' + (m.status === 'bye' ? tr('本签位轮空，自动进入下一轮。轮空不计为胜场。', 'A bye advances automatically and does not count as a played win.', '不戦勝で次のラウンドへ進みます。勝利数には含めません。') : tr('该场次尚未开赛。胜者确定后自动入场，开赛即可观战与回看。', 'This match has not started. Qualifiers enter automatically; live viewing and replay become available at kickoff.', '開始前の試合です。進出者が決まると自動入場し、開始後に観戦・再生できます。')) + '</p></div>';
    }
    function renderArena() {
      if (!cup) { renderSetup(); return; }
      const p = cup.progress(), champion = cup.participant(cup.data.championId), paused = cup.status !== 'running';
      renderedStatus = cup.status;
      node.innerHTML = '<div class="t-page t-arena-page"><div class="t-topline"><span><i class="' + (paused ? 'paused' : '') + '"></i> BOT ARENA / ' + (cup.status === 'completed' ? 'TOURNAMENT COMPLETE' : paused ? 'PAUSED' : 'LIVE TOURNAMENT') + '</span><div><span class="t-save-label" id="t-save-label">' + tr('独立赛事存档', 'Separate event save', '大会専用セーブ') + '</span><button data-t-action="history">' + symbol('history') + tr('赛事档案', 'Archive', '履歴') + '</button></div></div><header class="t-arena-heading"><div class="t-arena-title"><span class="t-mini-trophy">' + trophy + '</span><div><span class="t-eyebrow">' + countLabel(cup.data.participants.length) + ' · SINGLE ELIMINATION</span><h1>' + esc(cup.data.name) + '</h1><p>' + (champion ? tr('王者诞生 · ', 'Crowned champion · ', '王者誕生・') + '<strong class="t-gold">' + esc(name(champion)) + '</strong>' : tr('每一条晋级线，都由真实的决斗写下。', 'Every path is earned in a real duel.', 'すべての進出は、実際のデュエルで決まる。')) + '</p></div></div><div class="t-arena-actions"><button class="t-button" data-t-action="new">' + symbol('spark') + tr('新建赛事', 'New event', '新しい大会') + '</button><button class="t-button" data-t-action="export">' + symbol('download') + tr('导出赛事', 'Export', '書き出す') + '</button>' + (cup.status !== 'completed' ? '<button class="t-button t-primary" data-t-action="toggle">' + symbol(paused ? 'arrow' : 'clock') + (paused ? tr('继续比赛', 'Resume event', '大会を再開') : tr('暂停赛事', 'Pause event', '大会を一時停止')) + '</button>' : '<button class="t-button t-primary" data-t-action="watch-final">' + symbol('eye') + tr('重温决赛', 'Watch the final', '決勝を再生') + '</button>') + '</div></header>' + saveNotice() + '<div class="t-event-summary"><div><small>' + tr('已完成', 'COMPLETED', '終了') + '</small><strong><b data-t-stat="played">' + p.played + '</b><em> / ' + p.total + '</em></strong></div><div><small>' + tr('仍在征途', 'CONTENDERS', '勝ち残り') + '</small><strong data-t-stat="remaining">' + p.remaining + '</strong></div><div><small>' + tr('正在对决', 'IN PROGRESS', '対戦中') + '</small><strong data-t-stat="live">' + p.live + '</strong></div><div class="t-event-progress"><span><b>' + tr('通往王座', 'PATH TO THE THRONE', '王座への道') + '</b><small data-t-stat="percent">' + Math.round(p.played / p.total * 100) + '%</small></span><div><i id="t-progress-fill" style="width:' + p.played / p.total * 100 + '%"></i></div></div></div><div class="t-panel t-bracket-panel"><div class="t-arena-toolbar"><div class="t-tabs" role="tablist">' + [['bracket', tr('晋级图', 'Bracket', '対戦表')], ['matches', tr('全部比赛与录像', 'Matches & replays', '試合・リプレイ')], ['standings', tr('选手榜', 'Standings', '成績')]].map(([v, label]) => '<button role="tab" aria-selected="' + (arenaTab === v) + '" data-t-action="arena-tab" data-value="' + v + '" class="' + (arenaTab === v ? 'active' : '') + '">' + label + '</button>').join('') + '</div><div class="t-run-settings"><label><span>' + tr('调度', 'Schedule', '進行') + '</span><select data-t-field="run-concurrency" aria-label="' + tr('比赛调度', 'Match scheduling', '試合の進行') + '">' + concurrencyOptions(cup.data.settings.concurrency) + '</select></label><label><span>' + tr('节奏', 'Pace', '速度') + '</span><select data-t-field="run-pace" aria-label="' + tr('对决节奏', 'Duel pace', '進行速度') + '">' + paceOptions(cup.data.settings.pace) + '</select></label></div></div><div id="t-arena-content">' + (arenaTab === 'bracket' ? '<div class="t-chart-toolbar"><div class="t-legend"><span><i></i>' + tr('待开赛', 'Upcoming', '開始前') + '</span><span><i class="live"></i>' + tr('对决中', 'Live', '対戦中') + '</span><span><i class="winner"></i>' + tr('已晋级', 'Advanced', '進出') + '</span></div><div class="t-zoom"><button data-t-action="zoom-out" aria-label="' + tr('缩小晋级图', 'Zoom out', '縮小') + '">−</button><span id="t-zoom-label">100%</span><button data-t-action="zoom-in" aria-label="' + tr('放大晋级图', 'Zoom in', '拡大') + '">＋</button><button data-t-action="fit">' + tr('全图', 'Fit', '全体') + '</button><button data-t-action="focus-final">' + tr('定位决赛', 'Find final', '決勝へ') + '</button></div></div>' + chartHTML(cup) + '<div class="t-chart-hint">' + symbol('eye') + tr('滚动查看全图 · 点击任一场比赛，进入观战或录像', 'Scroll to explore · Select a match to watch live or replay', 'スクロールで全体を確認・試合を選択して観戦または再生') + '</div>' + selectionPanel() : arenaTab === 'matches' ? matchList() : standings()) + '</div></div><section class="t-live-section"><div class="t-section-heading"><span class="t-section-number">LIVE</span><div><h2>' + (cup.status === 'completed' ? tr('值得重温的对决', 'Duels worth revisiting', 'もう一度見たい対決') : tr('多路直播台', 'Around the arenas', '各会場のライブ')) + '</h2><p>' + tr('切换战场、查看过去，赛事始终独立推进。', 'Switch arenas or revisit a moment. The event keeps its own pace.', '会場の切り替えや過去の再生中も、大会は独立して進行します。') + '</p></div></div><div class="t-live-grid" id="t-live-grid">' + liveCards() + '</div></section>' + rules() + '</div>';
      Art.refresh(node); fitChart(); paintSave();
    }
    function paintSave() {
      const el = node.querySelector('#t-save-label');
      if (el) el.textContent = saveError ? tr('尚未保存', 'Not saved', '未保存') : saving ? tr('正在保存…', 'Saving…', '保存中…') : savedAt ? tr('赛事已自动保存', 'Event autosaved', '自動保存済み') : tr('独立赛事存档', 'Separate event save', '大会専用セーブ');
    }
    function refresh() {
      updateHome();
      if (!visible || stage !== 'arena' || !cup) return;
      if (renderedStatus !== cup.status) { renderArena(); return; }
      const p = cup.progress();
      for (const key of ['played', 'remaining', 'live']) { const el = node.querySelector('[data-t-stat="' + key + '"]'); if (el) el.textContent = p[key]; }
      const percent = node.querySelector('[data-t-stat="percent"]'); if (percent) percent.textContent = Math.round(p.played / p.total * 100) + '%';
      const fill = node.querySelector('#t-progress-fill'); if (fill) fill.style.width = p.played / p.total * 100 + '%';
      if (arenaTab === 'bracket') {
        for (const match of cup.matches) {
          const el = node.querySelector('.t-match[data-match="' + match.id + '"]'); if (!el) continue;
          const html = matchContent(match, cup);
          if (el.innerHTML !== html) el.innerHTML = html;
          el.className = 't-match ' + match.status + (match.id === selectedMatch ? ' selected' : '');
          el.setAttribute('aria-label', roundName(cup.data.size, match.round) + ' · ' + match.entrants.map(id => name(cup.participant(id))).join(' VS ') + ' · ' + statusName(match, cup));
        }
        const paths = node.querySelectorAll('.t-connectors path'); let i = 0;
        for (const m of cup.matches) for (const source of m.sources) paths[i++]?.classList.toggle('resolved', !!cup.match(source).winnerId);
      } else if (!node.contains(document.activeElement) || !document.activeElement.matches('button')) {
        const content = node.querySelector('#t-arena-content'); if (content) content.innerHTML = arenaTab === 'matches' ? matchList() : standings();
      }
      const live = node.querySelector('#t-live-grid'); if (live && !live.contains(document.activeElement)) live.innerHTML = liveCards();
      Art.refresh(node); paintSave();
    }
    function updateHome() {
      const el = document.getElementById('home-tournament-status');
      if (el) el.textContent = cup ? cup.status === 'completed' ? tr('冠军已诞生 · 查看录像', 'Champion crowned · replays', '王者誕生・リプレイ') : tr('继续赛事 · ', 'Continue event · ', '大会を再開・') + cup.progress().played + '/' + cup.progress().total : tr('16 强死斗 · 自由配置', '16-bot knockout · configurable', '16体の決闘・自由設定');
    }
    function render() {
      updateHome();
      if (!visible) return;
      node.setAttribute('aria-label', tr('死斗竞技场', 'Bot Arena', 'ロボット闘技場'));
      if (loading) { node.innerHTML = '<div class="t-loading">' + trophy + '<p>' + tr('正在读取赛事档案…', 'Opening the event archive…', '大会履歴を読み込み中…') + '</p></div>'; return; }
      if (stage === 'history') renderHistory(); else if (stage === 'setup') renderSetup(); else renderArena();
    }
    async function flush() {
      if (!cup) return;
      const model = cup, revision = model.revision, data = model.snapshot();
      if (savedRevision === revision && !saveError) return saveQueue;
      saving = true; paintSave();
      saveQueue = saveQueue.catch(() => {}).then(() => repository.save(data)).then(() => {
        unsaved.delete(data.id);
        if (cup === model) { savedRevision = revision; savedAt = Date.now(); saveError = ''; }
      }).catch(error => {
        unsaved.set(data.id, data);
        const first = !saveError; saveError = error.message || String(error);
        if (first) { host.toast(tr('赛事暂未保存，请导出备份。', 'Event could not be saved. Export a backup.', '保存できません。バックアップを書き出してください。'), true); render(); }
      }).finally(() => { saving = false; paintSave(); });
      return saveQueue;
    }
    function schedule() {
      clearTimeout(timer);
      if (!cup || cup.status !== 'running') return;
      const pace = cup.data.settings.pace;
      timer = setTimeout(() => {
        if (!cup || cup.status !== 'running') return;
        cup.advance(pace === 'turbo' ? 24 : 1, pace === 'turbo' ? 12 : Infinity);
        const now = Date.now();
        if (view && now - lastViewPaint > 150) { if (view.live) syncLive(); else renderBoardTools(); lastViewPaint = now; }
        if (now - lastPaint > 260 || cup.status !== 'running') { refresh(); lastPaint = now; }
        if (cup.status !== 'running') { if (view?.live) syncLive(true); else if (view) renderBoardTools(); flush(); }
        schedule();
      }, pace === 'normal' ? 540 : pace === 'fast' ? 110 : 8);
    }
    async function start() {
      ensureRoster();
      if (!draft.duplicates && new Set(draft.deckIds).size !== draft.count) throw new Error(tr('当前阵容包含重复卡组，请允许重复或重新抽签。', 'The roster has duplicate decks. Enable duplicates or redraw.', '重複があります。重複を許可するか、再抽選してください。'));
      cup = T.create({...draft, name:draft.name || tr('机器人死斗大会', 'Last Bot Standing', 'ロボット決闘大会')});
      savedRevision = -1; stage = 'arena'; arenaTab = 'bracket'; selectedMatch = null; zoom = 'fit';
      cup.resume(); render(); node.scrollTop = 0; schedule(); await flush();
    }
    async function show() { visible = true; render(); await ready; if (visible) render(); }
    function hide() { visible = false; }
    async function renderHistoryData() {
      try { history = await repository.list(); } catch (error) { if (!unsaved.size) throw error; history = []; }
      for (const data of unsaved.values()) {
        history = history.filter(item => item.id !== data.id);
        history.push({id:data.id, name:data.name, updatedAt:data.updatedAt, status:data.status, count:data.participants.length,
          played:data.matches.filter(m => m.status === 'complete').length, champion:data.participants.find(p => p.id === data.championId)?.name || ''});
      }
      history.sort((a,b) => b.updatedAt - a.updatedAt); stage = 'history'; render();
    }
    function renderHistory() {
      node.innerHTML = '<div class="t-page t-history-page"><div class="t-topline"><button data-t-action="back">← ' + tr('返回竞技场', 'Back to arena', '会場へ戻る') + '</button><span>TOURNAMENT ARCHIVE</span></div><header class="t-history-heading"><div><span class="t-eyebrow">EVERY DUEL LEAVES A TRACE</span><h1>' + tr('每一届，都值得铭记。', 'Every tournament has a story.', 'すべての大会を、記録に。') + '</h1><p>' + tr('本机保存的赛事与完整录像。选择一届，继续它的故事。', 'Saved events and full replays in this browser. Pick one to return to it.', 'このブラウザに保存された大会と全リプレイ。大会を選んで続きを。') + '</p></div><button class="t-button t-primary" data-t-action="import">' + symbol('download') + tr('导入赛事文件', 'Import event', '大会を読み込む') + '</button></header>' + saveNotice() + '<div class="t-history-grid">' + (history.length ? history.map(item => '<button class="t-history-card t-panel" data-t-action="load" data-id="' + esc(item.id) + '"><span>' + (item.status === 'completed' ? 'COMPLETED' : 'IN PROGRESS') + '<small>' + new Date(item.updatedAt).toLocaleDateString(I.language) + '</small></span><h2>' + esc(item.name) + '</h2><p>' + countLabel(item.count) + ' · ' + item.played + ' / ' + (item.count - 1) + ' ' + tr('场', 'matches', '試合') + '</p><footer><strong>' + (item.champion ? '♛ ' + esc(item.champion) : tr('冠军尚待决出', 'The throne awaits', '王者はまだ未定')) + '</strong>' + symbol('arrow') + '</footer></button>').join('') : '<div class="t-history-empty">' + trophy + '<h2>' + tr('你的第一届赛事，正在等待开幕。', 'Your first tournament awaits.', '最初の大会を開催しましょう。') + '</h2><button class="t-button" data-t-action="back">' + tr('前往组建阵容', 'Build a roster', '参加者を選ぶ') + symbol('arrow') + '</button></div>') + '</div>' + rules() + '</div>';
    }
    async function load(id) {
      if (cup) { cup.pause(); await flush(); }
      const data = unsaved.get(id) || await repository.load(id);
      if (!data) throw new Error(tr('未找到该赛事存档。', 'Event save not found.', '大会が見つかりません。'));
      const restored = T.Tournament.restore(data);
      closeViewer(); cup = restored; savedRevision = -1; stage = 'arena'; arenaTab = 'bracket'; zoom = 'fit';
      selectedMatch = null; render(); await flush();
    }
    function exportEvent() {
      if (!cup) { host.toast(tr('开赛后即可导出赛事及全部录像。', 'Start an event to export its recordings.', '開始後に大会とリプレイを書き出せます。')); return; }
      const data = cup.snapshot(), blob = new Blob([JSON.stringify(data)], {type:'application/json;charset=utf-8'}), url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = '死斗赛事-' + cup.data.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') + '-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      host.toast(tr('赛事和全部录像已导出。', 'Event and recordings exported.', '大会と全リプレイを書き出しました。'));
    }
    function importEvent() {
      const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
      input.addEventListener('change', async () => {
        try {
          const file = input.files[0]; if (!file) return;
          if (file.size > T.LIMITS.fileBytes) throw new Error(tr('赛事文件不能超过 48 MiB。', 'Event files must be under 48 MiB.', '48 MiB以下のファイルを選んでください。'));
          const imported = T.Tournament.restore(JSON.parse(await file.text()));
          if (cup) { cup.pause(); await flush(); }
          imported.data.id = 'cup-import-' + Date.now().toString(36) + '-' + T.hash(imported.data.id).toString(36);
          cup = imported; savedRevision = -1; stage = 'arena'; zoom = 'fit'; selectedMatch = null;
          await flush(); render(); host.toast(tr('赛事已导入，可继续比赛或观看录像。', 'Event imported. Resume it or watch its recordings.', '読み込みました。大会の再開やリプレイ視聴ができます。'));
        } catch (error) { host.toast(error.message, true); }
      }, {once:true});
      input.click();
    }

    function currentGame() { return view && cup.match(view.matchId)?.games[view.gameIndex]; }
    function currentMatch() { return view && cup.match(view.matchId); }
    function showFrame() {
      if (!view) return;
      const match = currentMatch();
      host.frame(view.cursor.engine, {names:match.entrants.map(id => name(cup.participant(id))), live:view.live, matchId:match.id});
      renderBoardTools();
    }
    function watch(id, gameIndex, replay = false) {
      const match = cup?.match(id); if (!match?.games.length) return;
      clearTimeout(playTimer); seekToken++;
      const index = gameIndex ?? match.games.length - 1, game = match.games[index];
      view = {matchId:id, gameIndex:index, cursor:new T.ReplayCursor(game), live:!replay && index === match.games.length - 1 && match.status === 'running', playing:false, speed:view?.speed || 1, busy:false};
      visible = false;
      if (view.live) syncLive(true); else showFrame();
    }
    function syncLive(force = false) {
      if (!view?.live) return;
      if (host.modalOpen()) return;
      if (!force && Date.now() < interactionUntil) return;
      const match = currentMatch(), latest = match.games.length - 1;
      if (view.gameIndex !== latest) { view.gameIndex = latest; view.cursor = new T.ReplayCursor(match.games[latest]); }
      view.cursor.engine = root.DuelEngine.restore(cup.gameSnapshot(match.id, latest));
      view.cursor.index = currentGame().steps.length;
      if (['complete', 'error'].includes(match.status)) { view.live = false; view.playing = false; }
      showFrame();
    }
    function closeViewer() {
      seekToken++; clearTimeout(playTimer); view = null; dock.hidden = true; delete dock.dataset.viewerKey;
      for (const id of ['turn-panel', 'mobile-turn-control']) { const el = document.getElementById(id); if (el) delete el.dataset.viewerKey; }
    }
    async function seek(index) {
      if (!view) return;
      const target = view, token = ++seekToken;
      target.live = false; target.playing = false; target.busy = true; clearTimeout(playTimer); renderBoardTools();
      try {
        const engine = await target.cursor.seekAsync(index, () => token !== seekToken || view !== target);
        if (engine && view === target) { target.busy = false; showFrame(); }
      } catch (error) { if (view === target) { target.busy = false; target.playing = false; renderBoardTools(); } host.toast(error.message, true); }
    }
    function playback() {
      clearTimeout(playTimer);
      if (!view?.playing || view.live) return;
      playTimer = setTimeout(() => {
        if (!view?.playing) return;
        if (host.modalOpen()) { playback(); return; }
        try {
          if (!view.cursor.next()) { view.playing = false; renderBoardTools(); return; }
          if (view.cursor.index >= currentGame().steps.length) view.playing = false;
          showFrame(); playback();
        } catch (error) { view.playing = false; host.toast(error.message, true); renderBoardTools(); }
      }, 560 / view.speed);
    }
    function viewerToggle() {
      if (!view || view.busy) return;
      if (view.live) { view.live = false; view.playing = false; renderBoardTools(); return; }
      if (view.cursor.index >= currentGame().steps.length) view.cursor.seek(0);
      view.playing = !view.playing; showFrame(); playback();
    }
    function turnPoints() {
      const result = [{turn:currentGame().initial.state.turn, index:0}];
      currentGame().steps.forEach((step, i) => { if (step.turn !== result.at(-1).turn) result.push({turn:step.turn, index:i + 1}); });
      return result;
    }
    function verdictText(game) {
      if (game.error) return tr('该局异常，可保留录像重赛。', 'This attempt failed. Its recording is preserved.', 'エラーが発生しました。記録を残して再試合できます。');
      if (!game.verdict) return tr('完整记录每一次行动', 'Every action recorded', 'すべての行動を記録');
      const kind = game.verdict.kind;
      return kind === 'normal' ? I.text(game.verdict.reason || '') : kind === 'draw' ? tr('平局 · 自动重赛', 'Draw · rematch', '引き分け・再試合') : tr('赛制裁定 · ', 'Adjudicated · ', '規定判定・') + I.text(game.verdict.reason);
    }
    function renderBoardTools() {
      if (!view) { dock.hidden = true; return; }
      dock.hidden = false;
      const match = currentMatch(), game = currentGame(), cursor = view.cursor, total = game.steps.length, state = cursor.engine.state;
      const recorded = cup.matches.filter(m => m.games.length), points = turnPoints(), currentTurn = points.filter(p => p.index <= cursor.index).at(-1);
      const atLive = match.status === 'running';
      const dockKey = match.id + ':' + view.gameIndex + ':' + match.games.length + ':' + I.language;
      if ((!view.scrubbing && dock.dataset.viewerKey !== dockKey) || !dock.querySelector('#t-replay-slider')) {
        dock.dataset.viewerKey = dockKey;
        dock.innerHTML = '<div class="t-viewer-top"><button class="t-back-arena" data-t-action="return">← <span>' + tr('赛事全景', 'Tournament', '大会へ') + '</span></button><div class="t-viewer-match"><label class="t-sr" for="t-watch-match">' + tr('切换比赛', 'Switch match', '試合を切り替え') + '</label><select id="t-watch-match" data-t-field="watch-match">' + recorded.map(m => option(m.id, roundName(cup.data.size, m.round) + ' · ' + m.entrants.map(id => name(cup.participant(id))).join(' VS '), match.id)).join('') + '</select>' + (match.games.length > 1 ? '<select class="t-attempt-select" data-t-field="attempt" aria-label="' + tr('选择重赛录像', 'Choose an attempt', '再試合を選択') + '">' + match.games.map((g, i) => option(i, tr('第 ' + (i + 1) + ' 局', 'Game ' + (i + 1), (i + 1) + ' 試合目'), view.gameIndex)).join('') + '</select>' : '') + '</div><span class="t-viewer-mode ' + (view.live ? 'live' : '') + '"><i></i>' + (view.live ? 'LIVE' : 'REPLAY') + '</span><button class="t-live-return" data-t-action="go-live"' + (!atLive ? ' disabled' : '') + '>' + tr('回到直播', 'Go live', 'ライブへ') + '</button></div><div class="t-playback-bar"><button data-t-action="previous-step" aria-label="' + tr('上一步', 'Previous action', '1手戻る') + '"' + (cursor.index === 0 || view.busy ? ' disabled' : '') + '>Ⅰ‹</button><button class="t-play-button" data-t-action="play" aria-label="' + (view.playing || view.live ? tr('暂停回看', 'Pause viewing', '一時停止') : tr('播放录像', 'Play replay', '再生')) + '"' + (view.busy ? ' disabled' : '') + '>' + (view.playing || view.live ? 'Ⅱ' : '▶') + '</button><button data-t-action="next-step" aria-label="' + tr('下一步', 'Next action', '1手進む') + '"' + (cursor.index >= total || view.busy ? ' disabled' : '') + '>›Ⅰ</button><label class="t-sr" for="t-replay-slider">' + tr('录像进度', 'Replay progress', '再生位置') + '</label><input id="t-replay-slider" data-t-field="seek" type="range" min="0" max="' + total + '" value="' + cursor.index + '"' + (view.busy ? ' disabled' : '') + '><span id="t-replay-position">' + (view.busy ? tr('定位中…', 'Seeking…', '移動中…') : cursor.index + ' / ' + total) + '</span><select data-t-field="turn" aria-label="' + tr('按回合跳转', 'Jump to turn', 'ターンに移動') + '">' + points.map(p => option(p.index, 'T' + p.turn, currentTurn?.index)).join('') + '</select><select data-t-field="replay-speed" aria-label="' + tr('录像播放速度', 'Replay speed', '再生速度') + '">' + [.5, 1, 2, 4, 8].map(speed => option(speed, speed + '×', view.speed)).join('') + '</select></div>';
      }
      // Keep range inputs and native selects mounted while live frames arrive.
      // Replacing them during a pointer gesture loses the user's change event.
      const slider = dock.querySelector('#t-replay-slider');
      slider.max = total; slider.disabled = view.busy;
      if (!view.scrubbing) slider.value = cursor.index;
      dock.querySelector('#t-replay-position').textContent = view.busy ? tr('定位中…', 'Seeking…', '移動中…') : cursor.index + ' / ' + total;
      const play = dock.querySelector('[data-t-action="play"]');
      play.disabled = view.busy; play.textContent = view.playing || view.live ? 'Ⅱ' : '▶';
      play.setAttribute('aria-label', view.playing || view.live ? tr('暂停回看', 'Pause viewing', '一時停止') : tr('播放录像', 'Play replay', '再生'));
      dock.querySelector('[data-t-action="previous-step"]').disabled = cursor.index === 0 || view.busy;
      dock.querySelector('[data-t-action="next-step"]').disabled = cursor.index >= total || view.busy;
      dock.querySelector('[data-t-action="go-live"]').disabled = !atLive;
      const mode = dock.querySelector('.t-viewer-mode');
      mode.className = 't-viewer-mode' + (view.live ? ' live' : '');
      mode.lastChild.textContent = view.live ? 'LIVE' : 'REPLAY';
      const options = (select, html, key, value) => {
        if (!select || document.activeElement === select) return;
        if (select.dataset.optionsKey !== key) { select.innerHTML = html; select.dataset.optionsKey = key; }
        select.value = String(value);
      };
      options(dock.querySelector('#t-watch-match'), recorded.map(m => option(m.id, roundName(cup.data.size, m.round) + ' · ' + m.entrants.map(id => name(cup.participant(id))).join(' VS '), match.id)).join(''), recorded.map(m => m.id).join('|'), match.id);
      options(dock.querySelector('[data-t-field="turn"]'), points.map(p => option(p.index, 'T' + p.turn, currentTurn?.index)).join(''), String(points.length), currentTurn?.index);
      const title = view.live ? tr('赛事直播', 'LIVE DUEL', 'ライブ観戦') : tr('录像放映室', 'REPLAY THEATER', 'リプレイシアター');
      const side = document.getElementById('turn-panel');
      const sideKey = dockKey + ':' + (game.error || game.verdict?.kind || '');
      if (side && (side.dataset.viewerKey !== sideKey || !side.querySelector('.t-viewer-summary'))) {
        side.dataset.viewerKey = sideKey;
        side.innerHTML = '<div class="turn-state"><i class="state-dot"></i>' + title + '</div><h2 class="turn-phase">TURN ' + String(state.turn).padStart(2, '0') + '</h2><p class="turn-description">' + esc(roundName(cup.data.size, match.round)) + '<br>' + tr('双方手牌与盖牌全部公开。', 'Both hands and Set cards are visible.', '両者の手札・セットカードを公開。') + '</p><div class="t-viewer-summary"><span>' + tr('猜拳先攻', 'RPS winner', 'じゃんけん先攻') + '</span><strong>' + esc(name(cup.participant(match.entrants[game.opening.first]))) + '</strong><span>' + game.opening.rounds.at(-1).map(n => ['✊', '✌', '✋'][n]).join(' · VS · ') + '</span></div><p class="t-verdict ' + (game.verdict?.kind !== 'normal' ? 't-gold' : '') + '">' + esc(verdictText(game)) + '</p>' + (game.error ? '<button class="secondary-button" data-t-action="retry-return" data-match="' + match.id + '">' + tr('保留录像并重赛', 'Retry this match', '記録を残して再試合') + '</button>' : '') + '<button class="secondary-button" data-t-action="return">' + tr('返回晋级图', 'Back to bracket', '対戦表に戻る') + '</button><div class="t-viewer-event-state">' + tr('赛事 ', 'Event ', '大会 ') + (cup.status === 'running' ? tr('正在继续', 'is running', '進行中') : cup.status === 'completed' ? tr('已结束', 'is complete', '終了') : tr('已暂停', 'is paused', '一時停止中')) + ' · ' + cup.progress().played + ' / ' + cup.progress().total + '</div>';
      }
      if (side) {
        side.querySelector('.turn-state').lastChild.textContent = title;
        side.querySelector('.turn-phase').textContent = 'TURN ' + String(state.turn).padStart(2, '0');
        side.querySelector('.t-viewer-event-state').textContent = tr('赛事 ', 'Event ', '大会 ') + (cup.status === 'running' ? tr('正在继续', 'is running', '進行中') : cup.status === 'completed' ? tr('已结束', 'is complete', '終了') : tr('已暂停', 'is paused', '一時停止中')) + ' · ' + cup.progress().played + ' / ' + cup.progress().total;
      }
      const mobile = document.getElementById('mobile-turn-control');
      if (mobile && (mobile.dataset.viewerKey !== dockKey || !mobile.querySelector('[data-t-action="play"]'))) {
        mobile.dataset.viewerKey = dockKey;
        mobile.innerHTML = '<div class="mobile-turn-copy"><small>' + title + '</small><b>TURN ' + state.turn + '</b></div><button class="primary-button" data-t-action="play">' + (view.live || view.playing ? tr('暂停回看', 'Pause', '停止') : tr('播放', 'Play', '再生')) + '</button><button class="mobile-end-button" data-t-action="return">' + tr('晋级图', 'Bracket', '対戦表') + '</button>';
      }
      if (mobile) {
        mobile.querySelector('.mobile-turn-copy small').textContent = title;
        mobile.querySelector('.mobile-turn-copy b').textContent = 'TURN ' + state.turn;
        mobile.querySelector('[data-t-action="play"]').textContent = view.live || view.playing ? tr('暂停回看', 'Pause', '停止') : tr('播放', 'Play', '再生');
      }
    }

    async function action(action, button) {
      switch (action) {
        case 'count': draft.count = Number(button.dataset.value); renderSetup(); break;
        case 'random': draft.seed = freshSeed(); draft.deckIds = T.randomRoster(pool(), draft.count, draft.seed, draft.duplicates); saveDraft(); renderSetup(); break;
        case 'shuffle': draft.seed = freshSeed(); draft.deckIds = T.shuffle(draft.deckIds, draft.seed); saveDraft(); renderSetup(); break;
        case 'setup-tab': setupTab = button.dataset.value; renderSetup(); break;
        case 'start': await start(); break;
        case 'toggle': cup.status === 'running' ? cup.pause() : cup.resume(); renderArena(); schedule(); await flush(); break;
        case 'new': if (cup) { cup.pause(); await flush(); } closeViewer(); cup = null; savedRevision = -1; stage = 'setup'; setupTab = 'roster'; render(); node.scrollTop = 0; break;
        case 'export': exportEvent(); break;
        case 'save': await flush(); render(); break;
        case 'history': await flush(); await renderHistoryData(); break;
        case 'load': await load(button.dataset.id); break;
        case 'import': importEvent(); break;
        case 'back': stage = cup ? 'arena' : 'setup'; render(); break;
        case 'arena-tab': arenaTab = button.dataset.value; renderArena(); break;
        case 'filter': filter = button.dataset.value; renderArena(); break;
        case 'fit': zoom = 'fit'; fitChart(); break;
        case 'zoom-in': case 'zoom-out': zoom = Math.max(.4, Math.min(1.6, Number(node.querySelector('.t-chart-size')?.dataset.scale || 1) + (action === 'zoom-in' ? .15 : -.15))); fitChart(); break;
        case 'focus-final': node.querySelector('.t-match[data-match="' + cup.matches.at(-1).id + '"]')?.scrollIntoView({block:'center', inline:'center', behavior:'smooth'}); break;
        case 'match': if (stage === 'setup') return; selectedMatch = button.dataset.match; if (cup.match(selectedMatch).games.length) watch(selectedMatch); else renderArena(); break;
        case 'watch': watch(button.dataset.match); break;
        case 'watch-final': watch(cup.matches.at(-1).id, undefined, true); break;
        case 'retry': cup.retry(button.dataset.match); render(); schedule(); await flush(); break;
        case 'retry-return': cup.retry(button.dataset.match); host.returnToArena(); schedule(); await flush(); break;
        case 'return': host.returnToArena(); break;
        case 'play': viewerToggle(); break;
        case 'previous-step': await seek(view.cursor.index - 1); break;
        case 'next-step': await seek(view.cursor.index + 1); break;
        case 'go-live': if (view) { seekToken++; clearTimeout(playTimer); view.live = true; view.busy = false; view.scrubbing = false; view.playing = false; syncLive(true); } break;
      }
    }
    async function field(el) {
      const key = el.dataset.tField;
      if (key === 'seek' || key === 'turn') { if (view) view.scrubbing = false; await seek(Number(el.value)); return; }
      if (key === 'watch-match') { watch(el.value); return; }
      if (key === 'attempt') { watch(view.matchId, Number(el.value), true); return; }
      if (key === 'replay-speed') { view.speed = Number(el.value); playback(); return; }
      if (key === 'run-concurrency' || key === 'run-pace') { cup.configure({[key === 'run-concurrency' ? 'concurrency' : 'pace']:el.value}); schedule(); refresh(); await flush(); return; }
      if (key === 'seat') { draft.deckIds[Number(el.dataset.seat)] = el.value; saveDraft(); renderSetup(); return; }
      if (key === 'count') {
        const count = Number(el.value);
        if (!Number.isInteger(count) || count < 2 || count > 64) { el.value = draft.count; throw new Error(tr('人数需要是 2–64 之间的整数。', 'Choose a whole number from 2 to 64.', '2〜64の整数を入力してください。')); }
        draft.count = count; ensureRoster(); renderSetup(); return;
      }
      if (key === 'seed') {
        const seed = Number(el.value);
        if (!Number.isInteger(seed) || seed < 1 || seed > 4294967295) { el.value = draft.seed; throw new Error(tr('种子需要是 1–4294967295 之间的整数。', 'Use an integer seed from 1 to 4294967295.', '1〜4294967295の整数を入力してください。')); }
        draft.seed = seed; draft.deckIds = T.randomRoster(pool(), draft.count, seed, draft.duplicates); saveDraft(); renderSetup(); return;
      }
      draft[key] = key === 'duplicates' ? el.checked : key === 'concurrency' ? Number(el.value) : el.value;
      saveDraft();
    }
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-t-action]'); if (!button || button.disabled) return;
      const navigates = ['start', 'new', 'load', 'history'].includes(button.dataset.tAction);
      if (navigates && navigationBusy) return;
      if (navigates) { navigationBusy = true; button.disabled = true; }
      action(button.dataset.tAction, button).catch(error => host.toast(error.message, true)).finally(() => {
        if (navigates) { navigationBusy = false; if (button.isConnected) button.disabled = false; }
      });
    });
    document.addEventListener('change', event => { if (event.target.matches('[data-t-field]')) field(event.target).catch(error => host.toast(error.message, true)); });
    document.addEventListener('input', event => {
      if (event.target.matches('[data-t-field="name"]')) { draft.name = event.target.value; saveDraft(); }
      if (event.target.matches('[data-t-field="seek"]') && view) {
        view.live = false; view.playing = false; view.scrubbing = true; clearTimeout(playTimer);
        const label = document.getElementById('t-replay-position'); if (label) label.textContent = event.target.value + ' / ' + currentGame().steps.length;
      }
    });
    document.addEventListener('pointerdown', event => {
      if (!view || !event.target.closest('.app-main, #mobile-turn-control')) return;
      interactionUntil = Date.now() + 650;
      if (event.target.matches('[data-t-field="seek"]')) { view.scrubbing = true; view.live = false; view.playing = false; clearTimeout(playTimer); }
    }, {passive:true});
    for (const type of ['pointerup', 'pointercancel']) document.addEventListener(type, () => { if (view) view.scrubbing = false; }, {passive:true});
    root.addEventListener('resize', () => { if (visible) fitChart(); });
    root.addEventListener('duel-language-change', () => { render(); if (view) showFrame(); updateHome(); });
    root.addEventListener('pagehide', () => { if (cup) flush(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && cup) flush(); });
    setInterval(() => { if (cup && !saving && cup.revision !== savedRevision) flush(); }, 1800);
    const ready = (async () => {
      try { const data = await repository.latest(); if (data) { cup = T.Tournament.restore(data); stage = 'arena'; } }
      catch (error) { saveError = error.message || String(error); }
      finally { loading = false; updateHome(); render(); }
    })();
    return {ready, show, hide, closeViewer, renderBoardTools, viewerToggle, watch, seek, flush, start,
      get current() { return cup; }, get viewer() { return view; }, get draft() { return JSON.parse(JSON.stringify(draft)); },
      handleKey(event) {
        if (!view || event.target.matches('input,select,textarea')) return false;
        if (event.key === ' ' && event.target.tagName !== 'BUTTON') viewerToggle();
        else if (event.key === 'ArrowLeft') seek(view.cursor.index - 1);
        else if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'n') seek(view.cursor.index + 1);
        else return false;
        event.preventDefault(); return true;
      }
    };
  }
  root.DuelTournamentUI = {create};
})(globalThis);
