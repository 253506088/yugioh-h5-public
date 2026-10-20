(function(root){
  const entries=[
    ['语言资料暂时无法加载，请检查连接后重试。','Language files could not load. Check your connection and try again.','言語データを読み込めません。接続を確認して再試行してください。'],
    ['功能暂时无法加载，请检查连接并刷新页面。','This feature could not load. Check your connection and reload.','機能を読み込めません。接続を確認して再読み込みしてください。'],
    ['导出录像','Export replay','リプレイを書き出す'],
    ['进入决斗 →','Enter duel →','デュエルへ →'],
    ['正在加载完整卡片资料…','Loading full card texts…','カード全文を読み込み中…'],
    ['P2P · 好友直连 ↗','P2P · Direct friend duel ↗','P2P・フレンド接続 ↗'],
    ['正在计算整场对局…','Computing the full duel…','デュエルを計算中…'],['播放速度','Playback speed','再生速度'],['回放进度','Replay position','再生位置'],
    ['决斗面板','Duel panel','デュエルパネル'],['收起面板','Close panel','パネルを閉じる'],
    ['决斗盘卡面大小','Field card size','フィールドのカードサイズ'],['紧凑','Compact','コンパクト'],['大卡面','Large cards','大きいカード'],
    ['先后手由猜拳决定','Rock–paper–scissors decides who starts','じゃんけんで先攻を決定'],
    ['请选择你的出手','Choose your hand','手を選んでください'],['猜拳决定先攻','Play for the first turn','じゃんけんで先攻を決める'],
    ['平局，请再次出手。','A tie. Choose again.','引き分け。もう一度。'],['你获得先攻。','You go first.','あなたが先攻です。'],['对手获得先攻。','Your opponent goes first.','相手が先攻です。'],
    ['石头','Rock','グー'],['剪刀','Scissors','チョキ'],['布','Paper','パー']
  ];
  for(const [zh,en,ja]of entries)root.DuelUITranslations.messages[zh]={en,ja};
})(globalThis);
