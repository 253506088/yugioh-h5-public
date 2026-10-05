/* 2023 prompt and family translations, shared by browser and Node. */
(function(root){'use strict';const rows=`
选择除外的光或暗属性怪兽|Choose a LIGHT or DARK monster to banish|除外する光・闇属性モンスターを選択
选择送去墓地的特殊召唤怪兽|Choose a Special Summoned monster to send to the GY|墓地へ送る特殊召喚されたモンスターを選択
选择送去墓地的深渊兽或烙印|Choose a Bystial or Branded card to send to the GY|墓地へ送るビーステッドまたは烙印を選択
选择解放的光或暗属性怪兽|Choose a LIGHT or DARK monster to Tribute|リリースする光・闇属性モンスターを選択
选择解放的高星暗属性龙族|Choose a Level 6 or higher DARK Dragon to Tribute|リリースするレベル6以上の闇属性・ドラゴン族を選択
选择表侧放置的烙印|Choose a Branded card to place face-up|表側で置く烙印カードを選択
选择解放的龙族怪兽|Choose a Dragon to Tribute|リリースするドラゴン族を選択
选择放回卡组底部的怪兽|Choose a monster to place on the bottom of the Deck|デッキの一番下に戻すモンスターを選択
选择复活的深渊兽|Choose a Bystial to revive|蘇生するビーステッドを選択
选择特殊召唤的除外怪兽|Choose a banished monster to Special Summon|特殊召喚する除外モンスターを選択
选择洗回卡组的除外卡片|Choose a banished card to shuffle into the Deck|デッキに戻す除外カードを選択
选择无效的效果怪兽|Choose an Effect Monster to negate|無効にする効果モンスターを選択
选择复活的弹丸|Choose a Rokket to revive|蘇生するヴァレットを選択
选择加入手牌的纯爱魔法陷阱|Choose a Purrely Spell/Trap to add to hand|手札に加えるピュアリィ魔法・罠を選択
选择作为超量素材的速攻魔法|Choose a Quick-Play Spell to use as Xyz Material|X素材にする速攻魔法を選択
选择超量召唤的纯爱妖精|Choose a Purrely to Xyz Summon|X召喚するピュアリィを選択
可以丢弃一张手牌并特殊召唤|You may discard one card to Special Summon|手札を1枚捨てて特殊召喚できます
选择受到记忆保护的卡片|Choose a card for the Memory protection|メモリーで守るカードを選択
选择赋予效果的记忆|Choose the Memory granting this effect|効果を与えるメモリーを選択
选择送去墓地的其他卡片|Choose another card to send to the GY|墓地へ送る他のカードを選択
选择叠放为素材的对方卡片|Choose an opponent's card to attach as material|素材にする相手のカードを選択
可以回手对方魔法陷阱|You may return an opponent's Spell/Trap to hand|相手の魔法・罠を手札に戻せます
可以改变对方怪兽表示形式|You may change an opponent's monster's battle position|相手モンスターの表示形式を変更できます
可以暂时除外怪兽|You may temporarily banish a monster|モンスターを一時的に除外できます
可以盖放纯爱陷阱|You may Set a Purrely Trap|ピュアリィ罠をセットできます
选择叠放的墓地魔法陷阱|Choose GY Spells/Traps to attach|素材にする墓地の魔法・罠を選択
选择回手的对方卡片|Choose opponent's cards to return to hand|手札に戻す相手のカードを選択
选择检索的纯爱卡片|Choose a Purrely card to search|サーチするピュアリィカードを選択
可以减半怪兽攻击力|You may halve a monster's ATK|モンスターの攻撃力を半分にできます
选择放回卡组底部的对方卡片|Choose an opponent's card to place on the bottom of the Deck|デッキの一番下に戻す相手のカードを選択
选择展示的三张纯爱卡片|Choose three Purrely cards to reveal|見せるピュアリィカード3枚を選択
选择不同名的速攻魔法|Choose Quick-Play Spells with different names|カード名の異なる速攻魔法を選択
选择叠放素材的纯爱超量|Choose a Purrely Xyz Monster to receive material|素材を重ねるピュアリィXモンスターを選択
选择叠放的纯爱速攻魔法|Choose a Purrely Quick-Play Spell to attach|素材にするピュアリィ速攻魔法を選択
选择不同阶级的纯爱超量|Choose a Purrely Xyz Monster with a different Rank|ランクの異なるピュアリィXモンスターを選択
选择洗回的纯爱怪兽|Choose Purrely monsters to shuffle into the Deck|デッキに戻すピュアリィモンスターを選択
选择复活的救援王牌|Choose a Rescue-ACE monster to revive|蘇生するR-ACEを選択
选择除外的救援王牌|Choose Rescue-ACE cards to banish|除外するR-ACEカードを選択
选择盖放的不同名救援卡片|Choose Rescue-ACE cards with different names to Set|セットするカード名の異なるR-ACEカードを選択
选择盖放的效果怪兽|Choose an Effect Monster to flip face-down|裏側にする効果モンスターを選択
选择特殊召唤的除外救援王牌|Choose a banished Rescue-ACE monster to Special Summon|特殊召喚する除外状態のR-ACEを選択
选择攻击力最高的效果怪兽|Choose an Effect Monster with the highest ATK|攻撃力が最も高い効果モンスターを選択
选择丢弃一张手牌|Choose one card to discard|捨てる手札1枚を選択
选择从卡组特殊召唤的救援王牌|Choose a Rescue-ACE monster to summon from the Deck|デッキから特殊召喚するR-ACEを選択
选择解放的救援王牌|Choose a Rescue-ACE monster to Tribute|リリースするR-ACEを選択
选择盖放的救援陷阱|Choose a Rescue-ACE Trap to Set|セットするR-ACE罠を選択
选择盖放的救援魔法|Choose a Rescue-ACE Spell to Set|セットするR-ACE魔法を選択
选择洗回的四张救援王牌|Choose four Rescue-ACE cards to shuffle into the Deck|デッキに戻すR-ACEカード4枚を選択
选择送去墓地的一张卡|Choose one card to send to the GY|墓地へ送るカード1枚を選択
选择盖放的罪宝|Choose a Sinful Spoils card to Set|セットする罪宝カードを選択
选择放回卡组底部的罪宝|Choose a Sinful Spoils card to place on the bottom of the Deck|デッキの一番下に戻す罪宝を選択
选择送墓的其他表侧卡片|Choose another face-up card to send to the GY|墓地へ送る他の表側カードを選択
选择放回卡组的蛇眼或迪亚贝尔斯塔尔|Choose a Snake-Eye or Diabellstar to return|デッキに戻すスネークアイかディアベルスターを選択
选择检索的一星炎属性怪兽|Choose a Level 1 FIRE monster to search|サーチするレベル1・炎属性を選択
选择送墓的光或暗属性手牌|Choose a LIGHT or DARK monster in hand to send to the GY|墓地へ送る手札の光・闇属性を選択
选择放回卡组底部的特殊召唤怪兽|Choose a Special Summon monster to return to the bottom|デッキの一番下に戻す特殊召喚モンスターを選択
选择除外的场上或墓地卡片|Choose a field or GY card to banish|除外するフィールド・墓地のカードを選択
选择两只暂时除外的怪兽|Choose two monsters to temporarily banish|一時的に除外するモンスター2体を選択
选择取得控制权的怪兽|Choose a monster to take control of|コントロールを得るモンスターを選択
选择洗回卡组的对方手牌|Choose an opponent's hand card to shuffle into the Deck|デッキに戻す相手の手札を選択
选择三战之才的效果|Choose a Triple Tactics Talent effect|三戦の才の効果を選択
抽两张卡|Draw two cards|2枚ドローする
取得怪兽控制权|Take control of a monster|モンスターのコントロールを得る
查看并洗回对方手牌|Look at and shuffle an opponent's hand card|相手の手札を見て1枚デッキに戻す
选择通常魔法或通常陷阱|Choose a Normal Spell or Normal Trap|通常魔法・通常罠を選択
选择处理方式|Choose how to resolve|処理方法を選択
从卡组盖放|Set from the Deck|デッキからセット
选择展示的属性怪兽|Choose monsters with the required Attributes to reveal|必要な属性のモンスターを選んで見せる
选择VS效果|Choose a Vanquish Soul effect|VSの効果を選択
选择回手的VS怪兽|Choose a Vanquish Soul monster to return to hand|手札に戻すVSを選択
炎：本回合不被效果破坏|FIRE: Cannot be destroyed by effects this turn|炎：このターン効果では破壊されない
炎与暗：破坏同列其他怪兽|FIRE and DARK: Destroy other monsters in this column|炎・闇：同じ縦列の他のモンスターを破壊
地：本回合不被战斗破坏|EARTH: Cannot be destroyed by battle this turn|地：このターン戦闘では破壊されない
地与炎：破坏同列魔法陷阱|EARTH and FIRE: Destroy Spells/Traps in this column|地・炎：同じ縦列の魔法・罠を破壊
暗：抽一张卡|DARK: Draw one card|闇：1枚ドロー
地与炎：造成1500伤害|EARTH and FIRE: Inflict 1500 damage|地・炎：1500ダメージ
地：不受对方发动效果影响|EARTH: Unaffected by opponent's activated effects|地：相手が発動した効果を受けない
地炎暗：破坏其他一张卡|EARTH, FIRE and DARK: Destroy one other card|地・炎・闇：他のカード1枚を破壊
暗：对方怪兽攻守下降500|DARK: An opponent's monster loses 500 ATK/DEF|闇：相手モンスターの攻守を500下げる
选择攻守下降的怪兽|Choose a monster to lose ATK/DEF|攻守を下げるモンスターを選択
暗与地：回手守备力最低的怪兽|DARK and EARTH: Return a monster with the lowest DEF|闇・地：守備力が最も低いモンスターを戻す
选择守备力最低的怪兽|Choose a monster with the lowest DEF|守備力が最も低いモンスターを選択
炎：守备力上升3000|FIRE: Gain 3000 DEF|炎：守備力3000アップ
暗与地：攻击力上升3000|DARK and EARTH: Gain 3000 ATK|闇・地：攻撃力3000アップ
炎：改变怪兽表示形式|FIRE: Change a monster's battle position|炎：モンスターの表示形式を変更
选择改变表示形式的怪兽|Choose a monster to change position|表示形式を変更するモンスターを選択
两张炎：检索VS卡片|Two FIRE: Search a Vanquish Soul card|炎2体：VSカードをサーチ
从墓地加入手牌|Add from the GY to hand|墓地から手札に加える
选择展示的怪兽|Choose a monster to reveal|見せるモンスターを選択
守备表示特殊召唤|Special Summon in Defense Position|守備表示で特殊召喚
选择墓地的VS怪兽|Choose a Vanquish Soul monster in the GY|墓地のVSを選択
选择盖放的对方怪兽|Choose opponent's monsters to flip face-down|裏側にする相手モンスターを選択
可以特殊召唤VS怪兽|You may Special Summon a Vanquish Soul monster|VSを特殊召喚できます
展示不同属性的怪兽|Reveal monsters with different Attributes|属性の異なるモンスターを見せる
是否破坏场上全部怪兽|Destroy all monsters on the field?|フィールドの全モンスターを破壊しますか？
破坏全部怪兽|Destroy all monsters|全モンスターを破壊
不破坏|Do not destroy|破壊しない
2023 年效果待落实，不可编入正式构筑|2023 effect pending; unavailable for validated Duel decks|2023年の効果は未実装。正式なデュエル用デッキには使用できません。
纯爱妖精|Purrely|ピュアリィ
救援王牌|Rescue-ACE|R-ACE
深渊兽|Bystial|ビーステッド
幻想魔族|Illusion|幻想魔族
VS|Vanquish Soul|VS
`.trim().split('\n').map(row=>row.split('|'));for(const[zh,en,ja]of rows)root.DuelUITranslations.messages[zh]={en,ja};})(globalThis);
