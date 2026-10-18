# 2025 批次验证

日期：2026-10-18。基线为 `48272b89fe9d5c54311bb7eb9a07c15195b325f7`。本轮保留10月7日、17日已有工作，修复历史整局发现的问题，重跑全量规则、历史整局和正式页面，并完成来源及离线复现审计。2024历史验收仍见[2024记录](verification-2024.md)，不把其中旧结果当作本轮重跑。

当前 **13,526目录身份、8,185可对战、148预设**。2025为 **28可用（24效果、4基础规则、0复用）／516 pending**；另外27张旧年依赖首次可用，净增55。1999—2025每年五套，共135套年度预设，另13套主题预设。

## 本轮实际执行

| 检查 | 结果 |
| --- | --- |
| 规则源码全量 | 14,625通过，0失败、0跳过、0取消；99个测试文件，Node 22.17.0 |
| 2025规则／交互／素材／天命专项 | 65项，已包含在全量 |
| 2025运行时身份扫描 | 实际544项，已包含在全量；不是零卡扫描 |
| 全年度构筑检查 | 27年各五套，三分区合法、无pending、无跨越OCG年份；29项来源／构筑检查及6项历史交互回归均纳入全量 |
| 历史完整对局 | 1999—2024的130套年度牌各一场，130完成、130整局重放一致、0错误 |
| 正式HTML年度浏览器 | 157组：2015为11、2016为10、2017／2018各12、2019为13、2020／2021各12、2022为13、2023／2024各12、2025为38 |
| 天命界面／AI导入界面 | 5组／9组，通过同一正式HTML |
| 三语／系列 | 全库13,526张三语名称、说明、灵摆文本及百科链接齐备；544张新身份三语及密码精确解析；固定CDB系列审计通过 |
| 全库AI名录 | 14,981条，与固定CDB一致；没有因新年度额外插入重复名称 |
| 图片 | 全部1,639张正式压缩图哈希一致；新增772张原图哈希齐备，旧来源哈希完整保留 |
| 卡片数据离线重建 | 年度快照、manifest、卡池、三语、系列、名录、预设、构筑报告及六份覆盖表共17个文件逐字节不变 |
| 图片重复优化 | 1,639张，changed=0，前后均34,996,910字节 |
| 独立HTML重建 | SHA-256与正式index.html一致 |

上述历史对局使用种子 `202510170 + case`，案例0—129连续。每套与同年度下一套交战，先后手交替；第24步从JSON存档恢复，终局从初始快照重放所有动作并比较整个状态。上限保持3000行动，未放宽以掩盖失败。该矩阵每套一场，不声称全历史牌组的两两穷举。

## 已有2025验证记录的复核

以下在2026-10-17运行，本轮核对完整报告、连续案例、重放标记、天命覆盖和赛事存档，**没有把它们写成本轮重新执行**：

| 检查 | 已有结果 |
| --- | --- |
| 2025五套整局矩阵 | 66场完成、66场完整重放一致：20场跨年对照＋20场年度有方向交叉＋26场天命 |
| 64人AI赛事 | 63场完成、63场完整重放一致、0保护判定，赛事存档可恢复 |

年度种子为 `202510020 + case`，案例0—65连续；覆盖全部26条天命，使用生产引擎与真实构筑。赛事种子为 `20251001`，五套2025牌和2016青眼／十二兽／威风妖怪组成64人名单，使用生产赛事实现。原报告分别位于 `output/rollout-2025/final/integration-0..3/` 和 `final/tournament/`。本轮两个历史修复另由六项反例、14,625项全量和130场历史整局覆盖。

## 本轮修复及页面检查

保留的历史模拟有四场失败：案例61、62的机甲要塞在手牌机械族合计不足8星时仍提供发动；案例81、87的天帝重复连锁后再次试图从已经离开的手牌位置召唤。修复后四场均在完整130场矩阵中通过。

要塞现在只提供合法的真实弃牌组合，AI可以选择7＋4或单张8星等组合，不足时不提供手续；特殊召唤手续不组成连锁。天帝没有凭空增加每回合次数限制，重复发动仍按卡文允许；解放素材改为结算时选择，并检查原手牌实体generation及当前合法素材，不能继续使用已离场的自己或失效祭品。JSON恢复与原回合玩家／通常召唤计数均有断言。

2015浏览器反例原先把灰流丽误写为未收录，已改为可用，并用Pot of Sloth测试真正的not-in-pool边界。K9-04 Noroi保持pending，不能混入有效构筑。全量中也验证了雷热交界在效果结算时的非连锁选择、真实素材移除、K9手牌展示、狼人暂时除外、码丽丝同回合陷阱代价、月光融合许可、闪刀额外区与连刀等分支。

所有年度页面使用同一SHA-256成品，阻断外部HTTP后执行。2025测试逐年选择1999—2025年度，确认每年五套；逐套点击2025构筑，核实选中状态、三分区及390px中／英／日布局。通过真实控件执行冰雷送墓代价、K9展示并召唤两张卡、三月兔除外、金狮子检索／弃牌、连刀额外区召唤及状态恢复。

