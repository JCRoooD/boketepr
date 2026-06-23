// Generate PWA icons from SVG sources into public/icons/.
// Run once: `node scripts/generate-pwa-icons.mjs`
//
// Produces:
//   public/icons/icon-192.png      (192x192, rounded square)
//   public/icons/icon-512.png      (512x512, rounded square)
//   public/icons/icon-maskable.png (512x512, full-bleed, glyph in safe zone)
//   public/icons/apple-touch-icon.png (180x180, for iOS Add to Home Screen)
//
// The "rounded square" 192/512 are the standard PWA icons Chrome shows in the
// install dialog. The maskable variant is what Android shows when the launcher
// masks the icon (circle, squircle, etc.). Apple-touch-icon is what iOS Safari
// uses when you tap Share > Add to Home Screen.

import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const outDir = resolve(root, "public", "icons");

const sources = {
  "icon-source.svg": "icon-192.png",
  "icon-source.svg": "icon-512.png",
  "icon-maskable.svg": "icon-maskable.png",
};

const sizes = [
  { src: "icon-source.svg", file: "icon-192.png", size: 192 },
  { src: "icon-source.svg", file: "icon-512.png", size: 512 },
  { src: "icon-maskable.svg", file: "icon-maskable.png", size: 512 },
];

await mkdir(outDir, { recursive: true });

for (const { src, file, size } of sizes) {
  const svg = await readFile(resolve(here, src));
  const png = await sharp(svg, { density: 384 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(resolve(outDir, file), png);
  console.log(`wrote ${file} (${size}x${size}, ${png.length} bytes)`);
}

// Apple touch icon — iOS ignores the rounded corners, so we ship a flat 180x180.
const appleSvg = await readFile(resolve(here, "icon-source.svg"));
const applePng = await sharp(appleSvg, { density: 384 })
  .resize(180, 180, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toBuffer();
await writeFile(resolve(outDir, "apple-touch-icon.png"), applePng);
console.log(`wrote apple-touch-icon.png (180x180, ${applePng.length} bytes)`);

// Favicon — 32x32 PNG for the browser tab. Use the rounded square source.
const faviconSvg = await readFile(resolve(here, "icon-source.svg"));
const faviconPng = await sharp(faviconSvg, { density: 384 })
  .resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toBuffer();
await writeFile(resolve(root, "app", "favicon.ico"), faviconPng);
console.log(`wrote app/favicon.ico (32x32 placeholder, ${faviconPng.length} bytes)`);

console.log("\nDone. Icons in public/icons/, favicon in app/favicon.ico.");