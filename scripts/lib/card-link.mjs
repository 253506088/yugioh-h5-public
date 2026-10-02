// Import-time Link grammar. Unknown material text or arrows must fail closed.
// `attribute` in the legacy engine means "including"; `allAttribute` means all.
export function parseLink(name, text, {races, attributes, linkRating, linkMarkers}) {
  if (!Number.isInteger(linkRating) || linkRating < 1 || linkRating > 6) throw new Error('Invalid Link rating: ' + name);
  const directions = {'Top-Left':'TL',Top:'T','Top-Right':'TR',Left:'L',Right:'R','Bottom-Left':'BL',Bottom:'B','Bottom-Right':'BR'};
  const arrows = (linkMarkers || []).map(marker => directions[marker]);
  if (arrows.length !== linkRating || arrows.some(a => !a) || new Set(arrows).size !== arrows.length) throw new Error('Invalid Link arrows: ' + name);
  const match = text.trim().match(/^(\d+)(\+| or more)? (.+)$/);
  if (!match) throw new Error('Unparsed Link material: ' + name + ' / ' + text);
  const link = {min:Number(match[1]), max:match[2] ? linkRating : Number(match[1])};
  let body = match[3];
  const take = (pattern, key) => { if (pattern.test(body)) { link[key] = true; body = body.replace(pattern, ''); } };
  take(/, except (?:Tokens|a Token)$/i, 'noTokens');
  const exceptName=body.match(/, except "([^"]+)"$/);
  if(exceptName){link.excludeName=exceptName[1];body=body.slice(0,exceptName.index);}
  take(/, including a Tuner$/i, 'includingTuner');
  const including=body.match(/, including (?:(?:a|an) )?(.+)$/i);
  if(including){
    let value=including[1];body=body.slice(0,including.index);
    if(value==='Token')link.includingToken=true;
    else if(value==='Link Monster')link.includingType='link';
    else if(value==='Ritual Monster')link.includingType='ritual';
    else if(/^"[^"]+"$/.test(value))link.includingName=value.slice(1,-1);
    else if(/^"[^"]+" (?:monster|Tuner)$/i.test(value)){link.includingSeries=value.match(/"([^"]+)"/)[1];if(/Tuner$/i.test(value))link.includingSeriesTuner=true;}
    else if(/^monster with \d+ or more ATK$/i.test(value))link.includingMinAtk=Number(value.match(/\d+/)[0]);
    else if(attributes[value.replace(/ monster$/i,'')])link.attribute=attributes[value.replace(/ monster$/i,'')];
    else throw new Error('Unknown included Link material: '+name+' / '+value);
  }
  take(/ with different names$/i, 'differentNames');
  take(/ Special Summoned from the Extra Deck$/i, 'summonedFromExtra');
  if (/ with different Types and (?:different )?Attributes$/i.test(body)) { link.differentRaces = true; link.differentAttributes = true; body = body.replace(/ with different Types and (?:different )?Attributes$/i, ''); }
  if (/ with the same Attribute but different Types$/i.test(body)) { link.sameAttribute = true; link.differentRaces = true; body = body.replace(/ with the same Attribute but different Types$/i, ''); }
  take(/ with the same Type$/i, 'sameRace');
  if(/ with the same Type and Attribute$/i.test(body)){link.sameRace=true;link.sameAttribute=true;body=body.replace(/ with the same Type and Attribute$/i,'');}
  take(/ with different Types$/i,'differentRaces');
  const parenthetical=body.match(/ \(([^)]+)\)$/);
  if(parenthetical){const values=parenthetical[1].split(' and/or ');if(values.some(v=>!races[v]))throw new Error('Unknown Link races: '+name);link.races=values.map(v=>races[v]);body=body.slice(0,parenthetical.index);}
  body = body.replace(/monsters?$/i, '').trim().replace(/-Type\b/gi, '');
  const levelBound=body.match(/^Level (\d+) or (lower|higher) (.+)$/i);
  if(levelBound){link[levelBound[2]==='lower'?'maxLevel':'minLevel']=Number(levelBound[1]);body=levelBound[3];}
  const nonAttribute=body.match(/^non-(FIRE|WATER|WIND|EARTH|LIGHT|DARK) (.+)$/);
  if(nonAttribute){link.excludeAttribute=attributes[nonAttribute[1]];if(!link.excludeAttribute)throw new Error('Unknown Link attribute: '+name);body=nonAttribute[2];}
  if(/^non-Link /i.test(body)){link.nonLink=true;body=body.replace(/^non-Link /i,'');}
  if(/ Effect$/i.test(body)){link.effect=true;body=body.replace(/ Effect$/i,'');}
  const attributeRace=body.match(/^(FIRE|WATER|WIND|EARTH|LIGHT|DARK) (.+)$/);
  if(attributeRace&&races[attributeRace[2]]){link.allAttribute=attributes[attributeRace[1]];body=attributeRace[2];}
  if(/ Link$/i.test(body)){link.linkOnly=true;body=body.replace(/ Link$/i,'');}
  if (body === 'Normal Summoned/Set') link.normalSummoned = true;
  else if (body === 'Normal') link.normal = true;
  else if (body === 'Effect') link.effect = true;
  else if (body === 'Pendulum') link.pendulum = true;
  else if (body === 'Link') link.linkOnly = true;
  else if (body === 'Flip') link.flip = true;
  else if (/^Level \d+$/.test(body)) link.level = Number(body.slice(6));
  else if (/^"[^"]+"$/.test(body)) link.series = body.slice(1,-1);
  else if (races[body]) link.race = races[body];
  else if (body.includes(' and/or ')||body.includes(', and/or ')){const names=body.split(/, | and\/or /).map(s=>s.replace(/^and\/or /,''));if(names.some(r=>!races[r]))throw new Error('Unknown Link races: '+name+' / '+body);link.races=names.map(r=>races[r]);}
  else if (attributes[body]) link.allAttribute = attributes[body];
  else if (body) throw new Error('Unknown Link material: ' + name + ' / ' + body);
  if (link.min < 1 || link.max < link.min || link.max > linkRating) throw new Error('Invalid Link material count: ' + name);
  return {linkRating, arrows, link};
}
