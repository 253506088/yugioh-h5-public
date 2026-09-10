const fs = require('node:fs/promises');
const path = require('node:path');
let sharp;
try { sharp = require('sharp'); } catch { sharp = require(path.resolve(path.dirname(process.execPath), '../node_modules/sharp')); }
const root = path.resolve(__dirname, '..');
const names = ['blue-eyes', 'ultimate-dragon', 'dark-magician', 'dark-girl', 'kaibaman', 'luster-dragon', 'battle-ox', 'summoned-skull', 'kuriboh', 'stone-soldier', 'pot-of-greed', 'monster-reborn', 'raigeki', 'polymerization', 'swords', 'mirror-force', 'magic-cylinder', 'trap-hole', 'kaiba', 'yugi'];
(async () => {
  await fs.mkdir(path.join(root, 'output'), { recursive: true });
  const layers = [];
  for (let i = 0; i < names.length; i++) {
    const data = await sharp(path.join(root, 'assets/art', names[i] + '.svg')).resize(220, 220).png().toBuffer();
    layers.push({ input: data, left: (i % 5) * 236 + 8, top: Math.floor(i / 5) * 246 + 8 });
    const label = Buffer.from('<svg width="220" height="18"><text x="110" y="13" fill="#c9b079" font-size="11" font-family="Arial" text-anchor="middle">' + names[i] + '</text></svg>');
    layers.push({ input: label, left: (i % 5) * 236 + 8, top: Math.floor(i / 5) * 246 + 230 });
  }
  await sharp({ create: { width: 1180, height: 984, channels: 4, background: '#101d17' } }).composite(layers).png().toFile(path.join(root, 'output/art-contact-sheet.png'));
  console.log('Saved output/art-contact-sheet.png');
})().catch(e => { console.error(e); process.exitCode = 1; });
