// Explicit material grammar for the preserved OCG snapshots. Unknown wording is
// an import error, never an unrestricted material or a silently normal monster.
export function parseFusion(name, text, {byName, norm, races, attributes}) {
  if (/^Neo-Spacian (Marine Dolphin|Twinkle Moss)$/.test(name)) return {fusion: [], nexOnly: true};
  if (name === 'Elemental HERO Divine Neos') return {
    fusion: Array.from({length: 5}, () => ({nameIncludesAny: ['Neos', 'Neo Space', 'Neo-Spacian', 'HERO']})),
    fusionDiversity: [['Neos', 'Neo Space'], ['Neo-Spacian'], ['HERO']], fusionOnly: true
  };
  const fusion = []; let fusionMore;
  for (const part of text.trim().split(/\s+\+\s+/)) {
    const named = part.match(/^"([^"]+)"$/);
    if (named) { const id = byName.get(norm(named[1])); fusion.push(id ? {id} : {officialName: named[1]}); continue; }
    const generic = part.match(/^(\d+)(\+)?\s+(.+?)\s+monsters?$/i);
    if (!generic) throw new Error('Unparsed Fusion material: ' + name + ' / ' + part);
    let body = generic[3].replace(/-Type\b/gi, ''), spec = {};
    const level = body.match(/^Level (\d+) or higher (.+)$/i);
    if (level) { spec.minLevel = Number(level[1]); body = level[2]; }
    const series = body.match(/^"([^"]+)"$/);
    if (series) spec.nameIncludes = series[1];
    else if (races[body]) spec.race = races[body];
    else if (attributes[body]) spec.attribute = attributes[body];
    else if (body === 'Gemini') spec.gemini = true;
    else throw new Error('Unknown Fusion material: ' + name + ' / ' + body);
    fusion.push(...Array.from({length: Number(generic[1])}, () => ({...spec})));
    if (generic[2]) fusionMore = spec;
  }
  if (fusion.length < 2) throw new Error('Missing Fusion materials: ' + name);
  return {fusion, ...(fusionMore ? {fusionMore} : {})};
}

export function parseSynchro(name, text, {byName, norm, races, attributes}) {
  const parts = text.trim().split(/\s+\+\s+/);
  if (parts.length !== 2) throw new Error('Unparsed Synchro materials: ' + name);
  const spec = {minTuners: 1, maxTuners: 1, minNon: 1};
  const named = parts[0].match(/^"([^"]+)"$/), tuner = parts[0].match(/^1\s+(?:(.+?)\s+)?Tuner$/);
  if (named) {
    spec.tunerId = byName.get(norm(named[1]));
    if (!spec.tunerId) throw new Error('Missing named Tuner: ' + name);
    if (/Synchron$/.test(named[1])) spec.namedSynchron = true;
  } else if (tuner) {
    if (tuner[1]) {
      if (attributes[tuner[1]]) spec.tunerAttribute = attributes[tuner[1]];
      else if (/^".+"$/.test(tuner[1])) spec.tunerNameIncludes = tuner[1].slice(1, -1);
      else throw new Error('Unknown Tuner requirement: ' + name);
    }
  } else throw new Error('Unknown Tuner material: ' + name);
  const non = parts[1].match(/^(\d+)(?:\+| or more)\s+non-Tuner(?:\s+(.+?))?\s+monsters$/i);
  if (!non) throw new Error('Unknown non-Tuner requirement: ' + name);
  spec.minNon = Number(non[1]);
  if (non[2]) {
    const body = non[2].replace(/-Type$/i, '');
    if (attributes[body]) spec.nonAttribute = attributes[body];
    else if (races[body]) spec.nonRace = races[body];
    else if (/^".+"$/.test(body)) spec.nonNameIncludes = body.slice(1, -1);
    else throw new Error('Unknown non-Tuner type: ' + name + ' / ' + body);
  }
  return {synchro: spec};
}
