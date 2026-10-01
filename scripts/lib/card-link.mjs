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
  take(/, including a Tuner$/i, 'includingTuner');
  take(/ with different names$/i, 'differentNames');
  take(/ Special Summoned from the Extra Deck$/i, 'summonedFromExtra');
  if (/ with different Types and (?:different )?Attributes$/i.test(body)) { link.differentRaces = true; link.differentAttributes = true; body = body.replace(/ with different Types and (?:different )?Attributes$/i, ''); }
  if (/ with the same Attribute but different Types$/i.test(body)) { link.sameAttribute = true; link.differentRaces = true; body = body.replace(/ with the same Attribute but different Types$/i, ''); }
  take(/ with the same Type$/i, 'sameRace');
  body = body.replace(/monsters?$/i, '').trim().replace(/-Type\b/gi, '');
  const levelMax=body.match(/^Level (\d+) or lower (.+)$/i);
  if(levelMax){link.maxLevel=Number(levelMax[1]);body=levelMax[2];}
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
  else if (body === 'Fish, Sea Serpent, and/or Aqua') link.races = ['Fish','Sea Serpent','Aqua'].map(r=>races[r]);
  else if (attributes[body]) link.allAttribute = attributes[body];
  else if (body) throw new Error('Unknown Link material: ' + name + ' / ' + body);
  if (link.min < 1 || link.max < link.min || link.max > linkRating) throw new Error('Invalid Link material count: ' + name);
  return {linkRating, arrows, link};
}
