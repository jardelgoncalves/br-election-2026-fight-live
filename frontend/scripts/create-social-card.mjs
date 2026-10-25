import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const frontendDirectory = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDirectory = join(frontendDirectory, 'public');
const outputDirectory = join(publicDirectory, 'assets', 'social');

const background = await sharp(join(publicDirectory, 'assets', 'backgrounds', 'congresso-floresta-incendio-v1.png'))
  .resize(1200, 630, { fit: 'cover', position: 'centre' })
  .modulate({ brightness: 0.62, saturation: 0.88 })
  .png()
  .toBuffer();

const lula = await sharp(join(publicDirectory, 'assets', 'fighters', 'lula', 'idle.png'))
  .resize({ height: 460 })
  .png()
  .toBuffer({ resolveWithObject: true });

const flavio = await sharp(join(publicDirectory, 'assets', 'fighters', 'flavio', 'idle.png'))
  .resize({ height: 460 })
  .png()
  .toBuffer({ resolveWithObject: true });

const lighting = Buffer.from(`
  <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#05070d" stop-opacity="0.72"/>
        <stop offset="0.28" stop-color="#05070d" stop-opacity="0.08"/>
        <stop offset="0.72" stop-color="#05070d" stop-opacity="0.08"/>
        <stop offset="1" stop-color="#05070d" stop-opacity="0.88"/>
      </linearGradient>
      <radialGradient id="focus" cx="50%" cy="48%" r="68%">
        <stop offset="0.3" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity="0.42"/>
      </radialGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#shade)"/>
    <rect width="1200" height="630" fill="url(#focus)"/>
  </svg>
`);

const typography = Buffer.from(`
  <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <style>
      .mono { font-family: 'Courier New', monospace; font-weight: 700; }
    </style>
    <text x="600" y="46" text-anchor="middle" class="mono" font-size="16" letter-spacing="6" fill="#fcd34d">BRASIL 2026</text>
    <text x="600" y="104" text-anchor="middle" class="mono" font-size="54" letter-spacing="-3" fill="#ffffff">
      <tspan>APURAÇÃO </tspan><tspan fill="#fcd34d" font-style="italic">FIGHT</tspan>
    </text>
    <text x="600" y="138" text-anchor="middle" class="mono" font-size="15" letter-spacing="4" fill="#d1d5db">A ELEIÇÃO EM UMA BATALHA AO VIVO</text>
    <rect x="546" y="276" width="108" height="70" rx="4" fill="#070910" fill-opacity="0.76" stroke="#fcd34d" stroke-width="2"/>
    <text x="600" y="325" text-anchor="middle" class="mono" font-size="41" fill="#fcd34d">VS</text>
    <rect x="0" y="570" width="1200" height="60" fill="#05070d" fill-opacity="0.86"/>
    <text x="600" y="607" text-anchor="middle" class="mono" font-size="15" letter-spacing="3" fill="#e5e7eb">DADOS OFICIAIS DO TRIBUNAL SUPERIOR ELEITORAL</text>
  </svg>
`);

await mkdir(outputDirectory, { recursive: true });
await sharp(background)
  .composite([
    { input: lighting },
    { input: lula.data, left: 82, top: 164 },
    { input: flavio.data, left: 1200 - 82 - flavio.info.width, top: 164 },
    { input: typography },
  ])
  .png({ compressionLevel: 9, palette: true, quality: 92 })
  .toFile(join(outputDirectory, 'og-apuracao-fight.png'));

console.log('Imagem social criada em public/assets/social/og-apuracao-fight.png');
