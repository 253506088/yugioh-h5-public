# 第三方 AI 组卡接入设计

对应 2026-09-21《优化需求 1》第 4 项。本文是**设计稿，尚未实现**。目标只有一个：用户上传文本、图片或网址，由第三方模型解析其中的卡组，再由本作把每张卡对应到当前卡池，生成一副或多副可直接进入工坊的卡组。

## 1. 目标与不做的事

| 做 | 不做（本期） |
| --- | --- |
| OpenAI 兼容协议与 Anthropic Messages 协议两种适配器 | Gemini 协议（预留接口位） |
| 自定义 API URL、令牌、模型 ID、协议 | 验证模型 ID 是否真实存在（由上游返回错误） |
| 文本、图片、网址三种输入 | 让模型改牌、补牌、评价强度 |
| 逐卡给出"已实现／未收录／需确认"的清晰结论 | 让模型直接给出本作卡片 ID |
| 一次内容产出多副卡组 | 对战中调用模型 |

核心原则：**模型只负责"读"，卡片身份由本地确定。** 模型从内容里抽出"卡名 × 数量 × 分区"，本作用三语名称与卡片密码在 6,275 张卡池里做确定性匹配。模型永远不会返回本作的内部 ID，也就不存在编造一张不存在的卡的问题。

## 2. 总体流程

```
输入（文本 / 图片 / 网址）
   │
   ├─ ① 结构化优先：YDK、YDKe 链接、本作 JSON、"3 卡名" 行式清单 → 不调用模型
   │
   └─ ② 自由内容：文章、截图、网页 → 调用模型，按固定 JSON Schema 返回
           { decks:[ { name, section:{ main:[{name,count}], extra:[...], side:[...] }, notes } ] }
   │
   ▼
③ 本地解析：名称规范化 → 精确匹配 → 密码匹配 → 别名表 → 模糊匹配 → 候选列表
   │
   ▼
④ 逐卡状态：可用 / 效果待实现 / 需确认（多候选） / 未收录 / 无法识别
   │
   ▼
⑤ 构筑校验（DuelDecks.analyze：40—60 主、≤15 额外、≤3 同名、额外类型）
   │
   ▼
⑥ 结果页：卡组卡片 + 状态标签 + 候选下拉 → 「载入工坊」生成草稿 → 用户保存
```

步骤 ① 让最常见的两种来源（YDK 文件、复制的清单）完全离线、零费用、零幻觉；步骤 ② 才用到模型。对未匹配的名字可选做一次**第二轮小请求**：只把未命中的几条名字发给模型，请它给出官方英文／日文名，再回到步骤 ③ 重试。这一步仍不让模型碰 ID。

## 3. 输入通道

| 输入 | 处理 | 静态部署（双击 HTML／GitHub Pages） | `npm start` 服务器部署 |
| --- | --- | --- | --- |
| 文本 | 直接作为消息正文，上限约 60 KB，超出截断并提示 | 支持 | 支持 |
| 图片 | 浏览器端缩放到最长边 1,568 px、JPEG 质量 0.85、≤ 4 MB，base64 发送；一次最多 4 张 | 支持 | 支持 |
| 网址 | 需要有人去取网页 | 浏览器不能跨域抓取任意站点；提示用户"粘贴网页文字或截图"，或使用服务器模式 | 服务器抓取并抽取正文（去 script/style、保留表格与列表文字），再走文本流程 |

网址通道是唯一必须依赖服务器的部分，设计上明确降级，不假装静态页面也能做到。

## 4. 协议适配器

`src/ai-provider.js`，同一份代码在浏览器和 Node 服务器复用（只依赖 `fetch`）。

### 4.1 配置项

```json
{
  "protocol": "openai" | "anthropic",
  "baseUrl": "https://api.wuanai.com",
  "apiKey": "sk-…",
  "model": "gpt-6-astra",
  "openaiEndpoint": "responses" | "chat-completions",
  "transport": "browser" | "server"
}
```

