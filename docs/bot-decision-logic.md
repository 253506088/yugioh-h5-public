# 机器人出牌逻辑解析

本文解析当前版本（2026-09-21）机器人如何决定每一步操作，以及各部分由哪些代码实现。**2026-09-22 起在此之上新增第四层推演 `src/ai-planner.js`：统一局面价值、本回合推演、战斗推演与响应门，见 [机器人推演层](bot-planner.md)；本文其余内容描述的三层仍然全部保留并作为推演层的基础。**适用于普通人机、双机器人观战、死斗竞技场和各类模拟脚本；PVP 联机不运行机器人。

## 一句话结论

机器人是**纯 JavaScript 的"规则评分 + 有限推演"**：没有机器学习模型、没有语言模型、没有搜索树库、没有外部依赖。每一步都先枚举引擎认可的合法行动，用手写的评分表打分，再对少数关键候选在引擎副本上实际结算一次，比较结算前后的局面来做最终取舍。同一个随机种子下决定完全可复现。

## 整体结构

```
UI / 赛事 / 模拟脚本
   │  engine.aiNext()
   ▼
┌─ advanced-engine.js ─────────────────────────────────────────────┐
│ aiNext()                                                         │
│   ├─ 有待处理选择 → chooseAI(pending)   ← 响应、目标、素材、顺序 │
│   ├─ DuelAITactics.battlePlan()         ← 公开场面能否直接打死   │
│   ├─ 战斗阶段 → 贪心攻击                                         │
│   └─ 主阶段 → allActions() → actionScore() 排序                  │
│                └─ DuelAITactics.select() → DuelAIMarginal.action()│
└──────────────────────────────────────────────────────────────────┘
        │                         │                        │
        ▼                         ▼                        ▼
 advanced-effects.js       ai-marginal.js            ai-tactics.js
 每张卡的 aiScore /        推演器 simulate()         致胜战斗搜索
 aiResponse / aiTrigger    重复发动是否有收益        场面保留判断
 目标评分 candidateScore   替代目标                  攻/守召唤比较
 aiPick 选择目标与代价     同时诱发的顺序            手坑不上场
                                                     反击陷阱是否划算
```

| 文件 | 职责 | 关键入口 |
| --- | --- | --- |
| `src/advanced-engine.js` | 合法行动枚举、基础评分、待处理选择的默认策略、战斗阶段贪心、提交预检 | `allActions` 1296、`cardUtility` 1305、`actionScore` 1315、`chooseAI` 1363、`aiCanCommit` 1416、`aiNext` 1420 |
| `src/advanced-effects.js` | 每张卡的 AI 钩子、目标/代价评分、响应与诱发的取舍 | `candidateScore` 178、`aiPick` 242、`aiChoice` 256、`aiTrigger` 262、`aiResponse` 269 |
| `src/ai-marginal.js` | 引擎副本推演器；重复发动的边际收益比较；同时诱发的顺序 | `cloneEngine` 9、`projection` 28、`simulate` 99、`evaluate` 163、`score` 203、`order` 214 |
| `src/ai-tactics.js` | 战术层：致胜战斗、场面保留、防守表示、手坑、反击陷阱 | `battlePlan` 28、`assessment` 68、`expectedDamage` 72、`defenseBias` 87、`evaluate` 127、`select` 157、`handTrapBias` 182、`negationWorth` 221、`response` 242 |
| `src/effects-*.js`、`src/chronicle-*.js`、`src/early-engine*.js` | 逐卡的 `aiScore`／`aiResponse`／`aiTrigger`，以及少量 `chooseAI` 特例（仪式素材、等级和、齿轮工厂、要塞代价） | 通过 `E.register`／年份批次 helper 注册 |
| `src/game-v2.js`、`src/tournament.js` | 驱动：什么时候调用 `aiNext()`、节奏、暂停、录像 | `scheduleAI`、`runAIStep`、`stepMatch` |

规模（当前卡池 6,275 张、17,888 条效果定义）：`aiScore` 常数 13,002 条、函数 593 条；`aiResponse` 函数 1,720 条；`aiTrigger` 自定义 8 条；被动效果 674 条。也就是说绝大多数卡用的是批次 helper 给的默认分（通常魔法／陷阱 700，怪兽主阶效果 800），只有核心组合卡写了专门的判断。

