(function(root){
  'use strict';
  const entries=[
    ['因卡片效果跳过这次抽卡阶段','This Draw Phase is skipped by a card effect.','カードの効果でこのドローフェイズをスキップ。'],
    ['支配者之雷：本回合不能进行战斗阶段','Thunder of Ruler: no Battle Phase this turn.','覇者の一括：このターンはバトルフェイズを行えない。']
  ];
  for(const [zh,en,ja] of entries)root.DuelUITranslations.messages[zh]={en,ja};
})(globalThis);