- `baseUrl` 只填到主机或带路径前缀（自动去掉末尾 `/`），路径由适配器拼接：`/v1/responses`、`/v1/chat/completions`、`/v1/messages`。
- 用户明确只要两种协议；`openaiEndpoint` 是 OpenAI 协议内部的接口形态，默认 `responses`（与需求里的示例一致），部分中转只开 Chat Completions，因此保留切换。这是一个需要确认的取舍，见第 10 节。
- `transport`：`browser` 直接从页面请求；`server` 经本项目服务器代理。静态部署下只有 `browser` 可选。

### 4.2 请求形态

| | OpenAI Responses | OpenAI Chat Completions | Anthropic Messages |
| --- | --- | --- | --- |
| 鉴权头 | `Authorization: Bearer` | 同左 | `x-api-key` + `anthropic-version: 2023-06-01` |
| 文本 | `input:[{role:'user',content:[{type:'input_text',text}]}]` | `messages:[{role:'user',content:[{type:'text',text}]}]` | `messages:[{role:'user',content:[{type:'text',text}]}]` |
| 图片 | `{type:'input_image',image_url:'data:image/jpeg;base64,…'}` | `{type:'image_url',image_url:{url:'data:…'}}` | `{type:'image',source:{type:'base64',media_type,data}}` |
| 系统提示 | `instructions` | `messages[0]` 为 `system` | 顶层 `system` |
| 结构化输出 | `text.format = {type:'json_schema', name, schema, strict:true}` | `response_format = {type:'json_schema', json_schema:{name,schema,strict:true}}` | 定义一个 `tools[0].input_schema` 为同一 Schema，`tool_choice:{type:'tool',name}` 强制调用，读取 `content[].input` |
| 读取结果 | 拼接 `output[].content[].text`（或 `output_text`） | `choices[0].message.content` | `content[]` 中 `type==='tool_use'` 的 `input` |
| 浏览器直连 | 一般允许跨域 | 同左 | 需额外头 `anthropic-dangerous-direct-browser-access: true`，中转站是否放行由其决定 |

三种形态返回同一个 JSON；解析后再用本地 Schema 校验一次，缺字段或类型不符视为失败，不把半成品塞进工坊。

### 4.3 错误与重试

- 401／403：令牌无效；404：接口路径或模型不存在（提示检查 `openaiEndpoint` 与模型 ID）；429／5xx：指数退避重试 2 次（1 s、3 s）。
- 浏览器 `TypeError: Failed to fetch` 且上游可达 → 判定为跨域被拒，提示改用服务器模式或换支持跨域的中转。
- 超时 60 s；图片过大在发送前拦截；返回 JSON 无法解析时把原文前 500 字展示给用户，便于排查中转站的包装差异。
- 「测试连接」按钮发送一次最小请求（"回复 OK"），显示往返耗时与上游返回的模型名。

## 5. 提示词与 Schema

系统提示固定，用户内容单独一条消息，图片跟在文字后：

> 你是游戏王卡组清单抽取器。只从给定内容中抽取卡组：保留卡名原文（不要翻译、不要改写为别名），给出每张卡的数量与所在分区（主卡组／额外卡组／副卡组）。内容中有多副卡组时全部列出并各自命名。无法确定数量时填 1 并在 `uncertain` 里说明。不要补充内容里没有出现的卡，不要给出任何编号。严格按 Schema 返回 JSON。

Schema（strict）：

```json
{
  "type":"object","additionalProperties":false,
  "properties":{
    "decks":{"type":"array","items":{
      "type":"object","additionalProperties":false,
      "properties":{
        "name":{"type":"string"},
        "main":{"type":"array","items":{"$ref":"#/$defs/entry"}},
        "extra":{"type":"array","items":{"$ref":"#/$defs/entry"}},
        "side":{"type":"array","items":{"$ref":"#/$defs/entry"}},
        "uncertain":{"type":"array","items":{"type":"string"}}
      },"required":["name","main","extra","side","uncertain"]}}
  },"required":["decks"],
  "$defs":{"entry":{"type":"object","additionalProperties":false,
    "properties":{"name":{"type":"string"},"count":{"type":"integer","minimum":1,"maximum":3},"language":{"type":"string","enum":["zh","en","ja","unknown"]}},
    "required":["name","count","language"]}}
}
```