## 决策入口：`aiNext()`

每次调用返回**一个**动作，调用方执行后再问下一步。顺序固定：

1. 决斗已结束 → `null`。
2. 有待处理选择（`state.pending`）→ 交给 `chooseAI`（见"响应与选择"）。
3. **致胜战斗**：`DuelAITactics.battlePlan` 在主要阶段 1 或战斗阶段检查公开场面，能确认打死对方就直接返回那条路线的第一步。
4. **战斗阶段**：贪心。按攻击力从高到低，对方无怪就直接攻击；否则攻击"打得过"的最强目标（里侧怪兽按 1600 估）；有直接攻击权的怪兽直接攻击；都不行进入主要阶段 2。
5. **主要阶段**：`allActions` 列出全部合法动作 → `actionScore` 打分 → 过滤分数 ≤ 0 → 降序 → `DuelAITactics.select` 从前往后挑第一个"有用"的（最多推演 8 个）→ `DuelAIMarginal.action` 附上推演时记录的选择方案。
6. 没有可选动作：主要阶段 1 且有攻击表示怪兽且第二回合起 → 进入战斗；否则结束回合。

引擎保证 `allActions` 只包含当下合法的动作（`actionsFor` 1277：通常召唤看 `canNormal`／祭品组合，盖放看空位，效果看 `canUse`），所以机器人不会产生非法操作；`act()` 失败会回滚状态并报错，UI 会暂停观战。

## 第一层：基础评分 `actionScore`

按动作类型给分，分数只在同一步的候选之间比较，没有统一量纲。

| 动作 | 计分方式 |
| --- | --- |
| 发动效果 `activate` | 效果定义的 `aiScore`（常数或函数）。没写时：来源怪兽在场且被无效 → -100，否则 350。结果再交给 `DuelAIMarginal.score` 做重复检查 |
| 通常召唤 `summon` | 380 + ATK/30 + 调整 50 + 卡名奖励表（Stratos 520、Junk Synchron 有目标 900、Royal Library 1000 等）+ `normalPriority`；守备表示：DEF>ATK 且对方更强 +50 否则 -120，有登场效果的守备 -450；上级召唤扣除祭品攻击力/15；再加 `defenseBias` 与 `handTrapBias` |
| 额外召唤 `extra-summon` | 500 + ATK/30 + 名单奖励（Junk Speeder 1400、Shooting Star 1700、Cyber Infinity 1400…）；Link 走 `linkScore`（`effects-link.js`） |
| 盖放 `set` | **只盖陷阱**：后场少于 4 张（休闲 2 张）给 180，否则 -100。魔法卡从不盖放 |
| 表示变更 `stance` | 里侧／守备转攻击：能打过任一对方怪或对方无怪 260，否则 -100；攻击转守备：-100 + `defenseBias` |
| 灵摆刻度 | 750 起，同刻度 -100，Qli Scout +150 |
| 灵摆召唤 | 680 |

`cardUtility`（1305）是很多地方共用的"这张卡值多少"：艾克佐迪亚部件 25000，王立魔法图书馆 7500，强欲之壶等抽卡／检索 6000，陷阱 2200，魔法 2500，怪兽 ATK + 4 星以下 1500 + 调整 800 + `aiValue`。它决定代价选谁、素材用谁、弃牌弃谁。

这些奖励表是 V2／V3 时代按预设卡组（英雄、废品、电子、机壳、黑羽、水晶）手写的，按内部 ID 匹配；2002—2013 年批次的卡只拿默认分。

## 第二层：重复发动的边际收益 `DuelAIMarginal`

目的是避免"第二张活死人的呼声再抢同一个目标"、"再发一张同名持续陷阱没有额外效果"这类空发。

