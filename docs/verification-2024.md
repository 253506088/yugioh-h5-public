# 2024 批次验证

日期：2026-10-06。基线 `10dcaf94c6f13183adba93db79a2e0d706af82fa`。本批分阶段完成实现、修复和验收；本次续接核对既有最终源码的全量／扫描／整局／赛事记录，重跑76项年度专项、全部年度页面、天命及AI导入界面，完成离线重建和提交审计。未将早期失败记录算作通过结果。

全库为 **12,982目录、8,130可对战、86预设**。2024为 **22可用（17效果、5基础规则、0复用）／438 pending**，加14张旧年依赖，本批净增36个可对战身份；不宣称全年460张效果完成。

## 验收结果

| 检查 | 结果 |
| --- | --- |
| 规则源码全量 | 13,975通过，0失败、0跳过；93个文件 |
| 2024规则／交互／素材专项 | 76项通过，已纳入全量 |
| 2024运行时身份扫描 | 460项通过，实际扫描本年全部身份 |
| 年度整局 | 44场完成、44场完整重放一致：18经典＋26天命 |
| 2009—2024编年quick | 60场完成、0异常，每个编年预设一场 |
| 64人AI赛事 | 63场完成、63场完整重放一致、0保护判定 |
| 旧牌天命 | 26场，mirror=0，覆盖全部26条法则 |
| 正式HTML年度浏览器 | 98组：2024／2023各12、2022为13、2021／2020各12、2019为13、2018／2017各12 |
| 天命界面／AI导入界面 | 5组／9组通过，使用同一正式HTML |
| 三语与系列 | 460身份三语精确解析，固定CDB系列审计通过 |
| 全库AI名录 | 14,981条，与2023基线相同，不按新年度重复插行 |
| 图片追溯 | 867张压缩文件哈希通过；新增46张原图哈希齐全，旧来源哈希保留 |
| 离线数据重建 | 卡池、三语、系列、名录、预设及三份覆盖表哈希不变 |
| 独立HTML重建 | SHA-256与正式index.html一致 |

正式HTML **83,338,974字节，约79.48MiB**，包含867张卡图、11张卡框和10首本地音乐，低于100MiB构建限制。SHA-256：

`2121e4c4a09766c2b366793a97a38cb02c8fa87234e9faca35ef92dd72e75154`

供应方461条原件SHA-256：

`d58330490e721d8acf884d6357547f0a853cdcb266000fad5ab2c9c255f5a476`

460身份年度快照SHA-256：

`e9f22dfc10a7cfc56ca6449b6bd943da609d9772a68554f1f7dc628e3197850c`

`output/rollout-2024/accepted-audit.json`汇总并实际断言以上数量、案例连续性、规则覆盖、八年度页面哈希、媒体来源和独立重建；`rebuild-report.json`记录逐文件哈希。这些验收现场由.gitignore排除，正式测试、来源输入和本说明提交。

## 规则及界面回归

覆盖魔锻真实弃牌／洗回／解放代价、墓地融合结算时素材消失、装备被破坏后的目标保护、非取对象无效与天命免疫；幻影使用两张真实卡回卡组的召唤手续、禁止融合素材、原连锁改写及被无效的分支；蛇眼真实送墓、后场怪兽身份、灵摆中间后场、墓地复活；天杯战斗阶段同调、伤害步骤、三次真实攻击、每决斗一次和龙族召唤限制。

咎姬的两个目标需要保留generation，离场又入场的自己炎属性怪兽不能被旧连锁破坏。凤凰必须先在墓地，不能将自己在场上被破坏也当成墓地诱发。场地灿幻的保护限定为表侧怪兽区，修复了手牌／墓地／里侧对象错误受保护的问题。这些情形均有实际去向、数值和存档恢复断言。

