/* 天命法则 · Fate Decree.
 * One duel-wide rule is drawn when the duel starts and applies to both players.
 * It is part of the game rules, not a card: nothing can negate, destroy or
 * copy it. The chosen rule lives in engine.state.ruleMode (plain JSON), so
 * saves, replays, PVP projection and AI copies all see the same rule.
 * Bookkeeping is nested under state.ruleMode on purpose: the lingering-effect
 * observer scans top-level player/state keys that end in Turn/Until/Lock. */
(function(root){
  'use strict';
  const D=root.DuelData,{CARDS,isMonster}=D;
  const L=(zh,en,ja)=>({'zh-CN':zh,en,ja});
  const fieldMonster=z=>z==='monsters'||z==='extraMonster';
  const RULES=[
    {id:'element',glyph:'☯',tone:'battle',name:L('属性克制','Elemental Affinity','属性相性'),
     summary:L('交战时克制方攻守×2，被克制方攻守×0.5。','In battle, the favoured monster doubles ATK/DEF; the disfavoured one halves.','戦闘時、有利側の攻守は2倍、不利側は半分。'),
     detail:L('只在两只怪兽交战（伤害计算）时适用。克制方的有效攻击力／守备力变为2倍，被克制方变为一半（向上取整）；同属性或无相克关系按原数值结算。神克制光、暗、炎、风、地、水全部属性；光与暗互相克制——两者交战时双方数值同时×2；光、暗与炎、风、地、水之间没有相克；炎克风、风克地、地克水、水克炎。有属性的衍生物同样适用，没有属性的衍生物按1:1结算。',
       'Applies only when two monsters battle (damage calculation). The favoured monster\'s ATK/DEF is doubled, the disfavoured one\'s is halved (rounded up); same Attribute or no affinity uses the normal values. DIVINE is favoured against LIGHT, DARK, FIRE, WIND, EARTH and WATER. LIGHT and DARK counter each other: when they battle, both are doubled. LIGHT/DARK have no affinity with the four elements. FIRE beats WIND, WIND beats EARTH, EARTH beats WATER, WATER beats FIRE. Tokens with an Attribute follow the same table; Tokens without one battle at 1:1.',
       '2体のモンスターが戦闘する（ダメージ計算）時のみ適用。有利側の攻撃力／守備力は2倍、不利側は半分（端数切り上げ）。同属性や相性なしは通常の数値。神は光・闇・炎・風・地・水すべてに有利。光と闇は互いに有利で、戦闘すると双方が2倍。光・闇と炎・風・地・水には相性なし。炎＞風＞地＞水＞炎。属性を持つトークンも同様、属性のないトークンは1:1。')},
    {id:'equivalence',glyph:'⚖',tone:'stat',name:L('等价交换','Equivalent Exchange','等価交換'),
     summary:L('效果怪兽攻守−星级×100；无效果怪兽攻守＋星级×100。','Effect Monsters lose Level×100 ATK/DEF; non-Effect Monsters gain Level×100.','効果モンスターはレベル×100ダウン、効果なしはレベル×100アップ。'),
     detail:L('场上表侧表示的怪兽：有效果的怪兽攻击力·守备力下降「星级×100」；没有效果的怪兽上升「星级×100」。效果被无效的怪兽视为无效果怪兽。超量怪兽使用阶级、连接怪兽使用连接值作为星级；衍生物按其等级计算。',
       'Face-up monsters on the field: Effect Monsters lose ATK/DEF equal to their Level×100; monsters without effects gain Level×100. Monsters whose effects are negated count as non-Effect. Xyz Monsters use their Rank and Link Monsters their Link Rating; Tokens use their Level.',
       'フィールドの表側表示モンスター：効果モンスターは攻撃力・守備力が「レベル×100」ダウン、効果を持たないモンスターは「レベル×100」アップ。効果が無効のモンスターは効果なしとして扱う。エクシーズはランク、リンクはリンクマーカー数を用いる。トークンはそのレベル。')},
    {id:'planned',glyph:'▦',tone:'limit',name:L('计划经济','Planned Economy','計画経済'),
     summary:L('自己回合最多发动10次卡片与效果，对方回合最多3次。','Up to 10 activations on your turn and 3 on your opponent\'s.','自分のターンは10回、相手ターンは3回まで発動できる。'),
     detail:L('每位玩家在自己的回合最多进行10次卡片或效果的发动（包括灵摆刻度的放置与诱发效果），在对方的回合最多3次。攻击宣言、通常召唤、特殊召唤手续和变更表示不计次数。次数用尽后，包括必发诱发在内的效果都不能再发动。',
       'Each player may make up to 10 card or effect activations during their own turn (including placing Pendulum Scales and trigger effects) and up to 3 during the opponent\'s turn. Attack declarations, Normal Summons, Summon procedures and position changes are free. Once the quota is spent, no further effect can be activated, mandatory triggers included.',
       '各プレイヤーは自分のターンにカードや効果を10回まで（ペンデュラムスケールの発動や誘発効果を含む）、相手ターンに3回まで発動できる。攻撃宣言・通常召喚・召喚手順・表示形式変更は数えない。回数を使い切ると、強制誘発を含めて効果を発動できない。')},
    {id:'escalation',glyph:'↗',tone:'draw',name:L('多抽多补','Snowball Draws','増えるドロー'),
     summary:L('抽卡阶段抽「回合数−1」张卡。','Draw (turn number − 1) cards in the Draw Phase.','ドローフェイズに（ターン数−1）枚ドロー。'),
     detail:L('每回合的抽卡阶段不再固定抽1张，而是抽「当前回合数−1」张：第2回合抽1张、第3回合抽2张，依此类推。卡组不足时照常判负，手牌上限仍在结束阶段生效。',
       'The Draw Phase no longer draws 1 card: the turn player draws (current turn number − 1) cards — 1 on turn 2, 2 on turn 3, and so on. Running out of cards still loses the duel and the hand-size limit still applies in the End Phase.',
       'ドローフェイズは1枚ではなく（現在のターン数−1）枚ドローする。2ターン目は1枚、3ターン目は2枚…。デッキ切れは通常どおり敗北、手札上限もエンドフェイズに適用。')},
    {id:'bitter',glyph:'✚',tone:'draw',name:L('苦肉','Desperate Measures','苦肉の策'),
     summary:L('每回合一次，支付当前生命值一半抽1张卡。','Once per turn, pay half your LP to draw 1 card.','1ターンに1度、LPの半分を払って1枚ドロー。'),
     detail:L('每位玩家每回合可以在自由行动或响应窗口进行1次：支付当前基本分的一半（向下取整），从卡组抽1张卡。这是规则行动，不入连锁，不能被无效；基本分不足2时不能进行。',
       'Once per turn for each player, during an open action or response window on either turn, pay half of their current LP (rounded down) to draw 1 card. It is a rule action: it does not start a Chain and cannot be negated. Not available below 2 LP.',
       '各プレイヤーは毎ターン1度、自由行動または応答窓で、現在のLPの半分（切り捨て）を払ってデッキから1枚ドローできる。ルール上の行動でチェーンを組まず、無効にされない。LPが2未満なら行えない。')},
    {id:'abyss',glyph:'◐',tone:'stat',name:L('深渊之拥','Embrace of the Abyss','深淵の抱擁'),
     summary:L('自己墓地每有1张卡，自己场上怪兽攻守−50。','Your monsters lose 50 ATK/DEF for each card in your GY.','自分の墓地1枚につき、自分のモンスターの攻守−50。'),
     detail:L('每位玩家场上表侧表示的怪兽，攻击力·守备力下降「该玩家墓地的卡数×50」，最低为0。',
       'Each player\'s face-up monsters lose 50 ATK/DEF for every card in that player\'s Graveyard (minimum 0).',
       '各プレイヤーのフィールドの表側表示モンスターは、そのプレイヤーの墓地のカード1枚につき攻撃力・守備力が50ダウン（最低0）。')},
    {id:'primal',glyph:'≋',tone:'stat',name:L('原初洪流','Primal Torrent','原初の奔流'),
     summary:L('无效果怪兽攻击力＋1500，且不受对方卡的效果影响。','Non-Effect monsters gain 1500 ATK and are unaffected by opponent\'s cards.','効果を持たないモンスターは攻撃力＋1500、相手のカードの効果を受けない。'),
     detail:L('场上表侧表示的通常怪兽（凡骨）及其他没有效果的怪兽攻击力上升1500，并且不受对方的卡的效果影响。效果被无效的效果怪兽同样视为无效果怪兽。无效果的衍生物也适用。',
       'Face-up Normal Monsters and other monsters without effects gain 1500 ATK and are unaffected by the opponent\'s card effects. Effect Monsters whose effects are negated count as well. Non-Effect Tokens qualify as well.',
       'フィールドの表側表示の通常モンスターなど効果を持たないモンスターは攻撃力が1500アップし、相手のカードの効果を受けない。効果が無効の効果モンスターも含む。効果なしのトークンも含む。')},
    {id:'overclock',glyph:'⧉',tone:'draw',name:L('双核超频','Dual-Core Overclock','デュアルコア・オーバークロック'),
     summary:L('抽卡阶段抽2张；每回合可额外通常召唤1次。','Draw 2 in the Draw Phase and gain 1 extra Normal Summon each turn.','ドローフェイズに2枚ドロー、通常召喚を1回追加。'),
     detail:L('抽卡阶段的通常抽卡变为2张。在通常召唤之外，每回合可以额外进行1次通常召唤（或盖放）。',
       'The normal draw becomes 2 cards. In addition to the Normal Summon, each turn the player may conduct 1 more Normal Summon (or Set).',
       '通常のドローが2枚になる。通常召喚に加え、毎ターン1回まで追加で通常召喚（セット）できる。')},
    {id:'hierarchy',glyph:'♔',tone:'guard',name:L('尊卑有别','Rank and Station','尊卑の別'),
     summary:L('场上怪兽只受同星或更高星怪兽的效果影响。','Field monsters ignore effects of lower-starred monsters.','フィールドのモンスターは同じかより高い星のモンスター効果のみ受ける。'),
     detail:L('场上表侧表示的怪兽不受星数比它低的怪兽的效果影响（魔法·陷阱卡照常适用）。超量怪兽与连接怪兽的星数为其素材星数的合计；连接怪兽作为连接素材时，以连接值作为星数。无法追溯素材时，超量使用阶级、连接使用连接值。',
       'Face-up monsters on the field are unaffected by effects of monsters with fewer stars (Spells and Traps still apply). An Xyz or Link Monster\'s stars are the total stars of its materials; a Link Monster used as Link Material counts its Link Rating as stars. If the materials cannot be traced, Xyz use their Rank and Link their Link Rating.',
       'フィールドの表側表示モンスターは、自身より星が少ないモンスターの効果を受けない（魔法・罠は通常どおり）。エクシーズ・リンクの星は素材の星の合計。リンク素材となるリンクモンスターはリンクマーカー数を星とする。素材が追えない場合はランク／リンクマーカー数。')},
    {id:'roulette',glyph:'⚅',tone:'chance',name:L('命运轮盘','Wheel of Fate','運命のルーレット'),
     summary:L('抽卡阶段后掷骰：抽卡、伤害、破坏、除外、回复或回收。','After the Draw Phase roll a die: draw, damage, destroy, banish, heal or recycle.','ドロー後にサイコロ：ドロー・ダメージ・破壊・除外・回復・回収。'),
     detail:L('回合玩家在抽卡阶段后掷1次骰子：1＝再抽1张并重新掷骰；2＝受到「回合数×1000」伤害；3＝选择场上1张卡破坏；4＝选择场上1张卡除外；5＝回复「回合数×1000」基本分；6＝选择墓地1张卡返回卡组（额外卡组的卡返回额外卡组）。',
       'After the Draw Phase the turn player rolls a die: 1 = draw 1 more card and roll again; 2 = take (turn × 1000) damage; 3 = destroy 1 card on the field of your choice; 4 = banish 1 card on the field; 5 = gain (turn × 1000) LP; 6 = return 1 card from a Graveyard to the Deck (Extra Deck cards to the Extra Deck).',
       'ドローフェイズ後、ターンプレイヤーはサイコロを1回振る：1＝1枚ドローして振り直し／2＝ターン数×1000ダメージ／3＝フィールドのカード1枚を破壊／4＝フィールドのカード1枚を除外／5＝ターン数×1000回復／6＝墓地のカード1枚をデッキへ（EXデッキのカードはEXデッキへ）。')},
    {id:'carnival',glyph:'✺',tone:'draw',name:L('狂欢连锁','Chain Carnival','狂宴チェーン'),
     summary:L('连锁达到3以上：每个效果处理后控制者回复500，连锁结束后抽卡。','Chains of 3+: each resolved link heals 500; draw after the chain.','チェーン3以上：処理ごとに500回復、終了後にドロー。'),
     detail:L('连锁长度达到3以上时，该连锁中每个效果处理完毕后，其控制者回复500基本分；整条连锁处理完毕后，每个效果的控制者再各抽1张卡（控制几个效果就抽几张）。发动被无效的效果不计。',
       'When a Chain reaches 3 or more links, the controller of each link gains 500 LP after it resolves; when the whole Chain has resolved, each controller draws 1 card per link they controlled. Negated links do not count.',
       'チェーンが3以上になった時、各効果の処理後にそのコントローラーは500回復し、チェーン全体の処理後、各効果のコントローラーは効果1つにつき1枚ドローする。無効になった効果は数えない。')},
    {id:'vacuum',glyph:'◌',tone:'draw',name:L('厌恶真空','Horror Vacui','真空嫌悪'),
     summary:L('每回合一次，手牌变为0张的瞬间立刻抽2张。','Once per turn, when your hand becomes empty, draw 2.','1ターンに1度、手札が0枚になった瞬間に2枚ドロー。'),
     detail:L('每位玩家每回合一次：自己的手牌数量变为0的瞬间，在当前处理结束后立刻从卡组抽2张卡。',
       'Once per turn for each player: the moment their hand becomes empty, they immediately draw 2 cards once the current step has finished.',
       '各プレイヤーは1ターンに1度、手札が0枚になった瞬間、その処理が終わり次第デッキから2枚ドローする。')},
    {id:'echo',glyph:'↺',tone:'reuse',name:L('魔导回响','Arcane Echo','魔導の残響'),
     summary:L('通常／速攻魔法结算后重新盖放，第二次使用后除外。','Normal/Quick-Play Spells re-Set after resolving; banished after the second use.','通常・速攻魔法は処理後に再セット、2回目の使用後は除外。'),
     detail:L('通常魔法和速攻魔法发动并处理完毕后，不送去墓地，而是在原位置重新盖放；已经回响过的这张卡再次使用后除外。盖放的速攻魔法在盖放的回合不能发动（除非同时有其他规则允许）。发动被无效的卡照常送去墓地。',
       'Normal and Quick-Play Spells that resolve are not sent to the GY: they are Set again in the same zone. A card that has already echoed is banished after its next use. A re-Set Quick-Play Spell still cannot be activated the turn it was Set. Negated activations go to the GY as usual.',
       '通常魔法・速攻魔法は発動・処理後に墓地へ送られず、同じ場所に再びセットされる。一度残響したカードは次の使用後に除外される。再セットされた速攻魔法はセットしたターンに発動できない。無効にされた発動は通常どおり墓地へ。')},
    {id:'cannon',glyph:'炮',tone:'battle',name:L('当头炮','Central Cannon','中炮'),
     summary:L('召唤到正中主怪兽区的怪兽攻击力翻倍至回合结束。','A monster Summoned to the centre Main Monster Zone doubles its ATK this turn.','中央のメインモンスターゾーンに召喚されたモンスターは攻撃力2倍。'),
     detail:L('怪兽被通常召唤或特殊召唤到额外怪兽区域正下方那一格（正中的主怪兽区）时，该怪兽的攻击力翻倍，直到回合结束。反转召唤与盖放不适用。本规则下召唤默认优先使用正中区域。',
       'When a monster is Normal or Special Summoned to the centre Main Monster Zone (directly below the Extra Monster Zones), its ATK is doubled until the end of the turn. Flip Summons and Sets do not count. Under this rule, Summons prefer the centre zone by default.',
       'モンスターがEXモンスターゾーン直下（中央のメインモンスターゾーン）に通常召喚・特殊召喚された時、そのモンスターの攻撃力はターン終了時まで2倍。反転召喚・セットは除く。このルールでは中央ゾーンが優先される。')},
    {id:'stargaze',glyph:'✧',tone:'chance',name:L('观星？','Stargazing?','星読み？'),
     summary:L('一方从卡组检索时，另一方翻开卡组顶：同类型加入手牌，否则送墓。','When one player searches, the other reveals their top card: same type to hand, else to GY.','一方がサーチすると、他方はデッキトップを公開：同種類なら手札、違えば墓地。'),
     detail:L('当一名玩家从卡组将卡加入手牌（抽卡除外）时，每加入1张，另一名玩家翻开自己卡组最上方1张卡：与加入手牌的卡同为怪兽／魔法／陷阱则加入手牌，否则送去墓地。',
       'Whenever a player adds a card from their Deck to their hand (other than by drawing), for each card added the other player reveals the top card of their Deck: if it is the same card type (Monster/Spell/Trap) it is added to their hand, otherwise it is sent to the GY.',
       'プレイヤーがドロー以外でデッキからカードを手札に加えるたび、1枚につき他方のプレイヤーはデッキの一番上を公開する：同じ種類（モンスター／魔法／罠）なら手札に加え、違えば墓地へ送る。')},
    {id:'liberation',glyph:'☁',tone:'reuse',name:L('灵魂解放','Soul Release','魂の解放'),
     summary:L('送往墓地的卡改为除外。','Cards that would be sent to the GY are banished instead.','墓地へ送られるカードは除外される。'),
     detail:L('任何将被送去墓地的卡都改为除外。包括代价、超量素材、结算后的魔陷及场上的灵摆卡。衍生物离场仍然消失。',
       'Any card that would be sent to the Graveyard is banished instead. This includes costs, Xyz Materials, resolved Spells/Traps and Pendulum cards on the field. Tokens still disappear.',
       '墓地へ送られるカードはすべて除外される。コスト、X素材、処理後の魔法・罠、フィールドのPカードも含む。トークンは消滅する。')},
    {id:'legacy',glyph:'✉',tone:'draw',name:L('遗产馈赠','Bequest','遺産の贈与'),
     summary:L('怪兽被对方破坏送墓时抽1；墓地怪兽效果全部无效。','Draw 1 when the opponent destroys your monster; GY monster effects are negated.','相手に破壊され墓地へ送られた時1枚ドロー；墓地のモンスター効果は無効。'),
     detail:L('自己场上表侧表示的怪兽被对方破坏并送去墓地时，自己从卡组抽1张卡。墓地中的所有怪兽卡效果无效化，不能在墓地发动效果（包括送墓时在墓地发动的诱发效果）。',
       'When a face-up monster you control is destroyed by your opponent and sent to the GY, draw 1 card. Monster effects in the Graveyard are negated and cannot be activated there (including triggers that would activate in the GY).',
       '自分フィールドの表側表示モンスターが相手に破壊され墓地へ送られた時、1枚ドローする。墓地のモンスターの効果はすべて無効になり、墓地で発動できない（墓地で発動する誘発効果を含む）。')},
    {id:'unity',glyph:'✦',tone:'stat',name:L('团结之力','Strength in Unity','団結の力'),
     summary:L('怪兽攻守＋「自己场上表侧怪兽数×400」。','Monsters gain 400 ATK/DEF per face-up monster their controller has.','自分の表側表示モンスター1体につき攻守＋400。'),
     detail:L('双方场上表侧表示的怪兽，攻击力·守备力上升「其控制者场上表侧表示怪兽数量×400」（包括自身）。',
       'Face-up monsters gain ATK/DEF equal to 400 × the number of face-up monsters their controller controls (itself included).',
       'フィールドの表側表示モンスターは、そのコントローラーの表側表示モンスターの数×400（自身を含む）攻撃力・守備力がアップ。')},
    {id:'quickdraw',glyph:'⚡',tone:'reuse',name:L('快速拔枪','Quick Draw','早撃ち'),
     summary:L('通常陷阱与速攻魔法盖放的回合即可发动。','Normal Traps and Quick-Play Spells can be activated the turn they are Set.','通常罠と速攻魔法はセットしたターンに発動できる。'),
     detail:L('盖放的通常陷阱卡与速攻魔法卡在盖放的回合就可以发动，其余发动条件不变。永续陷阱和反击陷阱仍需等到下个回合。',
       'Set Normal Trap Cards and Quick-Play Spell Cards can be activated the turn they were Set; all other requirements still apply. Continuous and Counter Traps still wait until the next turn.',
       'セットした通常罠カードと速攻魔法カードはセットしたターンに発動できる。その他の条件は変わらない。永続罠とカウンター罠は次のターンから。')},
    {id:'dulling',glyph:'⚔',tone:'battle',name:L('卷刃','Dulled Blade','刃こぼれ'),
     summary:L('战斗破坏对方怪兽后，攻击力下降对方原本攻击力的一半。','After destroying a monster by battle, lose ATK equal to half its original ATK.','戦闘破壊後、相手の元々の攻撃力の半分だけ攻撃力ダウン。'),
     detail:L('怪兽战斗破坏对方怪兽后，自身攻击力永久下降「被破坏怪兽原本攻击力的一半」，最低为0。离场后重置。',
       'After a monster destroys an opponent\'s monster by battle, its ATK permanently drops by half the destroyed monster\'s original ATK (minimum 0). It resets if it leaves the field.',
       'モンスターが相手モンスターを戦闘破壊した後、自身の攻撃力は破壊したモンスターの元々の攻撃力の半分だけ下がる（最低0）。フィールドを離れるとリセット。')},
    {id:'bounty',glyph:'☠',tone:'chance',name:L('悬赏令','Bounty','懸賞金'),
     summary:L('准备阶段随机通缉对方1只怪兽；破坏者回复2000并抽1张。','Each Standby Phase an opposing monster becomes Wanted; its destroyer gains 2000 LP and draws 1.','スタンバイに相手モンスター1体を指名手配；破壊者は2000回復し1枚ドロー。'),
     detail:L('每回合准备阶段，若对方场上没有「通缉犯」，随机给对方场上的1只怪兽附加「通缉犯」标记。无论被谁破坏，破坏它的玩家立即回复2000基本分并从卡组抽1张卡。标记在怪兽离场时消失。',
       'In each Standby Phase, if the opponent has no Wanted monster, one random monster they control becomes Wanted. Whoever destroys it immediately gains 2000 LP and draws 1 card. The mark is lost when the monster leaves the field.',
       '毎ターンのスタンバイフェイズ、相手フィールドに「指名手配」がいなければ、相手モンスター1体にランダムで「指名手配」を付ける。それを破壊したプレイヤーは即座に2000回復し1枚ドローする。フィールドを離れると印は消える。')},
    {id:'angel',glyph:'❦',tone:'draw',name:L('天使的施舍','Angel\'s Alms','天使の施し'),
     summary:L('通常抽卡改为翻开卡组顶3张，选1张加入手牌，其余送墓。','The normal draw reveals the top 3: add 1 to your hand, send the rest to the GY.','通常のドローはデッキトップ3枚を公開し1枚を手札へ、残りは墓地へ。'),
     detail:L('双方在抽卡阶段的通常抽卡，改为翻开自己卡组最上方3张卡（不足3张则全部翻开），选其中1张加入手牌，其余送去墓地。卡组没有卡时照常因无法抽卡判负。',
       'The normal draw in the Draw Phase is replaced: reveal the top 3 cards of your Deck (all of them if fewer), add 1 to your hand and send the others to the GY. With an empty Deck you still lose for being unable to draw.',
       'ドローフェイズの通常ドローの代わりに、デッキの上から3枚（3枚未満なら全て）を公開し、1枚を手札に加え残りを墓地へ送る。デッキが0枚ならドローできず敗北。')},
    {id:'bloodpact',glyph:'♦',tone:'limit',name:L('血祭召唤','Blood Offering','血の供犠'),
     summary:L('5星以上可以支付「等级×300」基本分代替解放进行通常召唤。','Level 5+ monsters can be Normal Summoned by paying Level×300 LP instead of Tributes.','レベル5以上はレベル×300LPを払いリリースなしで通常召喚できる。'),
     detail:L('等级5以上的怪兽通常召唤（或盖放）时，可以不进行解放，改为支付「等级×300」基本分。仍然占用本回合的通常召唤次数；基本分必须多于代价。',
       'A Level 5 or higher monster may be Normal Summoned (or Set) without Tributing by paying LP equal to its Level × 300 instead. It still uses your Normal Summon; you must have more LP than the cost.',
       'レベル5以上のモンスターは、リリースの代わりに「レベル×300」LPを払って通常召喚（セット）できる。通常召喚の権利は消費する。LPはコストより多く必要。')},
    {id:'hardline',glyph:'⛨',tone:'guard',name:L('刚柔并济','Iron and Silk','剛柔一体'),
     summary:L('攻击表示怪兽不会被战斗破坏；守备表示怪兽不会被效果破坏。','Attack Position monsters cannot be destroyed by battle; Defense Position ones not by effects.','攻撃表示は戦闘で、守備表示は効果で破壊されない。'),
     detail:L('攻击表示的怪兽不会被战斗破坏（战斗伤害照常计算）；守备表示的怪兽（包括里侧守备）不会被卡的效果破坏。',
       'Monsters in Attack Position cannot be destroyed by battle (battle damage is still inflicted); monsters in Defense Position, face-down included, cannot be destroyed by card effects.',
       '攻撃表示のモンスターは戦闘では破壊されない（戦闘ダメージは発生する）。守備表示のモンスター（裏側守備を含む）はカードの効果では破壊されない。')},
    {id:'dormant',glyph:'☾',tone:'reuse',name:L('只是睡着了','Only Sleeping','眠っているだけ'),
     summary:L('送入墓地满3个回合的卡，在结束阶段洗回所有者卡组。','Cards that have been in the GY for 3 turns shuffle back into their owner\'s Deck.','墓地に3ターンあったカードはエンドフェイズにデッキへ戻る。'),
     detail:L('卡片被送入墓地后，经过3个回合，在那个回合的结束阶段返回其所有者的卡组并洗切（额外卡组的卡返回额外卡组）。',
       'A card sent to the Graveyard returns to its owner\'s Deck and is shuffled in during the End Phase once 3 turns have passed (Extra Deck cards return to the Extra Deck).',
       '墓地へ送られたカードは3ターン経過後のエンドフェイズに持ち主のデッキに戻りシャッフルされる（EXデッキのカードはEXデッキへ）。')}
  ];
  const BY_ID=Object.fromEntries(RULES.map(r=>[r.id,r]));
  const MODE_NAME=L('天命法则','Fate Decree','天命の掟');

  // ---- helpers ---------------------------------------------------------------
  const rule=e=>e?._advancedReady?e.state.ruleMode?.id||null:null;
  const is=(e,id)=>rule(e)===id;
  const pstate=(e,owner)=>{const r=e.state.ruleMode;r.players ||= [{},{}];return r.players[owner] ||= {};};
  const monsterCard=c=>!!c&&isMonster(c);
  const hasEffect=(e,card)=>{const c=CARDS[card.id];return !!c.effect&&!card.ruleNoEffect&&!e.isNormalMonster?.(card)&&!e.negated(card);};
  const vanilla=(e,card)=>monsterCard(CARDS[card.id])&&!hasEffect(e,card);
  const stars=(e,card)=>{const c=CARDS[card.id];if(c.type==='xyz')return c.rank||0;if(c.type==='link')return c.linkRating||0;return e.level(card)||0;};
  // 尊卑有别: Xyz/Link take the total of their materials' stars, a Link used as
  // Link Material counts its Link Rating. Recorded when the monster is Summoned.
  const materialStars=m=>{const c=CARDS[m.id];if(!c)return 0;if(c.type==='link')return c.linkRating||0;if(c.type==='xyz')return m.ruleStars||c.rank||0;return m.level||c.level||0;};
  const rankStars=(e,card)=>{const c=CARDS[card.id];if(['xyz','link'].includes(c.type))return card.ruleStars||(c.type==='link'?c.linkRating:c.rank)||0;return e.level(card)||0;};
  const sourceStars=(e,source)=>{const f=source.uid&&e.find(source.uid);if(f&&fieldMonster(f.zone)&&(f.card.generation||0)===(source.generation??(f.card.generation||0)))return rankStars(e,f.card);const c=CARDS[source.id];return source.ruleStars??source.originalLevel??c?.rank??c?.linkRating??c?.level??0;};
  const BEATS={'炎':'风','风':'地','地':'水','水':'炎'};
  function affinity(a,b){
    if(!a||!b||a===b)return 0;
    if(a==='神')return 1;if(b==='神')return -1;
    if(a==='光'&&b==='暗'||a==='暗'&&b==='光')return 1;
    if(BEATS[a]===b)return 1;if(BEATS[b]===a)return -1;return 0;
  }
  const kindOf=c=>isMonster(c)?'monster':c.type==='trap'?'trap':'spell';
  const echoable=c=>c?.type==='spell'&&(!c.spellKind||['normal','quick'].includes(c.spellKind));
  const note=(e,text,owner,data={})=>e.log('rule',text,owner,{rule:rule(e),...data});

  function pick(engine,choice){
    if(!choice||choice==='off')return null;
    if(BY_ID[choice])return choice;
    if(choice!=='random'&&choice!==true)throw new root.DuelRuleError('未知的天命法则模式。');
    return RULES[Math.floor(engine.random()*RULES.length)].id;
  }
  // Applied once, right after the opening hands. Uses the engine's seeded RNG so
  // tournament replays and PVP rooms reproduce the same draw.
  function install(engine,choice){
    if(engine.state.ruleMode)return engine.state.ruleMode.id;
    const id=pick(engine,choice);if(!id)return null;
    engine.state.ruleMode={id,version:1,source:BY_ID[choice]?'chosen':'random',players:[{},{}],log:[]};
    engine.log('rule','天命法则 · '+BY_ID[id].name['zh-CN']+'：'+BY_ID[id].summary['zh-CN'],null,{rule:id,announce:true});
    return id;
  }

  const P=root.ModernDuelEngine.prototype;
  function extend(name,fn){const prior=P[name];P[name]=function(...a){return fn.call(this,prior,...a);};}
  P.ruleDamage=function(owner,amount){const p=this.state.players[owner],n=Math.max(0,Math.floor(amount));p.lp=Math.max(0,p.lp-n);this.state.damage[1-owner]+=n;this.log('damage','天命法则：'+this.name(owner)+'受到 '+n+' 点伤害',owner,{amount:n});this.checkWin();};
  P.ruleHeal=function(owner,amount){this.state.players[owner].lp+=amount;this.log('heal','天命法则：'+this.name(owner)+'回复 '+amount+' LP',owner,{amount});};
  P.ruleReplacesDraw=function(){return ['escalation','overclock','angel'].includes(rule(this));};

  // ---- numbers ----------------------------------------------------------------
  extend('stat',function(prior,card,stat,battle=null){
    if(battle&&battle.serial===undefined)battle={serial:-1,owner:this.find(battle.uid)?.owner,...battle};
    let n=prior.call(this,card,stat,battle);const id=rule(this);if(!id||!card)return n;
    const f=this.find(card.uid);if(!f||!fieldMonster(f.zone)||!card.faceUp)return n;
    if(id==='equivalence')n+=(hasEffect(this,card)?-1:1)*stars(this,card)*100;
    else if(id==='abyss')n-=50*this.state.players[f.owner].grave.length;
    else if(id==='primal'&&stat==='atk'&&vanilla(this,card))n+=1500;
    else if(id==='unity')n+=400*this.monsters(f.owner).filter(m=>m.faceUp).length;
    else if(id==='cannon'&&stat==='atk'&&card.ruleCannonTurn===this.state.turn)n*=2;
    else if(id==='dulling'&&stat==='atk')n-=card.ruleAtkLoss||0;
    else if(id==='element'&&battle&&(battle.uid===card.uid||battle.target===card.uid)){
      const other=this.find(battle.uid===card.uid?battle.target:battle.uid)?.card;
      if(other){const a=affinity(this.attribute(card),this.attribute(other));n=Math.max(0,n);if(a>0)n*=2;else if(a<0)n=Math.ceil(n/2);}
    }
    return Math.max(0,Math.floor(n));
  });
  // AI and UI preview: the value this monster would use against that one.
  P.ruleBattleValue=function(card,other,attackerUid){const battle={uid:attackerUid,target:attackerUid===card.uid?other.uid:card.uid,owner:this.find(attackerUid)?.owner,serial:-1,preview:true};return card.position==='defense'&&attackerUid!==card.uid?this.defenseValue(card,battle):this.attackValue(card,battle);};
  P.ruleAffinity=function(card,other){return is(this,'element')?affinity(this.attribute(card),this.attribute(other)):0;};

  // ---- protection ---------------------------------------------------------------
  P.ruleUnaffected=function(card,source){
    const id=rule(this);
    if(!id||!source||!card||!card.faceUp||!['primal','hierarchy'].includes(id))return false;
    const f=this.find(card.uid);if(!f||!fieldMonster(f.zone))return false;
    if(id==='primal')return vanilla(this,card)&&[0,1].includes(source.owner)&&source.owner!==f.owner&&source.effectType!=='battle';
    const type=source.effectType||(CARDS[source.id]&&isMonster(CARDS[source.id])?'monster':'');
    return type==='monster'&&source.uid!==card.uid&&sourceStars(this,source)<rankStars(this,card);
  };
  extend('unaffected',function(prior,card,source){return !!(this.ruleUnaffected(card,source)||prior.call(this,card,source));});
  // A card move must honour immunity too, including non-targeting banish/bounce.
  extend('move',function(prior,uid,to,o={}){
    const f=rule(this)&&o.source&&this.effectMove(o)&&!o.asCost?this.find(uid):null;
    if(f&&fieldMonster(f.zone)&&this.unaffected(f.card,o.source))return {card:f.card,from:f.zone,to:f.zone,owner:f.owner,destroyed:false,prevented:true};
    return prior.call(this,uid,to,o);
  });
  extend('negated',function(prior,card){if(is(this,'legacy')&&card&&this.find(card.uid)?.zone==='grave'&&isMonster(CARDS[card.id]))return true;return prior.call(this,card);});
  extend('earlyNegatesLink',function(prior,link,...a){return is(this,'legacy')&&link.source?.effectType==='monster'&&link.source.zone==='grave'||prior.call(this,link,...a);});
  extend('abilityContext',function(prior,...a){const ctx=prior.apply(this,a),f=this.find(ctx.uid);if(f&&is(this,'hierarchy'))ctx.source.ruleStars=rankStars(this,f.card);return ctx;});
  extend('destroy',function(prior,uid,source=null,battle=false,extra={}){
    if(is(this,'hardline')){const f=this.find(uid);if(f&&fieldMonster(f.zone)){
      if(battle&&f.card.position==='attack'){note(this,'刚柔并济：攻击表示的「'+CARDS[f.card.id].name+'」不会被战斗破坏',f.owner,{uid});return false;}
      if(!battle&&f.card.position==='defense')return false;
    }}
    return prior.call(this,uid,source,battle,extra);
  });

  // ---- zones / moves ------------------------------------------------------------
  extend('move',function(prior,uid,to,o={}){
    const id=rule(this);if(!id||to!=='grave')return prior.call(this,uid,to,o);
    const f=this.find(uid),c=f&&CARDS[f.card.id];
    if(id==='echo'&&o.kind==='rule-resolved'&&f&&f.zone==='spells'&&echoable(c)&&!f.card.ruleEchoInvalid){
      const echoed=this.state.ruleMode.echoed||={};
      if(!echoed[uid]){
        const card=f.card;card.faceUp=false;card.pendingActivation=false;card.setTurn=this.state.turn;card.ruleEchoed=true;
        echoed[uid]=true;card.generation=(card.generation||0)+1;
        note(this,'魔导回响：「'+c.name+'」重新盖放',f.owner,{uid,cardId:c.id});
        return {card,from:'spells',to:'spells',owner:f.owner,destroyed:false};
      }
      return prior.call(this,uid,'banished',{...o,kind:'rule-echo',reason:'魔导回响：第二次使用后除外'});
    }
    if(id==='liberation'&&f)return prior.call(this,uid,'banished',o);
    return prior.call(this,uid,to,o);
  });
  extend('describe',function(prior,card,...a){const d=prior.call(this,card,...a);if(card){if(card.ruleWanted)d.ruleWanted=true;if(card.ruleStars)d.ruleStars=card.ruleStars;if(card.ruleEchoed)d.ruleEchoed=true;}return d;});
  extend('freeZones',function(prior,owner,card,options={}){const zones=prior.call(this,owner,card,options);if(is(this,'cannon')&&zones.includes(2))return [2,...zones.filter(z=>z!==2)];return zones;});
  P.preferredNormalSlot=function(owner){const m=this.state.players[owner].monsters;return is(this,'cannon')&&!m[2]?2:m.indexOf(null);};

  // ---- draws --------------------------------------------------------------------
  extend('draw',function(prior,owner,amount=1,silent=false){
    const id=rule(this);
    if(id&&this.state.inDrawPhase&&amount===1&&!this._ruleDrawing){
      if(id==='escalation'){amount=Math.max(0,this.state.turn-1);if(amount>1)note(this,'多抽多补：第'+this.state.turn+'回合抽'+amount+'张',owner);if(!amount)return;}
      else if(id==='overclock')amount=2;
      else if(id==='angel'&&this.state.players[owner].deck.length){angel(this,owner);return;}
    }
    const drawing=this._ruleDrawing;this._ruleDrawing=true;try{return prior.call(this,owner,amount,silent);}finally{this._ruleDrawing=drawing;}
  });
  function angel(e,owner){
    const top=e.state.players[owner].deck.slice(0,3);
    note(e,'天使的施舍：翻开卡组顶的「'+top.map(c=>CARDS[c.id].name).join('」「')+'」',owner,{cards:top.map(c=>c.id)});
    e.queueChoice(owner,'天使的施舍 · 选择1张加入手牌，其余送去墓地',top.map(c=>e.option(c,{viewer:owner,reveal:true})),1,1,'rule-angel',{uids:top.map(c=>c.uid),role:'search',rule:'angel'});
  }
  const E=root.DuelEffects;
  E.op('rule-angel',(e,t)=>{
    const chosen=t.picks[0];
    for(const uid of t.context.uids){const f=e.find(uid);if(!f||f.zone!=='deck'||f.owner!==t.owner)continue;e.move(uid,uid===chosen?'hand':'grave',{kind:uid===chosen?'rule-angel':'rule-angel-send',byOwner:t.owner,reason:'天使的施舍'});}
  });

  // ---- summons ------------------------------------------------------------------
  extend('canNormal',function(prior,card,owner=this.state.active){
    if(is(this,'overclock')&&this.state.normalUsed&&pstate(this,owner).extraNormalTurn!==this.state.turn){this.state.normalUsed=false;try{return prior.call(this,card,owner);}finally{this.state.normalUsed=true;}}
    return prior.call(this,card,owner);
  });
  extend('tributeSets',function(prior,card,noTribute=false,owner=this.state.active){if(this._ruleBloodPact)return this.freeMain(owner)>0?[[]]:[];return prior.call(this,card,noTribute,owner);});
  P.bloodPactCost=function(card){return this.level(card)*300;};
  P.canBloodPact=function(card,owner=this.state.active){
    if(!is(this,'bloodpact')||!card)return false;const f=this.find(card.uid);
    return !!f&&f.zone==='hand'&&f.owner===owner&&['monster','pendulum'].includes(CARDS[card.id].type)&&this.level(card)>=5&&this.canNormal(card,owner)&&this.freeMain(owner)>0&&this.state.players[owner].lp>this.bloodPactCost(card);
  };
  extend('normalSummon',function(prior,action){
    const owner=this.state.active;
    if(action?.bloodPact){
      const f=this.find(action.uid);if(!f||!this.canBloodPact(f.card,owner))throw new root.DuelRuleError('现在不能进行血祭召唤。');
      const cost=this.bloodPactCost(f.card);
      const run=()=>{this.payLP(owner,cost);note(this,'血祭召唤：支付 '+cost+' LP 代替解放',owner,{cardId:f.card.id,amount:cost});this._ruleBloodPact=true;try{return prior.call(this,{...action,tributes:[]});}finally{this._ruleBloodPact=false;}};
      return overclocked(this,owner,run);
    }
    return overclocked(this,owner,()=>prior.call(this,action));
  });
  function overclocked(e,owner,run){
    if(!is(e,'overclock')||!e.state.normalUsed)return run();
    const ps=pstate(e,owner);if(ps.extraNormalTurn===e.state.turn)return run();
    const before=e.state.summons[owner];e.state.normalUsed=false;
    try{return run();}finally{if(e.state.summons[owner]>before){ps.extraNormalTurn=e.state.turn;note(e,'双核超频：使用了本回合的额外通常召唤',owner);}e.state.normalUsed=true;}
  }
  extend('actionsFor',function(prior,uid,owner=this.state.active){
    const out=prior.call(this,uid,owner);if(!is(this,'bloodpact')||!['main1','main2'].includes(this.state.phase))return out;
    const f=this.find(uid);if(f&&this.canBloodPact(f.card,owner)){const cost=this.bloodPactCost(f.card);out.push({type:'summon',uid,mode:'attack',bloodPact:true,label:'血祭召唤 · 支付 '+cost+' LP',icon:'swords'},{type:'summon',uid,mode:'defense',bloodPact:true,label:'血祭盖放 · 支付 '+cost+' LP',icon:'shield'});}
    return out;
  });

  // ---- rule actions -------------------------------------------------------------
  P.ruleActions=function(owner=this.state.active){
    const pending=this.state.pending;
    if(pending?(pending.kind!=='window'||owner!==pending.responder):owner!==this.state.active)return [];
    return this.ruleWindowActions(owner);
  };
  P.ruleWindowActions=function(owner){
    if(!is(this,'bitter')||this.state.winner!==null)return [];
    const p=this.state.players[owner];if(pstate(this,owner).bitterTurn===this.state.turn||p.lp<2||!p.deck.length)return [];
    const cost=Math.floor(p.lp/2);return [{type:'rule-action',key:'bitter',cost,label:'苦肉 · 支付 '+cost+' LP 抽1张卡',icon:'spark'}];
  };
  P.ruleAction=function(action){
    const pending=this.state.pending,owner=pending?.responder??this.state.active;
    const available=this.ruleActions(owner).find(a=>a.key===action.key);if(!available)throw new root.DuelRuleError('现在不能进行这个规则行动。');
    pstate(this,owner).bitterTurn=this.state.turn;this.payLP(owner,available.cost);
    note(this,'苦肉：支付 '+available.cost+' LP，抽1张卡',owner,{amount:available.cost});
    this.draw(owner,1);
    if(pending){this.state.pending=null;this.openWindow(owner,pending.passes);}else this.state.frame={kind:'main-open',owner,windowOffered:false};
  };
  extend('chooseAI',function(prior,p){const action=p.kind==='window'&&this.ruleActions(p.responder)[0];if(action&&this.actionScore({...action,owner:p.responder})>0)return action;return prior.call(this,p);});
  extend('allActions',function(prior,owner=this.state.active){const out=prior.call(this,owner);return out.length||this.ruleActions?.(owner).length?[...out,...this.ruleActions(owner)]:out;});
  extend('actionScore',function(prior,action){
    if(action.type==='rule-action'){
      const owner=action.owner??this.state.active,p=this.state.players[owner],cost=action.cost,left=p.lp-cost,threat=Math.max(0,...this.monsters(1-owner).filter(m=>m.faceUp&&m.position==='attack').map(m=>this.attackValue(m)));
      if(left<Math.max(1500,threat*1.2)||p.deck.length<4)return -100;
      return 260+Math.max(0,4-p.hand.length)*120+Math.min(400,(left-2000)/10);
    }
    if(action.type==='summon'&&action.bloodPact){
      const f=this.find(action.uid),owner=this.state.active,lp=this.state.players[owner].lp,cost=f?this.bloodPactCost(f.card):0;
      const base=prior.call(this,{...action,bloodPact:false,noTribute:true});
      return base+220-cost/(lp<=4000?4:9);
    }
    return prior.call(this,action);
  });

  // ---- activations --------------------------------------------------------------
  const plannedLimit=(e,owner)=>owner===e.state.active?10:3;
  const plannedUsed=(e,owner)=>{const ps=pstate(e,owner);return ps.plannedAt===e.state.turn?ps.planned||0:0;};
  P.plannedQuota=function(owner){return is(this,'planned')?{used:plannedUsed(this,owner),limit:plannedLimit(this,owner)}:null;};
  extend('earlyCanUse',function(prior,c,a){
    if(!prior.call(this,c,a))return false;const id=rule(this);if(!id)return true;
    if(id==='planned'&&!a.inherent&&plannedUsed(this,c.owner)>=plannedLimit(this,c.owner))return false;
    if(id==='legacy'){const f=this.find(c.uid);if(f?.zone==='grave'&&isMonster(CARDS[f.card.id]))return false;}
    return true;
  });
  extend('commitPrepared',function(prior,ctx){
    const counting=is(this,'planned')&&!this.fx.get(ctx.key)?.inherent,owner=ctx.owner;
    const r=prior.call(this,ctx);
    if(counting){const ps=pstate(this,owner);if(ps.plannedAt!==this.state.turn){ps.plannedAt=this.state.turn;ps.planned=0;}ps.planned++;if(ps.planned>=plannedLimit(this,owner))note(this,'计划经济：'+this.name(owner)+'本回合的发动次数已用完（'+ps.planned+'/'+plannedLimit(this,owner)+'）',owner);}
    if(counting&&this.state.pending?.kind==='window'&&this.state.pending.responder===owner&&plannedUsed(this,owner)>=plannedLimit(this,owner)){const passes=this.state.pending.passes;this.state.pending=null;this.openWindow(owner,passes);}
    return r;
  });
  P.ruleAllowsSetActivation=function(card){if(!is(this,'quickdraw'))return false;const c=CARDS[card.id];return c.type==='trap'?(!c.trapKind||c.trapKind==='normal'):c.type==='spell'&&c.spellKind==='quick';};

  // ---- chain carnival -----------------------------------------------------------
  extend('resolveLink',function(prior){
    if(is(this,'carnival')){const r=this.state.ruleMode,chainId=this.state.chain.at(-1)?.chainId;if(r.carnival?.chainId!==chainId)r.carnival={chainId,total:this.state.chain.length,draws:[0,0]};}
    return prior.call(this);
  });
  extend('runTask',function(prior,task){
    if(task?.op==='finish-link'&&is(this,'echo')&&task.link.negatedActivation){const f=this.find(task.link.uid);if(f&&(f.card.generation||0)===task.link.source.generation)f.card.ruleEchoInvalid=true;}
    const r=prior.call(this,task);
    if(task?.op==='finish-link'&&is(this,'carnival')){const c=this.state.ruleMode.carnival,link=task.link;if(c&&c.chainId===link.chainId&&c.total>=3&&task.applied&&this.state.winner===null){this.ruleHeal(link.owner,500);c.draws[link.owner]++;note(this,'狂欢连锁：连锁 '+link.chainNumber+' 处理完毕，回复500',link.owner);}}
    return r;
  });
  extend('emit',function(prior,event){
    const r=prior.call(this,event);
    if(event?.type==='chain-complete'&&is(this,'carnival')){const c=this.state.ruleMode.carnival;if(c&&c.chainId===event.chainId){delete this.state.ruleMode.carnival;if(c.total>=3)for(const owner of [this.state.active,1-this.state.active])if(c.draws[owner]&&this.state.winner===null){note(this,'狂欢连锁：'+c.total+'连锁结束，抽'+c.draws[owner]+'张',owner);this.draw(owner,c.draws[owner]);}}}
    return r;
  });

  // ---- horror vacui -------------------------------------------------------------
  extend('remove',function(prior,uid){
    const f=is(this,'vacuum')?this.find(uid):null,r=prior.call(this,uid);
    if(f?.zone==='hand'&&CARDS[f.card.id].type!=='token'&&!this.state.players[f.owner].hand.length&&this.state.winner===null){
      const ps=pstate(this,f.owner);if(ps.vacuumAt!==this.state.turn&&!ps.vacuumQueued){ps.vacuumQueued=true;this.queue({op:'rule-vacuum',owner:f.owner});}
    }
    return r;
  });
  E.op('rule-vacuum',(e,t)=>{const ps=pstate(e,t.owner);delete ps.vacuumQueued;if(!is(e,'vacuum')||ps.vacuumAt===e.state.turn)return;ps.vacuumAt=e.state.turn;note(e,'厌恶真空：手牌变为0，抽2张卡',t.owner);e.draw(t.owner,2);});

  // ---- turn structure -----------------------------------------------------------
  extend('beginNextTurn',function(prior){
    const r=prior.call(this);
    if(is(this,'roulette')&&this.state.winner===null&&this.state.frame?.kind==='standby'&&this.state.ruleMode.rouletteAt!==this.state.turn){this.state.ruleMode.rouletteAt=this.state.turn;this.queue({op:'rule-roulette',owner:this.state.active});}
    return r;
  });
  const ROLL_TEXT=['','再抽1张并重掷','受到伤害','破坏场上1张卡','除外场上1张卡','回复基本分','墓地1张卡回到卡组'];
  E.op('rule-roulette',(e,t)=>{
    const owner=t.owner;
    if(e.state.winner===null){
      const roll=1+Math.floor(e.random()*6),turn=e.state.turn;
      note(e,'命运轮盘：掷出 '+roll+' · '+ROLL_TEXT[roll],owner,{roll});
      if(roll===1){e.draw(owner,1);if(e.state.winner===null)e.queue({op:'rule-roulette',owner});return;}
      if(roll===2)e.ruleDamage(owner,turn*1000);
      else if(roll===5)e.ruleHeal(owner,turn*1000);
      else{
        const field=[0,1].flatMap(p=>e.field(p)),grave=[0,1].flatMap(p=>e.state.players[p].grave);
        const list=roll===6?grave:field;
        if(!list.length){note(e,'命运轮盘：没有可以选择的卡',owner);return;}
        const mode=roll===3?'destroy':roll===4?'banish':'return';
        e.queueChoice(owner,'命运轮盘 · '+ROLL_TEXT[roll],list.map(c=>e.option(c,{viewer:owner})),1,1,'rule-roulette-pick',{mode,role:mode==='return'?'bounce':mode,rule:'roulette'});
      }
      return;
    }
  });
  E.op('rule-roulette-pick',(e,t)=>{
    const uid=t.picks[0],f=e.find(uid);if(!f)return;
    if(t.context.mode==='destroy')e.move(uid,'grave',{kind:'destroy',byEffect:false,byOwner:t.owner,reason:'命运轮盘'});
    else if(t.context.mode==='banish')e.move(uid,'banished',{kind:'rule-roulette',byOwner:t.owner,reason:'命运轮盘'});
    else if(f.zone==='grave'){e.move(uid,'deck',{kind:'rule-roulette',byOwner:t.owner,reason:'命运轮盘'});e.shuffle(e.state.players[f.owner].deck);}
  });
  root.DuelEffects.on('standby',(e,v)=>{
    if(!is(e,'bounty'))return;const foe=1-v.owner,list=e.monsters(foe);
    if(!list.length||list.some(m=>m.ruleWanted))return;
    const m=list[Math.floor(e.random()*list.length)];m.ruleWanted=true;
    note(e,'悬赏令：'+e.name(foe)+'场上的'+(m.faceUp?'「'+CARDS[m.id].name+'」':'里侧怪兽')+'成为通缉犯',foe,{uid:m.uid,cardId:m.faceUp?m.id:null});
  });
  root.DuelEffects.on('move',(e,v)=>{
    const id=rule(e);if(!id||!fieldMonster(v.from))return;
    const destroyed=['destroy','battle'].includes(v.kind),by=v.source?.owner??v.byOwner;
    if(id==='bounty'&&v.previous?.ruleWanted&&destroyed&&[0,1].includes(by))e.queue({op:'rule-bounty',owner:by});
    if(id==='legacy'&&v.to==='grave'&&destroyed&&v.previous?.faceUp&&[0,1].includes(by)&&by!==v.owner)e.queue({op:'rule-legacy',owner:v.owner});
  });
  E.op('rule-bounty',(e,t)=>{if(e.state.winner!==null)return;note(e,'悬赏令：击破通缉犯，回复2000并抽1张',t.owner);e.ruleHeal(t.owner,2000);e.draw(t.owner,1);});
  E.op('rule-legacy',(e,t)=>{if(e.state.winner!==null)return;note(e,'遗产馈赠：怪兽被对方破坏，抽1张卡',t.owner);e.draw(t.owner,1);});
  root.DuelEffects.on('summon',(e,v)=>{
    const id=rule(e);if(!id)return;const f=e.find(v.uid);if(!f)return;
    if(id==='hierarchy'&&['xyz','link'].includes(CARDS[v.id]?.type)&&v.materials?.length)f.card.ruleStars=v.materials.reduce((n,m)=>n+materialStars(m),0)||undefined;
    if(id==='cannon'&&!['flip','set'].includes(v.kind)&&f.zone==='monsters'&&f.index===2){f.card.ruleCannonTurn=e.state.turn;note(e,'当头炮：「'+CARDS[v.id].name+'」攻击力翻倍至回合结束',f.owner,{uid:v.uid,cardId:v.id});}
  });
  root.DuelEffects.on('battle-win',(e,v)=>{
    if(!is(e,'dulling'))return;const orig=v.victim?.originalAtk??CARDS[v.victim?.id]?.atk??0,loss=Math.ceil(orig/2),f=e.find(v.uid);
    if(loss>0&&f&&fieldMonster(f.zone)){f.card.ruleAtkLoss=(f.card.ruleAtkLoss||0)+loss;note(e,'卷刃：「'+CARDS[v.id].name+'」攻击力下降'+loss,f.owner,{uid:v.uid,amount:loss});}
  });
  const searched=(e,owner,uids)=>{if(!is(e,'stargaze'))return;for(const uid of uids){const f=e.find(uid);if(f)e.queue({op:'rule-stargaze',owner:1-owner,type:kindOf(CARDS[f.card.id]),searcher:owner});}};
  root.DuelEffects.on('added',(e,v)=>{if(v.reason==='search')searched(e,v.owner,v.uids||[]);});
  root.DuelEffects.on('move',(e,v)=>{if(v.from==='deck'&&v.to==='hand'&&!String(v.kind||'').startsWith('rule-'))searched(e,v.owner,[v.uid]);});
  E.op('rule-stargaze',(e,t)=>{
    const top=e.state.players[t.owner].deck[0];if(!top||e.state.winner!==null)return;const c=CARDS[top.id],same=kindOf(c)===t.type;
    note(e,'观星？：'+e.name(t.owner)+'翻开「'+c.name+'」，'+(same?'类型相同，加入手牌':'类型不同，送去墓地'),t.owner,{cardId:top.id,same});
    e.move(top.uid,same?'hand':'grave',{kind:'rule-stargaze',byOwner:t.owner,reason:'观星？'});
  });
  root.DuelEffects.on('end-phase',e=>{if(is(e,'dormant'))e.queue({op:'rule-dormant'});});
  E.op('rule-dormant',e=>{
    for(const owner of [0,1]){
      const due=e.state.players[owner].grave.filter(c=>e.state.turn-(c.sentTurn??e.state.turn)>=3);if(!due.length)continue;
      for(const c of due)e.move(c.uid,'deck',{kind:'rule-dormant',reason:'只是睡着了'});
      e.shuffle(e.state.players[owner].deck);
      note(e,'只是睡着了：'+due.length+'张卡从墓地回到'+e.name(owner)+'的卡组',owner,{count:due.length});
    }
  });

  // ---- public API for UI / server ------------------------------------------------
  const text=(value,language='zh-CN')=>value?.[language]||value?.['zh-CN']||'';
  function status(engine,language='zh-CN'){
    const id=rule(engine)||engine?.state?.ruleMode?.id;if(!id)return [];const out=[],turn=engine.state.turn;
    const Lx=(zh,en,ja)=>text(L(zh,en,ja),language);
    if(id==='planned')for(const owner of [0,1]){const q=engine.plannedQuota?.(owner)||{used:0,limit:owner===engine.state.active?10:3};out.push({owner,text:Lx('本回合已发动 '+q.used+'/'+q.limit,'Activations this turn: '+q.used+'/'+q.limit,'このターンの発動 '+q.used+'/'+q.limit)});}
    if(id==='bounty')for(const owner of [0,1]){const m=(engine.monsters?.(owner)||[]).find(m=>m.ruleWanted);if(m)out.push({owner,uid:m.uid,text:Lx('通缉犯：'+(m.faceUp?CARDS[m.id].name:'里侧怪兽'),'Wanted: '+(m.faceUp?CARDS[m.id].officialName||CARDS[m.id].name:'face-down monster'),'指名手配：'+(m.faceUp?CARDS[m.id].name:'裏側モンスター'))});}
    if(id==='bitter')for(const owner of [0,1]){const used=engine.state.ruleMode.players?.[owner]?.bitterTurn===turn;out.push({owner,text:used?Lx('本回合已使用苦肉','Used this turn','このターンは使用済み'):Lx('苦肉可用','Available','使用可能')});}
    if(id==='vacuum')for(const owner of [0,1]){const used=engine.state.ruleMode.players?.[owner]?.vacuumAt===turn;if(used)out.push({owner,text:Lx('本回合已触发','Triggered this turn','このターンは発動済み')});}
    if(id==='overclock')for(const owner of [0,1]){const used=engine.state.ruleMode.players?.[owner]?.extraNormalTurn===turn;if(owner===engine.state.active)out.push({owner,text:used?Lx('额外通常召唤已使用','Extra Normal Summon used','追加召喚は使用済み'):Lx('额外通常召唤可用','Extra Normal Summon available','追加召喚が可能')});}
    if(id==='escalation')out.push({owner:null,text:Lx('下回合抽 '+turn+' 张','Next turn draws '+turn,'次のターンは'+turn+'枚ドロー')});
    if(id==='dormant')for(const owner of [0,1]){const soon=(engine.state.players[owner].grave||[]).filter(c=>turn-(c.sentTurn??turn)>=3).length;if(soon)out.push({owner,text:Lx(soon+'张卡将在本回合结束阶段醒来',soon+' card(s) wake up this End Phase','このエンドフェイズに'+soon+'枚が目覚める')});}
    return out;
  }
  const API={RULES,BY_ID,MODE_NAME,install,pick,affinity,text,status,
    get:id=>BY_ID[id]||null,
    name:(id,language)=>text(BY_ID[id]?.name,language),
    summary:(id,language)=>text(BY_ID[id]?.summary,language),
    detail:(id,language)=>text(BY_ID[id]?.detail,language),
    active:e=>e?.state?.ruleMode?.id||null,
    dormantLeft:(engine,card)=>is(engine,'dormant')?Math.max(0,3-(engine.state.turn-(card.sentTurn??engine.state.turn))):null};
  root.DuelRuleModes=API;
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:this);
