import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT_DIR = process.cwd();

// Posibles rutas del logo original
const LOGO_CANDIDATES = [
  path.join(ROOT_DIR, 'logo_ddanez_transparente.png'),
  path.join(ROOT_DIR, 'public', 'logo_ddanez_transparente.png'),
  path.join(ROOT_DIR, 'public', 'logo.png'),
  path.join(ROOT_DIR, 'src', 'assets', 'images', 'ddanez_logo_1789765141084.jpg')
];

let sourceLogo = null;
for (const cand of LOGO_CANDIDATES) {
  if (fs.existsSync(cand)) {
    sourceLogo = cand;
    break;
  }
}

if (!sourceLogo) {
  console.error("❌ No se encontró ningún archivo de logo para generar los iconos.");
  process.exit(1);
}

console.log(`✨ Usando logo fuente: ${sourceLogo}`);

// Asegurar carpeta public y copiar logo ahí
const publicDir = path.join(ROOT_DIR, 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

const targetPublicLogo = path.join(publicDir, 'logo.png');
const targetPublicLogoTransparent = path.join(publicDir, 'logo_ddanez_transparente.png');

try {
  execSync(`convert "${sourceLogo}" -fuzz 10% -transparent white -resize 512x512 "${targetPublicLogo}"`);
  fs.copyFileSync(targetPublicLogo, targetPublicLogoTransparent);
  console.log(`✅ Copiado a public/logo.png y public/logo_ddanez_transparente.png`);
} catch (err) {
  console.warn("Aviso al convertir con ImageMagick para public:", err.message);
  if (sourceLogo !== targetPublicLogo) {
    fs.copyFileSync(sourceLogo, targetPublicLogo);
  }
}

// Generar favicon e icono web
try {
  execSync(`convert "${targetPublicLogo}" -resize 64x64 "${path.join(publicDir, 'favicon.ico')}"`);
  execSync(`convert "${targetPublicLogo}" -resize 192x192 "${path.join(publicDir, 'icon-192.png')}"`);
  execSync(`convert "${targetPublicLogo}" -resize 512x512 "${path.join(publicDir, 'icon-512.png')}"`);
  console.log(`✅ Favicon e iconos PWA generados`);
} catch (e) {
  console.warn("Aviso al generar favicons:", e.message);
}

const RES_DIR = path.join(ROOT_DIR, 'android', 'app', 'src', 'main', 'res');

if (!fs.existsSync(RES_DIR)) {
  console.log("ℹ️ Directorio android no existe todavía, omitiendo generación de mipmaps nativos.");
  process.exit(0);
}

const MIPMAP_CONFIG = [
  { dir: 'mipmap-mdpi', iconSize: 48, fgCanvas: 108, fgIcon: 76 },
  { dir: 'mipmap-hdpi', iconSize: 72, fgCanvas: 162, fgIcon: 114 },
  { dir: 'mipmap-xhdpi', iconSize: 96, fgCanvas: 216, fgIcon: 152 },
  { dir: 'mipmap-xxhdpi', iconSize: 144, fgCanvas: 324, fgIcon: 228 },
  { dir: 'mipmap-xxxhdpi', iconSize: 192, fgCanvas: 432, fgIcon: 304 }
];

console.log("📱 Generando iconos Mipmap de Android...");
for (const conf of MIPMAP_CONFIG) {
  const folder = path.join(RES_DIR, conf.dir);
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

  // 1. Icono normal y redondo
  execSync(`convert "${targetPublicLogo}" -resize ${conf.iconSize}x${conf.iconSize} "${path.join(folder, 'ic_launcher.png')}"`);
  execSync(`convert "${targetPublicLogo}" -resize ${conf.iconSize}x${conf.iconSize} "${path.join(folder, 'ic_launcher_round.png')}"`);

  // 2. Icono adaptativo foreground (centrado en lienzo transparente con zona segura)
  execSync(`convert "${targetPublicLogo}" -resize ${conf.fgIcon}x${conf.fgIcon} -background none -gravity center -extent ${conf.fgCanvas}x${conf.fgCanvas} "${path.join(folder, 'ic_launcher_foreground.png')}"`);

  console.log(`  ✓ ${conf.dir} completado (${conf.iconSize}px / fg: ${conf.fgCanvas}px)`);
}

// Splash screens
const SPLASH_CONFIG = [
  { folder: 'drawable', w: 480, h: 320, logoSize: 160 },
  { folder: 'drawable-port-mdpi', w: 320, h: 480, logoSize: 160 },
  { folder: 'drawable-port-hdpi', w: 480, h: 800, logoSize: 220 },
  { folder: 'drawable-port-xhdpi', w: 720, h: 1280, logoSize: 320 },
  { folder: 'drawable-port-xxhdpi', w: 960, h: 1600, logoSize: 420 },
  { folder: 'drawable-port-xxxhdpi', w: 1280, h: 1920, logoSize: 520 },
  { folder: 'drawable-land-mdpi', w: 480, h: 320, logoSize: 160 },
  { folder: 'drawable-land-hdpi', w: 800, h: 480, logoSize: 220 },
  { folder: 'drawable-land-xhdpi', w: 1280, h: 720, logoSize: 300 },
  { folder: 'drawable-land-xxhdpi', w: 1600, h: 960, logoSize: 400 },
  { folder: 'drawable-land-xxxhdpi', w: 1920, h: 1280, logoSize: 500 }
];

console.log("🎨 Generando pantallas Splash para Android...");
for (const s of SPLASH_CONFIG) {
  const folder = path.join(RES_DIR, s.folder);
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

  const splashOut = path.join(folder, 'splash.png');
  // Fondo blanco puro con el logo D'Danez nítido en el centro
  execSync(`convert "${targetPublicLogo}" -resize ${s.logoSize}x${s.logoSize} -background "#FFFFFF" -gravity center -extent ${s.w}x${s.h} "${splashOut}"`);
}

console.log("🎉 ¡Todos los iconos y splash de D'Danez han sido generados exitosamente!");
