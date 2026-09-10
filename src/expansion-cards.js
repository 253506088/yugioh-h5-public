(function (root) {
  'use strict';
  const data = root.DuelData || require('./cards.js');
  const { CARDS, CARD_LIST, DECKS } = data;
  if (data.expansionLoaded) { if (typeof module !== 'undefined') module.exports = data; return; }
  const add = card => {
    card.en = card.officialName.toUpperCase(); card.art = card.id; card.expansion = true;
    CARDS[card.id] = card; CARD_LIST.push(card); return card;
  };
  const M = (id, name, officialName, level, atk, def, attribute, race, family, description, options = {}) => add({ id, name, officialName, type: 'monster', level, atk, def, attribute, race, family, description, effect: id, ...options });
  const S = (id, name, officialName, family, description, options = {}) => add({ id, name, officialName, type: 'spell', attribute: '魔', family, description, effect: id, spellKind: 'normal', ...options });
  const T = (id, name, officialName, family, description, options = {}) => add({ id, name, officialName, type: 'trap', attribute: '罠', family, description, effect: id, trapKind: 'normal', ...options });
  const F = (id, name, officialName, level, atk, def, attribute, race, family, description, fusion, options = {}) => M(id, name, officialName, level, atk, def, attribute, race, family, description, { type: 'fusion', fusion, ...options });
  const Y = (id, name, officialName, level, atk, def, attribute, race, family, description, synchro = {}, options = {}) => M(id, name, officialName, level, atk, def, attribute, race, family, description, { type: 'synchro', synchro: { minTuners: 1, maxTuners: 1, minNon: 1, ...synchro }, ...options });
  const X = (id, name, officialName, rank, atk, def, attribute, race, family, description, options = {}) => M(id, name, officialName, 0, atk, def, attribute, race, family, description, { type: 'xyz', rank, xyzCount: 2, ...options });
  const P = (id, name, officialName, level, atk, def, scale, description, pendulumDescription, options = {}) => M(id, name, officialName, level, atk, def, '地', '机械族', 'qliphort', description, { type: 'pendulum', scale, pendulumDescription, ...options });

  // Elemental HERO: fusion materials, attribute-changing paths, and Mask Change.
  M('hero-stratos','元素英雄 天空侠','Elemental HERO Stratos',4,1800,300,'风','战士族','hero','召唤或特殊召唤成功时，可以选择：将1只「HERO」怪兽从卡组加入手牌；或破坏最多为自己场上其他「HERO」数量的魔法、陷阱卡。',{elemental:true});
  M('hero-shadow-mist','元素英雄 影雾女郎','Elemental HERO Shadow Mist',4,1000,1500,'暗','战士族','hero','特殊召唤成功时，可以检索1张「变化」速攻魔法。送去墓地时，可以检索此卡以外的1只「HERO」怪兽。此卡名的两个效果每回合只能使用其中1个1次。',{elemental:true});
  M('hero-solid-soldier','元素英雄 固态侠','Elemental HERO Solid Soldier',4,1300,1100,'地','战士族','hero','通常召唤成功时，可以从手牌特殊召唤1只4星以下的「HERO」。被魔法效果从怪兽区送去墓地时，可以将墓地中此卡以外的1只「HERO」以守备表示特殊召唤；这个送墓效果每回合1次。',{elemental:true});
  M('hero-liquid-soldier','元素英雄 液态侠','Elemental HERO Liquid Soldier',4,1400,1300,'水','战士族','hero','通常召唤时，可以特殊召唤墓地中此卡以外的1只4星以下「HERO」。作为「HERO」融合素材送墓或除外时，可以抽2张再丢弃1张。此卡名的两个效果每回合只能使用其中1个1次。',{elemental:true});
  M('hero-blazeman','元素英雄 烈焰侠','Elemental HERO Blazeman',4,1200,1800,'炎','战士族','hero','召唤或特殊召唤时可以检索「融合」。主要阶段可以将卡组中另一只「元素英雄」送墓，此卡直到回合结束获得其属性、攻击力与守备力；该回合只能特殊召唤融合怪兽。两个效果每回合只能使用其中1个1次。',{elemental:true});
  M('hero-honest-neos','元素英雄 真诚新宇侠','Elemental HERO Honest Neos',7,2500,2000,'光','战士族','hero','快速效果：从手牌丢弃此卡，使场上1只「HERO」本回合攻击力上升2500。快速效果：丢弃1只「HERO」，此卡本回合攻击力上升其攻击力。每个效果每回合1次。',{elemental:true});
  M('hero-neos','元素英雄 新宇侠','Elemental HERO Neos',7,2500,2000,'光','战士族','hero','来自新宇宙的元素英雄，以全新的融合之力回应决斗者。',{elemental:true,effect:null});
  M('hero-avian','元素英雄 羽翼侠','Elemental HERO Avian',3,1000,1000,'风','战士族','hero','操纵风的力量，在天空自由翱翔的元素英雄。',{elemental:true,effect:null});
  M('hero-burstinatrix','元素英雄 爆热女郎','Elemental HERO Burstinatrix',3,1200,800,'炎','战士族','hero','操纵灼热烈焰的元素英雄，是火焰翼侠的融合素材。',{elemental:true,effect:null});
  M('hero-sparkman','元素英雄 电光侠','Elemental HERO Sparkman',4,1600,1400,'光','战士族','hero','操纵闪电的元素英雄，用雷霆之力击败敌人。',{elemental:true,effect:null});
  M('hero-clayman','元素英雄 黏土侠','Elemental HERO Clayman',4,800,2000,'地','战士族','hero','具有强大防御力的元素英雄，以坚实身躯守护同伴。',{elemental:true,effect:null});
  M('hero-bubbleman','元素英雄 水泡侠','Elemental HERO Bubbleman',4,800,1200,'水','战士族','hero','手牌只有此卡时可以从手牌特殊召唤。召唤成功时，若手牌为0且场上只有此卡，可以抽2张卡。',{elemental:true});
  S('e-emergency-call','E－紧急呼唤','E - Emergency Call','hero','从卡组将1只「元素英雄」怪兽加入手牌。');
  S('miracle-fusion','奇迹融合','Miracle Fusion','hero','将自己场上或墓地的融合素材除外，融合召唤1只「元素英雄」融合怪兽。');
  S('mask-change','假面变化','Mask Change','hero','以自己1只表侧「HERO」为对象，将其送去墓地，从额外卡组特殊召唤1只属性相同的「假面英雄」。',{spellKind:'quick'});
  S('a-hero-lives','英雄到来','A Hero Lives','hero','自己场上没有表侧怪兽时，支付一半生命值，从卡组特殊召唤1只4星以下「元素英雄」。');
  F('hero-flame-wingman','元素英雄 火焰翼侠','Elemental HERO Flame Wingman',6,2100,1200,'风','战士族','hero','「羽翼侠」＋「爆热女郎」。必须融合召唤。战斗破坏怪兽并送墓后，给予对方该怪兽原本攻击力数值的伤害。',[{id:'hero-avian'},{id:'hero-burstinatrix'}],{elemental:true,fusionOnly:true});
  F('hero-sunrise','元素英雄 日出侠','Elemental HERO Sunrise',8,2500,1200,'光','战士族','hero','属性不同的「HERO」2只。特殊召唤时可以检索「奇迹融合」。自己的怪兽攻击力上升自己场上属性种类×200。其他「HERO」战斗的攻击宣言时，可以破坏场上1张卡。检索与破坏效果各每回合1次。',[{family:'hero'},{family:'hero'}],{elemental:true,differentAttributes:true,fusionOnly:true});
  F('hero-absolute-zero','元素英雄 绝对零度侠','Elemental HERO Absolute Zero',8,2500,2000,'水','战士族','hero','「HERO」＋水属性怪兽。必须融合召唤。攻击力上升场上其他水属性怪兽数量×500。离开场上时，破坏对方所有怪兽；返回里侧额外卡组时不发动此诱发效果。',[{family:'hero'},{attribute:'水'}],{elemental:true,fusionOnly:true});
  F('hero-the-shining','元素英雄 闪光侠','Elemental HERO The Shining',8,2600,2100,'光','战士族','hero','「元素英雄」＋光属性怪兽。必须融合召唤。攻击力上升自己被除外的「元素英雄」数量×300。从场上送墓时，可以将最多2只被除外的「元素英雄」加入手牌。',[{elemental:true},{attribute:'光'}],{elemental:true,fusionOnly:true});
  F('hero-great-tornado','元素英雄 大龙卷侠','Elemental HERO Great Tornado',8,2800,2200,'风','战士族','hero','「元素英雄」＋风属性怪兽。必须融合召唤。融合召唤成功时，对方所有表侧怪兽的攻击力与守备力变为一半。',[{elemental:true},{attribute:'风'}],{elemental:true,fusionOnly:true});
  F('masked-dark-law','假面英雄 暗爪','Masked HERO Dark Law',6,2400,1800,'暗','战士族','hero','必须用「假面变化」特殊召唤。送往对方墓地的卡改为除外。对方在抽卡阶段以外从卡组将卡加入手牌时，每回合1次，可以随机除外其1张手牌。',null,{masked:true});
  F('masked-acid','假面英雄 酸水','Masked HERO Acid',8,2600,2100,'水','战士族','hero','必须用「假面变化」特殊召唤。特殊召唤成功时，破坏对方所有魔法、陷阱卡；若有卡被破坏，对方场上怪兽的攻击力下降300。',null,{masked:true});

  // Blackwings: hand extension, Whirlwind searching and distinct Synchro payoffs.
  M('bw-bora','黑羽－黑枪之布拉斯特','Blackwing - Bora the Spear',4,1700,800,'暗','鸟兽族','blackwing','控制此卡以外的「黑羽」时，可以从手牌特殊召唤。具有守备贯穿伤害。');
  M('bw-gale','黑羽－疾风之盖尔','Blackwing - Gale the Whirlwind',3,1300,400,'暗','鸟兽族','blackwing','调整。控制此卡以外的「黑羽」时，可以从手牌特殊召唤。每回合1次，使对方1只表侧怪兽的攻击力与守备力变为一半。',{tuner:true});
  M('bw-shura','黑羽－苍炎之修罗','Blackwing - Shura the Blue Flame',4,1800,1200,'暗','鸟兽族','blackwing','战斗破坏对方怪兽并送墓时，可以从卡组特殊召唤1只攻击力1500以下的「黑羽」，其效果无效。');
  M('bw-blizzard','黑羽－极北之布利扎德','Blackwing - Blizzard the Far North',2,1300,0,'暗','鸟兽族','blackwing','调整。不能特殊召唤。通常召唤时，可以将墓地1只4星以下「黑羽」以守备表示特殊召唤。',{tuner:true,noSpecial:true});
  M('bw-kalut','黑羽－月影之卡鲁特','Blackwing - Kalut the Moon Shadow',3,1400,1000,'暗','鸟兽族','blackwing','自己的「黑羽」进行战斗的伤害计算前，可以从手牌丢弃此卡，使那只怪兽本回合攻击力上升1400。');
  M('bw-zephyros','黑羽－精锐之泽费洛斯','Blackwing - Zephyros the Elite',4,1600,1000,'暗','鸟兽族','blackwing','在墓地时，将自己场上1张表侧卡返回手牌，特殊召唤此卡并受到400点伤害。此效果每场决斗只能使用1次。');
  M('bw-kris','黑羽－残夜之克里斯','Blackwing - Kris the Crack of Dawn',4,1900,300,'暗','鸟兽族','blackwing','控制此卡以外的「黑羽」时，可以从手牌特殊召唤；此方法每回合1次。每回合第1次将被魔法或陷阱效果破坏时不被破坏。');
  S('black-whirlwind','黑旋风','Black Whirlwind','blackwing','自己通常召唤「黑羽」时，可以从卡组检索1只攻击力比该怪兽低的「黑羽」。每张黑旋风分别处理。',{spellKind:'continuous'});
  T('icarus-attack','神鸟攻击','Icarus Attack','blackwing','解放1只鸟兽族怪兽，以场上2张卡为对象，将它们破坏。');
  Y('bw-armor-master','黑羽－铠翼鸦','Blackwing Armor Master',7,2500,1500,'暗','鸟兽族','blackwing','黑羽调整＋非调整。不会被战斗破坏，此卡战斗对自己造成的伤害为0。攻击后可给未破坏的对手放置楔指示物；主要阶段移除对方全部楔指示物，使那些怪兽本回合攻守变为0。',{tunerFamily:'blackwing'});
  Y('bw-armed-wing','黑羽－兵翼鸦','Blackwing Armed Wing',6,2300,1000,'暗','鸟兽族','blackwing','黑羽调整＋非调整。攻击守备表示怪兽时，伤害计算期间攻击力上升500，并造成贯穿伤害。',{tunerFamily:'blackwing'});
  Y('bw-nothung','黑羽－星影之苦剑鸟','Blackwing - Nothung the Starlight',6,2400,1600,'暗','鸟兽族','blackwing','特殊召唤成功时，给予对方800伤害，并使对方1只表侧怪兽攻守下降800；此诱发效果每回合1次。在自己主要阶段可以额外通常召唤1只「黑羽」，每回合最多获得1次此类追加召唤。');
  Y('bw-raikiri','强袭黑羽－雷切之千鸟','Assault Blackwing - Raikiri the Rain Shower',7,2600,2000,'暗','鸟兽族','blackwing','以「黑羽」作为素材同调召唤时也当作调整。每回合1次，可以破坏最多为自己场上其他「黑羽」数量的对方卡牌。');

  // Synchrons: genuine tuner constraints, graveyard extension, tokens and Accel Synchro.
  M('junk-synchron','废品同调士','Junk Synchron',3,1300,500,'暗','战士族','synchron','调整。通常召唤时，可以将墓地1只2星以下怪兽以守备表示特殊召唤，效果无效。',{tuner:true,junk:true});
  M('junk-converter','废品转换者','Junk Converter',2,400,200,'地','战士族','junk','从手牌丢弃此卡与1只调整，检索1只「同调士」。作为同调素材送墓时，可以守备表示特殊召唤墓地1只调整，该回合不能发动其效果。两个效果各每回合1次。',{junk:true});
  M('doppelwarrior','二重身战士','Doppelwarrior',2,800,800,'暗','战士族','junk','怪兽从自己墓地特殊召唤时，可以从手牌特殊召唤此卡。作为同调素材送墓时，可以攻击表示特殊召唤2只1星、攻守400的二重身衍生物。');
  M('quillbolt','螺丝刺猬','Quillbolt Hedgehog',2,800,800,'地','机械族','junk','控制调整怪兽时，可以从墓地特殊召唤此卡；以此方法登场的此卡离场时除外。成为超量素材不算离场。');
  M('jet-synchron','喷气同调士','Jet Synchron',1,500,0,'炎','机械族','synchron','调整。作为同调素材送墓时，可以检索1只「废品」。从手牌送墓1张卡，可以从墓地特殊召唤此卡，之后离场除外。此卡名的两个效果每回合只能使用其中1个1次。',{tuner:true});
  M('quickdraw-synchron','速攻同调士','Quickdraw Synchron',5,700,1400,'风','机械族','synchron','调整。从手牌送墓1只其他怪兽，可以从手牌特殊召唤。可以代替任意指定名称的「同调士」调整，但只能用于明确指定「同调士」为素材的同调召唤。',{tuner:true,synchronSubstitute:true});
  M('fleur-synchron','花之同调士','Fleur Synchron',2,400,200,'光','机械族','synchron','调整。作为同调素材送去墓地时，可以从手牌特殊召唤1只2星以下怪兽。',{tuner:true});
  S('tuning','调律','Tuning','synchron','将1只「同调士」调整从卡组加入手牌，然后将卡组顶1张卡送去墓地。');
  Y('junk-warrior','废品战士','Junk Warrior',5,2300,1300,'暗','战士族','junk','废品同调士＋非调整。同调召唤成功时，攻击力上升自己场上所有2星以下怪兽的攻击力合计。',{tunerId:'junk-synchron',namedSynchron:true},{junk:true});
  Y('junk-speeder','废品增速者','Junk Speeder',5,1800,1000,'风','战士族','junk','同调士调整＋非调整。同调召唤时，可以从卡组尽可能特殊召唤等级各不相同的「同调士」调整，守备表示；发动该效果的整回合只能从额外卡组特殊召唤同调怪兽。该回合首次与怪兽战斗时，可以使攻击力变为原本的2倍。两个效果各每回合1次。',{tunerFamily:'synchron'},{junk:true});
  Y('stardust-dragon','星尘龙','Stardust Dragon',8,2500,2000,'风','龙族','stardust','将破坏场上卡牌的效果发动时，可以解放此卡，无效该发动并破坏。以此效果解放并成功无效发动的回合结束阶段，可以从墓地特殊召唤此卡。');
  Y('formula-synchron','方程式同调士','Formula Synchron',2,200,1500,'光','机械族','synchron','同调调整。同调召唤成功时，可以抽1张卡。对方主要阶段，可以立即进行一次以此卡为素材的同调召唤。',{}, {tuner:true});
  Y('shooting-star','流星龙','Shooting Star Dragon',10,3300,2500,'风','龙族','stardust','同调调整＋星尘龙。每回合可分别使用：翻开卡组顶5张后洗回，本回合攻击次数变为其中调整数量；无效并破坏将破坏场上卡的效果发动；对方攻击宣言时除外此卡使攻击无效，并在结束阶段返回。',{tunerType:'synchro',nonId:'stardust-dragon',maxNon:1});
  Y('junk-archer','废品弓手','Junk Archer',7,2300,2000,'地','战士族','junk','废品同调士＋非调整。每回合1次，暂时除外对方1只怪兽；结束阶段返回原控制者场上。',{tunerId:'junk-synchron',namedSynchron:true},{junk:true});
  Y('junk-destroyer','废品破坏王','Junk Destroyer',8,2600,2500,'地','战士族','junk','废品同调士＋非调整。同调召唤时，可以破坏最多为本次使用的非调整素材数量的场上卡牌。',{tunerId:'junk-synchron',namedSynchron:true},{junk:true});

  // Utopia: levels are not ranks; overlay materials remain actual tracked cards.
  M('gagaga-magician','我我我魔术师','Gagaga Magician',4,1500,1000,'暗','魔法师族','gagaga','每回合1次，宣言1至8的等级，此卡本回合变为该等级。不能用作同调素材；自己场上只能有1只表侧同名卡。',{cannotSynchro:true,uniqueFaceUp:true,onomat:true});
  M('gagaga-girl','我我我少女','Gagaga Girl',3,1000,800,'暗','魔法师族','gagaga','每回合1次，可以使此卡等级变为自己1只其他「我我我」的等级。与「我我我」怪兽一同成为超量素材时，赋予该超量怪兽：超量召唤时，可使对方1只特殊召唤怪兽的攻击力变为0。',{onomat:true});
  M('goblindbergh','哥布林德伯格','Goblindbergh',4,1400,0,'地','战士族','utopia','通常召唤时，可以从手牌特殊召唤1只4星以下怪兽，然后此卡变为守备表示。');
  M('kagetokage','影蜥蜴','Kagetokage',4,1100,1500,'暗','爬虫类族','utopia','不能通常召唤或盖放，必须先以自身效果特殊召唤。自己通常召唤4星怪兽时，可以从手牌特殊召唤此卡。不能用作同调素材。',{noNormal:true,cannotSynchro:true,specialOnly:'kagetokage-hand'});
  M('utopic-onomatopoeia','拟声乌托邦','Utopic Onomatopoeia',4,1500,1500,'光','战士族','onomat','在规则上也当作「我我我」「隆隆隆」「怒怒怒」「刷拉拉」。每回合1次，从手牌将这些系列各最多1只、同名卡以外的怪兽特殊召唤，守备表示；之后本回合从额外卡组只能特殊召唤超量怪兽。',{onomat:true,families:['gagaga','gogogo','dododo','zubaba']});
  M('zubaba-gagagacoat','刷拉拉番长－我我我外套','Zubababancho Gagagacoat',4,1800,100,'地','战士族','onomat','控制同名以外的「刷拉拉」或「我我我」时，可从手牌特殊召唤。可以特殊召唤墓地1只「隆隆隆」或「怒怒怒」，之后本回合从额外卡组只能特殊召唤超量怪兽。两个效果各每回合1次。',{onomat:true,families:['zubaba','gagaga']});
  M('dododo-gogogoglove','怒怒怒矮人－隆隆隆手套','Dodododwarf Gogogoglove',4,0,1800,'地','岩石族','onomat','主要阶段，可以从手牌特殊召唤1只「刷拉拉」或「我我我」。控制同名以外的「隆隆隆」或「怒怒怒」时，可以从墓地特殊召唤此卡，之后离场除外。两个效果各每回合1次。',{onomat:true,families:['dododo','gogogo']});
  M('zs-ascended-sage','异热同心武器－升华贤者','ZS - Ascended Sage',4,900,300,'光','战士族','utopia','自己场上没有卡时，可以从手牌特殊召唤。作为「希望皇 霍普」超量素材时，赋予其超量召唤时检索1张「升阶魔法」的效果；此检索每回合1次。');
  S('onomatopaira','拟声连携','Onomatopaira','onomat','从手牌送墓1张卡，从卡组将最多2只「我我我」「隆隆隆」「怒怒怒」「刷拉拉」怪兽加入手牌，每个系列最多1只。每回合1次。');
  S('xyz-change-tactics','超量变化战术','Xyz Change Tactics','utopia','「希望皇 霍普」怪兽在自己场上超量召唤时，可以支付500生命值抽1张卡。自己场上只能有1张表侧同名卡。',{spellKind:'continuous',uniqueFaceUp:true});
  S('double-or-nothing','翻倍机会','Double or Nothing!','utopia','怪兽的攻击被无效时，以那只怪兽为对象：它可以再攻击1次，那次攻击的伤害计算期间攻击力变为2倍。',{spellKind:'quick'});
  S('limited-barians-force','升阶魔法－限制型巴利安之力',"Rank-Up-Magic Limited Barian's Force",'utopia','以自己1只4阶超量怪兽为对象，在其上叠放额外卡组1只5阶「混沌No.」超量怪兽，并继承原来的全部素材。',{rankUpSpell:true});
  X('utopia','No.39 希望皇 霍普','Number 39: Utopia',4,2500,2000,'光','战士族','utopia','2只4星怪兽。怪兽攻击宣言时，可以移除1个超量素材，使攻击无效。此卡没有素材时成为攻击对象，会自行破坏。');
  X('utopia-ray','CNo.39 希望皇 霍普雷','Number C39: Utopia Ray',4,2500,2000,'光','战士族','utopia','3只4星光属性怪兽，也可叠放在「No.39 希望皇 霍普」上超量召唤。自己LP在1000以下时，可以移除1素材，使自身本回合攻击力上升500，并使对方1只怪兽攻击力下降1000。',{xyzCount:3,xyzAttribute:'光',rankUpFrom:['utopia']});
  X('utopia-double','No.39 希望皇 霍普·翻倍','Number 39: Utopia Double',4,0,2500,'光','战士族','utopia','2只4星怪兽。快速效果，每回合1次：移除1素材，检索「翻倍机会」，并在此卡上叠放1只其他「希望皇 霍普」超量怪兽，继承全部素材，攻击力变为2倍，不能直接攻击。');
  X('utopia-lightning','闪光No.39 希望皇 霍普·电光皇','Number S39: Utopia the Lightning',5,2500,2000,'光','战士族','utopia','3只5星光属性怪兽，也可叠放在4阶「希望皇 霍普」上，每回合1次。不能成为超量素材。此卡战斗时对方不能发动效果。有「希望皇 霍普」素材时，可移除2素材，使伤害计算时攻击力变为5000。',{xyzCount:3,xyzAttribute:'光',rankUpFamily:'utopia',rankUpRank:4,cannotXyz:true});
  X('gagaga-cowboy','我我我枪手','Gagaga Cowboy',4,1500,2400,'地','战士族','gagaga','2只4星怪兽。每回合1次移除1素材：攻击表示时，本回合攻击对方怪兽的伤害计算期间自身攻击力上升1000、对手下降500；守备表示时，给予对方800伤害。',{onomat:true});
  X('castel','鸟铳士 卡斯泰尔','Castel, the Skyblaster Musketeer',4,2000,1500,'风','鸟兽族','generic','2只4星怪兽。移除1素材使1只表侧怪兽里侧守备；或移除2素材将场上1张其他表侧卡洗回卡组。两个效果每回合只能使用其中1个1次。');
  X('utopia-ray-v','CNo.39 希望皇 霍普雷V','Number C39: Utopia Ray V',5,2600,2000,'光','战士族','utopia','3只5星怪兽。原持有者控制的此卡被对方破坏时，可将墓地1只超量怪兽返回额外卡组。持有「No.39 希望皇 霍普」作为素材时，每回合1次，可移除1素材，破坏对方1只怪兽，并给予其原本攻击力数值的伤害。',{xyzCount:3,chaosNumber:true});

  // Qliphort: Pendulum monsters are main-deck cards, not Extra Deck monsters.
  const qliBody = '可以不解放通常召唤。若不解放召唤或被特殊召唤，等级变为4、原本攻击力变为1800。通常召唤或盖放的此卡不受原本等级／阶级低于此卡等级的怪兽发动的效果影响。';
  const qliScale = '自己只能特殊召唤「机壳」怪兽，此限制不能被无效。';
  P('qli-scout','机壳 侦察机','Qliphort Scout',5,1000,2800,9,'通往存储世界的终端，解读世界树的深层信息。',qliScale+'每回合1次，支付800LP，从卡组检索此卡以外的1张「机壳」卡。',{effect:null});
  P('qli-monolith','机壳 单体','Qliphort Monolith',5,2400,1000,1,'掌管系统重启的终端，以沉默的巨碑承载无限可能。',qliScale+'结束阶段，如果本回合进行了上级召唤，可按本回合为上级召唤而解放的「机壳」数量抽卡。',{effect:null});
  P('qli-carrier','机壳 运载者','Qliphort Carrier',6,2400,1000,1,qliBody+'被解放时，可以将场上1只怪兽返回手牌。',qliScale+'自己的「机壳」攻击力上升300。',{qliReduced:true});
  P('qli-helix','机壳 螺旋机','Qliphort Helix',6,2400,1000,9,qliBody+'被解放时，可以破坏场上1张魔法或陷阱卡。',qliScale+'对方怪兽的攻击力下降300。',{qliReduced:true});
  P('qli-disk','机壳 磁盘机','Qliphort Disk',7,2800,1000,1,qliBody+'解放「机壳」进行上级召唤时，可以从卡组特殊召唤2只「机壳」，它们在结束阶段破坏。',qliScale+'自己的「机壳」攻击力上升300。',{qliReduced:true});
  P('qli-stealth','机壳 隐藏者','Qliphort Stealth',8,2800,1000,1,qliBody+'解放「机壳」上级召唤时，可以将场上1张卡返回手牌，对方不能响应这个效果。',qliScale+'自己的「机壳」攻击力上升300。',{qliReduced:true});
  M('qli-towers','隐藏的机壳 杀手','Apoqliphort Towers',10,3000,2600,'地','机械族','qliphort','不能特殊召唤，必须解放3只「机壳」通常召唤。不受魔法、陷阱及原本等级／阶级低于10的怪兽发动效果影响。特殊召唤的怪兽攻守下降500。每回合1次，令对方从手牌或场上选择1只怪兽送墓。',{noSpecial:true,tributeCount:3,tributeFamily:'qliphort'});
  S('saqlifice','机壳的牲祭','Saqlifice','qliphort','装备给「机壳」：攻击力上升300，不会被战斗破坏，上级召唤「机壳」时可作为2份祭品。此卡从场上送墓时可以检索1只「机壳」怪兽。',{spellKind:'equip'});
  S('summoners-art','召唤师的技艺',"Summoner's Art",'qliphort','从卡组将1只5星以上的通常怪兽加入手牌。');
  S('wavering-eyes','摇晃的目光','Wavering Eyes','qliphort','破坏双方灵摆区的卡，按实际破坏数依次适用：1张，给予对方500伤害；2张，检索1只灵摆怪兽；3张，可除外场上1张卡；4张，可检索「摇晃的目光」。',{spellKind:'quick'});
  T('skill-drain','技能抽取','Skill Drain','generic','支付1000LP发动。此卡在场上表侧存在时，所有表侧怪兽的效果无效；它们仍可发动效果。',{trapKind:'continuous'});
  T('pendulum-reborn','灵摆苏生','Pendulum Reborn','qliphort','从自己的墓地或表侧额外卡组特殊召唤1只灵摆怪兽；从表侧额外卡组登场仍须使用可用的额外怪兽区。');

  // Exodia: five different parts, spell-counter engine, defense and resource loops.
  M('exodia-head','被封印的艾克佐迪亚','Exodia the Forbidden One',3,1000,1000,'暗','魔法师族','exodia','当此卡与被封印者的左腕、右腕、左足、右足同时存在于手牌时，获得决斗胜利。',{exodiaPart:'head'});
  for (const [id,name,en,part] of [
    ['exodia-left-arm','被封印者的左腕','Left Arm of the Forbidden One','left-arm'],
    ['exodia-right-arm','被封印者的右腕','Right Arm of the Forbidden One','right-arm'],
    ['exodia-left-leg','被封印者的左足','Left Leg of the Forbidden One','left-leg'],
    ['exodia-right-leg','被封印者的右足','Right Leg of the Forbidden One','right-leg']
  ]) M(id,name,en,1,200,300,'暗','魔法师族','exodia','解开封印的五个部件之一。集齐五个不同部件即可唤醒禁忌之力。',{effect:null,exodiaPart:part});
  M('royal-library','王立魔法图书馆','Royal Magical Library',4,0,2000,'光','魔法师族','exodia','每当魔法卡的发动处理完毕，放置1个魔力指示物，最多3个。主要阶段可以移除3个指示物抽1张卡。此抽卡效果没有每回合次数限制。');
  M('sangan','三眼怪','Sangan',3,1000,600,'暗','恶魔族','generic','从场上送墓时，检索1只攻击力1500以下的怪兽；本回合不能发动该同名怪兽卡的效果。每回合1次。艾克佐迪亚的胜利条件不属于发动效果。');
  M('witch-forest','黑森林的魔女','Witch of the Black Forest',4,1100,1200,'暗','魔法师族','generic','从场上送墓时，检索1只守备力1500以下的怪兽；本回合不能发动该同名怪兽卡的效果。每回合1次。');
  M('battle-fader','战斗消失者','Battle Fader',1,0,0,'暗','恶魔族','exodia','对方直接攻击宣言时，可以从手牌特殊召唤此卡并结束战斗阶段。以此方法特殊召唤的此卡离场时除外。');
  M('cardcar-d','卡片汽车·D','Cardcar D',2,800,400,'地','机械族','exodia','不能特殊召唤。通常召唤当回合的主要阶段1，可以解放此卡抽2张卡，并直接进入结束阶段。发动此效果的整回合不能特殊召唤。',{noSpecial:true});
  S('upstart-goblin','成金哥布林','Upstart Goblin','exodia','抽1张卡，然后对方回复1000LP。');
  S('dark-factory','暗之量产工厂','Dark Factory of Mass Production','exodia','将自己墓地2只通常怪兽加入手牌。');
  S('one-day-peace','一时休战','One Day of Peace','exodia','双方各抽1张卡。直到对方下个回合结束，双方受到的所有伤害变为0。');
  S('broken-bamboo','折断的竹光','Broken Bamboo Sword','bamboo','装备怪兽的攻击力上升0。可满足「黄金色的竹光」的发动条件。',{spellKind:'equip'});
  S('cursed-bamboo','妖刀竹光','Cursed Bamboo Sword','bamboo','装备怪兽攻击力上升0。每回合1次，将自己另一张「竹光」返回手牌，使装备怪兽本回合可以直接攻击。此卡送墓时，可以检索此卡以外的1张「竹光」。',{spellKind:'equip'});
  S('golden-bamboo','黄金色的竹光','Golden Bamboo Sword','bamboo','自己控制「竹光」装备魔法时，抽2张卡。');
  S('wonder-wand','魔术魔杖','Wonder Wand','exodia','装备给魔法师族，攻击力上升500。可以将装备的己方怪兽与此卡送墓，抽2张卡。',{spellKind:'equip'});
  T('reckless-greed','无谋的贪欲','Reckless Greed','exodia','抽2张卡，跳过自己接下来的2个抽卡阶段。多张同回合发动的跳过期间重叠计算。');
  T('waboku','和睦的使者','Waboku','generic','本回合自己受到的战斗伤害变为0，自己的怪兽不会被战斗破坏。');

  // Cyber Dragon: field/GY name changes, Fusion and overlay promotion.
  M('cyber-dragon','电子龙','Cyber Dragon',5,2100,1600,'光','机械族','cyber','仅对方控制怪兽时，可以从手牌特殊召唤此卡。');
  M('cyber-core','电子龙核','Cyber Dragon Core',2,400,1500,'光','机械族','cyber','在场上、墓地当作「电子龙」。通常召唤时检索1张「电子」魔法／陷阱。仅对方控制怪兽时，可以从墓地除外此卡，从卡组特殊召唤1只「电子龙」怪兽。两个效果每回合只能使用其中1个1次。',{cyberName:true});
  M('cyber-herz','电子龙芯','Cyber Dragon Herz',1,100,100,'光','机械族','cyber','在场上、墓地当作「电子龙」。特殊召唤时可变为5星直到回合结束，此后只能特殊召唤机械族。送墓时可从卡组或墓地检索此卡以外的1只名称为「电子龙」的怪兽。两个效果每回合只能使用其中1个1次。',{cyberName:true});
  M('cyber-nachster','电子龙·次代星','Cyber Dragon Nachster',1,200,200,'光','机械族','cyber','在场上、墓地当作「电子龙」。丢弃1只其他怪兽，从手牌特殊召唤此卡。召唤或特殊召唤时，可以复活1只攻击力或守备力为2100的机械族，之后本回合只能特殊召唤机械族。两个效果各每回合1次。',{cyberName:true});
  M('cyber-drei','电子龙·三型','Cyber Dragon Drei',4,1800,800,'光','机械族','cyber','在场上、墓地当作「电子龙」。通常召唤时可使自己全部「电子龙」变为5星，该回合只能特殊召唤机械族。被除外时，可使自己的1只「电子龙」本回合不会被战斗或效果破坏。',{cyberName:true});
  M('cyber-vier','电子龙·四型','Cyber Dragon Vier',4,1100,1600,'光','机械族','cyber','在场上、墓地当作「电子龙」。自己召唤或特殊召唤「电子龙」时，可以从手牌守备表示特殊召唤此卡，每回合1次。自己场上的其他「电子龙」攻守上升500。',{cyberName:true});
  M('galaxy-soldier','银河战士','Galaxy Soldier',5,2000,0,'光','机械族','galaxy','从手牌送墓1只其他光属性怪兽，守备表示特殊召唤此卡。特殊召唤时可以检索1只「银河」怪兽；检索效果每回合1次。');
  S('power-bond','力量结合','Power Bond','cyber','用手牌或场上素材融合召唤1只机械族，使其攻击力上升原本攻击力数值。结束阶段自己受到该上升数值的伤害，即使融合怪兽已离场也结算。');
  S('overload-fusion','超载融合','Overload Fusion','cyber','从自己场上或墓地除外素材，融合召唤1只暗属性机械族。');
  S('cyber-emergency','电子紧急呼救','Cyber Emergency','cyber','检索1只「电子龙」怪兽，或不能通常召唤的光属性机械族。若这张卡的发动被对方无效并送墓，可以丢弃1张卡将其加入手牌。每回合只能发动1张同名卡。');
  S('cyber-revsystem','电子革命系统','Cyber Revsystem','cyber','从手牌或墓地特殊召唤1只名称为「电子龙」的怪兽，该怪兽不会被效果破坏。');
  S('machine-duplication','机械复制术','Machine Duplication','cyber','以自己1只攻击力500以下的表侧机械族为对象，从卡组特殊召唤最多2只与其当前名称相同的怪兽。');
  S('cyberload-fusion','电子负载融合','Cyberload Fusion','cyber','将自己场上或表侧除外的素材洗回卡组，融合召唤1只以「电子龙」为素材条件的机械族。本回合自己的其他怪兽不能攻击。每回合只能发动1张同名卡。',{spellKind:'quick'});
  F('cyber-twin','电子双生龙','Cyber Twin Dragon',8,2800,2100,'光','机械族','cyber','「电子龙」＋「电子龙」。融合召唤只能使用以上素材。每个战斗阶段可以攻击2次。',[{nameId:'cyber-dragon'},{nameId:'cyber-dragon'}]);
  F('cyber-end','电子终结龙','Cyber End Dragon',10,4000,2800,'光','机械族','cyber','「电子龙」3只。融合召唤只能使用以上素材。具有守备贯穿伤害。',[{nameId:'cyber-dragon'},{nameId:'cyber-dragon'},{nameId:'cyber-dragon'}]);
  F('chimeratech-rampage','嵌合狂暴龙','Chimeratech Rampage Dragon',5,2100,1600,'暗','机械族','cyber','「电子龙」怪兽2只以上。融合召唤时可破坏最多为素材数量的魔法／陷阱。每回合1次，从卡组将最多2只光属性机械族送墓，每送墓1只，本回合增加1次攻击。',[{family:'cyber'},{family:'cyber'}],{fusionMore:{family:'cyber'}});
  F('chimeratech-overdragon','嵌合超载龙','Chimeratech Overdragon',9,0,0,'暗','机械族','cyber','「电子龙」＋机械族1只以上。必须融合召唤。原本攻守变为素材数×800；融合召唤时将自己的其他卡全部送墓。每个战斗阶段可向怪兽攻击素材数量次，直接攻击最多1次且须尚未攻击。',[{nameId:'cyber-dragon'},{race:'机械族'}],{fusionMore:{race:'机械族'},fusionOnly:true});
  X('cyber-nova','电子龙·新星','Cyber Dragon Nova',5,2100,1600,'光','机械族','cyber','2只5星机械族。每回合各1次：移除1素材复活墓地的「电子龙」；快速效果，除外手牌或场上1只「电子龙」，本回合攻击力上升2100。因对方效果送墓时，可从额外卡组特殊召唤1只机械族融合怪兽。',{xyzRace:'机械族'});
  X('cyber-infinity','电子龙·无限','Cyber Dragon Infinity',6,2100,1600,'光','机械族','cyber','3只6星光属性机械族，也可叠放在「电子龙·新星」上，每回合1次。攻击力上升素材数×200。每回合各1次：将场上另一只表侧攻击怪兽作为素材；快速效果，移除1素材，无效1次效果发动并破坏。',{xyzCount:3,xyzAttribute:'光',xyzRace:'机械族',rankUpFrom:['cyber-nova']});

  // Crystron: non-tuners set up resources; tuners Synchro on the opponent's turn.
  const cryDestroy = '每回合可以选择1个效果使用1次：破坏自己1张表侧卡，从卡组特殊召唤1只「水晶机巧」调整，此后本回合从额外卡组只能特殊召唤机械族同调；或';
  M('cry-sulfefnir','水晶机巧－硫黄石英','Crystron Sulfefnir',5,2000,1500,'水','机械族','crystron','从手牌丢弃此卡以外的1张「水晶机巧」，从手牌或墓地守备表示特殊召唤此卡，然后破坏自己1张卡。场上此卡被战斗或效果破坏时，可以从卡组守备表示特殊召唤1只「水晶机巧」。每个效果每回合1次。');
  M('cry-thystvern','水晶机巧－紫晶龙','Crystron Thystvern',3,1500,1500,'水','机械族','crystron',cryDestroy+'从墓地除外此卡，检索此卡以外的1只「水晶机巧」怪兽。');
  M('cry-smiger','水晶机巧－烟晶虎','Crystron Smiger',3,1000,1800,'水','机械族','crystron',cryDestroy+'从墓地除外此卡，检索1张「水晶机巧」魔法／陷阱。');
  M('cry-rosenix','水晶机巧－玫晶鸳','Crystron Rosenix',4,1800,1000,'水','机械族','crystron',cryDestroy+'从墓地除外此卡，特殊召唤1只1星、攻守0的水晶机巧衍生物，该衍生物不能被解放。');
  M('cry-prasiortle','水晶机巧－绿晶龟','Crystron Prasiortle',2,500,2000,'水','机械族','crystron',cryDestroy+'从墓地除外此卡，从手牌特殊召唤1只「水晶机巧」。');
  M('cry-citree','水晶机巧－黄晶','Crystron Citree',2,500,500,'水','机械族','crystron','调整。对方主要或战斗阶段，每回合1次：特殊召唤墓地1只非调整并使其效果无效，立即只用那只怪兽和此卡同调召唤机械族；这次素材改为除外。',{tuner:true});
  M('cry-quan','水晶机巧－量子刚玉','Crystron Quan',1,500,500,'水','机械族','crystron','调整。对方主要或战斗阶段，每回合1次：从手牌特殊召唤1只非调整并使其效果无效，立即只用那只怪兽和此卡同调召唤机械族。',{tuner:true});
  M('cry-rion','水晶机巧－红晶','Crystron Rion',3,500,500,'水','机械族','crystron','调整。对方主要或战斗阶段，每回合1次：特殊召唤自己表侧除外的1只非调整并使其效果无效，立即只用那只怪兽和此卡同调召唤机械族；这次素材洗回卡组。',{tuner:true});
  M('scrap-recycler','废铁回收员','Scrap Recycler',3,900,1200,'地','机械族','generic','召唤或特殊召唤时，可以将卡组1只机械族送墓。每回合1次，将墓地2只4星地属性机械族洗回卡组，抽1张卡。');
  S('crystolic-potential','水晶机巧潜能','Crystolic Potential','crystron','自己「水晶机巧」攻守上升300。双方的结束阶段，可以按本回合自己同调召唤的「水晶机巧」怪兽数量抽卡。',{spellKind:'field'});
  T('cry-impact','水晶机巧冲击','Crystron Impact','crystron','特殊召唤自己除外的1只「水晶机巧」，并使对方所有表侧怪兽守备力变为0。墓地效果：除外此卡，无效以自己「水晶机巧」为对象的1次效果；送墓当回合不能发动。每个效果每回合1次。');
  T('cry-entry','水晶机巧入场','Crystron Entry','crystron','从手牌和墓地各特殊召唤1只「水晶机巧」调整。墓地效果：除外此卡，将卡组中等级不同于自己目标「水晶机巧」的1只「水晶机巧」送墓，使目标变为其等级；送墓当回合不能发动。每个效果每回合1次。');
  Y('cry-ametrix','水晶机巧－紫黄晶','Crystron Ametrix',5,2500,1500,'水','机械族','crystron','同调召唤时，使对方所有特殊召唤的怪兽变为守备表示。同调召唤的此卡被战斗或效果破坏时，可复活墓地1只非同调的「水晶机巧」。');
  Y('cry-quandax','水晶机巧－量子刚玉·白晶','Crystron Quandax',4,1800,2000,'水','机械族','crystron','同调调整。每回合1次，对方主要或战斗阶段，可以立即进行一次以此卡为素材的同调召唤。同调召唤的此卡被战斗或效果破坏时，可复活墓地1只非同调的「水晶机巧」。',{}, {tuner:true});
  Y('cry-phoenix','水晶机巧－凤凰','Crystron Phoenix',9,2800,2000,'水','机械族','crystron','同调调整＋非调整同调。 同调召唤时，除外对方场上与墓地的全部魔法、陷阱。被同调召唤的此卡被战斗或效果破坏时，可复活墓地中此卡以外的1只怪兽。',{tunerType:'synchro',nonType:'synchro'});
  Y('cry-quariongandrax','水晶机巧－中枢大蛇','Crystron Quariongandrax',9,3000,3000,'水','机械族','crystron','2只以上调整＋1只非调整。同调召唤时，可除外对方场上与墓地最多为素材数量的怪兽。同调召唤的此卡被战斗或效果破坏时，可特殊召唤双方除外区中此卡以外的1只怪兽。',{minTuners:2,maxTuners:5,minNon:1,maxNon:1});
  Y('samurai-destroyer','武士破坏王','Samurai Destroyer',7,2600,1400,'地','机械族','generic','此卡战斗时，对方不能发动效果，与它战斗的怪兽在该伤害计算期间效果无效。原持有者控制的表侧此卡因对方效果离场时，可复活墓地1只机械族。');
  Y('powered-inzektron','甲化铠骨格','Powered Inzektron',6,2500,1600,'光','机械族','generic','同调召唤时，本回合此卡不会被战斗或效果破坏，且自己受到的所有伤害变为0。');

  S('reinforcement-army','增援','Reinforcement of the Army','generic','从卡组将1只4星以下战士族加入手牌。');
  S('foolish-burial','愚蠢的埋葬','Foolish Burial','generic','从卡组将1只怪兽送去墓地。');
  S('one-for-one','一对一','One for One','generic','从手牌将1只怪兽送墓，从手牌或卡组特殊召唤1只1星怪兽。');
  M('doppel-token','二重身衍生物','Doppel Token',1,400,400,'暗','战士族','token','由二重身战士产生。不能加入卡组或作为超量素材。',{type:'token',effect:null,notCollectible:true});
  M('cry-token','水晶机巧衍生物','Crystron Token',1,0,0,'水','机械族','token','由玫晶鸳产生。不能解放、加入卡组或作为超量素材。',{type:'token',effect:null,notCollectible:true,cannotTribute:true});

  const expand = entries => entries.flatMap(([id, n]) => Array(n).fill(id));
  const deck = (id,name,en,ace,player,mechanic,description,main,extra,combo) => {
    DECKS[id] = {id,name,en,ace,player,avatar:id,mechanic,description,subtitle:description,combo,cards:expand(main),extra:expand(extra),preset:true};
  };
  deck('hero','HERO · 交织的正义','ELEMENTAL HERO', 'hero-sunrise','游城十代','融合',
    '以属性与融合素材展开，利用假面变化制造连锁，让英雄在关键时刻进化。',
    [['hero-stratos',3],['hero-shadow-mist',2],['hero-solid-soldier',3],['hero-liquid-soldier',2],['hero-blazeman',2],['hero-honest-neos',1],['hero-neos',1],['hero-avian',1],['hero-burstinatrix',1],['hero-sparkman',1],['hero-clayman',1],['hero-bubbleman',2],['e-emergency-call',3],['reinforcement-army',1],['polymerization',3],['miracle-fusion',3],['mask-change',3],['a-hero-lives',1],['monster-reborn',1],['mst',2],['mirror-force',2],['waboku',1]],
    [['hero-sunrise',3],['hero-absolute-zero',3],['hero-the-shining',2],['hero-great-tornado',2],['hero-flame-wingman',1],['masked-dark-law',2],['masked-acid',2]],
    ['天空侠检索影雾女郎；固态侠拉出影雾，取得假面变化。','融合日出侠检索奇迹融合；绝对零度侠变身酸水，连续处理前后场。']);
  deck('blackwing','黑羽 · 漆黑的疾风','BLACKWING', 'bw-armor-master','克罗·霍根','同调',
    '黑旋风积累资源，黑羽从手牌接连登场，用精确等级组合奏响同调。',
    [['bw-bora',3],['bw-gale',3],['bw-shura',3],['bw-blizzard',3],['bw-kalut',3],['bw-zephyros',2],['bw-kris',3],['black-whirlwind',3],['icarus-attack',3],['pot-of-greed',2],['monster-reborn',2],['foolish-burial',1],['mst',3],['raigeki',1],['mirror-force',2],['waboku',2],['negate-attack',1]],
    [['bw-armor-master',3],['bw-armed-wing',3],['bw-raikiri',3],['bw-nothung',3],['stardust-dragon',2],['castel',1]],
    ['黑旋风在场时通常召唤修罗，检索盖尔并特殊召唤，3＋4同调铠翼鸦。','极北复活4星黑羽，2＋4同调苦剑鸟，再获得一次黑羽通常召唤。']);
  deck('junk','废品 · 奔向星尘','SYNCHRON', 'shooting-star','不动游星','加速同调',
    '墓地复活与衍生物形成精密的等级阶梯，从废品增速者奔向流星龙。',
    [['junk-synchron',3],['junk-converter',3],['doppelwarrior',3],['quillbolt',3],['jet-synchron',3],['quickdraw-synchron',2],['fleur-synchron',2],['tuning',3],['reinforcement-army',1],['foolish-burial',2],['one-for-one',2],['monster-reborn',2],['pot-of-greed',2],['mst',2],['mirror-force',2],['waboku',3],['swords',1],['negate-attack',1]],
    [['junk-warrior',2],['junk-speeder',2],['stardust-dragon',3],['formula-synchron',2],['shooting-star',2],['junk-archer',2],['junk-destroyer',2]],
    ['废品同调士＋二重身战士做增速者，衍生物与不同等级调整继续展开。','喷气＋1星衍生物做方程式，废品同调士＋增速者做星尘龙；2＋8加速同调流星龙。']);
  deck('utopia','希望皇 · 闪耀的未来','UTOPIA', 'utopia-lightning','九十九游马','超量',
    '用等级调整凑齐素材，叠放希望皇并管理素材，以升阶和翻倍机会打开胜机。',
    [['gagaga-magician',2],['gagaga-girl',1],['goblindbergh',2],['kagetokage',2],['utopic-onomatopoeia',3],['zs-ascended-sage',2],['zubaba-gagagacoat',3],['dododo-gogogoglove',3],['onomatopaira',3],['xyz-change-tactics',3],['double-or-nothing',2],['reinforcement-army',1],['monster-reborn',2],['pot-of-greed',2],['mst',2],['limited-barians-force',1],['mirror-force',3],['waboku',2],['raigeki',1]],
    [['utopia',3],['utopia-ray',1],['utopia-double',2],['utopia-lightning',3],['gagaga-cowboy',1],['castel',3],['utopia-ray-v',2]],
    ['哥布林德伯格带出4星怪兽，用2只4星超量召唤霍普·翻倍。','翻倍检索翻倍机会，叠放霍普；霍普无效自己的攻击，再用翻倍机会重新进攻。']);
  deck('qliphort','机壳 · 世界树的协议','QLIPHORT','qli-towers','系统管理者','灵摆',
    '刻度1与9启动灵摆，侦察机检索资源，解放机壳触发回收与清场。',
    [['qli-scout',3],['qli-monolith',3],['qli-carrier',3],['qli-helix',3],['qli-disk',3],['qli-stealth',3],['qli-towers',2],['saqlifice',3],['summoners-art',3],['wavering-eyes',2],['skill-drain',3],['pendulum-reborn',3],['pot-of-greed',2],['mst',2],['mirror-force',2]],
    [],
    ['侦察机放入刻度9，支付800检索刻度1的运载者；一次灵摆召唤多个机壳。','牲祭让1只机壳算作2只祭品；上级召唤磁盘机或隐藏者，同时处理解放触发效果。']);
  deck('exodia','艾克佐迪亚 · 被封印的奇迹','EXODIA','exodia-head','封印解读者','特殊胜利',
    '用魔法图书馆与竹光构筑抽卡引擎，守住回合，在手牌中集齐五个不同部件。',
    [['exodia-head',1],['exodia-left-arm',1],['exodia-right-arm',1],['exodia-left-leg',1],['exodia-right-leg',1],['royal-library',3],['sangan',2],['witch-forest',1],['battle-fader',2],['cardcar-d',2],['upstart-goblin',3],['pot-of-greed',3],['dark-factory',2],['one-day-peace',2],['golden-bamboo',3],['cursed-bamboo',2],['broken-bamboo',1],['wonder-wand',2],['reckless-greed',3],['waboku',3],['swords',1]],
    [],
    ['王立图书馆积累3个魔力指示物，移除后继续抽卡。竹光装备满足黄金色竹光的条件。','三眼怪与魔女检索缺少的部件；集齐五个不同部件直接获胜，不必把它们召唤到场上。']);
  deck('cyber','电子龙 · 无限的进化','CYBER DRAGON','cyber-infinity','丸藤亮','融合 / 超量',
    '电子龙名称变化联动复制术，五星机械叠放新星与无限，力量结合完成爆发。',
    [['cyber-dragon',3],['cyber-core',3],['cyber-herz',3],['cyber-nachster',2],['cyber-drei',3],['cyber-vier',2],['galaxy-soldier',3],['cyber-emergency',3],['machine-duplication',3],['power-bond',2],['overload-fusion',2],['polymerization',1],['cyber-revsystem',2],['cyberload-fusion',2],['mst',2],['monster-reborn',1],['mirror-force',2],['raigeki',1]],
    [['cyber-twin',2],['cyber-end',2],['chimeratech-rampage',3],['chimeratech-overdragon',2],['cyber-nova',3],['cyber-infinity',3]],
    ['电子龙核在场上名为电子龙，复制术可从卡组拉出2只原版电子龙。','2只五星机械超量新星，再叠放无限并继承素材；也可以力量结合狂暴龙，送墓2只机械争取三次攻击。']);
  deck('crystron','水晶机巧 · 时序的共鸣','CRYSTRON','cry-quariongandrax','水晶调律师','对方回合同调',
    '非调整为墓地与除外区准备资源，调整在对方回合组合素材，改变战斗节奏。',
    [['cry-sulfefnir',3],['cry-thystvern',3],['cry-smiger',3],['cry-rosenix',3],['cry-prasiortle',2],['cry-citree',3],['cry-quan',2],['cry-rion',2],['scrap-recycler',3],['crystolic-potential',2],['cry-impact',3],['cry-entry',2],['foolish-burial',2],['monster-reborn',2],['one-for-one',1],['mst',2],['waboku',2]],
    [['cry-ametrix',3],['cry-quandax',3],['cry-phoenix',2],['cry-quariongandrax',2],['samurai-destroyer',3],['powered-inzektron',2]],
    ['回收员将紫晶龙送墓，紫晶龙除外检索硫黄石英；破坏自己的机巧，准备对方回合。','对方回合黄晶复活3星非调整，2＋3同调紫黄晶；白晶4＋紫黄晶5可加速同调凤凰。']);
  for (const [id,c] of Object.entries(CARDS)) {
    c.officialName ||= c.en;
    c.family ||= id === 'blue-eyes' || id === 'kaibaman' || id === 'ultimate-dragon' ? 'blue-eyes' : ['dark-magician','dark-girl','skilled-magician'].includes(id) ? 'dark-magician' : 'generic';
    c.cyberDragon = /^Cyber Dragon(?: |$)/i.test(c.officialName);
    c.crystron = /^Crystron(?: |$)/i.test(c.officialName);
  }
  CARDS['la-jinn'].officialName='La Jinn the Mystical Genie of the Lamp';
  DECKS.blue.mechanic='融合'; DECKS.dark.mechanic='魔法 / 融合';
  CARDS['chimeratech-rampage'].fusion=[{cyberDragon:true},{cyberDragon:true}];
  CARDS['chimeratech-rampage'].fusionMore={cyberDragon:true};
  CARDS['mst'].spellKind='quick';
  CARDS['negate-attack'].trapKind='counter';
  CARDS['fissure'].description='破坏对方场上攻击力最低的1只表侧怪兽。';
  CARDS['trap-hole'].description='对方通常召唤或反转召唤攻击力1000以上的怪兽时，可以破坏那只怪兽。';
  CARDS['kuriboh'].description='伤害计算时，可以从手牌丢弃此卡。这次战斗对自己造成的伤害变为0，怪兽的战斗破坏仍会结算。';
  DECKS.blue.preset=DECKS.dark.preset=true;
  data.expansionLoaded = true;
  data.families = {all:'全部系列',hero:'E·HERO',blackwing:'黑羽',junk:'废品 / 同调士',utopia:'希望皇',qliphort:'机壳',exodia:'艾克佐迪亚',cyber:'电子龙',crystron:'水晶机巧',generic:'通用卡'};
  data.isFamily = (card, family) => (family === 'early' && card.early) || card.family === family || card.families?.includes(family) || (family === 'junk' && card.family === 'synchron') || (family === 'utopia' && ['gagaga','onomat'].includes(card.family)) || (family === 'exodia' && card.family === 'bamboo');
  root.DuelData = data;
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
})(typeof globalThis !== 'undefined' ? globalThis : this);