浏览器最初在幻影召唤定位超时：界面的 `data-command` 是数字索引，测试却按效果ID查询。修正为按引擎生成的可见动作名称定位，随后通过真实的两素材选择、召唤和JSON恢复。另逐套点击年度牌组验证选中状态，并在390px三语布局检查每个构筑按钮边界。

正式页面阻断外部HTTP后测试加载、年度／累计筛选、三语、卡图、主额外副卡完整性、导入边界，以及刻魔师弃牌、莲解放、蛇眼永续放置、白板检索、幻影召唤。独立 `isMobile:true`、`hasTouch:true` 环境以触屏操作完成真实弃牌与检索。截图已视觉检查；环境为Edge／Chromium模拟手机，未声称测试实体手机或其他内核。AI导入采用模拟模型响应和本地代理，未调用付费模型。

## 方法与边界

年度案例0—43连续，种子 `202410020 + case`。三套2024牌各对2016青眼、十二兽交换先后手共12场，三套互相有方向交叉6场，再逐条验证26天命。每场第24步恢复存档；终局从初始快照逐动作完整重放并比较整个快照，没有放宽3000行动上限。

赛事种子 `20241001`，64名参赛者来自三套2024牌及三套2016对照牌，使用生产赛事实现。63场完整重放一致，整项赛事存档可恢复，未使用行动上限保护结果。60场quick不是全历史预设完整配对矩阵。

供应方原件保留461条，排除缺少固定CDB身份的临时重复记录101206080，正式保留77751766；排除依据见年度manifest。首次OCG日期仍待全部官方产品交叉核验。三套是有同期来源的年度代表改编，世界赛两位四强并列，第三路线天杯标为八强与年度热门，不冒充季军、选手原表或某季度禁限表。详见 [构筑说明](decks-2024.md) 和 [逐卡覆盖](coverage-2024.md)。

全部生成卡片数据可从正式输入离线复现。本次相同媒体成品重建使用本机媒体；没有音频缓存的克隆会依构建器设计采用流媒体地址。发布脚本仍需支持DecompressionStream的现代浏览器。pending继续受构筑验证限制；效果登记与本次回归通过不代表所有官方裁定组合认证。

## 复现

使用Node 22.17.0，以下仅修改命令进程PATH。整局可直接执行或分别设置 `DUEL_SHARD=0..3`，不得把单个分片当作44场全部完成。

```powershell
$env:Path = 'C:\nvm\v22.17.0;' + $env:Path
npm.cmd ci --no-audit --no-fund
npm.cmd run cards:import
npm.cmd run locales:sync
npm.cmd run cards:catalog
npm.cmd run decks:chronicle
npm.cmd run cards:coverage:2024
npm.cmd run cards:coverage:2023
npm.cmd run cards:coverage:2019
npm.cmd run test:2024
$env:DUEL_TEST_CONCURRENCY = '4'
npm.cmd test
Remove-Item Env:DUEL_TEST_CONCURRENCY
$env:DUEL_YEAR = '2024'
node --test tests/chronicle-sweep.test.cjs
Remove-Item Env:DUEL_YEAR
npm.cmd run test:2024:simulation
npm.cmd run test:2024:tournament
node tests/chronicle-simulation.cjs --quick
$env:DUEL_MIRROR = '0'
node tests/rule-modes-simulation.cjs
Remove-Item Env:DUEL_MIRROR
npm.cmd run build
foreach ($year in @(2024,2023,2022,2021,2020,2019,2018,2017)) {
  node "tests/chronicle-$year-browser.cjs"
}
$env:DUEL_TEST_HTML = (Resolve-Path index.html).Path
node tests/rule-modes-browser.cjs
Remove-Item Env:DUEL_TEST_HTML
node tests/ai-import-browser.cjs
node scripts/build.mjs --out output/rollout-2024/rebuild/index.html
```

正式文件与.gitignore按用户授权提交推送。研究、原图、日志、截图、重放、失败现场和提交草稿保留本机；实际提交号与远端状态以Git记录为准。
