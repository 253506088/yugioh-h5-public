(function(root){
 'use strict';
 const P=root.DuelP2P;
 const tr=(zh,en,ja)=>root.DuelI18n.language==='en'?en:root.DuelI18n.language==='ja'?ja:zh;
 const esc=value=>root.DuelView.escape(value);
 const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),n=>n.toString(16).padStart(2,'0')).join('');
 function create(bridge){
  const node=document.getElementById('pvp-screen'),bar=document.getElementById('pvp-duel-bar');
  let peer,host,remote,localDeck,remoteDeck,shown=false,selected='blue',stun=true,output='',input='',status='idle',error='',hands={},commits={},ownHand=null,round=0,rpsCompleted=false,helloSent=false,rematches=new Set();
  const connection={get connected(){return !!peer?.connected;},request:async(type,payload)=>{
   if(!peer?.connected)throw Error(tr('连接中断，请交换重连文本。','Disconnected. Exchange reconnect codes.','切断されました。再接続コードを交換してください。'));
   if(peer.host){const result=host.request(0,type,payload);if(type!=='validate')publish();return result;}
   return peer.request(type,payload);
  }};
  function frame(data){
   P.validateFrame(data);
   if(!remote||data.gameId!==remote.data.gameId){remote=new root.DuelPVPClient.RemoteEngine(data,connection,e=>bridge.toast(e.message,true));remote.p2p=true;bridge.attach(remote);}
   else{remote.blocked=!peer.connected;remote.update(data);}
   bar.hidden=false;bar.innerHTML='<b>P2P · '+tr('好友对战','Friends duel','フレンド対戦')+'</b><span>'+tr('房主主持','Host authoritative','ホスト管理')+'</span><button data-action="p2p">'+tr('连接详情','Connection','接続情報')+'</button><button data-p2p="surrender">'+tr('认输本局','Concede','投了')+'</button>';
  }
  function publish(){frame(host.frame(0));peer.send({type:'frame',frame:host.frame(1)});}
  function resetRound(){round++;rpsCompleted=false;hands={};commits={};ownHand=null;render();}
  async function reveal(){if(ownHand&&commits[0]&&commits[1]&&hands[peer.host?0:1]===undefined){const seat=peer.host?0:1;hands[seat]=ownHand.hand;peer.send({type:'reveal',round,hand:ownHand.hand,nonce:ownHand.nonce});await result();}}
  async function result(){
   if(rpsCompleted||hands[0]===undefined||hands[1]===undefined)return;
   if(hands[0]===hands[1]){status='tie';resetRound();return;}
   rpsCompleted=true;const first=(hands[0]-hands[1]+3)%3===2?0:1;
   if(peer.host){host=new P.Host([localDeck,remoteDeck],first);publish();}status='playing';render();
  }
  async function receive(message){
   const sourcePeer=peer,sourceRound=round;
   if(message.type==='hello'){
    if(host&&host.room.engine.state.winner===null)return;
    if(message.build!==root.DUEL_BUILD_CONFIG.rulesHash)throw Error(tr('双方版本不同，请使用同一发布版本。','Versions differ. Use the same release.','バージョンが異なります。同じリリースを使用してください。'));
    remoteDeck=P.validateDeck(message.deck);status='ready';render();return;
   }
   if(message.type==='commit'){
    if(!remoteDeck||remote?.state.winner===null)return;
    if(message.round!==round||typeof message.value!=='string'||!/^[a-f0-9]{64}$/.test(message.value))throw Error('Invalid RPS commitment');
    const seat=peer.host?1:0;if(commits[seat]&&commits[seat]!==message.value)throw Error('RPS commitment cannot change');
    commits[seat]=message.value;await reveal();return;
   }
   if(message.type==='reveal'){
    if(message.round!==round||!commits[0]||!commits[1]||![0,1,2].includes(message.hand)||typeof message.nonce!=='string'||message.nonce.length!==32)throw Error('Invalid RPS reveal');
    const seat=peer.host?1:0;
    const value=await digest(round+':'+message.hand+':'+message.nonce);
    if(peer!==sourcePeer||round!==sourceRound)return;
    if(value!==commits[seat])throw Error('RPS commitment mismatch');
    hands[seat]=message.hand;await result();return;
   }
   if(message.type==='frame'&&!peer.host){if(!hands[0]&&hands[0]!==0)return;frame(message.frame);status='playing';render();return;}
   if(message.type==='request'&&peer.host){
    try{const value=host.request(1,message.request,message.payload);if(message.request!=='validate')publish();peer.send({type:'ack',id:message.id,result:value});}
    catch(e){peer.send({type:'ack',id:message.id,error:e.message});peer.send({type:'frame',frame:host.frame(1)});}return;
   }
   if(message.type==='rematch'&&remote&&remote.state.winner!==null){rematches.add(1);if(rematches.size===2){host=null;remote=null;remoteDeck=null;rematches.clear();resetRound();peer.send({type:'hello',deck:localDeck,build:root.DUEL_BUILD_CONFIG.rulesHash});}render();}
  }
  function createPeer(isHost){
   if(!root.RTCPeerConnection||!root.crypto?.subtle)throw Error(tr('此浏览器无法建立好友直连，请使用新版浏览器或服务器联机。','Use a current browser or server mode for this connection.','最新のブラウザーかサーバーモードをご利用ください。'));
   if(peer){peer.close();bridge.detach();}host=null;remote=null;remoteDeck=null;round=1;rpsCompleted=false;helloSent=false;hands={};commits={};ownHand=null;error='';
   localDeck=P.validateDeck(root.DuelDecks.list().find(d=>d.id===selected)||root.DuelDecks.list()[0]);
   let incoming=Promise.resolve();
   const nextPeer=new P.Peer({host:isHost,stun,message:m=>{
    // DataChannel is ordered, but digest() is asynchronous. Finish verifying
    // the reveal before applying a frame sent immediately after that reveal.
    incoming=incoming.then(()=>{if(peer===nextPeer)return receive(m);}).catch(e=>{if(peer===nextPeer){error=e.message;render();bridge.toast(error,true);}});
   },status:(s,detail)=>{
    if(peer!==nextPeer)return;
    const previous=status;status=s;if(detail)error=detail;
    if(remote){remote.blocked=s!=='connected';remote.onBusyUpdate();}
    if(s==='connected'&&peer.connected){if(host)publish();else if(!remote&&!helloSent){peer.send({type:'hello',deck:localDeck,build:root.DUEL_BUILD_CONFIG.rulesHash});helloSent=true;}}
    render();
   }});peer=nextPeer;
  }
  function render(){
   if(!shown)return;
   const connected=peer?.connected,playing=remote?.state.winner===null;
   const statuses={idle:tr('先选择卡组，再交换邀请。','Choose a deck, then exchange codes.','デッキを選び、コードを交換。'),connected:tr('已连接','Connected','接続済み'),ready:tr('已连接，请出拳决定先攻。','Connected. Play rock–paper–scissors.','接続済み。じゃんけんで先攻を決定。'),tie:tr('平局，请再次出拳。','Tie. Choose again.','引き分け。もう一度。'),disconnected:tr('已断线。房主生成重连邀请后，再交换一次文本。','Disconnected. The host can generate a reconnect offer.','切断。ホストが再接続コードを生成し、再度交換してください。'),failed:tr('打洞失败，可重试或改用服务器联机。','Could not establish a direct connection. Retry or use server mode.','直接接続に失敗。再試行するかサーバーモードを使用してください。')};
   node.innerHTML='<section class="p2p-page" data-i18n-skip><div class="p2p-heading"><small>WEBRTC / FRIENDS</small><h1>'+tr('和朋友，直接开局。','A direct duel with a friend.','友達と直接デュエル。')+'</h1><p>'+tr('无需游戏服务器。双方交换两段文本即可连接；公共 STUN 仅用于发现网络地址。房主主持规则，适合彼此信任的好友。','No game server. Exchange two codes; public STUN discovers network addresses. The host runs the rules, for trusted friends.','ゲームサーバー不要。2つのコードを交換し接続。公開STUNはアドレス検出に使用。信頼できる友達とのホスト管理対戦です。')+'</p></div><div class="p2p-controls"><label>'+tr('出战卡组','Deck','デッキ')+'<select id="p2p-deck"'+(peer?' disabled':'')+'>'+root.DuelDecks.list().map(d=>'<option value="'+d.id+'"'+(d.id===selected?' selected':'')+'>'+esc(root.DuelI18n.deck(d).name)+'</option>').join('')+'</select></label><label><input type="checkbox" id="p2p-stun"'+(stun?' checked':'')+(peer?' disabled':'')+'>'+tr('使用公共 STUN（跨网络连接）','Public STUN (across networks)','公開STUN（別ネットワーク）')+'</label><div class="p2p-actions"><button class="primary-button" data-p2p="host"'+(peer?' disabled':'')+'>'+tr('我是房主 · 生成邀请','Host · create offer','ホスト・招待を生成')+'</button><button class="secondary-button" data-p2p="join"'+(peer?' disabled':'')+'>'+tr('我是来宾 · 输入邀请','Guest · enter offer','ゲスト・招待を入力')+'</button></div><p role="status">'+esc(statuses[status]||status)+'</p>'+(error?'<p class="p2p-error">'+esc(error)+'</p>':'')+'</div><div class="p2p-codes"><label>'+tr('发给朋友的文本','Send this code to your friend','友達に送るコード')+'<textarea id="p2p-output" readonly>'+esc(output)+'</textarea><button data-p2p="copy">'+tr('复制文本','Copy','コピー')+'</button></label><label>'+tr('粘贴朋友发来的文本','Paste your friend’s code','友達のコードを貼り付け')+'<textarea id="p2p-input">'+esc(input)+'</textarea><button class="primary-button" data-p2p="accept"'+(!peer?' disabled':'')+'>'+tr('使用这段文本','Apply code','コードを適用')+'</button></label></div>'+
    (connected&&remoteDeck&&!playing?'<div class="rps-picks">'+['✊','✌️','🖐️'].map((hand,i)=>'<button data-p2p="hand" data-value="'+i+'"'+(ownHand?' disabled':'')+'>'+hand+'</button>').join('')+'</div>':'')+
    '<div class="p2p-actions">'+(remote?'<button class="primary-button" data-p2p="board">'+tr('返回决斗','Back to duel','デュエルに戻る')+'</button>':'')+(remote&&remote.state.winner!==null?'<button data-p2p="rematch">'+tr('准备再战（双方确认后猜拳）','Ready to rematch (both players)','再戦の準備（両者確認後じゃんけん）')+'</button>':'')+(peer?.host?'<button data-p2p="restart">'+tr('生成重连邀请','Reconnect offer','再接続コード')+'</button>':'')+(peer?'<button data-p2p="leave">'+tr('断开并返回','Disconnect and return','切断して戻る')+'</button>':'')+'<button data-p2p="server"'+(playing?' disabled':' ')+'>'+tr('服务器联机','Server mode','サーバーモード')+'</button></div></section>';
  }
  let busy=false;
  function disconnect(){
   const old=peer;peer=null;old?.close();host=null;remote=null;remoteDeck=null;
   rematches.clear();output='';input='';status='idle';bridge.detach();bar.hidden=true;
  }
  document.addEventListener('click',async event=>{
   const b=event.target.closest('[data-p2p]');if(!b||busy)return;busy=true;
   try{
    const action=b.dataset.p2p;input=node.querySelector('#p2p-input')?.value||input;
    if(action==='host'||action==='join'){createPeer(action==='host');status='connecting';render();if(action==='host')output=await peer.offer();}
    if(action==='accept')output=await peer.accept(input)||output;
    if(action==='copy'){try{await navigator.clipboard.writeText(output);}catch{const field=node.querySelector('#p2p-output');field.focus();field.select();if(!document.execCommand('copy'))bridge.toast(tr('请手动复制已选中的文本。','Copy the selected text manually.','選択したテキストを手動でコピーしてください。'));}}
    if(action==='restart')output=await peer.offer(true);
    if(action==='hand'){
     const hand=Number(b.dataset.value);if(!connectedReady()||ownHand)return;ownHand={hand,nonce:P.randomId()};const seat=peer.host?0:1;
     commits[seat]=await digest(round+':'+hand+':'+ownHand.nonce);peer.send({type:'commit',round,value:commits[seat]});await reveal();
    }
    if(action==='board')bridge.board();
    if(action==='surrender'&&remote)await connection.request('surrender',{gameId:remote.data.gameId,revision:remote.revision});
    if(action==='rematch'){rematches.add(0);peer.send({type:'rematch'});if(rematches.size===2){host=null;remote=null;remoteDeck=null;rematches.clear();resetRound();peer.send({type:'hello',deck:localDeck,build:root.DUEL_BUILD_CONFIG.rulesHash});}}
    if(action==='leave'){disconnect();bridge.home();}
    if(action==='server'&&remote?.state.winner!==null){disconnect();shown=false;bridge.server();}
   }catch(e){error=e.message;bridge.toast(error,true);}finally{busy=false;if(b.dataset.p2p!=='copy')render();}
  });
  function connectedReady(){return peer?.connected&&remoteDeck&&(!remote||remote.state.winner!==null);}
  node.addEventListener('change',event=>{if(event.target.id==='p2p-deck')selected=event.target.value;if(event.target.id==='p2p-stun')stun=event.target.checked;});
  node.addEventListener('input',event=>{if(event.target.id==='p2p-input')input=event.target.value;});
  return {show(){shown=true;render();},hide(){shown=false;},showResult(){bridge.show();},get active(){return !!peer;},get remote(){return remote;}};
 }
 root.DuelP2PUI={create};
})(globalThis);
