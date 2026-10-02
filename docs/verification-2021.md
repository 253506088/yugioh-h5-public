# 2021 批次验证

日期：2026-10-02。基线为已推送的2020提交 `0da5e9a`。2021本批32／640身份可用（27新效果、3基础规则、2复用），另补24张旧年依赖，净增54个可对战身份；608张本年卡继续pending。

## 验收结果

| 检查 | 结果 |
| --- | --- |
| 最终源码全量 | **12,187通过，0失败、0跳过**，85个测试文件 |
| 2021规则与交互 | **57项通过**，纳入全量，最终专项亦单独通过 |
| 2021运行时扫描 | **640项通过**，纳入全量，核验报告确实包含640个年度身份 |
| 年度整局 | **38场完成、完整重放一致**：12场经典、全部26条天命 |
| 2009—2021编年quick | **49场完成、0异常**，49个编年预设各一场 |
| 64人赛事 | **63场完成、63场完整重放一致、0保护判定** |
| 正式HTML年度浏览器 | **61组通过**：2021十二组、2020十二组、2019十三组、2018十二组、2017十二组 |
| 天命界面 | **5组通过**，使用同一正式HTML |
| AI导入界面 | **9组通过**，含离线样例、三语、模拟模型／图片、取消、草稿与本地代理 |
| 旧牌天命 | **26场完成**，mirror=0，覆盖全部26条法则 |
| 三语／身份／系列 | 11,447目录身份均有三语名称与说明、百科链接；固定CDB系列码审计通过 |
| 卡图 | 新增63张，共729张压缩WebP；729个manifest文件哈希逐一核验 |
| 独立重建 | 正式HTML与另一输出路径重建的SHA-256一致 |

正式HTML为103,083,840字节，约98.31MiB，内嵌729张卡图、11张卡框与10首音乐。SHA-256：

`7fb718fa06408cc8393754be0bc997a0ca80607eb6b62a61600457945eee51f5`

`output/rollout-2021/accepted-audit.json` 汇总并独立核验上述结果：年度案例连续性、所有规则、49个quick预设、63场赛事重放、五年度浏览器成品哈希、正式来源和全部729个卡图文件。汇总与原日志留在忽略目录，正式测试源码提交。

## 覆盖与实际修复

专项验证真实展示、丢弃、除外、送墓、额外素材与次数限制：莫邪／泰阿生成独立调整衍生物，赤霄共用次数，龙渊送墓伤害，承影替代与除外，天威在新衍生物上的识别，铁兽人马—姬特—纳贝尔路线、块击熊检索和抗战的正规连接召唤。

随风旅鸟覆盖小鸟离场除外与被无效时的差异、帝企的表示与召唤方式限制、地图额外通常召唤、对方回合梦之町、雪猫头鹰三次通常召唤、恐怖之海的召唤无效／正确玩家限制，以及未知之风在次元吸引者下的官方FAQ行为。素材选择、金满翻牌和排序、鲜花使用标记均验证JSON恢复。

收尾修复真知蟠龙复活后引用不存在的 `early-destroy` 操作，改为已登记命名续接；回归分别验证选择破坏、跳过与选择中途恢复。金满抽卡封锁扩展到增殖的G在连锁外的实际效果抽卡，并在发动前阻止已登记的必需抽卡效果。天命的苦肉、狂欢、真空、轮盘、悬赏和遗产奖励改用明确的 `ruleDraw`，不误算为卡片效果抽卡。

年度扩展后，莫邪已可对战。旧年度浏览器和AI导入示例中的“未收录”反例统一改为已核实的Spright Blue；没有放宽未收录或pending校验。最初发现的旧数量断言、缺失翻译、续接异常和过期示例均保留诊断日志；最终结果只采用修正后代码与正式成品的验证。

## 方法与准确边界

年度整局让三套构筑分别与2016青眼、十二兽交换先后手，再逐条测试26条天命。每场第24步恢复JSON存档；终局从初始存档逐动作重放并比较完整快照。四分片案例0—37必须连续、无重复、无错误，种子为 `202110020 + case`，不放宽3000行动上限。

赛事固定种子 `20211001`，64人使用三套2021牌组及三套2016对照牌组，standard难度和生产胜负／行动上限。测试Worker只并行独立场次，通过生产 `Tournament.stepMatch` 推进；全部63场逐动作重放并比较完整终局，整场赛事存档也恢复成功。编年quick是每个预设对基础青眼一场，不冒充全配对矩阵。

五个年度浏览器均直接打开同一正式HTML、阻断外部HTTP，并通过真实控件验证卡片发动、代价、选择保留、语言与手机布局。61组年度报告保存相同成品哈希。AI导入使用模拟模型响应和本地HTTP代理，不能描述为实际调用外部付费模型，也不宣称这9组测试零HTTP请求。

正式供应方响应哈希、季度来源网页哈希、官方FAQ哈希与729张卡图哈希均已核对。数据导入、语言与名录生成可使用已提交来源离线执行。独立重建使用本机已有媒体输入；原始音频按既有.gitignore留本机，干净克隆若没有本地音频会按构建器设计采用流媒体地址，不把本次哈希一致声称为无媒体缓存的逐字节构建。

源码全量及运行时扫描通过不等于全部官方裁定认证；自动破坏替代等明确适配见 [构筑说明](decks-2021.md)。未实现身份保持pending。正式代码、来源、压缩图、文档与HTML提交；日志、截图、研究网页、赛事与整局录像、失败现场和构建副本在被忽略的 `output/rollout-2021/`。

## 复现

使用Node22或以上。本机已有运行时，无需额外安装：

```powershell
$env:Path = 'C:\nvm\v22.17.0;' + $env:Path
npm.cmd run cards:import
npm.cmd run locales:sync
npm.cmd run cards:catalog
npm.cmd run decks:chronicle
npm.cmd test
npm.cmd run test:2021
$env:DUEL_YEAR = '2021'
node --test tests/chronicle-sweep.test.cjs
Remove-Item Env:DUEL_YEAR
npm.cmd run test:2021:simulation
npm.cmd run test:2021:tournament
node tests/chronicle-simulation.cjs --quick
$env:DUEL_MIRROR = '0'
node tests/rule-modes-simulation.cjs
Remove-Item Env:DUEL_MIRROR
npm.cmd run build
npm.cmd run test:2021:browser
npm.cmd run test:2020:browser
npm.cmd run test:2019:browser
npm.cmd run test:2018:browser
npm.cmd run test:2017:browser
$env:DUEL_TEST_HTML = (Resolve-Path index.html).Path
node tests/rule-modes-browser.cjs
Remove-Item Env:DUEL_TEST_HTML
node tests/ai-import-browser.cjs
node scripts/build.mjs --out output/rollout-2021/rebuild/index.html
```

年度整局可设 `DUEL_SHARD=0..3`；编年quick可设 `DUEL_SHARDS=4` 与 `DUEL_SHARD=0..3`。实际提交号及远端同步以Git记录为准。
