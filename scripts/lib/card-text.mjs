export function splitPendulum(text) {
  const separator=/[\[【]\s*(?:Monster Effect|Monster Description|怪兽效果|怪兽描述|モンスター効果)\s*[\]】]/i,match=separator.exec(text);
  if(!match)return {description:text};
  return {pendulumDescription:text.slice(0,match.index).replace(/^[\s\S]*?[\[【]\s*(?:Pendulum Effect|灵摆效果|ペンデュラム効果)\s*[\]】]\s*/i,'').replace(/^←[^\r\n]+[\r\n]+/,'').replace(/^【[PＰ]スケール[^】]+】\s*/,'').replace(/[-－─]{3,}/g,'').trim(),description:text.slice(match.index+match[0].length).trim()};
}

export function applyTextOverrides(records, overrides) {
  if(overrides.schemaVersion!==1||!Array.isArray(overrides.entries))throw Error('Invalid text override file');
  for(const entry of overrides.entries){
    if(!records[entry.cardId]||!['zh-CN','en','ja'].includes(entry.language)||!entry.reason||!entry.source||!entry.verifiedAt)throw Error('Text corrections require a known card, language, source, date and reason');
    const fields=Object.keys(entry.text||{});
    if(!fields.length||fields.some(k=>!['name','description','pendulumDescription'].includes(k)||typeof entry.text[k]!=='string'||!entry.text[k].trim()))throw Error('Invalid corrected text: '+entry.cardId);
    Object.assign(records[entry.cardId].locales[entry.language]||={},entry.text);
  }
}
