/* 2025 choices and distinct action captions, shared by Node and offline HTML. */
(function(root){'use strict';const ui=root.DuelUITranslations;
const rows=`
2025 年效果待落实，不可编入正式构筑|2025 effect pending; unavailable for validated Duel decks|2025年の効果は未実装。正式なデュエル用デッキには使用できません。
码丽丝|Maliss|Ｍ∀ＬＩＣＥ
雷热涡炉|Ryzeal|ライゼオル
选择盖放的K9速攻魔法|Choose a K9 Quick-Play Spell to Set|セットするK9速攻魔法を選択
选择送墓的K9|Choose a K9 card to send to the GY|墓地へ送るK9カードを選択
选择展示的五星怪兽|Choose a Level 5 monster to reveal|公開するレベル5モンスターを選択
选择复活的五星K9|Choose a Level 5 K9 to revive|蘇生するレベル5のK9を選択
选择检索的K9|Choose a K9 card to add to hand|手札に加えるK9カードを選択
选择叠放召唤的K9|Choose a K9 to Xyz Summon|重ねてX召喚するK9を選択
选择场上与墓地除外卡|Choose cards on the field and in the GY to banish|フィールド・墓地から除外するカードを選択
选择暂时除外的手牌|Choose a hand card to banish temporarily|一時的に除外する手札を選択
选择展示的VS怪兽|Choose a VS monster to reveal|公開するVSモンスターを選択
地暗：取得最低攻击力怪兽|EARTH + DARK: take the lowest-ATK monster|地・闇：最低攻撃力のモンスターのコントロールを得る
炎暗：从卡组特殊召唤VS|FIRE + DARK: Special Summon a VS from Deck|炎・闇：デッキからVSを特殊召喚
选择最低攻击力的怪兽|Choose a monster with the lowest ATK|攻撃力が一番低いモンスターを選択
选择VS怪兽|Choose a VS monster|VSモンスターを選択
选择盖放的VS陷阱|Choose a VS Trap to Set|セットするVS罠を選択
本作适配：每卡名每回合第一次可替代的破坏自动展示一张真实VS手牌；展示不丢弃该卡。|Game adaptation: once per name per turn, automatically reveal a real VS card in hand to replace destruction. It stays in hand.|本作の調整：カード名につき毎ターン1度、破壊の代わりに実際の手札のVSを自動で公開。捨てません。
选择检索的月光怪兽|Choose a Lunalight monster to add to hand|手札に加えるムーンライトを選択
选择回收的月光怪兽|Choose a Lunalight monster to recover|回収するムーンライトを選択
选择特殊召唤的月光怪兽|Choose a Lunalight monster to Special Summon|特殊召喚するムーンライトを選択
选择除外的月光融合怪兽|Choose a Lunalight Fusion Monster to banish|除外するムーンライト融合モンスターを選択
选择返回手牌的月光卡片|Choose a Lunalight card to return to hand|手札に戻すムーンライトカードを選択
可以特殊召唤月光怪兽|You may Special Summon a Lunalight monster|ムーンライトを特殊召喚できる
选择送墓的月光额外怪兽|Choose a Lunalight Extra Deck monster to send to the GY|墓地へ送るEXデッキのムーンライトを選択
选择送墓的月光怪兽|Choose a Lunalight monster to send to the GY|墓地へ送るムーンライトを選択
选择回收的融合|Choose Polymerization to recover|回収する「融合」を選択
可以丢弃手牌以使用墓地素材|You may discard a card to enable GY materials|手札を捨てて墓地の融合素材を使用できる
选择送墓的月光手牌|Choose a Lunalight hand card to send to the GY|墓地へ送る手札のムーンライトを選択
选择复活的月光怪兽|Choose a Lunalight monster to revive|蘇生するムーンライトを選択
选择强化的融合怪兽|Choose a Fusion Monster to boost|強化する融合モンスターを選択
选择除外的码丽丝|Choose a Maliss card to banish|除外するＭ∀ＬＩＣＥを選択
选择盖放的码丽丝陷阱|Choose a Maliss Trap to Set|セットするＭ∀ＬＩＣＥ罠を選択
选择回收的码丽丝|Choose a Maliss card to recover|回収するＭ∀ＬＩＣＥを選択
选择除外的电子界族|Choose a Cyberse to banish|除外するサイバース族を選択
选择洗回的码丽丝|Choose a Maliss card to shuffle back|デッキに戻すＭ∀ＬＩＣＥを選択
选择除外的码丽丝代价|Choose a Maliss monster to banish as cost|コストで除外するＭ∀ＬＩＣＥを選択
选择检索的码丽丝|Choose a Maliss card to add to hand|手札に加えるＭ∀ＬＩＣＥを選択
选择特殊召唤的码丽丝|Choose a Maliss monster to Special Summon|特殊召喚するＭ∀ＬＩＣＥを選択
选择除外的墓地码丽丝|Choose a Maliss card in the GY to banish|除外する墓地のＭ∀ＬＩＣＥを選択
选择送墓的额外超量怪兽|Choose an Extra Deck Xyz Monster to send to the GY|墓地へ送るEXデッキのXモンスターを選択
选择移除的超量素材|Choose Xyz materials to detach|取り除くX素材を選択
选择盖放的雷热涡炉|Choose a Ryzeal card to Set|セットするライゼオルを選択
选择复活的雷热涡炉|Choose a Ryzeal monster to revive|蘇生するライゼオルを選択
选择不同名的雷热涡炉|Choose Ryzeal cards with different names|カード名の異なるライゼオルを選択
本作适配：破坏替代自动选择价值最低的真实素材，每卡名每回合一次；发动与对象选择仍使用正常连锁。|Game adaptation: destruction replacement automatically detaches the lowest-value real material, once per name per turn. Activated effects use normal Chains and targeting.|本作の調整：カード名につき毎ターン1度、破壊の代わりに評価値が最も低い実際の素材を自動で取り除きます。発動効果は通常のチェーンと対象選択を使用。
选择放回卡组底部的雷热涡炉|Choose Ryzeal cards to put on the bottom of the Deck|デッキの一番下に戻すライゼオルを選択
移除素材使正在结算的效果无效|Detach a material to negate the resolving effect|素材を取り除き、処理中の効果を無効にする
选择叠放的雷热涡炉|Choose a Ryzeal card to attach|X素材にするライゼオルを選択
选择叠放素材的四阶怪兽|Choose a Rank 4 monster to receive the material|素材を重ねるランク4を選択
选择零衣与露世|Choose Raye and Roze|レイとロゼを選択
选择强化的闪刀怪兽|Choose a Sky Striker monster to boost|強化する閃刀モンスターを選択
选择装备的闪刀连接怪兽|Choose a Sky Striker Link Monster to equip|装備先の閃刀リンクモンスターを選択
选择送墓的其他场上卡片|Choose another field card to send to the GY|墓地へ送る他のフィールドのカードを選択
选择特殊召唤的闪刀连接怪兽|Choose a Sky Striker Link Monster to Special Summon|特殊召喚する閃刀リンクモンスターを選択
选择除外的墓地魔法|Choose a Spell in the GY to banish|除外する墓地の魔法を選択
选择返回手牌的场上卡片|Choose field cards to return to hand|手札に戻すフィールドのカードを選択
选择等量闪刀姬与闪刀魔法|Choose equal numbers of Sky Striker Aces and Spells|同じ数の閃刀姫と閃刀魔法を選択
选择连接怪兽与素材|Choose a Link Monster and its materials|リンクモンスターと素材を選択
选择复活的电子界族|Choose a Cyberse to revive|蘇生するサイバース族を選択
选择复活的电子界连接怪兽|Choose a Cyberse Link Monster to revive|蘇生するサイバース族リンクモンスターを選択
选择连接箭头指向的区域|Choose a zone a Link Arrow points to|リンク先のゾーンを選択
选择超量怪兽与素材|Choose an Xyz Monster and its materials|Xモンスターと素材を選択
`.trim().split('\n').map(r=>r.split('|'));
for(const[zh,en,ja]of rows)ui.messages[zh]={en,ja};
const actions={
 'y25-special':['特殊召唤','Special Summon','特殊召喚'], 'y25-search':['检索卡片','Add a card to hand','カードを手札に加える'],
 'y25-revive':['复活怪兽','Revive a monster','モンスターを蘇生'], 'y25-banish':['除外卡片','Banish cards','カードを除外'],
 'y25-return':['除外后复活','Revive after banishment','除外後に蘇生'], 'y25-recover':['回收卡片','Recover a card','カードを回収'],
 'y25-set':['盖放卡片','Set a card','カードをセット'], 'y25-draw':['调配资源并抽卡','Cycle resources and draw','リソースを循環してドロー'],
 'y25-attach':['补充超量素材','Attach an Xyz material','X素材を補充'], 'y25-destroy':['破坏卡片','Destroy a card','カードを破壊'],
 'y25-send':['从卡组送墓','Send from Deck to GY','デッキから墓地へ送る'], 'y25-pair':['同时特殊召唤两只','Special Summon both monsters','2体を同時に特殊召喚'],
 'y25-negate':['无效对方发动或效果','Negate an activation or effect','発動または効果を無効'], 'y25-xyz':['用此卡超量召唤','Xyz Summon using this card','このカードでX召喚'],
 'y25-reset':['从墓地重新盖放','Set from the GY','墓地から再セット'], 'y25-reveal':['展示属性并发动效果','Reveal Attributes for an effect','属性を公開して効果を発動'],
 'y25-recruit':['特殊召唤支援怪兽','Special Summon support','支援モンスターを特殊召喚'], 'y25-bounce':['返回手牌并展开','Return to hand and extend','手札に戻して展開'],
 'y25-reduce':['除外自身降低攻击力','Banish self to reduce ATK','自身を除外して攻撃力を下げる'], 'y25-wipe':['送墓额外并破坏特殊召唤怪兽','Send Extra Deck cost; destroy Special Summons','EXを墓地へ送り特殊召喚モンスターを破壊'],
 'y25-cycle':['送墓手牌并抽卡','Send a hand card and draw','手札を墓地へ送りドロー'], 'y25-boost':['强化攻击力','Increase ATK','攻撃力を強化'],
 'y25-equip':['从墓地装备','Equip from GY','墓地から装備'], 'y25-battle-destroy':['战斗开始时破坏','Destroy at start of damage step','ダメージステップ開始時に破壊'],
 'y25-link':['立即连接召唤','Immediately Link Summon','効果処理後にリンク召喚']
};
// Names are explicit because Node may load UI captions before effect registration.
ui.effectActions||={};for(const name of ["Maliss \u003cP> Dormouse","Maliss \u003cP> White Rabbit","Maliss \u003cP> Chessy Cat","Maliss \u003cP> March Hare","Maliss \u003cQ> Red Ransom","Maliss \u003cQ> White Binder","Maliss \u003cQ> Hearts Crypter","Maliss in the Mirror","Ice Ryzeal","Ext Ryzeal","Sword Ryzeal","Node Ryzeal","Star Ryzeal","Ryzeal Duo Drive","Ryzeal Detonator","Ryzeal Cross","\"A Case for K9\"","K9-17 Izuna","K9-66a Jokul","K9-66b Lantern","K9-ØØ Lupis","K9-17 \"Ripper\"","K9-ØØ \"Hound\"","K9-LC Release Restraint","K9-X Forced Release","K9-X \"Werewolf\"","Vanquish Soul Rocks","Vanquish Soul Hollie Sue","Vanquish Soul, Start!","Lunalight Gold Leo","Lunalight Silver Hound","Lunalight Perfume Dancer","Lunalight Liger Dancer","Lunalight Masquerade","Lunalight Emerald Bird","Lunalight Yellow Marten","Lunalight Sabre Dancer","Sky Striker Ace = Zero","Sky Striker Mecha - Adil Saber","Sky Striker Ace - Azalea","Sky Striker Special Maneuver - Lemnisgate!","Splash Mage","Transcode Talker","Parallel eXceed"]){ui.effectActions[name]={...ui.effectActions[name],...actions};}
})(globalThis);
