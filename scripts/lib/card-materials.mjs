// Explicit material grammar for the preserved OCG snapshots. Unknown wording is
// an import error, never an unrestricted material or a silently normal monster.
export function parseFusion(name, text, {byName, norm, races, attributes}) {
  if (name === 'Pair Cycroid') return {fusion: [{race: races.Machine}, {race: races.Machine}], fusionSameName: true};
  if (name === 'Elder Entity Norden') return {fusion: [{types: ['synchro', 'xyz']}, {types: ['synchro', 'xyz']}]};
  if (/^Masked HERO /.test(name)) return {fusion: [], masked: true, specialOnly: 'mask'};
  if (/^Neo-Spacian (Marine Dolphin|Twinkle Moss)$/.test(name)) return {fusion: [], nexOnly: true};
  if (name === 'Elemental HERO Divine Neos') return {
    fusion: Array.from({length: 5}, () => ({nameIncludesAny: ['Neos', 'Neo Space', 'Neo-Spacian', 'HERO']})),
    fusionDiversity: [['Neos', 'Neo Space'], ['Neo-Spacian'], ['HERO']], fusionOnly: true
  };
  const fusion = []; let fusionMore;
  for (const part of text.trim().split(/\s+\+\s+/)) {
    const named = part.match(/^(?:1\s+)?"([^"]+)"$/);
    if (named) { const id = byName.get(norm(named[1])); fusion.push(id ? {id} : {officialName: named[1]}); continue; }
    const generic = part.match(/^(\d+)(\+| or more)?\s+(.+?)\s+monsters?$/i);
    if (!generic) throw new Error('Unparsed Fusion material: ' + name + ' / ' + part);
    let body = generic[3].replace(/-Type\b/gi, ''), spec = {};
    const level = body.match(/^Level (\d+) or higher (.+)$/i);
    if (level) { spec.minLevel = Number(level[1]); body = level[2]; }
    const type = body.match(/^(.*?)\s*Synchro$/i);
    if (type) { spec.type = 'synchro'; body = type[1]; }
    if (/^(?:non-Effect|Normal)$/i.test(body)) { spec.normal = true; body = ''; }
    const attributeRace = body.match(/^(DARK|LIGHT|EARTH|WIND|WATER|FIRE) (.+)$/);
    if (attributeRace && races[attributeRace[2]]) { spec.attribute = attributes[attributeRace[1]]; spec.race = races[attributeRace[2]]; body = ''; }
    const combined = body.match(/^(.+?)\s+"([^"]+)"$/);
    if (combined && races[combined[1]]) { spec.race = races[combined[1]]; body = '"' + combined[2] + '"'; }
    const series = body.match(/^"([^"]+)"$/);
    if (series) spec.nameIncludes = series[1];
    else if (races[body]) spec.race = races[body];
    else if (attributes[body]) spec.attribute = attributes[body];
    else if (body === 'Gemini') spec.gemini = true;
    else if (body || !Object.keys(spec).length) throw new Error('Unknown Fusion material: ' + name + ' / ' + body);
    fusion.push(...Array.from({length: Number(generic[1])}, () => ({...spec})));
    if (generic[2]) fusionMore = spec;
  }
  if (fusion.length < 2) throw new Error('Missing Fusion materials: ' + name);
  return {fusion, ...(fusionMore ? {fusionMore} : {})};
}

