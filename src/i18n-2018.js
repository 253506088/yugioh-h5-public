(function(root){'use strict';const words=[
 ['选择特殊召唤的怪兽','Choose a monster to Special Summon','特殊召喚するモンスターを選択'],
 ['选择回到手牌的卡片','Choose a card to return to the hand','手札に戻すカードを選択'],
 ['选择放回卡组的卡片','Choose cards to return to the Deck','デッキに戻すカードを選択'],
 ['请选择不同等级的怪兽。','Choose monsters with different Levels.','レベルが異なるモンスターを選択してください。'],
 ['选择加入手牌的卡片','Choose a card to add to the hand','手札に加えるカードを選択'],
 ['请选择不同名且数量合法的装备魔法。','Choose differently named Equip Spells whose count matches a legal monster Level.','特殊召喚可能なレベルと枚数が一致する、名前の異なる装備魔法を選択してください。'],
 ['选择召唤的怪兽','Choose a monster to Normal Summon','通常召喚するモンスターを選択'],
 ['选择盖放的卡片','Choose a card to Set','セットするカードを選択'],
 ['控制怪兽时不能通常召唤这张卡。','This card cannot be Normal Summoned while you control a monster.','モンスターをコントロールしている場合、このカードは通常召喚できません。'],
 ['卡组顶','Top of the Deck','デッキの一番上'],['卡组底','Bottom of the Deck','デッキの一番下'],
 ['抽1张卡','Draw 1 card','1枚ドロー'],['不抽卡','Do not draw','ドローしない'],
 ['本作适配：可选破坏代替自动除外墓地中价值最低的合法卡。','Game adaptation: optional destruction replacement automatically banishes the lowest-value legal cards from the GY.','本作の処理：任意の破壊代替では、墓地の合法なカードから評価が最も低いものを自動で除外します。'],
 ['2018 年效果待落实，不可编入正式构筑','2018 effect pending; unavailable for validated Duel decks','2018年の効果は未実装。正式なデュエル用デッキには使用できません。']
 ];for(const[zh,en,ja]of words)root.DuelUITranslations.messages[zh]={en,ja};})(globalThis);
