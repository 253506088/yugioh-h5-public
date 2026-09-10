const {chromium}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/localization/ui-audit-'+new Date().toISOString().replace(/[:.]/g,'-'));
(async()=>{await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.DUEL_BROWSER||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.stack));await page.route(/https?:\/\//,r=>r.abort());await page.addInitScript(()=>{localStorage.clear();localStorage.setItem('duel-sanctuary-welcomed-v3','true');localStorage.setItem('duel-sanctuary-online-art-v2','false');localStorage.setItem('duel-sanctuary-prefs-v1',JSON.stringify({sound:false,reducedMotion:true}));});
 try{await page.goto(pathToFileURL(path.join(root,'output/no-art/index.html')).href);await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');const result={errors,views:[]};
 for(const language of ['zh-CN','en','ja']){
  await page.evaluate(language=>duelApp.setLanguage(language),language);
  for(const view of ['field','library','workshop','help','settings','new-game']){
   if(await page.locator('#modal').evaluate(el=>el.open))await page.locator('#modal [data-action="close-modal"]').first().click();
   if(view!=='field')await page.locator('[data-action="'+({library:'library',workshop:'workshop',help:'help',settings:'settings','new-game':'new-game'}[view])+'"]').first().click();
   await page.evaluate(()=>DuelI18n.apply());
   const details=await page.evaluate(()=>{const area=document.querySelector('#modal').open?document.querySelector('#modal'):document.body,walker=document.createTreeWalker(area,NodeFilter.SHOW_TEXT),texts=[];let node;while(node=walker.nextNode()){const el=node.parentElement;if(!el||el.closest('script,style,svg,[data-user-content]')||!el.getClientRects().length)continue;const text=node.nodeValue.trim();if(/[\u3400-\u9fff]/.test(text))texts.push(text);}return {han:[...new Set(texts)],untranslated:DuelI18n.missingUI,overflow:document.documentElement.scrollWidth>innerWidth};});
   result.views.push({language,view,...details});await page.screenshot({path:path.join(out,language+'-'+view+'.png'),fullPage:true});
  }
 }
 await fs.writeFile(path.join(out,'report.json'),JSON.stringify(result,null,2));await fs.writeFile(path.join(root,'output/localization/ui-audit-latest.json'),JSON.stringify({...result,archive:out},null,2));console.log(JSON.stringify({out,errors,english:result.views.filter(v=>v.language==='en').map(v=>({view:v.view,han:v.han,overflow:v.overflow}))},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
