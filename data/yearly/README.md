# 1999—2001卡片与原图采集

范围配置：scope-1999-2001.json。完整方案见根目录YEARLY-CARD-ROLLOUT-PLAN.md。

采集器复用游戏现有的YGOPRODeck图源，在开发阶段批量下载；每张目标卡保存全卡面与裁切插画。实际年度卡数由成功获取、带明确首次OCG日期的记录生成，不预填数字。

在正常网络访问获得允许且可用后执行：

~~~sh
node scripts/collect-years.mjs
node scripts/collect-years.mjs --resume
~~~

如果已有合法取得的JSON快照或图片文件，可以完全离线整理：

~~~sh
node scripts/collect-years.mjs --catalog path/to/cardinfo.json --offline
node scripts/collect-years.mjs --catalog path/to/cardinfo.json --image-dir path/to/images --offline
~~~

本地图片按cropped/图片ID.jpg与full/图片ID.jpg放置，也支持PNG、WebP。只匹配范围内记录的图片ID。图像检查使用sharp；当前工作环境的Node运行时已包含该库，其他开发环境需要安装。

成功的目录会写入data/yearly/1999、2000、2001；原始响应和各轮报告保存在output/yearly-collection。图片按SHA-256保存在assets/official-archive/objects，展示副本保存在derived。index.json保存来源、卡片关联、哈希、尺寸与核验状态。

以下状态不可混淆：

- 目录抓取／整理成功：某个来源的年度候选卡片已保存。
- 图片下载完成：目标图片字节已经解码、校验并落地。
- 年度收录完整：还须与正式发行产品及附卡目录交叉核对。
- 卡片可用于自动对战：还须完成或审计效果脚本并验证。

采集不会自动将未实现效果的卡片塞入当前游戏，不会修改根目录index.html。正式离线单HTML在资料、原图和效果通过后逐批构建。

测试命令：node --test tests/yearly-collector.test.mjs。测试在output/yearly-collector-tests独立目录使用明确标注的合成数据和图片，不代表真实卡片下载结果。