不向模型发送卡池名单：6,275 × 3 语名称远超合理上下文，而且会诱导模型"凑"名字。匹配在本地完成。

## 6. 本地卡片解析器

`src/card-resolver.js`，纯函数，可单测。

1. **规范化**：NFKC、小写、去空白与标点、全角转半角、`・`／`·`／`－` 统一、去掉「」『』、去掉常见前缀（如 "No." 与 "No"），中文简繁不转换（卡池是简体，繁体名走别名表）。
2. **精确匹配**：对 `DuelI18n.searchName(id)` 建索引（内部 ID、中文名、英文名、日文名、密码）。
3. **密码匹配**：8 位数字直接命中 `providerId`（当前 6,192 张有密码）；YDK 文件全部走这一步。
4. **别名表** `data/card-aliases.json`：常见简称与俗称（灰流丽、增 G、屋敷わらし、"Ash"）以及繁体写法；可增量维护。
5. **模糊匹配**：对未命中名字，按同语言在候选池里计算归一化编辑距离与词块重叠，取相似度 ≥ 0.86 的前 5 个作为候选；只有唯一候选且 ≥ 0.94 时自动采用并标记"自动修正"，其余标为"需确认"。
6. **第二轮规范化**（可选、可关闭）：把仍未命中的名字批量发给模型，请它给出官方英文名与日文名，再重跑 2—5 步。这一步的开销小（只有几条名字），且仍不会产生 ID。

逐卡状态：

| 状态 | 含义 | 结果页表现 |
| --- | --- | --- |
| `playable` | 命中且 `implementationStatus !== 'pending'` | 绿色，直接进入草稿 |
| `pending` | 命中但效果待实现 | 黄色，提示暂不能用于正式决斗（工坊校验会拒绝） |
| `ambiguous` | 多个候选 | 橙色，下拉选择，默认不入草稿 |
| `not-in-pool` | 是有效卡名格式但卡池没有 | 红色，显示原名与模型标注的语言；给出 YGOPRODeck 搜索链接 |
| `unknown` | 无法识别（OCR 噪音等） | 灰色，可手动输入名字重试 |

副卡组（side）单独展示，不进入草稿；用户可把其中的卡拖到主卡组。

## 7. 界面

- **设置 → AI 助手**：协议、接口形态、API URL、令牌（密码框，可显示）、模型 ID、传输方式、「测试连接」、「清除令牌」。
- **组卡工坊**：在「导入／导出」旁增加「AI 导入」。窗口三个标签：文本（粘贴框）、图片（拖放／选择，最多 4 张缩略）、网址（输入框；静态部署时显示降级说明）。
- 进度条显示三阶段：读取内容 → 模型解析 → 本地匹配。
- 结果页：多副卡组时左侧列表切换；每副显示主／额外／副三区卡片网格，卡片右上角状态标签，需确认的卡带候选下拉；底部汇总"可用 38／需确认 2／未收录 3"，以及构筑校验结论（如"主卡组 37 张，还差 3 张"）。
- 「载入工坊」：只放入 `playable` 与已确认的候选，草稿名取模型给出的卡组名，未收录清单保存在草稿备注里（工坊现有草稿结构新增 `notes` 字段，不影响旧草稿）。
- 三语：新增 `src/i18n-ai-import.js`；结果页里的卡名走现有 `DuelI18n.name`。

## 8. 服务器代理（可选）

`server/ai-proxy.mjs`，仅在 `npm start` 的服务器上启用，静态部署不存在。

