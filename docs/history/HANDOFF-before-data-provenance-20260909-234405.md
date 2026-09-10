# V4.1 项目交接

日期：2026-09-09。当前操作指南见 [MANUAL.md](MANUAL.md)。

## 用户目标与不可丢失的约定

1. 缺图必须仍能正常运行。
2. 图片由用户以后手动采集；维护好增量脚本即可。图片优先级低于所有内容开发。
3. 先落实 1999、2000、2001 三年卡片和仪式召唤。
4. 最终交付一个编译后的 `index.html`，保留源码、原始数据、图片、测试报告和历史中间文件。
5. 后续按年推进到 2026 截至当时实际发行的卡片。采集完成、效果实现和官方年度核验是不同状态。
6. 默认中文，支持中英日即时切换；卡片详情保留原图链接并增加对应百科。
7. 保留可选的「在线原版卡图」，尤其供无图版本使用。用户后续明确要求恢复此功能，覆盖 V4 曾采用的“运行时绝不联网取图”限制。
8. 手动采图必须显示实时进度，继续支持增量、断点后续取及日志归档。

## 已完成的工作

- 接入用户已下载的真实三年快照：1999 / 623，2000 / 337，2001 / 242，合计 1,202 个供应方身份。
- 保留 39 个原卡身份，新增 1,163 张，使可组卡总数为 1,367。新增卡 ID 采用 `early-<providerId>`。
- 导入器是离线、可重复执行的；记录输入哈希、原始英文说明、首次 OCG 日期候选、图片键及来源。
- 三年条目已全部连接到本作基础规则、通用效果模板或专用处理器。`pending` 列表为空。这里的完成口径是“本作实现已登记”，不是每张卡通过官方裁定认证。
- 16 对仪式怪兽 / 仪式魔法已逐对执行测试。支持主卡组、手牌 / 场上解放、固定等级要求、禁止多余解放、区域校验、表示选择、AI、中途保存及正规召唤标记。
- 补充反转与战斗后触发、准备阶段、临时控制权、怪兽装备、代用融合素材、通常召唤无效时点、陷阱怪兽、卡通及灵魂怪兽等早期机制。
- 交织绵羊新增仪式分支；修正黑魔术少女漏计混沌之黑魔术师的问题。
- 新增「仪式 · 混沌的降临」「融合 · 初代的羁绊」两套 40 张预设，预设总数 13。原有 DM、HERO、黑羽、废品、希望皇、机壳、艾克佐迪亚、电子龙、水晶机巧、珠泪和 Link 内容保留。
- 图鉴和组卡工坊支持单年 / 累计年份筛选；图鉴 24 张一页、工坊 30 张一页；大候选宣言界面采用可搜索文字列表。
- 原版卡图读取本地档案并在构建时内嵌，使用 Blob URL 复用已解码资源。V4.1 恢复可选在线补图；本地优先、失败回退，缺图不影响规则。
- 新增 `collect-game-art.mjs`，维护 `collect-years.mjs`；同一图片档案按哈希增量复用。`--plan` 不联网，`--offline` 不联网，`--no-images` 成功时返回 0。
- 添加 Node / 工具版本声明和锁文件，完整操作文档、规则 / 采集测试、年度混合模拟及浏览器验证脚本。
- 为全部 1,367 张可组卡卡片配齐中、英、日名称、说明和灵摆分段，保存三份原始 CDB、来源提交和哈希。语言切换不会修改卡片规则身份。
- 全部 1,367 张卡具有实际 YGOPRODeck 百科地址。详情中的百科与原图链接并列；卡图关闭或缺失时仍可看百科。
- 主要界面、具体效果按钮、卡片属性 / 种族、玩法指南和常见记录支持三语；切换保留对局、素材、表示、区域、连锁选择、筛选及组卡草稿。自建卡组名称不会自动翻译。
- 两个采集器默认输出进度和每 5 秒等待状态，实时追加 `progress.log`。`--quiet` 保留最终 JSON 和归档日志；`--plan` 不联网、不改卡图索引。

