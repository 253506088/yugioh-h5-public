import {createHash} from 'node:crypto';

export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const normalizedName=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
export function validateScope(scope){
  if(!Number.isInteger(scope.startYear)||!Number.isInteger(scope.endYear)||scope.startYear<1999||scope.endYear<scope.startYear||scope.endYear>2026)throw new Error('年度范围必须位于1999—2026，且结束年份不早于起始年份。');
  if(scope.dateRegion!=='ocg')throw new Error('当前采集器只按明确的首次OCG日期归档，不能混用TCG日期。');
  const url=new URL(scope.catalogUrl);if(url.protocol!=='https:'||url.hostname!=='db.ygoprodeck.com'||url.pathname!=='/api/v7/cardinfo.php'||url.username||url.password)throw new Error('目录来源不是配置的公开卡片API。');
  if(url.searchParams.get('dateregion')!=='ocg'||url.searchParams.get('misc')!=='yes'||url.searchParams.get('startdate')!=='01/01/'+scope.startYear||url.searchParams.get('enddate')!=='12/31/'+scope.endYear)throw new Error('目录请求的地区或日期参数与本批范围不一致。');
  return scope;
}
export function strictDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const [y,m,d]=value.split('-').map(Number),at=new Date(Date.UTC(y,m-1,d));
  return at.getUTCFullYear()===y&&at.getUTCMonth()===m-1&&at.getUTCDate()===d?value:null;
}
export function validImageURL(value,imageId,kind){
  try{const u=new URL(value),match=u.pathname.match(/^\/images\/(cards|cards_cropped)\/(\d+)\.jpg$/);if(u.protocol!=='https:'||u.hostname!=='images.ygoprodeck.com'||u.username||u.password||u.search||u.hash||(u.port&&u.port!=='443')||!match||Number(match[2])!==imageId||match[1]!==({full:'cards',cropped:'cards_cropped'}[kind]))return null;return u.href;}catch{return null;}
}
export function normalizeCatalog(payload,scope,{existingCards=[]}={}){
  validateScope(scope);if(!payload||!Array.isArray(payload.data))throw new Error('卡片目录响应缺少data数组，不能按成功目录处理。');
  const cards=[],quarantine=[],outOfRange=[],excluded=[],duplicates=[],byId=new Map(),jobs=new Map();
  const existing=new Map();for(const c of existingCards){const name=normalizedName(c.officialName||c.en);if(!existing.has(name))existing.set(name,[]);existing.get(name).push(c.id);}
  for(let index=0;index<payload.data.length;index++){
    const raw=payload.data[index];
    if(!raw||!Number.isSafeInteger(raw.id)||raw.id<=0||typeof raw.name!=='string'||!raw.name.trim()||typeof raw.type!=='string'){quarantine.push({index,cardId:raw?.id??null,reason:'invalid_card_identity'});continue;}
    const formats=(Array.isArray(raw.misc_info)?raw.misc_info:[]).flatMap(m=>Array.isArray(m.formats)?m.formats:[]);
    if((scope.excludeTypes||[]).includes(raw.type)||raw.frameType==='skill'||(scope.excludeRushDuel&&(/^rush/i.test(raw.frameType||'')||(formats.includes('Rush Duel')&&!formats.includes('OCG'))))){excluded.push({cardId:raw.id,type:raw.type,reason:'different_format_or_not_deck_collectible'});continue;}
    const misc=Array.isArray(raw.misc_info)?raw.misc_info:[],rawDates=misc.map(x=>x.ocg_date).filter(Boolean),dates=[...new Set(rawDates.map(strictDate).filter(Boolean))];
    if(dates.length!==1||rawDates.some(x=>!strictDate(x))){quarantine.push({index,cardId:raw.id,name:raw.name,reason:dates.length>1?'conflicting_first_ocg_dates':'missing_or_invalid_first_ocg_date',values:rawDates});continue;}
    const date=dates[0],year=Number(date.slice(0,4));
    if(year<scope.startYear||year>scope.endYear){outOfRange.push({cardId:raw.id,date});continue;}
    if(byId.has(raw.id)){
      const previous=byId.get(raw.id);if(previous.name!==raw.name||previous.firstOCGDate!==date||previous.providerType!==raw.type||previous.description!==(raw.desc||'')||previous.atk!==(raw.atk??null)||previous.def!==(raw.def??null))quarantine.push({index,cardId:raw.id,reason:'conflicting_duplicate_identity'});else duplicates.push({cardId:raw.id,index});continue;
    }
    const mappings=existing.get(normalizedName(raw.name))||[];
    const c={cardUid:'ygoprodeck:'+raw.id,providerId:raw.id,name:raw.name,providerType:raw.type,frameType:raw.frameType||null,description:raw.desc||'',attribute:raw.attribute||null,race:raw.race||null,atk:raw.atk??null,def:raw.def??null,level:raw.level??null,linkRating:raw.linkval??null,linkMarkers:raw.linkmarkers||[],pendulumScale:raw.scale??null,firstOCGDate:date,firstTCGDate:misc.map(x=>strictDate(x.tcg_date)).find(Boolean)||null,year,sourceRecordIndex:index,existingGameIds:mappings,implementationStatus:mappings.length?'existing_requires_audit':'not_implemented',dateVerification:'provider_candidate',productCoverage:'not_crosschecked',imageSelection:'provider_default_not_verified_historical_first_print',imageKeys:[],providerSetReferences:raw.card_sets||[]};
    cards.push(c);byId.set(raw.id,c);
    const image=raw.card_images?.[0];
    if(!image||!Number.isSafeInteger(image.id)||image.id<=0){quarantine.push({index,cardId:raw.id,reason:'no_valid_default_image'});continue;}
    for(const kind of scope.collectImages||['cropped','full']){
      const candidate=kind==='cropped'?image.image_url_cropped:image.image_url,url=validImageURL(candidate,image.id,kind),key=kind+':'+image.id;
      if(!url){quarantine.push({index,cardId:raw.id,imageId:image.id,kind,reason:'missing_or_untrusted_image_url'});continue;}
      c.imageKeys.push(key);
      if(!jobs.has(key))jobs.set(key,{key,imageId:image.id,kind,url,cardUids:[],years:[]});const job=jobs.get(key);
      if(!job.cardUids.includes(c.cardUid))job.cardUids.push(c.cardUid);if(!job.years.includes(year))job.years.push(year);
    }
  }
  cards.sort((a,b)=>a.firstOCGDate.localeCompare(b.firstOCGDate)||a.providerId-b.providerId);
  const years=Array.from({length:scope.endYear-scope.startYear+1},(_,i)=>scope.startYear+i);
  return {schemaVersion:1,scope:{startYear:scope.startYear,endYear:scope.endYear,dateRegion:'ocg'},sourceRecordCount:payload.data.length,cardCount:cards.length,cards,byYear:Object.fromEntries(years.map(y=>[y,cards.filter(c=>c.year===y)])),imageJobs:[...jobs.values()],quarantine,excluded,outOfRange,duplicates,sourceCoverage:'single_provider_not_authoritative_year_completion'};
}
export async function inspectImage(bytes,sharp){
  if(!Buffer.isBuffer(bytes)||bytes.length<32)throw new Error('图片字节过少或为空。');
  const metadata=await sharp(bytes,{failOn:'error',limitInputPixels:30_000_000}).metadata();
  if(!['jpeg','png','webp'].includes(metadata.format)||!metadata.width||!metadata.height||Math.min(metadata.width,metadata.height)<64)throw new Error('图片格式或尺寸不合格，可能是错误响应或占位图片。');
  await sharp(bytes,{failOn:'error',limitInputPixels:30_000_000}).stats();
  return {sha256:sha256(bytes),bytes:bytes.length,format:metadata.format,width:metadata.width,height:metadata.height,extension:metadata.format==='jpeg'?'jpg':metadata.format,validation:'decoded_and_hashed',identityReview:'pending_visual_review'};
}
