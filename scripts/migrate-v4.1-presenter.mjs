// Preserved migration: presentation only. Card IDs, canonical rules and saved decks are not translated.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const replacements={
 'src/game-v2.js':[
  ["window.DuelEffects.get(l.key)?.label", "I.effectLabel(window.DuelEffects.get(l.key))"],
  ["window.DuelEffects.get(trigger.key)?.label", "I.effectLabel(window.DuelEffects.get(trigger.key))"],
  ["window.DuelEffects.get(p.ctx?.key||trigger?.key)?.label||''", "I.effectLabel(window.DuelEffects.get(p.ctx?.key||trigger?.key))"],
  ["window.DuelEffects.get(o.key)?.label||CARDS[id]?.name", "I.effectLabel(window.DuelEffects.get(o.key))||CARDS[id]?.name"],
  ["window.DuelEffects.get(selectionState.response?.key)?.label||'发动效果'", "I.effectLabel(window.DuelEffects.get(selectionState.response?.key))"],
  ["escape(o.label||I.effectLabel", "escape(I.effectLabel(window.DuelEffects.get(o.key))||o.label||I.effectLabel"],
  ["escape(s.pending.title||'效果处理中')", "escape(I.pendingTitle(s.pending,engine))"],
  ["const full=Art.full(id);", ""],
  ["卡图由你在开发阶段手动增量采集，构建时把本地图片内嵌进HTML。游玩不会请求图片接口，缺图和断网均不影响决斗。游戏逻辑、音效和进度都在本地运行。", "卡图优先使用构建时内嵌的本地图片。也可在设置中开启「在线原版卡图」，为无图版本或缺失图片联网补图；关闭在线卡图、图片失败或断网都不影响决斗。界面、卡名与说明可在中文、English、日本語之间切换，偏好会自动保存。"]
 ],
 'src/workshop.js':[
  ["T.list().filter(d=>d.preset).map(d=>", "T.list().filter(d=>d.preset).map(d=>I.deck(d)).map(d=>"],
  ["本地卡图在构建时内嵌。<br>缺图仍可查看资料、组卡和决斗。", "卡图优先使用本地内嵌图片。<br>可在设置中启用在线原版卡图。"]
 ]
};
for(const [file,pairs] of Object.entries(replacements)){const path=join(root,file);let source=await readFile(path,'utf8');for(const [before,after] of pairs)if(!source.includes(after)||after==='')source=source.split(before).join(after);await writeFile(path,source);console.log('Updated '+file);}