## 数据与成果在哪里

```text
data/yearly/1999/cards.json
data/yearly/2000/cards.json
data/yearly/2001/cards.json
data/yearly/manifest-1999-2001.json
output/yearly-collection/run-2026-09-09T02-33-23-930Z/raw/catalog.json
```

该原始目录 SHA-256：

```text
e536053bf7d3d22eca0c91e4370e30c76881c855888ff6afb54f507b73a5769a
```

开始本轮开发时，用户本地已经有 2,404 个图片档案条目（cropped / full 各一套）。本轮没有为了补齐图片而等待采集；读取已有文件用于最终构建。后续状态以档案索引和构建报告为准。

开发前备份：`output/v3-content-baseline-20260909-125221/`。年度效果原文审计分组：`output/early-card-audit/`。所有构建和验证报告继续按时间归档。

V4.1 开发前另保留 `output/v4.0-before-localization-20260909-184922/`。本次只使用用户已经下载的图片，未为开发批量采图；交付构建可嵌入 1,367 张，后续以 `output/build-report.json` 实际数量为准。

最终成品是根目录 `index.html`；无图验证成品是 `output/no-art/index.html`。不要把无图输出路径误当成根目录正式构建。

## 架构与容易踩到的点

### 数据与注册顺序

浏览器构建顺序由 `scripts/build.mjs` 显式维护。基础卡片 → 扩展 / Link → 生成年度卡片 → 预设 → 规则引擎 / 年度扩展 → 效果注册 → 生成三语资料 / 界面词典 / 显示代理 → 图片层 / UI。

CommonJS 入口为 `src/advanced-engine.js`。它加载年度扩展和效果注册，避免首次分析年度预设时仍把生成数据的 pending 初值视为最终状态。

`src/early-cards.js` 是生成物。不要将长期修改只写进它。效果代码在 `effects-early.js`、`effects-early-spells.js`、`effects-early-monsters.js`、`effects-early-traps.js`、`effects-early-complex.js`、`effects-early-advanced.js`。

### 规则与状态

`act()` 是原子操作，失败要恢复随机种子和整份状态。新字段也必须参与回滚。保存格式继续为 `state.version === 3`；项目版本 4.1.0 不等于存档版本 4。

不要把解放代价、规则送墓、连接 / 同调素材和效果送墓混用。珠泪、三眼怪、魔女及送墓反应依赖这些区别。

仪式解放在仪式魔法结算时处理，不是发动代价；等级要求来自仪式魔法，不能直接拿被降星后的仪式怪兽等级代替。

召唤无效窗口中，怪兽暂用 `summonPending` 标记；成功后才触发登场效果。被无效的卡发出 `from: summon-pending` 事件，不能虚构“从场上送墓”。

怪兽被吸收为装备使用 `monsterEquip`，不能先假送墓再装备。墓地效果的发动者应采用卡片到达墓地后的控制者 / 所有者，而不是机械沿用离场前的控制方。

新增多步效果请使用 `queue()`、`queueChoice()` 和命名 `E.op()`。存档里不能放函数、DOM 节点、Promise 或闭包。新的参数和选择需能 JSON 往返。

### 图片

当前运行的是 **`artwork-hybrid.js`**。`artwork.js` 和 `artwork-local.js` 保留作历史参考，不要同时放进构建列表。

`DuelArt` 优先读内嵌图片，再按用户开关加载在线图片，最终回退到可读卡面。无图构建的 `onlineArtDefault` 是 true，常规构建是 false；旧用户偏好优先。当前卡池从 `card-locales.js` 或卡片数据取得准确图片 ID，不需逐张请求元数据接口；以后未知身份才懒查询英文名，最多并行两条。关闭开关会中止未完成元数据请求并忽略迟到结果。

