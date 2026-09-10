export function createProgressLogger({write=message=>console.log(message),now=()=>Date.now()}={}){
 const lines=[];let started=now(),lastPrinted=0;
 function emit(message){lines.push(message);write(message);lastPrinted=now();}
 const handle=event=>{
  const elapsed=Math.floor((now()-started)/1000),counts=event.counts;
  const meter=counts?`[${counts.processed}/${counts.total}] 已下载 ${counts.downloaded} · 已复用 ${counts.reused} · 待补 ${counts.pending} · 失败 ${counts.failed} · 剩余待处理 ${counts.remaining} · ${elapsed}s`:'';
  if(event.type==='catalog')emit(`准备年度切片 ${event.scope}，正在读取卡片目录…`);
  else if(event.type==='catalog-ready')emit(`卡片目录已整理：${event.cards} 张卡，对应 ${event.total} 张图片。本次只保存资料，不请求图片。`);
  else if(event.type==='start'){started=now();emit(`开始卡图采集：${event.cards} 张卡，${event.total} 张图片；${event.mode}。正在检查本地缓存…`);}
  else if(event.type==='plan')emit(`缓存检查完成：预计可复用 ${event.cached} 张，需要补充 ${event.missing} 张（其中 ${event.unresolved} 张卡尚需查询身份）。`);
  else if(event.type==='metadata')emit(`${meter} 查询卡片资料：${event.name}`);
  else if(event.type==='download')emit(`${meter} 正在下载 ${event.kind}：${event.name}`);
  else if(event.type==='retry')emit(`${meter} 请求重试 ${event.attempt}/3：${event.reason}`);
  else if(event.type==='saved')emit(`${meter} 已保存：${event.name} (${event.kind})`);
  else if(event.type==='imported')emit(`${meter} 已导入本地图片：${event.name} (${event.kind})`);
  else if(event.type==='failure')emit(`${meter} 未完成：${event.name} · ${event.reason}`);
  else if(event.type==='heartbeat')emit(`${meter} ${event.operation||'处理中…'}`);
  else if(event.type==='reused'&&(counts.processed%100===0||now()-lastPrinted>=1500))emit(`${meter} 复用本地缓存：${event.name}`);
  else if(event.type==='finish')emit(`${meter} ${event.completionLabel||(event.complete?'全部完成':`本次处理结束，仍需补全 ${counts?.missing??0} 张，可再次运行续取`)}。报告：${event.report}`);
 };
 return {handle,lines};
}
