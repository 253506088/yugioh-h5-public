/* Curated, classic-era card pool. All illustrations are original SVG artwork. */
(function (root) {
  'use strict';
  const monster = (id, name, en, level, atk, def, attribute, race, description, effect = null, art = id) => ({ id, name, en, type: 'monster', level, atk, def, attribute, race, description, effect, art });
  const spell = (id, name, en, description, effect, target = null) => ({ id, name, en, type: 'spell', attribute: '魔', description, effect, target, art: id });
  const trap = (id, name, en, description, effect, trigger = 'attack') => ({ id, name, en, type: 'trap', attribute: '罠', description, effect, trigger, art: id });
  const list = [
    monster('blue-eyes', '青眼白龙', 'BLUE-EYES WHITE DRAGON', 8, 3000, 2500, '光', '龙族', '以高攻击力著称的传说之龙。任何对手都能被它粉碎，其破坏力不可估量。'),
    monster('dark-magician', '黑魔术师', 'DARK MAGICIAN', 7, 2500, 2100, '暗', '魔法师族', '在魔法师之中，攻击力与守备力均为最高级别的存在。跨越时光的羁绊，再次回应决斗者的呼唤。'),
    monster('alexandrite', '亚历山大龙', 'ALEXANDRITE DRAGON', 4, 2000, 100, '光', '龙族', '全身覆盖着耀眼宝石的龙。月光洒落之时，它的鳞片会映照出千变万化的光辉。'),
    monster('luster-dragon', '蓝宝石龙', 'LUSTER DRAGON', 4, 1900, 1600, '风', '龙族', '全身被蓝色宝石包覆的美丽之龙。它并不喜欢争斗，但会毫不留情地反击入侵者。'),
    monster('battle-ox', '牛头人', 'BATTLE OX', 4, 1700, 1000, '地', '兽战士族', '持斧的强壮战士。其挥舞战斧的冲击力，足以粉碎挡在面前的一切。'),
    monster('la-jinn', '灯之魔精', 'LA JINN', 4, 1800, 1000, '暗', '恶魔族', '栖息于魔法之灯中的精灵。听从主人的召唤，以强大的魔力击退敌人。'),
    monster('kaibaman', '正义的伙伴 海马侠', 'KAIBAMAN', 3, 200, 700, '光', '战士族', '主要阶段：解放此卡，从自己的手牌特殊召唤1只「青眼白龙」。此效果不消耗通常召唤次数。', 'kaibaman'),
    monster('spear-dragon', '长枪龙', 'SPEAR DRAGON', 4, 1900, 0, '风', '龙族', '攻击守备表示怪兽时，给予攻击力超过守备力数值的战斗伤害。此卡攻击结束后，变为守备表示。', 'pierce'),
    monster('thunder-dragon', '雷龙', 'THUNDER DRAGON', 5, 1600, 1500, '光', '雷族', '主要阶段：从手牌丢弃此卡，从卡组将最多2张「雷龙」加入手牌。可作为「双头雷龙」的融合素材。', 'thunder-search'),
    monster('dark-girl', '黑魔术少女', 'DARK MAGICIAN GIRL', 6, 2000, 1700, '暗', '魔法师族', '双方墓地每存在1只「黑魔术师」，此卡的攻击力上升300。', 'dark-girl'),
    monster('skilled-magician', '熟练的黑魔术师', 'SKILLED DARK MAGICIAN', 4, 1900, 1700, '暗', '魔法师族', '每发动1张魔法卡，放置1个魔力指示物（最多3个）。移除3个并解放此卡，从手牌、卡组或墓地特殊召唤1只「黑魔术师」。', 'skilled'),
    monster('breaker', '魔导战士 破坏者', 'BREAKER THE MAGICAL WARRIOR', 4, 1600, 1000, '暗', '魔法师族', '通常召唤时获得1个魔力指示物，攻击力上升300。主要阶段可移除这个指示物，破坏场上1张魔法或陷阱卡。', 'breaker'),
    monster('celtic-guardian', '精灵剑士', 'CELTIC GUARDIAN', 4, 1400, 1200, '地', '战士族', '学习过剑术的精灵。以迅捷、准确的剑技保护同伴，是值得信赖的战士。'),
    monster('stone-soldier', '岩石巨兵', 'GIANT SOLDIER OF STONE', 3, 1300, 2000, '地', '岩石族', '由巨大的岩石组成的战士。沉默的身躯之中，蕴藏着令人惊叹的防御力量。'),
    monster('summoned-skull', '恶魔的召唤', 'SUMMONED SKULL', 6, 2500, 1200, '暗', '恶魔族', '操纵黑暗力量的恶魔。它能引发恐怖的雷击，在恶魔族中也是力量极强的存在。'),
    monster('gaia', '暗黑骑士 盖亚', 'GAIA THE FIERCE KNIGHT', 7, 2300, 2100, '地', '战士族', '骑着速度超越疾风的战马，手中的长枪以无可阻挡的气势冲向敌人。'),
    monster('curse-dragon', '诅咒之龙', 'CURSE OF DRAGON', 5, 2000, 1500, '暗', '龙族', '栖息在黑暗中的邪恶之龙。它吐出的火焰，能够焚尽大地上的一切。'),
    monster('kuriboh', '栗子球', 'KURIBOH', 1, 300, 200, '暗', '恶魔族', '对方攻击宣言时，可以将此卡从手牌丢弃。这次战斗对自己造成的战斗伤害变为0；怪兽的战斗破坏仍会结算。', 'kuriboh'),
    spell('pot-of-greed', '强欲之壶', 'POT OF GREED', '从自己的卡组抽2张卡。', 'draw2'),
    spell('monster-reborn', '死者苏生', 'MONSTER REBORN', '选择双方墓地中的1只怪兽，将其在自己场上以攻击表示特殊召唤。', 'reborn', 'grave-monster'),
    spell('raigeki', '雷击', 'RAIGEKI', '破坏对方场上的所有怪兽。', 'raigeki'),
    spell('dark-hole', '黑洞', 'DARK HOLE', '破坏双方场上的所有怪兽。', 'dark-hole'),
    spell('fissure', '地割', 'FISSURE', '破坏对方场上攻击力最低的1只怪兽；存在里侧怪兽时，优先选择表侧怪兽。', 'fissure'),
    spell('mst', '旋风', 'MYSTICAL SPACE TYPHOON', '选择场上的1张魔法或陷阱卡，将其破坏。', 'mst', 'backrow'),
    spell('swords', '光之护封剑', 'SWORDS OF REVEALING LIGHT', '此卡留在场上，翻开对方所有里侧怪兽。在对方的3个回合内，对方不能宣言攻击。此卡离场时效果消失。', 'swords'),
    spell('polymerization', '融合', 'POLYMERIZATION', '从自己的手牌或场上，将融合怪兽所需的素材送去墓地，从额外卡组融合召唤对应怪兽。', 'fusion', 'fusion'),
    spell('ancient-rules', '古之规则', 'ANCIENT RULES', '从手牌将1只5星以上的通常怪兽，以攻击表示特殊召唤。', 'ancient', 'hand-normal'),
    spell('dian-keto', '治疗之神 迪安·凯特', 'DIAN KETO THE CURE MASTER', '自己的生命值回复1000点。', 'heal'),
    trap('mirror-force', '神圣防护罩 · 反射镜力', 'MIRROR FORCE', '对方怪兽攻击宣言时发动：破坏对方场上所有攻击表示怪兽。', 'mirror-force'),
    trap('magic-cylinder', '魔法筒', 'MAGIC CYLINDER', '对方怪兽攻击宣言时发动：使那次攻击无效，给予对方该怪兽攻击力数值的伤害。', 'magic-cylinder'),
    trap('trap-hole', '落穴', 'TRAP HOLE', '对方通常召唤攻击力1000以上的怪兽时发动：破坏那只怪兽。', 'trap-hole', 'summon'),
    trap('negate-attack', '攻击无力化', 'NEGATE ATTACK', '对方怪兽攻击宣言时发动：使那次攻击无效，并结束对方的战斗阶段。', 'negate-attack'),
    { ...monster('ultimate-dragon', '青眼究极龙', 'BLUE-EYES ULTIMATE DRAGON', 12, 4500, 3800, '光', '龙族', '「青眼白龙」＋「青眼白龙」＋「青眼白龙」。三颗龙首交织成毁灭之光，传说中的究极之龙。'), type: 'fusion', materials: ['blue-eyes', 'blue-eyes', 'blue-eyes'], art: 'ultimate-dragon' },
    { ...monster('twin-thunder', '双头雷龙', 'TWIN-HEADED THUNDER DRAGON', 7, 2800, 2100, '光', '雷族', '「雷龙」＋「雷龙」。双头之间流动的闪电，会将整个战场化为雷霆的领域。'), type: 'fusion', materials: ['thunder-dragon', 'thunder-dragon'], art: 'twin-thunder' },
    { ...monster('dragon-champion', '龙骑士 盖亚', 'GAIA THE DRAGON CHAMPION', 7, 2600, 2100, '风', '龙族', '「暗黑骑士 盖亚」＋「诅咒之龙」。驾驭巨龙的骑士，让天空也成为自己的战场。'), type: 'fusion', materials: ['gaia', 'curse-dragon'], art: 'dragon-champion' }
  ];
  const CARDS = Object.fromEntries(list.map(card => [card.id, card]));
  const expand = entries => entries.flatMap(([id, amount]) => Array(amount).fill(id));
  const DECKS = {
    blue: {
      id: 'blue', name: '青眼的觉醒', en: 'THE WHITE DRAGON', ace: 'blue-eyes', avatar: 'kaiba', player: '海马濑人', subtitle: '用绝对的力量，开辟胜利之路。',
      description: '龙族的压倒性力量。通过海马侠与古之规则快速召唤青眼白龙，以融合召唤决定胜负。',
      cards: expand([['blue-eyes', 3], ['alexandrite', 3], ['luster-dragon', 3], ['battle-ox', 3], ['la-jinn', 2], ['kaibaman', 2], ['spear-dragon', 2], ['thunder-dragon', 2], ['pot-of-greed', 2], ['monster-reborn', 2], ['raigeki', 1], ['dark-hole', 1], ['mst', 2], ['swords', 1], ['polymerization', 2], ['ancient-rules', 1], ['mirror-force', 3], ['magic-cylinder', 2], ['trap-hole', 2], ['negate-attack', 1]]),
      extra: ['ultimate-dragon', 'twin-thunder']
    },
    dark: {
      id: 'dark', name: '黑魔术的传承', en: 'THE DARK MAGICIAN', ace: 'dark-magician', avatar: 'yugi', player: '暗之游戏', subtitle: '相信卡组，也相信我们的羁绊。',
      description: '魔法与陷阱的巧妙配合。积累魔力指示物，呼唤黑魔术师，掌控决斗的节奏。',
      cards: expand([['dark-magician', 3], ['dark-girl', 1], ['skilled-magician', 3], ['breaker', 3], ['celtic-guardian', 1], ['stone-soldier', 2], ['summoned-skull', 1], ['gaia', 1], ['curse-dragon', 2], ['kuriboh', 1], ['pot-of-greed', 2], ['monster-reborn', 2], ['dark-hole', 1], ['fissure', 2], ['mst', 2], ['swords', 1], ['polymerization', 1], ['dian-keto', 1], ['ancient-rules', 2], ['mirror-force', 3], ['magic-cylinder', 2], ['trap-hole', 1], ['negate-attack', 2]]),
      extra: ['dragon-champion']
    }
  };
  const api = { CARDS, CARD_LIST: list, DECKS, isMonster: c => !!c && ['monster', 'ritual', 'fusion', 'synchro', 'xyz', 'link', 'pendulum', 'token'].includes(c.type), isExtra: c => !!c && ['fusion', 'synchro', 'xyz', 'link'].includes(c.type) };
  root.DuelData = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
