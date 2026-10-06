/* Annual prompts are maintained with the corresponding rules. */
(function(root){'use strict';const rows=`
2024 年效果待落实，不可编入正式构筑|2024 effect pending; unavailable for validated Duel decks|2024年の効果は未実装。正式なデュエル用デッキには使用できません。
魔锻|Fiendsmith|デモンスミス
天杯龙|Tenpai Dragon|天盃龍
蛇眼|Snake-Eye|スネークアイ
尤贝尔|Yubel|ユベル
选择送墓的魔锻装备|Choose a Fiendsmith Equip Card to send to the GY|墓地へ送るデモンスミス装備カードを選択
选择洗回的光属性恶魔族|Choose a LIGHT Fiend to shuffle into the Deck|デッキに戻す光属性・悪魔族を選択
选择检索的光属性恶魔族|Choose a LIGHT Fiend to add to hand|手札に加える光属性・悪魔族を選択
选择装备的光属性恶魔族|Choose a LIGHT Fiend to equip|装備する光属性・悪魔族を選択
选择回收的光属性恶魔族|Choose a LIGHT Fiend to recover|回収する光属性・悪魔族を選択
选择效果无效的表侧卡片|Choose face-up cards to negate|効果を無効にする表側カードを選択
选择回收的一星炎属性怪兽|Choose a Level 1 FIRE monster to recover|回収するレベル1の炎属性モンスターを選択
选择送墓的两张表侧卡片|Choose two face-up cards to send to the GY|墓地へ送る表側カード2枚を選択
选择作为永续魔法放置的炎属性怪兽|Choose a FIRE monster to place as a Continuous Spell|永続魔法として置く炎属性モンスターを選択
选择作为永续魔法放置的怪兽|Choose a monster to place as a Continuous Spell|永続魔法として置くモンスターを選択
选择后场的怪兽卡|Choose a Monster Card in the Spell & Trap Zone|魔法＆罠ゾーンのモンスターカードを選択
选择复活的两只一星炎属性怪兽|Choose two Level 1 FIRE monsters to revive|蘇生するレベル1の炎属性モンスター2体を選択
选择放置为永续魔法的蛇眼|Choose a Snake-Eye to place as a Continuous Spell|永続魔法として置くスネークアイを選択
选择破坏的卡片种类|Choose the type of cards to destroy|破壊するカードの種類を選択
选择破坏的自己炎属性怪兽|Choose your FIRE monster to destroy|破壊する自分の炎属性モンスターを選択
选择复活的连接三以下怪兽|Choose a Link-3 or lower monster to revive|蘇生するリンク3以下のモンスターを選択
选择被破坏的炎属性怪兽|Choose the destroyed FIRE monster|破壊された炎属性モンスターを選択
选择灿幻魔法陷阱|Choose a Sangen Spell/Trap|燦幻魔法・罠を選択
选择复活的低星炎属性龙族|Choose a Level 4 or lower FIRE Dragon to revive|蘇生するレベル4以下の炎属性・ドラゴン族を選択
等级变为四|Increase Level to 4|レベルを4にする
保持等级三|Keep Level 3|レベル3のままにする
选择检索的天杯龙|Choose a Tenpai Dragon to add to hand|手札に加える天盃龍を選択
选择攻击力翻倍的龙族同调|Choose a Dragon Synchro Monster to double its ATK|攻撃力を倍にするドラゴン族Sモンスターを選択
选择低星炎属性龙族|Choose a Level 4 or lower FIRE Dragon|レベル4以下の炎属性・ドラゴン族を選択
检索后特殊召唤|Add to hand, then Special Summon|手札に加えた後、特殊召喚
选择复活的炎属性龙族|Choose a FIRE Dragon to revive|蘇生する炎属性・ドラゴン族を選択
可以破坏场上的卡片|You may destroy a card on the field|フィールドのカードを破壊できる
选择由改写效果破坏的尤贝尔|Choose a Yubel to destroy with the replaced effect|書き換えた効果で破壊するユベルを選択
选择记载尤贝尔的魔法陷阱|Choose a Spell/Trap that mentions Yubel|ユベルのカード名が記された魔法・罠を選択
选择破坏的暗属性怪兽|Choose a DARK monster to destroy|破壊する闇属性モンスターを選択
选择攻守为零的恶魔族|Choose a Fiend with 0 ATK and DEF|攻撃力・守備力0の悪魔族を選択
选择等级相差一的尤贝尔|Choose a Yubel whose Level differs by 1|レベルが1つ異なるユベルを選択
可以特殊召唤加入手牌的怪兽|You may Special Summon the monster added to hand|手札に加えたモンスターを特殊召喚できる
选择洗回的尤贝尔与零攻守恶魔族|Choose a Yubel and a 0 ATK/DEF Fiend to shuffle back|デッキに戻すユベルと攻撃力・守備力0の悪魔族を選択
选择同调怪兽与素材|Choose a Synchro Monster and its materials|Sモンスターとその素材を選択
攻击表示怪兽|Attack Position monsters|攻撃表示モンスター
魔法与陷阱|Spells and Traps|魔法・罠
选择破坏的对方怪兽|Choose an opposing monster to destroy|破壊する相手モンスターを選択
选择融合召唤的怪兽|Choose a monster to Fusion Summon|融合召喚するモンスターを選択
`.trim().split('\n').map(r=>r.split('|'));for(const[zh,en,ja]of rows)root.DuelUITranslations.messages[zh]={en,ja};})(globalThis);