偏好键 `duel-local-art-enabled-v4` 控制总显示，`duel-sanctuary-online-art-v2` 控制在线补图，旧身份缓存键 `duel-sanctuary-artwork-v2` 继续兼容。线上图片不会自动写进项目目录，供以后构建仍须使用采集器。

两个采集器使用同一个 `assets/official-archive/index.json`。原件按内容哈希保存；`gameIds` / `cardNames` / `imageKeys` 用于匹配；完整卡面不直接重复内嵌到每个 DOM 元素。

原始文件、派生文件与构建缓存含义不同。手动批量删 `output/` 或 `assets/` 会丢失用户明确要求保留的中间资料。

### 三语资料和显示层

来源提交为 `mycard/ygopro-database@ac5d8fb80465e74b33f3b4a294e3b22c02d743f2`；之后以 `data/locales/source-manifest.json` 为准。原始 `zh-CN.cdb`、`en-US.cdb`、`ja-JP.cdb` 保存在 `data/locales/sources/<commit>/`，同步工具通过 Node 自带 SQLite 只读提取。

`src/card-locales.js` 是生成物。长期文字修订应在来源修订 / 同步器中保留依据，不要只改生成文件。百科 URL 来自已保存的元数据，禁止用猜测的英文 slug 冒充确切地址。

Barrel Dragon 存在跨来源编号别名：`providerId` / 图片 ID `81480461` 对应文本 `textId: 81480460`。已通过唯一英文名、攻击力、守备力和等级核对。别名在覆盖报告中保留；不能因此改写游戏或图片身份。

`DuelData.CARDS` 及 `DuelEffects` 是规则层的规范数据；**不要把已翻译的种族、属性或显示名写回规则层**。界面使用 `DuelI18n.cards` / `card()` 显示代理。卡组与素材操作仍按稳定 ID，搜索通过 `searchText()`（含效果）或 `searchName()`（仅名称 / 编号）匹配三语。

`i18n-data.js` 维护界面词典和动态模板，`i18n-effects.js` 维护具体效果按钮，`i18n-help.js` 维护指南。旧界面通过 DOM 文本翻译兼容，`data-action`、字段值和卡片编号不被翻译；新文案应同时提供三语。用户输入用 `data-user-content` 标记，卡片原文直接从本地三语记录显示。

语言偏好键是 `duel-sanctuary-language-v1`，值为 `zh-CN`、`en`、`ja`。切换触发 `duel-language-change`；`game-v2.js` 保存并恢复弹窗上下文、当前选择和滚动位置。新增弹窗类型时记得接入这条重绘路径，尤其不能清空已选素材或重开决斗。

## 验证入口

```powershell
npm.cmd ci
npm.cmd run cards:import
npm.cmd run locales:sync
npm.cmd run cards:coverage
npm.cmd test
npm.cmd run test:v4-simulation
npm.cmd run build:no-art
npm.cmd run build
npm.cmd run test:browser
npm.cmd run report
```

最新结果分别在：

- `output/v4-checks-report.json` 与对应 `results.tap`。
- `output/v4-simulation-report.json`；失败时保存对局快照及最近操作。
- `output/v4-browser-report.json`；有成品哈希、截图、脚本错误和 HTTP 请求计数。
- `output/v4.1-browser-report.json`；三语、选择保留、百科、模拟在线补图、内嵌优先和手机布局。
- `output/localization/card-coverage.json`；当前三语覆盖、缺失项和编号别名。
- `output/build-report.json`；有源文件列表、体积、内嵌图片数和图片告警。
- `output/v4-delivery-report.json`、`output/v4-QA.md`；聚合当前成品的哈希和已通过验证，生成时检查浏览器报告与成品一致。

旧 `tests/v3-browser.cjs` 保留了旧版界面断言，不是当前默认验证。`test:browser` 依次执行 `v4-browser.cjs` 和 `v4.1-browser.cjs`。前者显式关闭在线开关并验证零 HTTP 请求，后者以模拟图片响应测试可选网络路径，不能把前者的零请求结论泛化为“游戏没有在线功能”。

