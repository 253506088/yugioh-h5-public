# 游戏王 · 决斗之境 V4.1

> 最新年度批次：收录至 2012 年的 OCG 日期候选快照，共 **5,754 张可组卡卡片、38 套预设**。2009／2010／2011／2012 各新增三套年度代表构筑，见 [交接](交接/2009—2012批次交接.md)、[牌组与来源](docs/decks-2009-2012.md) 和 [验证记录](docs/verification-2009-2012.md)。


**5,754 张卡片 · 38 套预设 · 中文 / English / 日本語 · 全召唤方式 · 单 HTML**

**新增[单局 PVP 联机服务](docs/pvp.md)**：公开／私密房间、好友邀请、快速匹配、双方准备和单局结算。服务器运行现有规则引擎，按玩家隐藏手牌与构筑，支持独立思考计时、断线重连和 SQLite 重启恢复。运行 `npm run start:pvp`，打开 `http://127.0.0.1:4173/#pvp` 即可；附带 Docker Compose 与 HTTPS 部署配置。

项目保留1999—2012十四年本地快照，共5,664个供应方身份。本轮新增2,059个身份，复用34个原有身份，推进同调后期与超量初期：黑羽、蛙炮、神光、代行、废二、六武、甲虫装机、发条、水精鳞海皇等可以直接选择出战。图鉴和工坊支持单年／累计年份；新决斗增加年度预设筛选，每年三套。

总卡池还保留项目原有的90张快照范围外卡片，包含后续时代的既有支援。因此「截至2012」累计图鉴为5,664张，全部可组卡卡池为5,754张。

右上角或设置中可切换中文、英文、日文。全部卡名、卡片说明与灵摆文本保存在 HTML 中；切换时保留当前对局、素材选择和组卡草稿。卡片详情可打开对应的 YGOPRODeck 百科页面。

**新增[死斗竞技场](docs/tournament.md)**：默认 16 名机器人争夺冠军，也可配置 2–64 人。随机或指定本地及自定义卡组，支持重复编号、串行／并行对战、实时晋级图、整场录像和赛事存档。从首页点击「死斗竞技场」即可开始。

图片是可选资源：正式HTML内嵌264张压缩卡图、11张卡框、卡背与十首配乐。缺图时使用文字卡面，也可在设置中开启「在线原版卡图」。已有的用户选择优先；未保存过设置且内嵌图片不完整时，默认允许在线补图。关闭在线卡图或断网都能继续决斗。日志、截图、下载原件和构建历史留在本机，提交排除规则见 `.gitignore`。

## 从这里开始

- [PVP 使用与部署](docs/pvp.md)：房间、匹配、BO1 规则、重连、存储、局域网／公网部署和协议。
- [决斗体验升级说明](docs/experience-upgrade.md)：主界面、一屏战斗、字号和分页设置、原声 BGM、卡背卡框、连锁演出及响应模式。
- [死斗竞技场](docs/tournament.md)：2–64 名机器人淘汰赛、随机／指定本地及自定义卡组、重复编号、并行观战、晋级图和整场录像。
- [年度代表构筑](docs/decks-2009-2012.md)：十二套牌的核心玩法、赛事参考、替换理由和现代卡文区别。
- [完整操作手册](操作手册.md)：安装、构建、增量卡图、年度切片、测试与排错。
- [开发交接文档](HANDOFF.md)：最新入口及历次交接索引。
- [年度推进方案](游戏王卡片按年切片推进方案.md)：从下一年继续推进的验收规则。

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd start
```

访问 `http://127.0.0.1:4173/`，或者直接双击根目录 `index.html`。

`npm start` 同时提供网页和 PVP 后端。双击 HTML 或 GitHub Pages 继续支持离线游玩；联机需要打开实际服务器地址。原静态开发服务保留为 `npm run start:static`。

macOS / Linux 使用 `npm`。要求 Node.js 22.13 或以上，建议 24 LTS；游玩成品不需要安装开发依赖。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run start:pvp` | 启动网页、WebSocket PVP 服务及 SQLite 存储；与 `npm start` 相同 |
| `npm run start:static` | 仅启动原有本地静态开发服务器 |
| `npm run test:pvp` | PVP 规则、隐私、计时、重连、存储及真实 WebSocket 检查 |
| `npm run test:pvp:browser` | 两个独立浏览器实际联机、连锁、素材选择和恢复验证 |
| `npm run build` | 生成根目录单 HTML，自动内嵌已有本地卡图 |
| `npm run build:no-art` | 生成 `output/no-art/index.html`，完全不处理图片 |
| `npm run cards:import` | 从保留的十四年 JSON 离线重新生成游戏数据 |
| `npm run decks:chronicle` | 从来源明确的 JSON 重新生成十二套年度牌组及三语名称 |
| `npm run cards:coverage` | 导出逐卡实现和输入覆盖报告 |
| `npm run locales:sync` | 从保留的文本数据库离线生成当前卡池的三语资料 |
| `npm run locales:update` | 手动联网更新三语文本数据库；不下载卡图 |
| `npm test` | 规则、回归、三语完整性和采集日志测试 |
| `npm run test:v4-simulation` | 预设 / 年度混合牌组模拟 |
| `npm run test:browser` | 离线规则、组卡、三语切换、移动布局及模拟在线卡图验证 |
| `npm run test:chronicle` | 2009—2012 逐卡扫描、真实组合与素材条件检查 |
| `npm run test:chronicle:simulation` | 十二套新牌120场对战、64人赛事与决赛回放 |
| `npm run test:chronicle:browser` | 四年图鉴、年度选牌、超量／手牌同调素材和移动界面 |
| `npm run art:plan` | 不联网检查当前卡池缺图情况 |
| `npm run audio:collect` | 获取十首指定动画配乐，核验并复用本地文件 |
| `npm run art:experience` | 获取预设和连锁示例使用的小型卡图 |
| `node scripts/collect-experience-art.mjs --aces` | 只增量补齐预设王牌，合并保留已有图片清单 |
| `npm run test:experience` | 字号、分页、小屏布局、连锁演出和配乐的专项验证 |
| `npm run test:tournament` | 淘汰赛、保存恢复、完整录像与桌面／手机观战验证 |
| `npm run art:collect -- --years 2001` | 手动增量采集 2001 年缺图，实时显示进度 |

原始图片与完整卡面保存在 `assets/official-archive/`；每次构建另存到 `output/v4-builds/`。图片采集之后重新构建即可，无需等待所有图片齐全。

## 范围说明

最新四年来源数量为520／573／518／482，依据供应方首次OCG日期候选；官方全部产品、附卡、赠卡的年度交叉核验仍待完成。效果采用本作独立实现和当前来源文本，并非全部官方裁定或历史勘误版本的穷尽模拟。年度牌组是参考历史战术的改编，年份筛选不会切换旧卡文或禁限表。具体适配边界列在交接及卡片实现说明中。

文字来源为保留的 YGOPRODeck 资料和 [mycard/ygopro-database](https://github.com/mycard/ygopro-database) 三语快照；语言资料与规则实现相互独立，不在运行时翻译或解析卡片效果。

旧版 README、两代图片层和历史报告保留用于追溯；当前操作以 V4.1 手册及决斗体验升级说明为准。
