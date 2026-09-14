(function (root) {
  'use strict';
  const { Connection, RemoteEngine } = root.DuelPVPClient;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tr = (zh, en, ja) => root.DuelI18n.language === 'en' ? en : root.DuelI18n.language === 'ja' ? ja : zh;
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const leaveRoomButton = () => `<button type="button" class="pvp-button pvp-leave-button" data-pvp-action="leave"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4H4v16h5m6-12 4 4-4 4m-7-4h11"/></svg><span>${tr('离开房间', 'Leave room', 'ルームを退出')}</span></button>`;
  const formatTime = ms => { const n = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`; };
  const labels = {
    'lp-zero': ['生命值归零', 'Life Points reached zero', 'LPが0になりました'],
    'deck-out': ['无牌可抽', 'No cards left to draw', 'ドローできるカードがありません'],
    exodia: ['艾克佐迪亚特殊胜利', 'Exodia victory', 'エクゾディアの特殊勝利'],
    special: ['卡片效果达成胜利', 'Victory by card effect', 'カード効果による勝利'],
    surrender: ['对手认输，本局结束。', 'The duel ended by surrender.', 'サレンダーにより終了しました。'],
    timeout: ['思考时间耗尽，本局结束。', 'The thinking clock ran out.', '持ち時間がなくなりました。'],
    disconnect: ['重连时间已用尽，本局结束。', 'The reconnection window expired.', '再接続の猶予時間が終了しました。'],
    abandoned: ['双方离线，本局结束为平局。', 'Both players disconnected. The duel is a draw.', '両者が切断したため引き分けです。'],
    limit: ['达到对局保护上限，本局平局。', 'The duel limit was reached. The result is a draw.', '対戦の上限に達したため引き分けです。'],
    draw: ['双方同时达到结束条件，本局平局。', 'The duel ended in a draw.', 'このデュエルは引き分けです。']
  };

  function create(bridge) {
    const screen = document.querySelector('#pvp-screen'), bar = document.querySelector('#pvp-duel-bar');
    let room = null, remote = null, shown = false, layout = '', busy = false, queued = false, queueAt = 0;
    let lobby = { online: 0, playing: 0, rooms: [] }, clockAt = 0, lastError = '', selected = 'blue', nickname = '', clockSeconds = 300;
    try { const saved = JSON.parse(localStorage.getItem('duel-pvp-profile-v1') || '{}'); nickname = saved.name || ''; selected = saved.deck || 'blue'; } catch {}
    if (!nickname) nickname = tr('决斗者', 'Duelist', 'デュエリスト') + ' ' + Math.random().toString(36).slice(2, 6).toUpperCase();
    const remember = () => { try { localStorage.setItem('duel-pvp-profile-v1', JSON.stringify({ name: nickname, deck: selected })); } catch {} };
    const availableDecks = () => root.DuelDecks.list().map(deck => root.DuelI18n.deck(deck));
    const deck = () => availableDecks().find(d => d.id === selected) || availableDecks()[0];
    const deckInput = () => { const d = deck(); return d.preset ? { preset: d.id } : { name: d.name, cards: [...d.cards], extra: [...d.extra] }; };
    const deckOptions = () => availableDecks().map(d => `<option value="${esc(d.id)}"${d.id === deck().id ? ' selected' : ''}>${esc(d.name)}${d.preset ? '' : ' · ' + tr('自建', 'Custom', '自作')}</option>`).join('');

    function peerNotice(data = room) {
      if (!data) return null;
      const own = data.seats[data.you], peer = data.seats[1 - data.you];
      if (!own || !peer) return null;
      const kind = data.status === 'finished' && peer.rematch && !own.rematch ? 'rematch'
        : data.status === 'waiting' && peer.ready && !own.ready ? 'ready' : null;
      if (!kind) return null;
      return {
        kind, connected: peer.connected,
        key: [data.code, data.gameId || 'waiting', data.you, kind, peer.name].join(':'),
        title: kind === 'rematch'
          ? tr(`${peer.name} 已准备，希望与你再战一局`, `${peer.name} is ready and would like a rematch.`, `${peer.name} さんが再戦を希望しています。`)
          : tr(`${peer.name} 已准备，等你一起开始下一局`, `${peer.name} is ready for the next duel.`, `${peer.name} さんが準備を完了し、あなたを待っています。`)
      };
    }
    function peerNoticeHTML(inResult = false) {
      const notice = peerNotice();
      if (!notice) return '';
      const hint = !notice.connected
        ? tr('对手暂时离线，重连后可以继续准备。', 'Your opponent is reconnecting. You can continue when they return.', '相手は切断中です。再接続後に準備を続けられます。')
        : notice.kind === 'ready'
          ? tr('确认出战卡组并点击「准备决斗」，双方准备后自动开始。', 'Confirm your deck and select Ready to duel. The game starts when both players are ready.', 'デッキを確認して「準備完了」を選択。両者の準備が整うと開始します。')
          : inResult
            ? tr('返回房间回应邀请，双方确认出战卡组后即可开始。', 'Return to the room to respond, then both players can confirm their decks.', 'ルームに戻って招待に応じ、両者のデッキを確認してください。')
            : tr('点击「同意再战」回应邀请，再确认你的出战卡组。', 'Select Accept rematch, then confirm your deck.', '「再戦に同意」を選び、使用するデッキを確認してください。');
      return `<section class="pvp-peer-notice" data-notice-kind="${notice.kind}" role="status" aria-live="polite" data-i18n-skip><span class="pvp-peer-notice-icon">${icon(notice.kind === 'rematch' ? 'refresh' : 'check')}</span><div><small>${notice.kind === 'rematch' ? tr('再战邀请', 'REMATCH REQUEST', '再戦の招待') : tr('对手已准备', 'OPPONENT READY', '相手の準備完了')}</small><strong>${esc(notice.title)}</strong><p>${esc(hint)}</p></div></section>`;
    }
    function updatePeerNotice(previous, announce = true) {
      const notice = peerNotice(), before = peerNotice(previous), host = document.querySelector('#pvp-result-notice');
      if (host) {
        const key = notice ? `${notice.key}:${notice.connected}:${root.DuelI18n.language}` : '';
        if (host.dataset.noticeKey !== key) { host.innerHTML = peerNoticeHTML(true); host.dataset.noticeKey = key; }
      }
      // Reconnects and repeated room snapshots must not replay the same notification.
      if (announce && notice?.connected && notice.key !== before?.key) bridge.toast(notice.title);
    }

    const connection = new Connection({
      status: status => {
        if(status==='replaced'){
          room=null;remote=null;bridge.detach();layout='';bridge.show();
          showError({message:tr('此席位已在另一页面打开。这里可以重新连接，使用新的席位。','This seat is open in another tab. Reconnect here to use a new seat.','この席は別のタブで開かれています。再接続して新しい席を利用できます。')});
        }
        updateStatus(); updateClocks(); bridge.refresh?.();
      },
      latency: () => updateStatus(), error: showError,
      welcome(data) { nickname = data.name; remember(); lastError = ''; updateStatus(); },
      message(data) {
        if (data.type === 'lobby') { lobby = data; updateLobby(); updateStatus(); }
        if (data.type === 'queue') { queued = data.active; queueAt = data.joinedAt || queueAt; updateQueue(); }
        if (data.type === 'clock' && room?.code === data.code) { const changed=room.clock.paused!==data.paused;room.clock = data; clockAt = Date.now(); if (remote) remote.blocked = data.paused; updateClocks(); if(changed)bridge.refresh?.(); }
        if (data.type === 'left') {
          room = null; remote = null; bridge.detach(); layout = ''; bridge.show();
          if (data.expired) showError({ message: tr('房间已过期，请创建或加入新的房间。', 'The room expired. Create or join a new one.', 'ルームの有効期限が切れました。') });
        }
        if (data.type === 'room') {
          const prior = room; room = data; queued = false; clockAt = Date.now();
          if (data.game) {
            const game = { ...data.game, revision: data.revision };
            if (!remote || prior?.gameId !== data.gameId) {
              remote = new RemoteEngine(game, connection, showError); remote.blocked = data.clock.paused;
              bridge.attach(remote); layout = '';
            } else { remote.blocked = data.clock.paused; remote.update(game); }
          } else if (remote) { remote = null; bridge.detach(); bridge.show(); }
          if (shown) render(); renderBar(); updateStatus(); updateClocks();
          updatePeerNotice(prior);
          if (!prior && !data.game) bridge.show();
        }
      }
    });

    function showError(error) {
      lastError = error.message || tr('连接暂时不可用，请稍后再试。', 'The connection is unavailable. Please try again.', '接続できません。もう一度お試しください。');
      bridge.toast(lastError, true);
      const node = screen.querySelector('#pvp-error'); if (node) { node.textContent = lastError; node.hidden = false; }
    }
    async function run(task) {
      if (busy) return;
      busy = true; screen.classList.add('pvp-working');
      try { await task(); } catch (error) { showError(error); }
      finally { busy = false; screen.classList.remove('pvp-working'); }
    }
    async function identity() {
      const field=screen.querySelector('#pvp-name');if(field)nickname=field.value.trim();
      if (!nickname) throw { message: tr('请填写昵称。', 'Enter your name.', '名前を入力してください。') };
      if (!connection.connected) throw { message: tr('正在连接服务器，请稍候。', 'Connecting to the server. Please wait.', 'サーバーに接続しています。') };
      if (nickname !== connection.name) await connection.rename(nickname);
      remember();
    }
    function artPreview() {
      const d = deck();
      return `<div class="pvp-deck-art">${root.DuelArt.html(d.ace)}</div><div><small>${tr('你的出战卡组', 'YOUR DECK', '使用するデッキ')}</small><strong data-user-content>${esc(d.name)}</strong><span>${d.cards.length} ${tr('主卡组', 'main', 'メイン')} <i> / </i> ${d.extra.length} ${tr('额外', 'extra', 'EX')}</span></div><span class="pvp-deck-check">${icon('check')}</span>`;
    }
    function render() {
      if (!shown) return;
      const key = room ? 'room:' + room.code : 'lobby';
      if (key !== layout || room) {
        const focus = document.activeElement?.id;
        screen.innerHTML = `<div class="pvp-shell"><div class="pvp-topline"><span><i class="pvp-status-dot"></i> ONLINE DUELS <b>/</b> BEST OF ONE</span><button data-action="home">← ${tr('返回主界面', 'Home', 'ホーム')}</button></div><div class="pvp-error" id="pvp-error" role="alert"${lastError ? '' : ' hidden'}>${esc(lastError)}</div>${room ? roomHTML() : lobbyHTML()}<footer class="pvp-footer"><span>${icon('shield')}${tr('每个选择，都由服务器确认。', 'Every move is confirmed by the server.', 'すべての操作をサーバーが確認します。')}</span><span>8000 LP · BO1 · ${tr('现有卡池规则', 'Current card pool rules', '現在のカードプール')}</span></footer></div>`;
        layout = key;
        if (focus && screen.querySelector('#' + focus)) screen.querySelector('#' + focus).focus({ preventScroll: true });
        root.DuelArt.refresh(screen);
      }
      updateLobby(); updateQueue(); updateStatus(); updateClocks();
    }
    function lobbyHTML() {
      const invite = root.location.hash.match(/^#pvp\/([A-Z2-9]{6})$/i)?.[1] || '';
      return `<header class="pvp-hero"><div class="pvp-hero-copy"><span class="pvp-eyebrow">A REAL RIVAL. YOUR NEXT CHAPTER.</span><h1>${tr('这一局，<br>与你<span>交锋。</span>', 'One duel.<br>Make it <span>yours.</span>', 'この一戦で、<br>あなたと<span>決闘。</span>')}</h1><p>${tr('把熟悉的战术，交给未知的对手。<br>邀请好友，或遇见下一位决斗者。', 'Bring your best deck to a real opponent.<br>Invite a friend, or find your next rival.', '磨いた戦術で、まだ見ぬ相手へ。<br>友達を招待するか、新しい決闘者と出会おう。')}</p><div class="pvp-pills"><span>${tr('真人对战', 'REAL PLAYERS', 'プレイヤー対戦')}</span><span>${tr('单局决胜', 'SINGLE DUEL', 'シングル戦')}</span><span>${tr('断线可重连', 'RECONNECT & RESUME', '再接続に対応')}</span></div></div><div class="pvp-hero-art" aria-hidden="true"><div class="pvp-orbit"></div><div class="pvp-orbit inner"></div><div class="pvp-hero-card left"></div><div class="pvp-hero-card right"></div><span class="pvp-vs-mark">VS</span><small>THE NEXT MOVE IS YOURS</small><span class="pvp-art-corner a"></span><span class="pvp-art-corner b"></span></div></header>
      <div class="pvp-server-strip"><div><i class="pvp-status-dot"></i><strong class="pvp-connection-label"></strong><span class="pvp-server-host">${esc(root.location.host || 'LOCAL FILE')}</span></div><span><b data-pvp-online>0</b> ${tr('在线', 'online', 'オンライン')}</span><span><b data-pvp-playing>0</b> ${tr('对局中', 'live duels', '対戦中')}</span><span class="pvp-latency">— ms</span></div>
      <div id="pvp-server-help" class="pvp-server-help" hidden><strong>${tr('通过联机服务器打开游戏', 'Open the game on a PVP server', '対戦サーバーでゲームを開く')}</strong><p>${tr('联机需要运行服务器。项目目录执行 npm run start:pvp，再访问下方地址；异地游玩可填写已部署的服务器地址。', 'Run npm run start:pvp in the project, then open the address below. For remote play, use your deployed server address.', 'プロジェクトで npm run start:pvp を実行し、下のアドレスを開いてください。')}</p><div><label class="pvp-sr" for="pvp-server-url">${tr('服务器地址', 'Server address', 'サーバーアドレス')}</label><input id="pvp-server-url" type="url" value="http://127.0.0.1:4173" placeholder="https://duel.example.com"><button class="pvp-button" data-pvp-action="open-server">${tr('打开服务器', 'Open server', 'サーバーを開く')} ↗</button><button class="pvp-text-button" data-pvp-action="reconnect">${tr('重新连接', 'Reconnect', '再接続')}</button></div></div>
      <div class="pvp-lobby-grid"><div class="pvp-main-column"><section class="pvp-panel pvp-preparation"><div class="pvp-section-title"><span>01</span><div><h2>${tr('以你的名字，出战。', 'Enter as yourself.', 'あなたの名前で、参戦。')}</h2><p>${tr('预设卡组或亲手构筑，选择你相信的力量。', 'A preset or your own creation. Choose a deck you trust.', 'プリセットか自作デッキ。信じる力を選ぼう。')}</p></div></div><div class="pvp-identity-row"><label for="pvp-name">${tr('决斗者昵称', 'Duelist name', 'プレイヤー名')}<input id="pvp-name" maxlength="20" autocomplete="nickname" value="${esc(nickname)}"></label><label for="pvp-deck">${tr('出战卡组', 'Deck', 'デッキ')}<select id="pvp-deck" data-pvp-deck>${deckOptions()}</select></label></div><div class="pvp-deck-preview" id="pvp-deck-preview">${artPreview()}</div><div class="pvp-quick-row" id="pvp-quick-row"></div></section>
      <section class="pvp-panel pvp-rooms-panel"><div class="pvp-list-heading"><div><span class="pvp-eyebrow">OPEN ROOMS</span><h2>${tr('寻找一席对手', 'Find a seat at the table', '対戦相手を探す')} <small id="pvp-room-count">0</small></h2></div><button class="pvp-text-button" data-pvp-action="refresh">${icon('refresh')}${tr('刷新', 'Refresh', '更新')}</button></div><div id="pvp-public-list" class="pvp-public-list" aria-live="polite"></div></section></div>
      <aside class="pvp-side-column"><section class="pvp-panel pvp-create-panel"><div class="pvp-section-title"><span>02</span><h2>${tr('邀请好友', 'Invite a friend', '友達を招待')}</h2></div><p class="pvp-muted">${tr('创建房间，将邀请链接分享给你的对手。', 'Create a room and share the invitation.', 'ルームを作成し、招待リンクを共有。')}</p><label for="pvp-room-title">${tr('房间名称', 'Room name', 'ルーム名')}<input id="pvp-room-title" maxlength="20" placeholder="${tr('今晚，来一局。', 'One duel tonight.', '今夜、一戦。')}"></label><label for="pvp-visibility">${tr('房间类型', 'Visibility', '公開設定')}<select id="pvp-visibility"><option value="public">${tr('公开 · 大厅可见', 'Public · listed in lobby', '公開・ロビーに表示')}</option><option value="private">${tr('私密 · 仅凭房间码加入', 'Private · invitation only', '非公開・招待のみ')}</option></select></label><label>${tr('每人思考时间', 'Thinking time per player', '各プレイヤーの持ち時間')}</label><div class="pvp-clock-options">${[180, 300, 600].map(n => `<button data-pvp-action="clock" data-value="${n}" class="${clockSeconds === n ? 'active' : ''}" aria-pressed="${clockSeconds === n}">${n / 60}<small> ${tr('分钟', 'min', '分')}</small></button>`).join('')}</div><p class="pvp-clock-help">${tr('每次进入自己的新回合恢复 20 秒，不超过初始时长。响应时由响应方计时。', 'Gain 20 seconds on each of your turns, up to the initial clock. Responses use the responder’s clock.', '自分のターンごとに20秒回復（初期値が上限）。応答時は応答側の時間を使用。')}</p><button class="pvp-button pvp-primary pvp-full" data-pvp-action="create">${icon('swords')}${tr('创建房间', 'Create room', 'ルームを作成')}<span>↗</span></button></section>
      <section class="pvp-panel pvp-join-panel"><h2>${tr('已有房间码？', 'Have a room code?', 'ルームコードをお持ちですか？')}</h2><form id="pvp-join-form"><label class="pvp-sr" for="pvp-code">${tr('六位房间码', 'Six-character room code', '6文字のルームコード')}</label><div class="pvp-join-row"><input id="pvp-code" placeholder="A B C 2 3 4" value="${esc(invite)}" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" pattern="[A-Za-z2-9]{6}" required><button class="pvp-button" type="submit">${tr('加入', 'Join', '参加')} →</button></div></form><p>${tr('邀请链接也能直接找到房间。', 'Invitation links take you to the right room.', '招待リンクからも参加できます。')}</p></section></aside></div>`;
    }

    function roomHTML() {
      const own = room.seats[room.you], opponent = room.seats[1 - room.you], finished = room.status === 'finished', playing = room.status === 'playing';
      const seatHTML = (member, self) => `<article class="pvp-seat ${self ? 'self' : 'rival'} ${(finished ? member?.rematch : member?.ready) ? 'ready' : ''}"><span class="pvp-seat-tag">${self ? 'YOU' : 'OPPONENT'}</span><div class="pvp-seat-avatar">${self ? root.DuelArt.html(deck().ace) : `<img src="${root.DUEL_ART['card-back']}" alt="">`}${(finished ? member?.rematch : member?.ready) ? '<b>' + icon('check') + '</b>' : ''}</div><h2 data-user-content>${member ? esc(member.name) : tr('等待对手入座', 'Waiting for a rival', '対戦相手を待っています')}</h2><p>${member ? self ? esc(own.deckName || deck().name) : tr('对手的构筑保密', 'Opponent’s deck is private', '相手の構築は非公開') : tr('分享房间码，邀请好友加入。', 'Share your code to invite a friend.', 'コードを共有して友達を招待。')}</p><span class="pvp-seat-status">${member ? !member.connected ? tr('暂时离线', 'Disconnected', '切断中') : playing ? tr('对局中', 'In duel', '対戦中') : finished ? member.rematch ? tr('已准备 · 等待再战', 'Ready for a rematch', '再戦を希望') : tr('本局结束', 'Duel complete', '対戦終了') : member.ready ? tr('已准备', 'Ready', '準備完了') : tr('正在选择卡组', 'Choosing a deck', 'デッキを選択中') : tr('空席', 'Open seat', '空席')}</span></article>`;
      return `<header class="pvp-room-heading"><div><span class="pvp-eyebrow">${room.visibility === 'private' ? 'PRIVATE ROOM' : 'PUBLIC ROOM'} · BEST OF ONE</span><h1 data-user-content>${esc(room.title)}</h1><p>${tr('两位决斗者，一场胜负。', 'Two duelists. One game.', '2人の決闘者、1回の勝負。')}</p></div><div class="pvp-code-ticket"><small>${tr('房间码', 'ROOM CODE', 'ルームコード')}</small><button data-pvp-action="copy-code" title="${tr('复制房间码', 'Copy room code', 'コードをコピー')}">${room.code}<span>⧉</span></button><button class="pvp-copy-link" data-pvp-action="copy-link">${tr('复制邀请链接', 'Copy invitation link', '招待リンクをコピー')} ↗</button></div></header>
      <div class="pvp-room-progress"><span class="done"><b>01</b>${tr('进入房间', 'Join room', '入室')}</span><i></i><span class="${own?.ready ? 'done' : 'current'}"><b>02</b>${tr('确认卡组', 'Ready up', '準備')}</span><i></i><span class="${playing || finished ? 'done' : ''}"><b>03</b>${tr('开始决斗', 'Duel', 'デュエル')}</span></div>
      ${peerNoticeHTML()}
      <div class="pvp-room-network" role="status" hidden></div><section class="pvp-matchup">${seatHTML(own, true)}<div class="pvp-room-versus"><small>SINGLE DUEL</small><b>VS</b><span>8000 <i>LP</i></span><div>${room.clockSeconds / 60} ${tr('分钟', 'MIN', '分')} + 20s</div></div>${seatHTML(opponent, false)}</section>
      ${finished ? `<section class="pvp-panel pvp-room-result"><span class="pvp-eyebrow">DUEL COMPLETE</span><h2>${resultTitle()}</h2><p>${resultReason()}</p><div><button class="pvp-button pvp-primary" data-pvp-action="rematch"${own?.rematch || !opponent ? ' disabled' : ''}>${own?.rematch ? tr('已准备，等待对手回应', 'Ready · waiting for opponent', '相手の同意を待っています') : opponent?.rematch ? tr('同意再战', 'Accept rematch', '再戦に同意') : tr('再战一局', 'Play again', 'もう一戦')}</button><button class="pvp-button" data-pvp-action="board">${tr('查看战场与记录', 'Board & journal', '盤面と記録')}</button></div></section>` : playing ? `<section class="pvp-panel pvp-resume-panel"><div><span class="pvp-eyebrow">DUEL IN PROGRESS</span><h2>${tr('战场正等待你的下一步。', 'Your next move awaits.', '次の一手を待っています。')}</h2></div><button class="pvp-button pvp-primary" data-pvp-action="board">${tr('进入战场', 'Enter duel', '対戦画面へ')} ${icon('arrow')}</button></section>` : `<section class="pvp-panel pvp-ready-panel"><div><label for="pvp-room-deck">${tr('确认你的出战卡组', 'Confirm your deck', '使用するデッキを確認')}<select id="pvp-room-deck" data-pvp-deck${own?.ready ? ' disabled' : ''}>${deckOptions()}</select></label><p>${tr('双方准备后自动开始，先后攻随机决定。', 'The duel begins when both players are ready. First turn is random.', '両者の準備完了で開始。先攻・後攻はランダムです。')}</p></div><button class="pvp-button ${own?.ready ? '' : 'pvp-primary'}" data-pvp-action="ready">${icon(own?.ready ? 'refresh' : 'check')}${own?.ready ? tr('取消准备', 'Unready', '準備を解除') : tr('准备决斗', 'Ready to duel', '準備完了')}</button></section>`}
      <div class="pvp-room-bottom"><span>${finished ? icon('check') + tr('本局结果已保存', 'Duel result saved', '対戦結果を保存しました') : icon('clock') + tr('每人每局 60 秒重连额度 · 返回后继续当前选择', '60-second reconnection budget per duel · resume your decision', '各対戦で合計60秒間の再接続が可能です')}</span>${playing ? `<button class="pvp-text-button danger" data-pvp-action="surrender">${tr('认输', 'Surrender', 'サレンダー')}</button>` : leaveRoomButton()}</div>`;
    }
    function resultTitle() { return room.result?.winner === 'draw' ? tr('决斗平局', 'A draw', '引き分け') : room.result?.winner === room.you ? tr('决斗胜利', 'Victory is yours', 'あなたの勝利') : tr('本局告负', 'Defeat this time', '今回の敗北'); }
    function resultReason() {
      if (room.result?.kind === 'surrender' && room.result.winner !== room.you) return tr('你选择认输，本局结束。', 'You surrendered this duel.', 'あなたはサレンダーしました。');
      return tr(...(labels[room.result?.kind] || labels.special));
    }
    function updateLobby() {
      const node = screen.querySelector('#pvp-public-list');
      if (node) {
        node.innerHTML = lobby.rooms.length ? lobby.rooms.map(r => `<article class="pvp-public-room"><div class="pvp-room-glyph">${icon('swords')}</div><div class="pvp-public-info"><strong data-user-content>${esc(r.title)}</strong><span data-user-content>${esc(r.host)} <i>·</i> ${r.clockSeconds / 60} ${tr('分钟', 'MIN', '分')} + 20s</span></div><span class="pvp-open-seat"><i></i> 1 / 2</span><button class="pvp-button" data-pvp-action="join" data-code="${r.code}"${queued ? ' disabled' : ''}>${tr('入座', 'Join', '参加')} ↗</button></article>`).join('') : `<div class="pvp-empty-rooms"><span>${icon('swords')}</span><div><strong>${connection.connected ? tr('第一张战书，由你发出。', 'Be the first to issue a challenge.', '最初の挑戦状を出そう。') : tr('正在寻找决斗房间…', 'Finding duel rooms…', '対戦ルームを探しています…')}</strong><p>${tr('创建公开房间，等待一位对手；也可以快速匹配。', 'Create a public room or try quick match.', '公開ルームを作成するか、クイックマッチをご利用ください。')}</p></div></div>`;
        screen.querySelector('#pvp-room-count').textContent = lobby.rooms.length;
      }
    }
    function updateQueue() {
      const node = screen.querySelector('#pvp-quick-row'); if (!node) return;
      node.innerHTML = queued ? `<div class="pvp-matching"><i></i><div><strong>${tr('正在寻找对手', 'Finding your opponent', '対戦相手を検索中')}</strong><span id="pvp-queue-time">00:00</span></div></div><button class="pvp-button" data-pvp-action="cancel-queue">${tr('取消匹配', 'Cancel', 'キャンセル')}</button>` : `<div><strong>${tr('让下一位对手，成为惊喜。', 'Meet your next rival.', '次のライバルと出会おう。')}</strong><span>${tr('快速匹配 · 5 分钟 + 每回合 20 秒', 'Quick match · 5 minutes + 20s per turn', 'クイックマッチ・5分＋毎ターン20秒')}</span></div><button class="pvp-button pvp-primary" data-pvp-action="quick">${icon('bolt')}${tr('快速匹配', 'Quick match', 'クイックマッチ')}</button>`;
      for (const id of ['pvp-name', 'pvp-deck']) { const input = screen.querySelector('#' + id); if (input) input.disabled = queued; }
    }
    function updateStatus() {
      const text = connection.status==='unavailable'?tr('未连接到联机服务','SERVER UNAVAILABLE','サーバーに接続できません'):connection.connected ? tr('联机服务已连接', 'CONNECTED', '接続済み') : connection.status === 'replaced' ? tr('席位已在另一页面打开', 'OPEN IN ANOTHER TAB', '別のタブで接続されています') : connection.status === 'reconnecting' ? tr('连接中断，正在重连', 'RECONNECTING', '再接続中') : tr('正在连接联机服务', 'CONNECTING', '接続中');
      for (const node of document.querySelectorAll('.pvp-connection-label')) node.textContent = text;
      for (const node of document.querySelectorAll('.pvp-status-dot')) node.classList.toggle('connected', connection.connected);
      for (const node of document.querySelectorAll('.pvp-latency')) node.textContent = connection.connected && connection.latency !== null ? connection.latency + ' ms' : '— ms';
      for (const node of screen.querySelectorAll('[data-pvp-online]')) node.textContent = lobby.online;
      for (const node of screen.querySelectorAll('[data-pvp-playing]')) node.textContent = lobby.playing;
      const help = screen.querySelector('#pvp-server-help'); if (help) help.hidden = !['unavailable', 'replaced'].includes(connection.status) && connection.attempt < 2;
    }
    function renderBar() {
      bar.hidden = !remote;
      if (!remote || !room) return;
      bar.innerHTML = `<button class="pvp-back-room" data-pvp-action="room">← <span>${tr('联机房间', 'Room', 'ルーム')}</span><b>${room.code}</b></button><div class="pvp-board-clocks">${[room.you, 1 - room.you].map((seat, i) => `<div class="pvp-board-clock ${i ? 'rival' : 'self'}"><small>${i ? 'OPP' : 'YOU'}</small><b data-pvp-clock="${seat}">05:00</b></div>`).join('')}</div><span class="pvp-board-status"><i class="pvp-status-dot"></i><span class="pvp-connection-label"></span><small class="pvp-latency">— ms</small></span><button class="pvp-board-surrender${peerNotice() ? ' has-invitation' : ''}" data-pvp-action="${room.status === 'finished' ? 'result' : 'surrender'}">${room.status === 'finished' ? peerNotice() ? tr('再战邀请', 'Rematch', '再戦招待') : tr('结果', 'Result', '結果') : tr('认输', 'Surrender', 'サレンダー')}</button><div class="pvp-room-network pvp-board-network" role="status" hidden></div>`;
    }
    function updateClocks() {
      const q = screen.querySelector('#pvp-queue-time'); if (q) q.textContent = formatTime(Date.now() - queueAt);
      if (!room) return;
      const clock = room.clock, paused = !connection.connected || clock.paused;
      for (const node of document.querySelectorAll('[data-pvp-clock]')) {
        const seat = Number(node.dataset.pvpClock), running = !paused && room.status === 'playing' && clock.actor === seat;
        const ms = clock.remaining[seat] - (running ? Date.now() - clockAt : 0);
        node.textContent = formatTime(ms); node.classList.toggle('running', running); node.classList.toggle('low', ms < 30_000);
      }
      for (const node of document.querySelectorAll('.pvp-room-network')) {
        node.hidden = room.status !== 'playing' || !paused;
        if (node.hidden) continue;
        const deadline = clock.reconnectUntil.filter(Boolean).sort((a, b) => a - b)[0];
        const seconds = deadline ? Math.max(0, Math.ceil((deadline - clock.serverTime - (Date.now() - clockAt)) / 1000)) : 60;
        node.textContent = !connection.connected ? tr('连接中断，正在自动重连。你的操作将在同步后恢复。', 'Reconnecting. Controls resume after synchronization.', '再接続中です。同期後に操作を再開できます。') : tr(`对手暂时离线，思考计时已暂停 · 重连剩余 ${seconds} 秒`, `Opponent disconnected. Clock paused · ${seconds}s to reconnect`, `相手が切断しました。時計を停止中・残り${seconds}秒`);
      }
      document.body.classList.toggle('pvp-input-locked', !!remote && (paused || remote.busy));
    }
    function showResult() {
      if (!room?.result) return;
      const win = room.result.winner === room.you;
      bridge.modal('result', resultTitle(), room.result.winner === 'draw' ? 'A DUEL TO REMEMBER' : win ? 'VICTORY IS YOURS' : 'THE NEXT DUEL AWAITS',
        `<div class="pvp-result-content ${win ? 'win' : ''}"><div id="pvp-result-notice">${peerNoticeHTML(true)}</div><div class="pvp-result-emblem">${icon(win ? 'crown' : 'shield')}</div><p>${resultReason()}</p><div class="pvp-result-score"><div><small>${tr('决斗回合', 'TURNS', 'ターン')}</small><b>${room.result.turn}</b></div><div><small>${tr('你的生命值', 'YOUR LP', 'あなたのLP')}</small><b>${remote.state.players[0].lp.toLocaleString()}</b></div><div><small>${tr('对手生命值', 'OPPONENT LP', '相手のLP')}</small><b>${remote.state.players[1].lp.toLocaleString()}</b></div></div><p class="pvp-result-saved">${icon('check')}${tr('本局结果已保存。回到房间，可以互相邀请再战。', 'Result saved. Return to the room to request another duel.', '結果を保存しました。ルームで再戦を申し込めます。')}</p></div>`,
        `<button class="secondary-button pvp-result-journal" data-action="log">${tr('决斗记录', 'Duel journal', '対戦記録')}</button><button class="primary-button" data-pvp-action="room">${tr('返回房间', 'Return to room', 'ルームへ')} →</button>${leaveRoomButton()}`, 'pvp-result-modal');
    }
    function confirmSurrender() {
      bridge.modal('pvp-confirm', tr('确定结束这一局？', 'End this duel?', 'この対戦を終了しますか？'), 'SURRENDER',
        `<p class="modal-lead">${tr('认输后，对手将获得本局胜利。', 'Surrendering awards this duel to your opponent.', 'サレンダーすると相手の勝利になります。')}</p>`,
        `<button class="secondary-button" data-action="close-modal">${tr('继续决斗', 'Keep playing', '対戦を続ける')}</button><button class="primary-button" data-pvp-action="confirm-surrender">${tr('确认认输', 'Surrender', 'サレンダーする')}</button>`);
    }
    async function copy(value) {
      try { await navigator.clipboard.writeText(value); }
      catch { const input = document.createElement('textarea'); input.value = value; input.style.cssText = 'position:fixed;left:-9999px'; document.body.append(input); input.select(); const ok = document.execCommand('copy'); input.remove(); if (!ok) throw { message: tr('无法自动复制，请手动复制房间码：', 'Copy the room code manually: ', 'コードを手動でコピーしてください：') + room.code }; }
      bridge.toast(tr('已复制，可以分享给对手。', 'Copied. Share it with your opponent.', 'コピーしました。相手に共有してください。'));
    }
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-pvp-action]'); if (!button || button.disabled) return;
      const action = button.dataset.pvpAction;
      if (action === 'clock') { clockSeconds = Number(button.dataset.value); for (const b of screen.querySelectorAll('[data-pvp-action="clock"]')) { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); } return; }
      if (action === 'room') { bridge.show(); return; }
      if (action === 'board') { bridge.board(); return; }
      if (action === 'result') { showResult(); return; }
      if (action === 'surrender') { confirmSurrender(); return; }
      if (action === 'reconnect') { connection.reset(); return; }
      if (action === 'open-server') {
        try { const url = new URL(screen.querySelector('#pvp-server-url').value); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw Error(); url.hash = 'pvp'; root.location.assign(url.href); }
        catch { showError({ message: tr('请输入有效的 HTTP 或 HTTPS 服务器地址。', 'Enter a valid HTTP or HTTPS server address.', '有効なHTTPまたはHTTPSアドレスを入力してください。') }); }
        return;
      }
      run(async () => {
        lastError = ''; const errorNode = screen.querySelector('#pvp-error'); if (errorNode) errorNode.hidden = true;
        if (action === 'quick') { await identity(); await connection.request('queue', { deck: deckInput() }); }
        if (action === 'cancel-queue') await connection.request('cancel-queue');
        if (action === 'create') { await identity(); await connection.request('create', { title: screen.querySelector('#pvp-room-title').value, visibility: screen.querySelector('#pvp-visibility').value, clockSeconds }); }
        if (action === 'join') { await identity(); await connection.request('join', { code: button.dataset.code }); }
        if (action === 'refresh') await connection.request('list');
        if (action === 'ready') await connection.request('ready', { ready: !room.seats[room.you].ready, deck: deckInput() });
        if (action === 'leave') await connection.request('leave');
        if (action === 'rematch') await connection.request('rematch');
        if (action === 'confirm-surrender') { bridge.dismiss(); await connection.request('surrender'); }
        if (action === 'copy-code') await copy(room.code);
        if (action === 'copy-link') { const url = new URL(root.location.href); url.search = ''; url.hash = 'pvp/' + room.code; await copy(url.href); }
      });
    });
    screen.addEventListener('change', event => {
      if (event.target.matches('[data-pvp-deck]')) {
        selected = event.target.value; remember(); const preview = screen.querySelector('#pvp-deck-preview'); if (preview) { preview.innerHTML = artPreview(); root.DuelArt.refresh(preview); }
      }
      if (event.target.id === 'pvp-name') { nickname = event.target.value; remember(); }
    });
    screen.addEventListener('input', event => { if (event.target.id === 'pvp-code') event.target.value = event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''); });
    screen.addEventListener('submit', event => { if (event.target.id !== 'pvp-join-form') return; event.preventDefault(); const code = screen.querySelector('#pvp-code').value; run(async () => { await identity(); await connection.request('join', { code }); }); });
    root.addEventListener('duel-language-change', () => { layout = ''; render(); renderBar(); updateStatus(); updateClocks(); updatePeerNotice(room, false); });
    root.addEventListener('hashchange', () => { if (root.location.hash.startsWith('#pvp')) bridge.show(); });
    setInterval(updateClocks, 500);
    setInterval(() => { if (shown && !room && connection.connected) connection.request('list').catch(() => {}); }, 10_000);
    if (connection.session) setTimeout(() => connection.connect(connection.name), 0);
    return {
      show() { shown = true; render(); if (!connection.connected && !connection.stopped) connection.connect(nickname); },
      hide() { shown = false; },
      get room() { return room; }, get connected() { return connection.connected; }, get connection() { return connection; },
      get active() { return room?.status === 'playing'; },
      showResult, updateClocks
    };
  }
  root.DuelPVP = { create };
})(globalThis);
