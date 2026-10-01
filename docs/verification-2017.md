# 2017 年度验证记录

## 2026-10-02 第二批

以 `639135fa231469e9d4105300b17e89574f62db3a` 为干净基线继续开发，新增25张真实效果，当前 **98可用／538 pending**。未重复提交上一批13项优化，也未将首批73张算作本次新增。五套年度构筑来源复核见[牌组说明](decks-2017.md)。

| 本次实际执行 | 结果 |
| --- | --- |
| 全量 `scripts/run-checks.mjs` | 9,177项通过，0失败、0跳过；约240秒，含新33项、系列、三语、PVP及BO3 |
| 新卡结果测试 `chronicle-2017-expansion.test.cjs` | 33项通过：真实区域移动、素材／祭品、箭头、次数、伤害来源、跨年成员、灰流丽、JSON恢复 |
| `DUEL_YEAR=2017` 逐卡扫描 | 636项通过；未实现卡仍保持538项pending |
| 正式 HTML `chronicle-2017-browser.cjs` | 12组通过、0页面异常；HTTP全部拦截，含三语导入、新卡实际召唤／选择、五套完整构筑和手机布局 |
| 新卡测试构筑整局 | 4场完成，经典／灵魂解放／厌恶真空／魔导回响；每场完整重放与最终快照一致 |
| 年度五套构筑整局 | 46场完成：20场经典配对与全部26条天命法则；均完成JSON恢复及完整重放，0错误 |
| 来源复核 | 4个正式来源页面HTTP 200；既有4张牌表图链接仍在对应文章中 |

补充部队末次复审修正为只响应对方攻击造成的战斗伤害，并添加自己主动攻击较强怪兽的反例；修正后重新通过全量9,177项、12组正式浏览器和独立构建哈希核验。年度五套构筑均不含此卡，46场年度验证覆盖其现有路径。

新增测试构筑不是历史代表牌表。它实际触发电子界展开、点阵图跳离士、钝重、局部性飓风等新处理器；独立单卡测试覆盖随机整局未触发的其余分支。整局通过不等于所有卡间组合均已审计。

正式构建：8,756张目录卡、57套预设、348张内嵌图，约73,342.6 KB。SHA-256：

`4ebd5edf9454f68ff0b9e17707c2afb144aff65c5f31ad3e9aec568f71e099c5`

证据保存在忽略的 `output/2017-expansion-{full,sweep,build,browser,simulation,annual-simulation}.log`、`output/v4-checks-report.json`、`output/rollout-2017/browser/report.json`、`output/rollout-2017/expansion-integration/report.json`。正式源码、测试和发布HTML进入Git；网页、截图、日志与失败诊断仅留本机，`.gitignore`注明。

重现使用 Node 22.13+；本机执行 `C:/nvm/v24.13.0/node.exe`。新入口 `npm run test:2017:expansion-simulation`，其余沿用 `npm test`、`npm run test:2017`、`npm run test:2017:browser`、`npm run test:2017:simulation`、`npm run cards:coverage:2017`、`npm run build`。

边界：538张年度卡仍待实现；不宣称年度官方全集核验或完整裁定认证。三语与身份继续来自已固定并提交的离线来源，没有新建来源别名。新卡没有新增本地图片。既有复制器仍沿用只复制已登记主动／快速效果的明确适配。

---

日期：2026-10-01。此次续接保留已实现的年度批次，补齐验收文档、复核正式构建与当前回归，并完成 Git 交付。实际范围为 **73 个 2017 可用身份、563 个 pending**，另补齐构筑依赖的 6 个 2016 身份；不代表全年卡片效果全部完成。

## 交付与来源

- 年度 636 个身份的原始 JSON、日期候选快照、三语资料与系列码均纳入正式数据，原件 SHA-256 由专项测试核对。
- 五套预设：真龙皇龙星恐龙、真龙、十二兽、淘气仙星、SPYRAL。前四套主卡 40 张，SPYRAL 42 张，各有额外 15 张、副卡 15 张，全部通过当前构筑校验。
- 四套有赛事原表，一套为明确标注的淘气仙星代表改编；来源、冠军同质化处理及历史规则边界见 [牌组说明](decks-2017.md)。
- 总目录 8,756、可对战 7,711、预设 57。待实现身份保持不可用于有效对战构筑的状态。

## 验证证据

本批先前完成并保留的记录，续接时已经重新读取、核对：

| 检查 | 结果 |
| --- | --- |
| 2017 专项与连接素材 | 93 项通过，0 失败、0 跳过 |
| 2017 年逐卡运行时扫描 | 636 项通过；扫描通过不改变 pending 状态 |
| 编年对局四分片 | 310 场完成，分片分别为 78／78／77／77，0 异常 |
| 编年附带赛事 | 64 人、63 场完成，0 保护判定，决赛重放一致 |
| 2017 整局集成四分片 | 45 场完成，编号无重复；20 场经典规则和全部 25 条天命法则，均通过完整重放与 JSON 恢复 |
| 2017 独立赛事最终复测 | 64 人、63 场完成，包含全部五套新牌组及三套 2016 牌组，0 保护判定，决赛重放一致 |

先前的 v4、v4.1、2016、PVP、天命法则及界面浏览器检查也保留通过记录。其中部分浏览器报告绑定的是较早构建哈希，不冒充为最终 HTML 的重新执行结果。

续接实际重新执行：

- 全量 `scripts/run-checks.mjs`：**9,137 项通过、0 失败、0 跳过**，耗时约 243 秒，包含旧年度、2017 专项、系列守卫、AI 导入、PVP 与 BO3 回归。
- `tests/chronicle-2017-browser.cjs`：正式 `index.html` 的 **9 组全部通过、0 页面异常**。所有 HTTP 请求被阻止；覆盖年度／累计图鉴三语计数、五套完整构筑、内嵌王牌图、三语名称导入及 pending 区分、手机连接卡详情、真龙魔陷祭品的实际按钮操作、SPYRAL 检索和三语手机布局。
- `scripts/build.mjs --out output/rollout-2017/rebuilt/index.html`：重新构建成功，输出与根目录正式 HTML 的 SHA-256 完全一致；73,304.2 KB、348 张本地内嵌卡图。
- `git diff --cached --check`：通过。正式来源、源码、测试、文档及压缩卡图纳入提交，原图、研究网页、截图、日志和临时构建由 `.gitignore` 排除。

正式 HTML SHA-256：`df3e0f8827151c9d441c0d6db4127834fba697c0886f2421dd4736d51e7890f1`。

本机默认 Node 14 不满足项目要求，续接使用已安装的 `C:/nvm/v24.13.0/node.exe`。无需修改全局 Node 配置；常规环境应使用 `package.json` 声明的 Node 22.13 或以上版本。

## 重现与归档

```sh
npm test
npm run test:2017
npm run test:2017:browser
npm run test:2017:simulation
npm run test:2017:tournament
npm run cards:coverage:2017
npm run build
```

逐卡扫描：设置 `DUEL_YEAR=2017` 后运行 `node --test tests/chronicle-sweep.test.cjs`。编年对局运行 `node tests/chronicle-simulation.cjs`；分片方式见该脚本。断点报告不得用旧根目录汇总替代当次分片结果。

本机证据保存在忽略目录 `output/rollout-2017/`：`resume-full-checks.log`、`resume-browser.log`、`resume-build.log`、`browser/report.json`、`integration-{0,1,2,3}/report.json`、`tournament/report.json`。编年证据为 `output/chronicle-simulation/shard-{0,1,2,3}/report.json`。正式回归脚本全部提交，便于在其他机器重新执行。