export function parseSynchro(name, text, {byName, norm, races, attributes}) {
  if (name === 'Ultimaya Tzolkin') return {synchro: {noSummon: true}, noNormal: true, specialOnly: 'tzolkin'};
  const parts = text.trim().split(/\s+\+\s+/);
  if (parts.length < 2 || parts.length > 3) throw new Error('Unparsed Synchro materials: ' + name);
  const spec = {minTuners: 1, maxTuners: 1, minNon: 1};
  const named = parts[0].match(/^"([^"]+)"$/), tuner = parts[0].match(/^(\d+)\s+(?:(.+?)\s+)?Tuners?( Synchro Monster)?$/i);
  if (named) {
    spec.tunerId = byName.get(norm(named[1]));
    if (!spec.tunerId) throw new Error('Missing named Tuner: ' + name);
    if (/Synchron$/.test(named[1])) spec.namedSynchron = true;
  } else if (tuner) {
    spec.minTuners = spec.maxTuners = Number(tuner[1]);
    if (tuner[3]) spec.tunerType = 'synchro';
    if (tuner[2]) {
      const body = tuner[2].replace(/-Type$/i, '');
      if (attributes[body]) spec.tunerAttribute = attributes[body];
      else if (races[body]) spec.tunerRace = races[body];
      else if (/^".+"$/.test(body)) spec.tunerNameIncludes = body.slice(1, -1);
      else throw new Error('Unknown Tuner requirement: ' + name);
    }
  } else throw new Error('Unknown Tuner material: ' + name);
  const namedNon = parts[1].match(/^"([^"]+)"$/);
  if (namedNon) {
    const id = byName.get(norm(namedNon[1]));
    if (!id) throw new Error('Missing named non-Tuner: ' + name);
    if (parts.length === 2) { spec.nonId = id; spec.maxNon = 1; return {synchro: spec}; }
    spec.requiredNonIds = [id]; spec.minNon = 2; spec.maxNon = 2;
  } else if (parts.length !== 2) throw new Error('Unparsed Synchro materials: ' + name);
  // Gottoms explicitly allows EARTH Tuners in its additional material slots.
  if (name === 'XX-Saber Gottoms' && parts[1] === '1 or more EARTH monsters') return {synchro: {...spec, maxTuners: 6, minNon: 0, additionalAttribute: attributes.EARTH}};
  const non = parts.at(-1).match(/^(\d+)(\+| or more)?\s+(?:Level (\d+) )?non-Tuner(?:\s+(.+?))?\s+monsters?$/i);
  if (!non) throw new Error('Unknown non-Tuner requirement: ' + name);
  spec.minNon = Number(non[1]) + (namedNon ? 1 : 0);
  if (!non[2]) spec.maxNon = spec.minNon;
  if (non[3]) spec.nonLevel = Number(non[3]);
  if (non[4]) {
    const body = non[4].replace(/-Type$/i, '');
    if (attributes[body]) spec.nonAttribute = attributes[body];
    else if (races[body]) spec.nonRace = races[body];
    else if (/^".+"$/.test(body)) spec.nonNameIncludes = body.slice(1, -1);
    else if (body === 'Normal') spec.nonNormal = true;
    else if (body === 'Gemini') spec.nonGemini = true;
    else if (body === 'Synchro') spec.nonType = 'synchro';
    else throw new Error('Unknown non-Tuner type: ' + name + ' / ' + body);
  }
  return {synchro: spec};
}

export function parseXyz(name, text, {races, attributes}) {
  if (name === 'Number F0: Utopic Future') return {xyzCount: 2, rank: 0, xyzMaterialType: 'xyz', xyzSameRank: true, xyzExcludeNameIncludes: 'Number'};
  const unlimited = /^(\d+) or more Level/.test(text);
  if (unlimited) text = text.replace(/^(\d+) or more Level/, '$1 or more (max. 7) Level');
  // YGOPRODeck prints Xyz materials in two orders: the long-standing
  // "2 Level 4 Fairy-Type monsters" and the newer "2 Pyro-Type Level 4 monsters".
  const levelFirst = text.trim().match(/^(\d+)(?: or more \(max\. (\d+)\))? Level (\d+)(?: (.+?))? monsters$/i);
  const typeFirst = text.trim().match(/^(\d+)(?: or more \(max\. (\d+)\))? (.+?) Level (\d+) monsters$/i);
  const m = levelFirst || typeFirst;
  if (!m) throw new Error('Unparsed Xyz materials: ' + name + ' / ' + text);
  const out = {xyzCount: Number(m[1]), rank: Number(levelFirst ? m[3] : m[4])};
  if (m[2]) out.xyzMax = Number(m[2]);
  const body = (levelFirst ? m[4] : m[3])?.replace(/-Type$/i, '');
  if (body) {
    if (races[body]) out.xyzRace = races[body];
    else if (attributes[body]) out.xyzAttribute = attributes[body];
    else if (body === 'Normal') out.xyzNormal = true;
    else if (/^".+"$/.test(body)) out.xyzNameIncludes = body.slice(1, -1);
    else throw new Error('Unknown Xyz material: ' + name + ' / ' + body);
  }
  return out;
}