`npm test` 包括全部旧规则、资产采集、实时进度及三语完整性检查。`tests/i18n-audit.cjs` 和 `mobile-i18n-audit.cjs` 另保存界面截图和布局诊断；这些截图不能代替功能断言。

## 后续必须继续做的事

### 1. 官方年度目录核验

目前只使用供应方 `firstOCGDate` 候选。尚未独立核对 1999—2001 年全部卡包、预组、附卡、赠卡等产品，也没有证明不存在遗漏或错年。不能把“1,202 条全部导入”改写为“已证明收录三年官方全集”。

`Amphibious Bugroth` 的两个指定素材 `Ground Attacker Bugroth`、`Defender of the Sea` 不在本批快照中；导入保留名称约束，没有补造数据。`Temple of the Kings` 的 `Mystical Beast of Serket` 支线要在相关卡数据补入后再次验证。

本轮另行查询了 Bugroth 的公开元数据，原始响应保留在 `output/yearly-plan-research/20260909/bugroth.json`。供应方将 `Ground Attacker Bugroth` 记为 `2002-08-22` 首次 OCG，落在当前切片之外；没有擅自将它改年加入。另一个素材名称未能通过精确查询匹配，后续应核对名称及正式发行资料。

### 2. 逐卡裁定与组合审计

通用规则和关键流程已有自动测试，但远不是所有卡的全部互相作用。优先继续检查：

- 同时送墓 / 同时特殊召唤的完整时点、选发“时”与“场合”的差异。
- 持续无效效果之间的适用顺序，尤其 Jinzo、Royal Decree、Skill Drain、Imperial Order。
- 守备表示直接攻击、强制攻击、战斗卷回、多次战斗阶段、临时控制权与完整伤害步骤的组合。
- 陷阱怪兽 / 魔术礼帽临时怪兽与所有融合、连接、仪式素材规则的交互。
- 各卡特殊召唤条件中的“必须先”与“只能”的精细区别、隐藏区域的合法性与信息披露。
- 卡通、灵魂与旧卡勘误后的细节；目前使用当前供应方文本，不模拟历史规则版本。

有两项明确的本作适配：**Spirit Elimination** 预先指定替代除外顺序；**Bait Doll** 的可发动陷阱走后续连锁。已写在卡片实现说明和手册里。后续若改为完整官方处理，应同步更新测试及这些说明。

“implemented”是运行代码的登记状态，不是测试通过状态，更不是正式裁定认证。需要添加独立的逐卡裁定审计维度时，请新增字段，不要复用年度、图片或实现状态。

### 3. 从 2002 年开始的新批次

先用 `cards:year` + `collect:years --no-images` 准备下一年资料，再按小批次实现效果。当前导入器、筛选选项和覆盖报告的接入范围是 1999—2001；增加年份时同步扩展这些入口。

后续年份的供应方类型还可能包括同调、超量、灵摆、连接、调整等。虽然引擎已有这些召唤，**年度导入器的类型映射仍需随下一批扩展**，不能把所有新类型直接当作普通怪兽导入。

2026 批次应按执行当日截断实际发行日期；不要把仅已公告的未来产品纳入“至今”。目前 `prepare-year` 生成整年采集范围，届时要补截止日期核验。

### 4. 持续维护文案和工具

新增卡后运行 `locales:sync`，尽量从已保留快照离线提取三语；快照未收录的新卡再手动运行 `locales:update`。新增的特殊效果按钮、选择提示和实现适配说明也要补三语，不能只补卡名。社区库的译名与各地发行文本可能不同，保留来源及原文追溯，不把译名猜测当作官方资料。卡片内容和效果优先，图片最后由用户自行增量处理。

以后每批完成时，更新本交接文档、手册、覆盖报告和测试记录。没有被授权发布、部署或提交 Git，本轮也没有替用户执行这些动作。
