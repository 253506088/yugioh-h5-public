# 2017 首批验证记录

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
