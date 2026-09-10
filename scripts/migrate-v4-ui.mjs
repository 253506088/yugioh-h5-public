// Kept as a reproducible intermediate migration; this is not part of the build.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const updates={
 'src/game-v2.js':[
  ['在线原版卡图','本地原版卡图'],
  ['按英文原名匹配原图。关闭后，游戏仍可离线进行。','显示构建时内嵌的本地卡图。缺图使用备用卡面，不影响决斗。'],
  ["张卡图地址 · ' + (Art.status().online ? '网络可用' : '当前离线')","张已内嵌卡图 · ' + '运行时不联网'"],
  ['重试卡图','刷新卡图'],
  ['正在重新尝试加载原版卡图。','已刷新本地卡图，缺失图片继续使用备用卡面。'],
  ['卡片显示的中文效果是本作使用的规则文本。','早期卡片保留来源效果原文；年份和实现状态见卡片详情。'],
  ['原图将在联网成功后显示','本次构建未内嵌这张图片，备用卡面可正常使用'],
  ['查看原始卡面 ↗','查看内嵌卡图 ↗'],
  ['实现融合、同调、超量、灵摆、连接与相应连锁','实现仪式、融合、同调、超量、灵摆、连接与相应连锁'],
  ['不采用赛事禁限卡表，没有仪式以及未收录卡片的规则。','不采用赛事禁限卡表。1999—2001按本地首次OCG日期快照收录；逐卡实现状态在图鉴中标注，待实现卡不会作为无效果卡混入决斗。'],
  ['原版卡图通过 YGOPRODeck 在线取得，首次加载可能需要等待。卡图失效或断网不会影响决斗；设置里可关闭联网图片。游戏逻辑、音效和进度都在本地运行。','卡图由你在开发阶段手动增量采集，构建时把本地图片内嵌进HTML。游玩不会请求图片接口，缺图和断网均不影响决斗。游戏逻辑、音效和进度都在本地运行。'],
  ["const rows=[", "const rows=[['仪式召唤','仪式怪兽编入主卡组。发动对应仪式魔法，结算时选择手牌或场上的怪兽解放，等级合计达到要求且不能多解放无须使用的素材；仪式怪兽登场于主怪兽区。'],"]
 ],
 'src/workshop.js':[
  ['原版卡图由 YGOPRODeck 在线提供。<br>离线时仍可查看效果与构筑卡组。','本地卡图在构建时内嵌。<br>缺图仍可查看资料、组卡和决斗。'],
  ['卡牌已全部解锁 · 不采用赛事禁限卡表','本作不采用赛事禁限卡表 · 默认仅显示可用卡片'],
  ['融合、同调与超量怪兽<br>会自动加入这里。','融合、同调、超量与连接怪兽<br>会自动加入这里。仪式在主卡组。']
 ]
};
for(const [file,replacements] of Object.entries(updates)){const path=join(root,file);let text=await readFile(path,'utf8');for(const [from,to] of replacements){if(!text.includes(to))text=text.split(from).join(to);}await writeFile(path,text);console.log('Updated '+file);}
