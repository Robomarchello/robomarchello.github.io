/**
 * Colour palette system — the single source of truth for site theming.
 *
 * This module is imported by the browser *and* by build.js (to inline the
 * pre-paint bootstrap snippet into every page), so everything above
 * `applyPalette` must stay free of DOM access at module scope.
 */

export const STORAGE_KEY = 'portfolio_palette_index';

export const PALETTES = [
  { name: 'Sky Blue', bg: '#E0F2FE', cardBg: '#FFFFFF', textMain: '#0F172A', textMuted: '#475569', accent: '#0284C7', accentHover: '#0369A1' },
  { name: 'Lavender Purple', bg: '#d7c0f7', cardBg: '#ffffff', textMain: '#14151a', textMuted: '#3c2f32', accent: '#2b26f5', accentHover: '#1e14bd' },
  // new — from #e069ff
  { name: 'Orchid Violet', bg: '#F5DFFF', cardBg: '#FFFFFF', textMain: '#2B1233', textMuted: '#6B4877', accent: '#A729D6', accentHover: '#7E1EA3' },
  // new — from #696dff
  { name: 'Periwinkle Indigo', bg: '#E6E7FF', cardBg: '#FFFFFF', textMain: '#14162E', textMuted: '#4B4E80', accent: '#4347D1', accentHover: '#2F32A0' },
  // new — from #89d65c + #52b788
  { name: 'Meadow Green', bg: '#EAF7DE', cardBg: '#FFFFFF', textMain: '#142B0A', textMuted: '#3F6B2A', accent: '#24793A', accentHover: '#1A5C2B' },
  // new — from #F2A900
  { name: 'Amber Gold', bg: '#FFF3D6', cardBg: '#FFFFFF', textMain: '#2E2100', textMuted: '#6B5A2E', accent: '#8F5F00', accentHover: '#6B4700' },
];

/** Background of the dark (posts) pages. */

export const DARK_BG = '#141b25';

function hexToRgb(colorHex) {
  let hex = String(colorHex || '').replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  return {
    r: parseInt(hex.substring(0, 2), 16) / 255,
    g: parseInt(hex.substring(2, 4), 16) / 255,
    b: parseInt(hex.substring(4, 6), 16) / 255
  };
}

function hueToRgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

/**
 * Lifts an accent colour until it reads clearly on the dark background,
 * without shifting its hue.
 */
export function getReadableDarkAccent(colorHex) {
  if (!colorHex || typeof colorHex !== 'string') return '#38BDF8';

  const { r, g, b } = hexToRgb(colorHex);
  if ([r, g, b].some(Number.isNaN)) return '#38BDF8';

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }

  const channel = c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

  if (luminance < 0.24) {
    const isBlueIndigo = h >= 0.56 && h <= 0.76;
    l = Math.max(l, isBlueIndigo ? 0.72 : 0.56);
    s = Math.max(s, 0.65);
  }

  let outR;
  let outG;
  let outB;
  if (s === 0) {
    outR = outG = outB = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    outR = hueToRgb(p, q, h + 1 / 3);
    outG = hueToRgb(p, q, h);
    outB = hueToRgb(p, q, h - 1 / 3);
  }

  const toHex = x => Math.round(Math.min(255, Math.max(0, x * 255))).toString(16).padStart(2, '0');
  return `#${toHex(outR)}${toHex(outG)}${toHex(outB)}`;
}

export function readPaletteIndex() {
  try {
    const parsed = parseInt(localStorage.getItem(STORAGE_KEY), 10);
    if (!Number.isNaN(parsed) && parsed >= 0 && parsed < PALETTES.length) return parsed;
  } catch (e) {
    /* localStorage unavailable (private mode / sandbox) */
  }
  return 0;
}

let currentIndex = 0;

export function applyPalette(theme) {
  const root = document.documentElement.style;
  root.setProperty('--bg-color', theme.bg);
  root.setProperty('--card-bg', theme.cardBg);
  root.setProperty('--text-main', theme.textMain);
  root.setProperty('--text-muted', theme.textMuted);
  root.setProperty('--accent-color', theme.accent);
  root.setProperty('--accent-hover', theme.accentHover);

  document.documentElement.style.backgroundColor = theme.bg;

  const readableAccent = getReadableDarkAccent(theme.accent);
  const readableHover = getReadableDarkAccent(theme.accentHover);
  root.setProperty('--posts-accent', readableAccent);
  root.setProperty('--posts-accent-hover', readableHover);
  root.setProperty('--accent-readable-dark', readableAccent);
  root.setProperty('--accent-readable-dark-hover', readableHover);
}

export function initPalette() {
  currentIndex = readPaletteIndex();
  applyPalette(PALETTES[currentIndex]);
}

export function cyclePalette() {
  currentIndex = (currentIndex + 1) % PALETTES.length;
  applyPalette(PALETTES[currentIndex]);
  try {
    localStorage.setItem(STORAGE_KEY, String(currentIndex));
  } catch (e) {
    /* ignore */
  }
}

/** Wires the navbar palette button on whichever page is current. */
export function initPaletteButton() {
  const button = document.getElementById('palette-toggle-btn');
  if (button) button.addEventListener('click', cyclePalette);
}