- `POST /api/ai/complete`：请求体是第 4.1 节的配置（不含令牌）+ 消息；令牌由浏览器通过 `X-Duel-AI-Key` 头逐次传递，服务器**不落盘、不写日志**。也允许通过环境变量 `DUEL_AI_DEFAULT_KEY` 提供托管密钥，此时限制每 IP 每小时次数（默认 30）。
- `POST /api/ai/fetch-url`：抓取网页并返回抽取的正文文本。安全限制：只允许 `https:`；解析 DNS 后拒绝私网、回环、链路本地地址（防 SSRF）；跟随最多 3 次重定向并逐次复检；响应 ≤ 2 MB；只接受 `text/html` 与 `text/plain`；超时 15 s。
- 上游主机白名单 `DUEL_AI_UPSTREAMS`（逗号分隔，默认空表示允许任意 https 主机，但同样过私网检查）。
- CSP 的 `connect-src` 已经允许 `https:`，浏览器直连不需要改动；代理路径同源。

## 9. 存储与隐私

- 令牌保存在 `localStorage` 的 `duel-sanctuary-ai-provider-v1`，仅本设备；设置页明确提示"令牌只保存在本浏览器，任何导出、存档、决斗记录都不包含它"。
- 导出卡组 JSON、赛事档案、PVP 投影都不携带 AI 配置。
- 发送给模型的内容只有用户主动提供的文本／图片／网页正文，不附带对局或个人数据。
- 静态部署时页面通过 CSP 允许 `connect-src https:`，用户填写的任意 https 地址都能请求；这是用户的明确选择，设置页说明这一点。

## 10. 需要确认的取舍

1. **OpenAI 接口形态**：按示例默认 Responses，同时保留 Chat Completions 切换；如果只要一种，去掉切换即可。
2. **副卡组**：只展示不入草稿（当前方案），或直接并入主卡组候补。
3. **托管密钥**：服务器部署是否提供默认密钥（涉及费用与限流），或永远要求用户自带。
4. **第二轮规范化**：默认开启还是默认关闭（多一次小请求、提高命中率）。
5. **未收录卡**：只提示，或进一步记录到本地"需求清单"供后续年份推进参考。

## 11. 文件与分期

| 文件 | 职责 |
| --- | --- |
| `src/ai-provider.js` | 两种协议三种形态的适配器、错误归一化、重试、图片预处理 |
| `src/deck-parse.js` | YDK／YDKe／本作 JSON／行式清单解析 |
| `src/card-resolver.js` | 规范化、索引、别名、模糊匹配、状态判定 |
| `data/card-aliases.json` | 别名表 |
| `src/ai-import-ui.js`、`src/ai-import.css`、`src/i18n-ai-import.js` | 设置区、导入窗口、结果页 |
| `server/ai-proxy.mjs` | 代理与网页抓取（含 SSRF 防护） |
| `tests/ai-provider.test.cjs` | 用假 `fetch` 断言三种请求体、头、结果解析、错误映射、重试 |
| `tests/card-resolver.test.cjs` | 三语精确、密码、别名、模糊、歧义、未收录 |
| `tests/deck-parse.test.cjs` | 各结构化格式 |
| `tests/ai-proxy.test.mjs` | 代理转发、私网拒绝、大小与类型限制 |
| `tests/ai-import-browser.cjs` | 拦截网络、用固定 JSON 扮演模型，走完文本与图片流程直到保存卡组 |

分期：

1. **无模型阶段**：解析器 + 匹配器 + 结果页 + 载入工坊。YDK 与清单导入立即可用，也是后续所有阶段的验收基线。
2. **模型阶段**：设置区、两种协议、文本与图片输入、第二轮规范化。
3. **服务器阶段**：代理、网址抓取、SSRF 防护、限流。
4. **打磨**：别名表扩充、多卡组结果页、错误文案三语、手机布局。

所有测试都不访问真实网络；真实中转站的连通性由「测试连接」在用户环境验证。

## 12. 与现有代码的接口

- 生成草稿复用 `DuelDecks.analyze / clean / save`，不引入第二套校验。
- 卡名索引复用 `DuelI18n.searchName`，与图鉴搜索口径一致。
- 工坊入口走现有 `workshop.handle(action)` 分派；窗口用 `openModal`。
- 构建脚本按现有方式把新模块加入 `scripts/build.mjs`；服务器路由挂在 `server/index.mjs` 的 `/api/` 前缀下。
