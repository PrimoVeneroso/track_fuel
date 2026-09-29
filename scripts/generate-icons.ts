/**
 * Genera le icone PWA di FuelLog (192, 512, maskable 512) da un SVG
 * disegnato su misura. Uso solo in fase di build: nessuna dipendenza
 * aggiuntiva a runtime (sharp è già nel progetto).
 *   bun scripts/generate-icons.ts
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const OUT = path.join(process.cwd(), "public", "icons");

/** Icona: pompa di carburante stilizzata, tema dark + accento arancio. */
function iconSvg({ padding = 0, size = 512 }: { padding?: number; size?: number }): string {
  const inner = size - padding * 2;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#131a23"/>
      <stop offset="1" stop-color="#0a0e13"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffa765"/>
      <stop offset="1" stop-color="#ff8a3d"/>
    </linearGradient>
  </defs>
  <rect x="${padding}" y="${padding}" width="${inner}" height="${inner}" rx="${size * 0.22}" fill="url(#bg)"/>
  <rect x="${padding + inner * 0.06}" y="${padding + inner * 0.06}" width="${inner * 0.88}" height="${inner * 0.88}" rx="${inner * 0.19}" fill="none" stroke="#2b3a4c" stroke-width="${size * 0.012}"/>
  <g transform="translate(${padding}, ${padding}) scale(${inner / 512})">
    <!-- corpo pompa -->
    <rect x="140" y="96" width="200" height="290" rx="26" fill="url(#accent)"/>
    <!-- finestra pompa -->
    <rect x="170" y="128" width="140" height="120" rx="18" fill="#0a0e13"/>
    <!-- livello carburante nella finestra -->
    <rect x="170" y="176" width="140" height="72" rx="14" fill="#3ddc91" opacity="0.9"/>
    <circle cx="240" cy="166" r="10" fill="#ffa765"/>
    <!-- base -->
    <rect x="124" y="382" width="232" height="26" rx="13" fill="#e8721c"/>
    <!-- tubo flessibile -->
    <path d="M340 150 h34 a40 40 0 0 1 40 40 v140 a30 30 0 0 0 60 0 V226"
          fill="none" stroke="url(#accent)" stroke-width="26" stroke-linecap="round"/>
    <path d="M436 190 v36" stroke="#ffa765" stroke-width="26" stroke-linecap="round"/>
    <!-- gocce -->
    <path d="M96 250 c0 0 -26 34 -26 52 a26 26 0 0 0 52 0 c0 -18 -26 -52 -26 -52z" fill="#3ddc91" opacity="0.85"/>
  </g>
</svg>`;
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const jobs = [
    { file: "icon-192.png", size: 192, padding: 0 },
    { file: "icon-512.png", size: 512, padding: 0 },
    // maskable: contenuto entro il safe zone (badge/round), ~20% padding
    { file: "maskable-512.png", size: 512, padding: 56 },
  ];

  for (const job of jobs) {
    const svg = Buffer.from(iconSvg({ size: job.size, padding: job.padding }));
    await sharp(svg).png({ compressionLevel: 9 }).toFile(path.join(OUT, job.file));
    console.log(`✔ ${job.file}`);
  }
  console.log("Icone generate in public/icons/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
