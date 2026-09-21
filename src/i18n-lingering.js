(function(root){
  'use strict';
  const entries=[
    ['生效中的效果','Active effects','適用中の効果'],
    ['ACTIVE EFFECTS · 已结算、仍在生效','ACTIVE EFFECTS · resolved and still in force','ACTIVE EFFECTS · 解決済みで継続中'],
    ['当前没有生效中的持续效果。','No lingering effects are in force right now.','現在適用中の継続効果はありません。'],
    ['这里列出已经结算、仍在生效的效果：伤害保护、召唤限制、效果无效等。持续魔法·陷阱卡本身请直接查看场上的卡片。','Effects that already resolved but still apply: damage protection, summon restrictions, negated effects and so on. Continuous Spell and Trap Cards are shown on the field itself.','解決済みで今も適用されている効果（ダメージ防止、召喚制限、効果無効など）を一覧します。永続魔法・罠カードはフィールド上のカードをご確認ください。'],
    ['双方','Both players','両方'],
    ['里侧卡牌','Face-down card','裏側表示のカード'],
    ['无效','Negated','無効'],
    ['效果无效','Effects negated','効果無効'],
    ['本回合','this turn','このターン'],
    ['持续中','ongoing','継続中']
  ];
  for(const [zh,en,ja] of entries)root.DuelUITranslations.messages[zh]={en,ja};
  root.DuelUITranslations.patterns||=[];
  root.DuelUITranslations.patterns.push(['^至第 ([0-9]+) 回合$','until turn $1','$1ターン目まで']);
})(globalThis);
