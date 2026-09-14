(function (root) {
  'use strict';
  const entries = [
    ['联机对战', 'Online duels', 'オンライン対戦'],
    ['这一局，与真正的对手交锋。', 'This time, face a real opponent.', 'この一戦で、本当の対戦相手と。'],
    ['邀请好友 · 单局决胜', 'Invite friends · Single duel', '友達を招待・シングル戦'],
    ['返回联机房间', 'Return to room', 'ルームへ戻る'],
    ['等待连接与确认…', 'Waiting for connection…', '接続を待っています…'],
    ['等待服务器连接与确认…', 'Waiting for server confirmation…', 'サーバーの確認を待っています…'],
    ['联机进度由服务器保存', 'Duel saved on server', 'サーバーに保存されます'],
    ['请先离开联机房间，再开始其他对局。', 'Leave the online room before starting another duel.', '別の対戦を始める前にルームを退出してください。'],
    ['对手的卡组', 'Opponent’s deck', '相手のデッキ'],
    ['对手的构筑在本局中保密。', 'Your opponent’s deck list is private.', '相手のデッキリストは非公開です。'],
    ['未公开卡牌', 'Unrevealed card', '非公開のカード'],
    ['未公开的卡片', 'Unrevealed card', '非公開のカード'],
    ['等待对手完成选择', 'Waiting for opponent’s choice', '相手の選択を待っています'],
    ['真人决斗者', 'Duelist', '決闘者'],
    ['正在校验选择…', 'Validating selection…', '選択を確認しています…'],
    ['联机局面由服务器确认。', 'The server confirms the online game state.', 'オンラインの盤面はサーバーが確認します。']
  ];
  for (const [zh, en, ja] of entries) root.DuelUITranslations.messages[zh] = { en, ja };
})(globalThis);