独立 `isMobile:true`、`hasTouch:true` 环境用触屏完成K9展示与特殊召唤；桌面图鉴、中文手机牌组选择、触屏战场截图已视觉检查。环境为Edge／Chromium模拟手机，未测试实体手机或其他浏览器内核。AI导入采用模拟模型响应及本地代理，没有调用付费模型。

## 正式成品与来源哈希

正式HTML为 **90,384,172字节，约86.20MiB**，保留1,639张卡图、11张卡框、卡背、10首本地配乐、内嵌gzip逻辑，低于100MiB限制，无外部逻辑依赖。

| 文件 | SHA-256 |
| --- | --- |
| 根目录index.html及独立副本 | `36fb01d62952450bb2696f28df632bf9a671c6ef374bcbc310452b4f6933aae9` |
| 546条供应方原件 | `3573b34eaa63e81ab2a72bc9db52058d30f73e7e6fcb3747cde289748f4cfaae` |
| 544身份年度快照 | `ec6a719cb45423cc5cb1f605d501906bf0ba4b9e2ac29540fdf6226e37df8eb9` |

五份2025来源网页、四张选手原表图片均与正式来源清单SHA-256一致，四份牌表逐区与原图核对。正式选手原表和游戏改编分开，见[2025构筑](decks-2025.md)及[逐年核对](decks-annual-audit.md)。原件546条保留，排除20250830再版密码和101303071临时重复项的依据写入scope／manifest，不伪造CDB alias。

固定三语数据库仍为 `mycard/ygopro-database@ac5d8fb80465e74b33f3b4a294e3b22c02d743f2`，三个CDB哈希核对成功，544新身份无缺失，故没有更新来源。首次OCG日期仍为供应方候选；1999—2002与部分早期替代路线只具发行卡池证据，不能将其称为统计热门或世界赛原表。

本次第一遍覆盖表重建遇到Windows暂时文件锁（UNKNOWN/open），原文件保留完整；生成器改用已有 `writeAtomic` 重试机制后，完整流水线通过。压缩图优化重复执行无变化，正式WebP及编码配置支持离线重建。相同媒体HTML的逐字节重建使用现有本机音频缓存；无音频缓存克隆按既有构建器使用流媒体地址，不能声称自带源音频。单HTML运行需要支持DecompressionStream的现代浏览器。

`output/rollout-2025/closeout/accepted-audit.json`实际断言全量结果、历史案例连续性、已有2025报告、十一年度页面哈希、素材来源和独立重建；`rebuild-data.json`与`rebuild-html.json`记录逐文件哈希。研究、旧失败与本轮现场均保留在被忽略的output下，正式测试与来源输入提交。

## 复现

```powershell
$env:Path = 'C:\nvm\v22.17.0;' + $env:Path
npm.cmd ci --no-audit --no-fund
npm.cmd run cards:snapshot -- 2025
npm.cmd run cards:import
npm.cmd run locales:sync
npm.cmd run cards:catalog
npm.cmd run decks:chronicle
npm.cmd run decks:report
foreach ($year in @(2018,2020,2021,2022,2024,2025)) {
  node scripts/report-card-coverage.mjs --write-year $year
}
npm.cmd run test:2025
npm.cmd run test:annual-decks
$env:DUEL_TEST_CONCURRENCY = '4'
npm.cmd test
Remove-Item Env:DUEL_TEST_CONCURRENCY
$env:DUEL_RUN_DIR = 'output/rollout-2025/reproduction'
npm.cmd run test:annual-decks:simulation
npm.cmd run test:2025:simulation
npm.cmd run test:2025:tournament
Remove-Item Env:DUEL_RUN_DIR
npm.cmd run art:optimize
npm.cmd run build
foreach ($year in @(2025,2024,2023,2022,2021,2020,2019,2018,2017,2016,2015)) {
  $env:DUEL_BROWSER_OUTPUT = "output/rollout-2025/reproduction/browser-$year"
  node "tests/chronicle-$year-browser.cjs"
}
$env:DUEL_TEST_HTML = (Resolve-Path index.html).Path
$env:DUEL_BROWSER_OUTPUT = 'output/rollout-2025/reproduction/browser-rule-modes'
node tests/rule-modes-browser.cjs
$env:DUEL_BROWSER_OUTPUT = 'output/rollout-2025/reproduction/browser-ai-import'
node tests/ai-import-browser.cjs
Remove-Item Env:DUEL_TEST_HTML
Remove-Item Env:DUEL_BROWSER_OUTPUT
node scripts/build.mjs --out output/rollout-2025/reproduction/rebuild/index.html
```

两种整局脚本可分别设置 `DUEL_SHARD=0..3` 运行；不能把一个分片当作完整130或66场。复现命令包含可重新运行的2025矩阵与赛事；本次实际执行与10月17日已有结果的界限以上表为准。pending和明确规则适配仍保留，未把效果登记或本轮回归称为全部官方裁定认证。
