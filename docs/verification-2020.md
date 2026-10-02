# 2020 批次验证

日期：2026-10-02。基于2019已推送提交 `c0788d7`。本年59／663身份可用（53新增效果、4基础规则、2复用），另补齐7张旧年依赖，净增64个可对战身份。604个本年身份继续pending。

## 验收结果

| 检查 | 结果 |
| --- | --- |
| 全量源码回归 | **11,475通过，0失败、0跳过**，83个测试文件 |
| 2020规则与交互专项 | **58项通过**，纳入全量，最终专项另行复跑 |
| 2020运行时扫描 | **663项通过**，独立扫描且纳入全量 |
| 年度整局 | **46场完成、完整重放一致**：20场经典＋全部26条天命 |
| 2009—2020编年quick | **46场完成，0异常**，覆盖46个编年预设 |
| 64人赛事 | **63场完成，63场完整重放一致，0保护判定** |
| 旧牌天命 | **26场完成**，mirror=0，覆盖所有法则 |
| 正式HTML年度离线浏览器 | **49组通过**：2020十二组、2019十三组、2018十二组、2017十二组 |
| 天命界面 | **5组通过**，使用同一正式HTML |
| AI导入界面 | **9组通过**，含模拟模型、图片、三语、取消、草稿及本地代理流程 |
| 三语与系列 | 10,809目录身份三语、百科与固定CDB系列码完整；系列全库审计通过 |
| 卡图 | 新增103张压缩WebP，共666张；59个可用年度身份全部有图 |
| 独立重建 | 正式HTML与另一输出路径重建的SHA-256一致 |

正式HTML：98,389,020字节，约93.83MiB。SHA-256：

`befb6d022e9fa25483172664a4ae8ad6ba5f482d5900ee673f500b9d2bef2e92`

`output/rollout-2020/accepted-audit.json` 已独立核对：年度案例0—45连续且无重复、种子 `202010020 + case`、全部26条法则、46个编年quick预设、63场赛事重放、四个年度浏览器的成品哈希、666张卡图逐文件哈希及正式来源哈希。日志、研究缓存、截图和重放在忽略目录，正式测试源码提交。

## 规则与修复

专项通过实际发动、代价、区域移动、连锁和恢复验证黄金卿送墓与强化、黄金药／黄金乡共用次数、教导的额外封锁、天底与惩罚送墓、阿不思素材边界、七贤巨鲲魔检索丢弃、伪典融合除外及禁止直击。

魔救覆盖翻牌的真实卡片、逐张卡组顶／底排序、JSON恢复、积木龙合计8星搜索与岩石族保护、怒气土器的原本属性／等级与里侧特召。电脑堺覆盖第二／第三卡种、对象离场中断、豸豸延迟回收、玄武复活无效、娘娘调整及离场除外、仙仙的区域替换、同种同属性素材及龙龙取对象抗性。

天霆号覆盖实际战斗门槛、素材整叠继承、两素材全场送墓；一滴覆盖真实送墓与按原本卡种禁止直接响应；访问码验证只保留一次加攻实现；继承玻纤验证物理卡片发动锁及视为同调召唤。

年度模拟暴露的两项旧问题已修复并追加真实结果回归：Ω结算时对方手牌已空，不再读取不存在的随机卡；狂装霸王计数移至实际代价提交阶段，第二次合法发动不再被提前拦截。豸豸的结束阶段延迟键也通过恢复用例验证。

素材组合现在同时验证 `pending.sets` 和 `pending.group.sets`。手动输入不能绕过积木龙或电脑堺组合要求。年度导入发现真红眼暗钢龙别画与旧身份重名，通过固定CDB alias核实排除，新增重名守卫防止以后覆盖旧年数据。

旧数量断言按实际新增身份更新，未收录反例和AI导入示例改用已核实的2021相剑师-莫邪。浏览器中娘娘除外后将瑞瑞洗回牌组属于真实诱发处理，测试同时核对了两张代价卡的最终去向，未删去结果断言。

## 方法与边界

年度整局与2016青眼、十二兽交换先后手，第24步JSON恢复；每场终局从初始存档逐动作重放，比较完整快照。四个分片保留原始案例、种子、规则和行动上限。

赛事固定种子 `20201001`、64人、standard难度及生产上限。Worker仅并行独立场次，实际调用 `Tournament.stepMatch`，按轮次屏障推进；全部63场逐场完整重放，赛事整体存档也恢复成功。未放宽胜负、超时或重放断言。

年度浏览器直接打开正式HTML并阻断外部HTTP。通过真实控件完成关键卡操作，验证手机布局、三语和选择保留。AI导入浏览器使用模拟模型响应及本地HTTP代理夹具，其结果不宣称实际调用了外部付费模型，也不宣称这组测试零HTTP请求。

编年使用quick模式，每个年度预设对基础青眼一场，不能把46场说成全配对矩阵。效果登记和扫描通过不是官方裁定认证；全年604个pending仍不可进入有效构筑。牌表来源及统一构筑规则边界见 [牌组说明](decks-2020.md)。

## 重现

使用已有Node22，无需安装新运行时：

```powershell
$env:Path = 'C:\nvm\v22.17.0;' + $env:Path
npm.cmd run cards:import
npm.cmd run locales:sync
npm.cmd run cards:catalog
npm.cmd run decks:chronicle
npm.cmd test
npm.cmd run test:2020
$env:DUEL_YEAR = '2020'
node --test tests/chronicle-sweep.test.cjs
Remove-Item Env:DUEL_YEAR
npm.cmd run test:2020:simulation
npm.cmd run test:2020:tournament
node tests/chronicle-simulation.cjs --quick
$env:DUEL_MIRROR = '0'
node tests/rule-modes-simulation.cjs
Remove-Item Env:DUEL_MIRROR
npm.cmd run build
npm.cmd run test:2020:browser
npm.cmd run test:2019:browser
npm.cmd run test:2018:browser
npm.cmd run test:2017:browser
$env:DUEL_TEST_HTML = (Resolve-Path index.html).Path
node tests/rule-modes-browser.cjs
Remove-Item Env:DUEL_TEST_HTML
node tests/ai-import-browser.cjs
node scripts/build.mjs --out output/rollout-2020/rebuild/index.html
```

年度整局可设 `DUEL_SHARD=0..3`；编年quick可设 `DUEL_SHARDS=4`、`DUEL_SHARD=0..3`。本次验收合并核对了所有分片。正式来源、卡片实现、牌表、测试、压缩图、三语和文档均可追溯，提交／推送结果以Git记录为准。
