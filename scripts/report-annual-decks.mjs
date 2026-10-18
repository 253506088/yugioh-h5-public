import {readFile,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {writeAtomic} from './lib/io.mjs';
const require=createRequire(import.meta.url);require('../src/advanced-engine.js');
const D=globalThis.DuelData,context=JSON.parse(await readFile('data/deck-sources/annual-context.json','utf8'));
const files=(await readdir('data')).filter(f=>['decks-1999-2008.json','decks-2009-2012.json'].includes(f)||/^decks-\d{4}\.json$/.test(f)&&Number(f.slice(6,10))>=2013).sort();
const inputs=await Promise.all(files.map(async f=>({file:f,...JSON.parse(await readFile('data/'+f,'utf8'))})));
const rows=inputs.flatMap(j=>j.decks.map(d=>({...d,file:j.file}))),esc=s=>String(s).replaceAll('|','\\|').replace(/[\r\n]+/g,' '),size=xs=>xs.reduce((n,[,q])=>n+q,0);
const audit=['# 年度五套构筑核对','',`核对日期：${context.reviewed}。1999—2025共27年、135套年度预设；另保留13套跨年／主题预设，总计148套。每套主卡40—60张、副卡15张，额外按玩法保留0—15张。空额外的帝王与早期不使用融合的构筑不以无用途卡补足15张。`,'','“补齐前”指基线中带year字段、能进入年度筛选的数量。2002—2005的四个旧主题ID复用，不重复新增；其余早期跨年主题仍保留。','',
 '| 年份 | 补齐前 | 当前 | 五套构筑 |','| --- | ---: | ---: | --- |'];
for(const year of D.earlyYears){const ds=rows.filter(d=>d.year===year);if(ds.length!==5)throw Error('Annual count: '+year);audit.push(`| ${year} | ${context.before[year]??'—'} | ${ds.length} | ${ds.map(d=>`[${esc(d.title)}](../data/${d.file})`).join('；')} |`);}
audit.push('','## 历史与来源边界','');for(const year of D.earlyYears)audit.push(`- **${year}**：${context.history[year]}`);
audit.push('','首届世界赛及历年名次以[World Championship 2003](https://roadoftheking.com/yu-gi-oh-world-championship-2003/)起的逐年记录和各年度正式输入sources为依据。1999—2002及部分早期替代路线只有发行卡池证据，明确称作年代重构，不宣称同期上位率；2003、2004旧原表缺失不补猜。2020—2022停办依据见年度sources中的KONAMI公告及同期报道。','',
 '## 构筑与验证口径','','保留选手原表的年份继续保留原数量。新增适配逐套保存主、额外、副卡和sourceKind；缺副卡时用当年可用的墓地应对、召唤干扰和除去卡补齐，并标记为游戏改编。未以相同主卡复制凑数；测试比较主卡多重集，同年任意两套至少20%卡位不同。','',
 '本项目使用现行三语卡文和自身规则实现，不切换历史卡文或重现各次赛事的禁限表。同期TCG先行卡仍受首次OCG候选日期约束。implemented不是官方裁定穷尽认证；pending卡在三分区都不得进入有效构筑。完整自动验收见[2025验证记录](verification-2025.md)。','',
 '重建：`node scripts/report-annual-decks.mjs`。正式数据及生成器支持离线重建，不读取output研究缓存。','');
await writeAtomic('docs/decks-annual-audit.md',audit.join('\n'));
const j=inputs.find(j=>j.file==='decks-2025.json'),out=['# 2025 五套年度构筑与来源','',context.history['2025'],'','全部为40主／15额外／15副卡。未称为独立季军、选手原表或世界赛共享禁限表合法构筑。完整选手原表在[data/deck-sources/worlds-2025.json](../data/deck-sources/worlds-2025.json)，四张来源图片已人工核对，原图及网页留在忽略的研究目录。游戏构筑在[data/decks-2025.json](../data/decks-2025.json)。','','## 同期证据',''];
for(const s of j.sources)out.push(`- [${s.id}](${s.url})：${s.evidenceSummary} 取得日期${s.accessed}；网页SHA-256：\`${s.retrievedContentSHA256}\`。`);
out.push('','## 改编范围','','K9・VS移除尚未实现的多多迷迷、幻创龙与部分升阶工具，保留真实K9五阶／九阶与VS展示。月光提高本家素材密度，移除多多迷迷、大融合等依赖。闪刀加入2025零号、阿迪尔之剑和等式门支援。码丽丝从41张混合原表改成40张本家／电子界循环。雷热涡炉参考季度样本，加入同年星雷；不是单一选手原表。完整差异逐套保留在adaptation字段。');
for(const d of j.decks){out.push('',`## ${d.title}`,'',d.description,'',`主／额外／副：${size(d.main)}／${size(d.extra)}／${size(d.side)}。来源：${d.sourceRefs.join('、')}。`,'',d.adaptation,'');if(d.sourceOriginalRecipe)out.push(`原表：\`${d.sourceOriginalRecipe}\`。`,'');for(const key of ['main','extra','side']){out.push(`### ${{main:'主卡组',extra:'额外卡组',side:'副卡组'}[key]}`,'','| 卡片 | 数量 |','| --- | ---: |',...d[key].map(([n,q])=>`| ${esc(n)} | ${q} |`),'');}}
out.push('规则、素材、三语、AI与离线页面验收见[验证记录](verification-2025.md)。其他年份五套要求见[逐年核对](decks-annual-audit.md)。重建本文：`node scripts/report-annual-decks.mjs`。','');
await writeAtomic('docs/decks-2025.md',out.join('\n'));
console.log('Documented all 135 annual builds and five 2025 recipes.');
