// A Pendulum card has two independently applied text boxes. Preserve the full
// source text as originalDescription, but never feed the scale effect into the
// monster-effect parser (or classify a Normal Pendulum as an Effect Monster).
export function parsePendulum(row) {
  if (!/Pendulum/.test(row.providerType || '')) return null;
  const text = String(row.description || '');
  const marker = /\[\s*Monster (?:Effect|Description)\s*\]/i.exec(text);
  const normal = /Pendulum Normal/.test(row.providerType);
  // Cards with no Pendulum effect (e.g. Majespecters) have only one text box
  // in this provider. An incomplete, explicitly delimited pair remains invalid.
  if (!marker && /\[\s*Pendulum Effect\s*\]/i.test(text)) throw new Error('Missing Pendulum monster text: ' + row.name);
  const scale = Number(row.pendulumScale);
  if (row.pendulumScale == null || !Number.isInteger(scale) || scale < 0 || scale > 13) {
    throw new Error('Invalid Pendulum scale: ' + row.name);
  }
  if (!marker) return {type: 'pendulum', scale, pendulumDescription: '', description: text.trim(), normal};
  const pendulumDescription = text.slice(0, marker.index)
    .replace(/^\s*\[\s*Pendulum Effect\s*\]\s*/i, '')
    .replace(/[-－─]{3,}/g, '').trim();
  const description = text.slice(marker.index + marker[0].length).trim();
  if (!pendulumDescription || !description) throw new Error('Empty Pendulum text box: ' + row.name);
  return {type: 'pendulum', scale, pendulumDescription, description, normal};
}