- 只在存在"前一份"时才工作（`priorCopy` 21：连锁上、连锁历史里、场上或墓地有同名且同效果）。没有重复时直接放行。
- 有重复时用推演器分别模拟"不发动"和"发动"，把两个结果投影成可比较的状态（`projection` 28：去掉日志、流水号、使用次数、代价卡本身、LP 代价，规范化数值修正与锁定），完全相同 → -100（不发动）；有差异 → 保留，并把推演中做出的选择记为 `choices`。
- 需要目标的效果会尝试最多 10 个替代目标，找到"结果不同"的目标就采用它（`evaluate` 163）。
- 推演不确定（随机、抽卡、对方需要选择、超出预算）→ 保守放行。
- `order`（214）处理同时触发的多个诱发：强制的必选；可选的逐个比较有无收益，主阶段还要通过战术层的场面保留判断。

## 第三层：战术判断 `DuelAITactics`

### 局面评估 `assessment`（68）

`fieldValue` 把每只怪兽折算成 250 + max(ATK, DEF×0.8)×0.6 + min×0.08 + 场上速攻能力×250，再加最高攻击力×0.55。`assessment` = 我方 − 对方×0.85 + 可攻击总值×0.25 + 手牌×180 + 后场×160 + LP×0.15 − 对方 LP×0.45。这是一个静态启发式，不是胜率。

`expectedDamage`（72）估计对方下一次攻击能造成多少伤害：对方每只怪兽按允许攻击次数（最多 4）从强到弱依次挑我方最赚的目标，里侧按 1600。

### 致胜战斗 `battlePlan`（28）

只看公开信息（对方全部怪兽表侧、我方可动怪兽的攻击力上限 ≥ 对方 LP 才开始）。用推演器做宽度优先：主要阶段 1 的候选是"进入战斗"和合法的守备转攻击；战斗阶段的候选是按价值排序的攻击（直击优先、能击破加 1000）。预算 32 个节点、每节点 8 个候选、路径 12 步；任一分支推演出 `winner === 我方` 且不含随机就返回整条路线。不预测对方手牌，真实对局中手坑仍会正常响应。

### 场面保留 `evaluate`／`select`（127、157）

排序后的候选按顺序处理，只有发动、额外召唤和上级召唤需要推演（最多 8 个）：

- 我方已占优（最高攻 ≥ 1600 且 ≥ 对方、总值 ≥ 对方、能攻击）时才启用保留判断；劣势时一律放行，鼓励展开与解场。
- 推演后直接取胜 → 用；直接落败 → 弃。
- 推演遇到抽卡：用抽卡前的局面加每张 180 估值，若为了赌新卡而拆掉大量场面 → 弃（`do-not-gamble-away-board`）。
- 场面价值明显下降（power 掉 650 或最高攻掉 650 且总值降 250）→ 再看接下来最多两步旧 AI 会选的召唤／展开能否恢复，不能就弃（`preserve-strong-board`）。

### 防守表示 `defenseBias`（87）

通常召唤时同时比较攻击召唤与里侧盖放两条推演：攻击表示能直接赢或有致胜路线 → 强烈偏向攻击；盖放能把"必死"变"不死" → +1000；能省 500 以上伤害且登场没有实际收益 → +200～700；反转怪兽、高守低攻且没有收益 → +240。攻击转守备也用同一套伤害比较。

### 手坑与反击陷阱（2026-09-21 新增）

- `handTrapBias`（182）：只在手牌发动、非主阶或速度 ≥ 2、ATK ≤ 1200 的怪兽视为手坑，召唤／盖放扣 1500；例外是召唤后立即出现新的额外召唤选项，或场上无怪且只有盖放能避免致死而这张卡的手牌效果又挡不住。
- `negationWorth`（221）：对方发动或宣言召唤、我方响应需要 LP 或额外卡片代价时，推演"放弃"与"发动"两条分支，用 `boardValue`（场面评估 + 我方表侧后场×300 − 对方后场×160 − 对方手牌×120）比较；发动后更好或能避免直接落败才发动。
- `response`（242）把以上门槛接到所有响应评分上；我方回合延展自己的展开时还要通过场面保留判断。

## 响应与选择：`chooseAI(pending)`

