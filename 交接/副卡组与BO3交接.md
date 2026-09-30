# 副卡组与 BO3 维护交接

日期：2026-09-30。基线为346d5f5，保留2016批次163个可用身份与488个pending。先读[功能与技术说明](../docs/side-deck-matches.md)、[实施设计](../docs/side-deck-match-design.md)和[验收记录](../docs/verification-side-matches.md)。

1. 主卡、额外、副卡的同名上限联合计算。不要把side加入引擎refs、实体卡数或抽牌区。新增导入／保存通道必须完整传递side；缺省side兼容空列表，非法side不能静默丢弃。
2. 编辑器命令使用来源分区＋副本下标＋内部ID。按用户后续反馈，工坊改用transfer直接拖拽，允许临时39张或超限的草稿；出战／准备才做最终校验。比赛守恒按内部ID逐卡数量比较，不按总张数或译名。原move严格API供AI等事务调用，不能混淆草稿与已采用构筑。详见[拖拽重排](../docs/workshop-drag.md)。
3. MatchCore与Game引擎分离。结算先查gameId去重；换备沿用上一局构筑但与首局报名比对。每局必须新引擎，不能清空上一局若干数组冒充重开。
4. PVP新操作遵守v2协议、事务回执与白名单。局间不要使用双方共享revision锁；不能向对手发送报名、换卡数、side、构筑指纹或日志中的私密原文。读取历史局必须验证属于本场。
5. 服务器重启冻结业务时间，累计重连预算不得每局重置。换备超时只采用已确认构筑或上一局构筑。整场弃权不能覆盖上一局已完成结果。
6. AI换备只能接收自己的构筑与逐事件公开观察。match-ai.js会在事件发生时记录公开身份；不要改成终局遍历对手deckSpec、手牌或副卡。
7. 年度副卡由generate-chronicle-decks.mjs生成。必须加载实际效果模块，否则早期静态资料上的pending标记会误删已实现副卡。side-deck-availability.json属于正式可核查报告。
8. 单局、整场与赛事统计／文件格式不同。机器人淘汰赛继续采用既有格式，未替换其Tournament.match。当前PVE整场导出是状态与逐局记录备份，不声称可导入旧版录像。
9. 工坊样式最终层在workshop.css；不要又在早期CSS中堆叠相反规则。手机以当前构筑为首页，测试访问牌库需先切页签。自建名称、备注和选项必须保留data-user-content，不能被UI翻译器改写。
10. 变更后重建已跟踪index.html。正式测试入口包括test:matches、test:matches:browser与test:matches:simulation；保留原PVP、工坊、导入、三语、天命法则和赛事回归。
