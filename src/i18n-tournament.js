(function (root) {
  'use strict';
  const entries = [
    ['死斗竞技场', 'Bot Arena', 'ロボット闘技場'],
    ['万千可能，只留一位冠军。', 'Many contenders. One champion.', '可能性は無限。王者は1体。'],
    ['机器人淘汰赛', 'Bot tournament', 'ロボット大会'],
    ['LP 较高者晋级', 'Higher LP advances', 'LPの多い側が進出'],
    ['累计伤害较高者晋级', 'Higher damage advances', '与ダメージの多い側が進出'],
    ['同分，按赛前种子抽签晋级', 'Still tied: seeded draw decides advancement', '同点のため事前シード抽選で進出を決定']
  ];
  for (const [zh, en, ja] of entries) root.DuelUITranslations.messages[zh] = {en, ja};
})(globalThis);