| pending 类型 | 谁在做决定 |
| --- | --- |
| `window`（可以连锁的时点） | 每个选项 `aiResponse(e,ctx,window)` 打分；没写就用 `aiScore`；再没有则"对方发动的连锁"200 否则 0。过滤 ≤ 0 后降序，再逐个用 `aiCanCommit` 确认真的能提交，第一个通过的就发动，否则 pass |
| `trigger`（可选诱发） | 强制必发；可选看 `aiTrigger`（只有 8 张自定义，默认"来源没被无效就发"），再过边际收益与战术门 |
| `input`（目标／代价） | `aiPick`：按 `candidateScore` 排序，满足 `min`/`max`/`distinct`/`validator` 逐个加入；`destroy`/`banish`/`bounce` 超过下限后不选负分目标 |
| `materials`（素材） | 同调／超量／连接：`cardUtility` 总和最低的一组；融合按 `fusionCombos`，合成龙尽量多；仪式素材由 `early-engine.js` 覆盖；灵摆按攻击力 |
| `choice`（效果分支） | `preferIds` 指定顺序，否则走 `aiPick` |
| `discard` | 弃 `cardUtility` 最低的 |
| `replay`（攻击目标重选） | 直击优先，否则最弱的打得过的目标，否则取消 |
| `order`（同时诱发） | `DuelAIMarginal.order` |

`aiCanCommit`（1416）在引擎副本上试执行该响应，失败（例如假面英雄 暗法在场时欧尼斯特的代价送不进墓地）就换下一个候选。

### 目标评分 `candidateScore`（178）

按输入组的 `role` 分支：

- `cost`／`discard`／`send-cost`：−`cardUtility`，墓地有价值的卡（Jet Synchron、Quillbolt 等）+6000。
- `destroy`／`banish`／`bounce`：己方 −5000；对方里侧 1700；怪兽 ATK+1200；灵摆 3200；持续魔陷 2900；其他 1700。
- `search`：核心检索目标名单（Stratos、Cyber Core、Junk Synchron…，手里已有则降分），其余用 `cardUtility`。
- `special`／`synchrons`／`send-deck`／`fusion-choice`／`mask-target`／`own-boost`／`xyz-upgrade`：各自的名单表。
- Link 相关由 `effects-link.js` 的 `extraCandidateScore` 先接管；输入组可以自带 `aiValues` 完全接管。

## 推演器 `simulate`（`ai-marginal.js` 99）

所有"实际结算一次再比较"都走它：

1. `cloneEngine`：复制原型链与状态（去掉日志），保留随机状态，打上 `_aiMarginalProbe`。副本里 `actionScore`／响应评分退回基础评分，不再递归推演。
2. **脱敏对方**：未公开的对方手牌与卡组替换为 Battle Ox，未翻开的额外卡组替换为青眼究极龙，里侧魔陷替换为圣防，避免用偷看到的信息做决定。
3. **不确定标记**：`random`（洗牌以外）、`draw`、`mill`、`revealCards`、从卡组挖卡 → `uncertain`；抽卡前另存一份副本供"不赌抽卡"判断。
4. **代价捕获**：`payLP`、`move(kind:'cost')`、指示物减少都记下来，投影比较时剔除。
5. **选择捕获**：自己效果的每个输入组按 `aiPick` 选，并记录成 `plan`；单目标输入还枚举最多 10 个替代目标。
6. 自动处理后续：可选诱发按选项、对方窗口一律 pass、**需要对方选择就抛错**（视为不确定）；预算 160 步。
7. 结束时连锁未清空也算失败。

推演不消耗实局随机序列（副本有自己的 `randomState`），也不写日志；赛事在 `act()` 前保存随机状态，回放只重放动作。

## 驱动与节奏

- `game-v2.js` `scheduleAI`：轮到机器人（或机器人需要响应）时用 `setTimeout` 排一步：快速 160/220 ms，沉浸 650～720 ms；连锁演出、弹窗、页面隐藏、观战暂停时不排。`spectateStep` 单步执行一次 `aiNext`。
- `tournament.js` `stepMatch`：无延时循环，每步记录动作与之前的随机状态；2,400 步或 160 回合触发保护裁定（LP 高者晋级）。
- 模拟脚本（`tests/*-simulation.cjs`）直接 `while(!winner) act(aiNext())`，3,000 步上限。
- 难度只有一处差别：`casual` 后场最多盖 2 张陷阱，`standard` 4 张。

## 历史沿革

