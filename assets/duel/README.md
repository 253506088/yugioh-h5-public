# 决斗界面素材

- `card-back.jpg`：YGOPRODeck 提供的原版旋涡卡背，来源为 <https://images.ygoprodeck.com/images/cards/back.jpg>，已核对下载内容与本地文件一致。
- `frames/*.webp`：来自 [YGOCARDER](https://github.com/lauqerm/ygocarder) 的社区卡框纹理，使用版本 `e43af1f15cba77bb666770e6fbd09e5bd2d5c363` 下 `public/asset/image/frame/` 的对应类型模板。灵摆框结合 `background/background-pendulum-effect.png` 与 `frame-pendulum/border-pendulum-large-normal.png`。界面纹理压缩为 488 × 711 的 WebP。
- 卡名、属性、等级、效果文字、灵摆刻度和 Link 箭头由本作绘制，以支持中文、英文和日文。全图卡面使用相同卡图与文字布局，由 CSS 展示。
- `art/*.webp`：预设和连锁示例所需的 YGOPRODeck 插图，由 `npm run art:experience` 采集。具体图片 URL 和 SHA-256 见 `art/manifest.json`。

小型卡背、卡框、预设卡图与来源清单保留在源码中；`frames/source/` 和 `art/source/` 中的下载原件已忽略。构建过程直接内嵌本地素材，运行游戏不依赖模板仓库。

卡片插图、卡背和卡框相关设计的权利归原权利人；项目代码的许可证不改变这些素材的权属。

## 2009—2012 王牌补图

本批使用 `node scripts/collect-experience-art.mjs --aces` 补齐预设王牌，新增19张压缩WebP，总数264；包括新十二套所缺的十张及此前九张王牌。采集器合并保留已有manifest，重复执行复用缓存，不删除原有卡图。下载大图位于忽略的 `art/source/`。
