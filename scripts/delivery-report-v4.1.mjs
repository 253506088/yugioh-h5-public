import {readFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {writeAtomic} from './lib/io.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=async file=>JSON.parse(await readFile(join(root,file),'utf8'));
const [build,rules,simulation,browser,localizedBrowser,catalog,locales,packageInfo]=await Promise.all([
 read('output/build-report.json'),read('output/v4-checks-report.json'),read('output/v4-simulation-report.json'),read('output/v4-browser-report.json'),read('output/v4.1-browser-report.json'),read('output/early-import/effect-coverage.json'),read('output/localization/card-coverage.json'),read('package.json')
]);
const html=await readFile(join(root,'index.html')),noArt=await readFile(join(root,'output/no-art/index.html'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),sha256=hash(html),noArtSha256=hash(noArt);
if(!rules.ok||simulation.failures.length||!browser.ok||browser.errors.length||browser.requests.length||!localizedBrowser.ok||localizedBrowser.errors.length)throw new Error('A required validation has not passed. Inspect the referenced reports.');
if(browser.buildSha256!==sha256||localizedBrowser.buildSha256!==sha256||localizedBrowser.noArtSha256!==noArtSha256)throw new Error('Browser reports do not match the current HTML files; validate both final builds.');
if(build.bytes!==html.length||build.embeddedOriginalArt!==browser.embeddedArt)throw new Error('Build metadata does not match the tested artifact.');
if(locales.missing.length||locales.missingPendulum.length||locales.missingEncyclopedia.length||Object.values(build.localization.byLanguage).some(count=>count!==build.collectibleCards))throw new Error('Current card-language coverage is incomplete.');
const report={
 version:packageInfo.version,at:new Date().toISOString(),artifact:'index.html',sha256,bytes:html.length,
 noArtArtifact:{path:'output/no-art/index.html',sha256:noArtSha256,bytes:noArt.length,defaultOnlineArt:true},
 collectibleCards:build.collectibleCards,presets:build.presetDecks,earlySnapshotCards:catalog.total,years:catalog.years,
 localization:{...build.localization,sourceCommit:locales.sourceCommit,identityAliases:locales.identityAliases},
 embeddedArtwork:build.embeddedOriginalArt,artworkPolicy:'embedded first, optional online fallback, readable placeholders if unavailable',offlineValidationRequests:browser.requests.length,
 validation:{tests:rules.tests,passed:rules.pass,simulatedMatches:simulation.matches,completedMatches:simulation.completed,browserWorkflows:browser.checks.length+localizedBrowser.checks.length,offlineBrowserWorkflows:browser.checks.length,localizationBrowserWorkflows:localizedBrowser.checks.length,onlineArtwork:'tested with intercepted synthetic responses; no real artwork downloads required'},
 documents:['README.md','MANUAL.md','HANDOFF.md','YEARLY-CARD-ROLLOUT-PLAN.md'],
 reports:['output/build-report.json','output/v4-checks-report.json','output/v4-simulation-report.json','output/v4-browser-report.json','output/v4.1-browser-report.json','output/localization/card-coverage.json','output/early-import/effect-coverage.json'],
 scopeNotes:[
  'The 1999–2001 counts are preserved provider first-OCG-date snapshots; official annual product coverage is not independently complete.',
  'Effect registration and selected passing tests are separate from exhaustive official ruling certification.',
  'Spirit Elimination and Bait Doll have documented local adaptations.',
  'Named Fusion dependencies outside or unmatched in current snapshots remain constraints, not fabricated cards.',
  'Community card text is localized for display; effect handlers and stable card identities remain independent.',
  'Zero HTTP requests were verified with online artwork disabled. Optional online artwork and encyclopedia pages require a connection.'
 ],artworkWarnings:build.artworkWarnings
};
const archive=join(root,'output/v4-delivery',report.at.replace(/[:.]/g,'-'));await mkdir(archive,{recursive:true});
for(const file of ['v4-delivery-report.json','v4-QA.md']){try{await writeAtomic(join(archive,'previous-'+file),await readFile(join(root,'output',file)));}catch(error){if(error.code!=='ENOENT')throw error;}}
const qa=`# V${report.version} 交付验证

生成：${report.at}

- 成品：\`index.html\`，${(report.bytes/1024/1024).toFixed(2)} MiB。
- SHA-256：\`${sha256}\`。
- 无图成品：\`output/no-art/index.html\`，${(noArt.length/1024/1024).toFixed(2)} MiB，三语和规则齐全。
- 卡池：${report.collectibleCards} 张、${report.presets} 套预设；三年快照 ${report.earlySnapshotCards} 张。
- 中英日文字：每种语言 ${report.collectibleCards} 张；具体百科地址 ${build.localization.encyclopediaLinks} 条。
- 本地内嵌图片：${report.embeddedArtwork} 张。无图构建默认允许在线补图，已保存的用户偏好优先。
- 规则、采集、日志和语言检查：${rules.pass} / ${rules.tests} 通过。
- 跨预设和年度混合模拟：${simulation.completed} / ${simulation.matches} 完成。
- 浏览器：${report.validation.browserWorkflows} 项流程通过；脚本错误为 0。关闭在线卡图的文件模式 HTTP 请求 ${browser.requests.length}。
- 在线图片分支使用模拟响应验证，没有为了测试批量下载卡图。

## 浏览器覆盖

${[...browser.checks,...localizedBrowser.checks].map(x=>'- '+x).join('\n')}

## 资料与范围

文本来源提交：\`${locales.sourceCommit}\`。三个 CDB 原件、SHA-256、卡片身份别名和覆盖报告均保留。

本报告描述本地快照、实际成品和已执行的测试，不将供应方日期视作完整官方年度核验，也不将效果登记视作全部裁定认证。已知适配和后续事项见 [交接文档](../HANDOFF.md)，操作说明见 [手册](../MANUAL.md)。

原始响应、源码、卡图原件、文本数据库、派生图、无图产物、采集日志、历次构建和测试截图均继续保留。
`;
await writeAtomic(join(archive,'report.json'),JSON.stringify(report,null,2)+'\n');await writeAtomic(join(archive,'QA.md'),qa);
await writeAtomic(join(root,'output/v4-delivery-report.json'),JSON.stringify(report,null,2)+'\n');await writeAtomic(join(root,'output/v4-QA.md'),qa);
console.log(JSON.stringify({artifact:report.artifact,sha256,bytes:report.bytes,cards:report.collectibleCards,artwork:report.embeddedArtwork,localization:report.localization,...report.validation},null,2));