| 阶段 | 实现 |
| --- | --- |
| V2（`src/engine.js` 429 `aiNext`） | if-else 脚本：先打得过就打，有强欲之壶就发，怪兽从大到小召唤。文件仍在但不再被构建或调用 |
| V3／V4（`advanced-engine.js`） | 合法行动枚举 + `actionScore` + 逐卡 `aiScore`／`aiResponse` |
| 2026-09-13 | `ai-marginal.js` 边际收益；`ai-tactics.js` 致胜战斗、场面保留、防守表示（见 [ai-marginal.md](ai-marginal.md)、[bot-tactics-and-outcomes.md](bot-tactics-and-outcomes.md)） |
| 2026-09-21 | 手坑不上场、反击陷阱划算判断、响应提交预检、生效中效果展示（见 [lingering-and-bot-judgment.md](lingering-and-bot-judgment.md)） |
| 2026-09-22 | `ai-planner.js` 局面价值、本回合推演、战斗推演、响应门；波动加农炮改为起动效果；推演器提速（见 [bot-planner.md](bot-planner.md)） |

## 当前局限

以下为 2026-09-21 的状态；标 ✅ 的已由 [推演层](bot-planner.md) 处理。

- **没有多回合搜索**。所有推演只到当前动作结算完毕（致胜战斗除外，也只到本回合战斗结束）；不会为下回合留资源、不会考虑对方回合的展开。
- **评分表是名单驱动的**。2002—2013 年批次的绝大多数卡只有 700／800 默认分，效果之间几乎没有优先级；检索目标、特殊召唤对象也主要靠旧系列名单，新系列用 `cardUtility` 兜底。
- ✅ **战斗阶段是贪心**。除致胜路线外不推演攻击结果，`enemyValue` 把里侧一律当 1600，不估计对方盖卡和手坑，容易撞圣防／和睦。→ 标准难度下每次攻击先在副本结算，对方盖卡按数量折算。
- **魔法卡从不盖放**，速攻魔法只在手牌或当回合发动；后场只放陷阱。
- **脱敏偏乐观**。对方手牌统一当 Battle Ox，推演里对方永远 pass，所以"发动后的局面"是无干扰前提下的结果。
- **静态评估没有校准**。`assessment` 的系数是手调的，不同卡组之间不可比；`boardValue` 同理。
- ✅ **不识别节奏**：不会故意不召唤、不会留手牌、不会为了 OTK 攒资源；只有"场面保留"一条阻止拆场。→ 推演层把"进入战斗／结束回合"与每个候选放在同一价值尺度上比较。

## 可能的改进方向

按收益与工作量粗排，不是本批承诺：

1. **默认分按效果模板估值**：年份批次 helper 已知每条效果是检索／抽卡／破坏／复活／保护，可按模板和目标数量给出区分度更高的默认分，覆盖面最大。
2. ✅ **战斗阶段用推演器**：已由 `DuelAIPlanner.battle` 实现。
3. ✅ **通用的"发动是否有收益"门**：已由 `DuelAIPlanner.responseGate`（响应）与 `select`（主阶段）实现。
4. ✅ **一步对手回合展望**：已并入 `positionValue` 的战斗威胁与下回合伤害项。
5. **手牌管理**：给 `assessment` 的手牌项加入卡种（手坑、速攻、陷阱）权重，避免为了 +180 而不发动。

## 相关测试

- `tests/ai-planner.test.cjs`：局面价值、推演不改实局、战斗推演、响应门、难度开关、跨年代完整对局。
- `tests/ai-tactics.test.cjs`：致胜战斗、场面保留、防守表示、手坑、反击陷阱。
- `tests/ai-marginal.test.cjs`、`tests/ai-marginal-browser.cjs`：重复发动、替代目标、同时诱发、存档一致。
- `tests/simulation-fixes.test.cjs`：提交预检、卡片修复。
- `tests/yearly-simulation.cjs`、`tests/chronicle-simulation.cjs`、`tests/tournament-simulation.cjs`：全卡组机器人对战，检查不会卡死、不产生非法动作、录像可重放。
- `DuelAITactics.evaluate()`／`negationWorth()` 与 `DuelAIMarginal.evaluate()` 都返回 `reason` 字段，可在控制台直接查看某一步为什么被选或被弃。
