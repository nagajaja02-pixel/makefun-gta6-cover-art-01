// Poster rendering for Cover Studio. Everything the poster shows is drawn
// here, on a plain 2D canvas, in this order: the photo in each panel, the
// colour grade over the whole poster, a little film grain and a vignette,
// then the caption and the small brand mark on top. The same function draws
// the live preview and the exported PNG — the preview canvas simply is the
// export canvas, shown scaled down — so what you see is what you get.
//
// The photo never leaves the machine: it is drawn from an <img> element
// that was filled from a local file or from one of the bundled samples.

import { gradeTable, gradeById } from './grades.js';
import { layoutById, panelRect } from './layouts.js';

/** The three post sizes an export can be: square, tall portrait, wide. */
export const SIZES = {
  square: { id: 'square', name: 'Square post', w: 1080, h: 1080 },
  portrait: { id: 'portrait', name: 'Story post', w: 1080, h: 1350 },
  wide: { id: 'wide', name: 'Wide post', w: 1920, h: 1080 },
};

/** A small deterministic random generator, so grain never flickers. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let noisePattern = null;
/** A tileable grey-noise pattern, built once, for the film grain. */
function grainPattern(ctx) {
  if (noisePattern) return noisePattern;
  const tile = document.createElement('canvas');
  tile.width = 160;
  tile.height = 160;
  const tctx = tile.getContext('2d');
  const img = tctx.createImageData(160, 160);
  const rnd = mulberry32(20261119);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rnd() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 28;
  }
  tctx.putImageData(img, 0, 0);
  noisePattern = ctx.createPattern(tile, 'repeat');
  return noisePattern;
}

/**
 * Draws the photo into one panel, covering it completely. The crop's zoom
 * zooms into the photo and its offsets slide it around, so each panel can
 * frame a different part of the same photo.
 */
function drawPanelPhoto(ctx, photo, rect, crop) {
  const scale = Math.max(rect.w / photo.naturalWidth, rect.h / photo.naturalHeight) * crop.zoom;
  const dw = photo.naturalWidth * scale;
  const dh = photo.naturalHeight * scale;
  const overflowX = Math.max(0, (dw - rect.w) / 2);
  const overflowY = Math.max(0, (dh - rect.h) / 2);
  const dx = rect.x + (rect.w - dw) / 2 - crop.ox * overflowX;
  const dy = rect.y + (rect.h - dh) / 2 - crop.oy * overflowY;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.drawImage(photo, dx, dy, dw, dh);
  ctx.restore();
}

/**
 * The colour grade: every pixel's brightness is remapped through the
 * grade's lookup table. A dark poster background (the gaps between panels)
 * is nearly black, so grading it changes almost nothing.
 */
function applyGrade(ctx, width, height, grade) {
  const table = gradeTable(grade);
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
    d[i] = table[lum * 3];
    d[i + 1] = table[lum * 3 + 1];
    d[i + 2] = table[lum * 3 + 2];
  }
  ctx.putImageData(img, 0, 0);
}

/** A soft darkening towards the poster's edges, for a printed-poster feel. */
function applyVignette(ctx, width, height) {
  const r = Math.hypot(width, height) / 2;
  const g = ctx.createRadialGradient(width / 2, height / 2, r * 0.45, width / 2, height / 2, r);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
}

/**
 * The caption across the bottom of the poster, tilted a few degrees like a
 * hand-placed title. The lettering style decides how the letters are
 * filled: a warm gradient, a neon glow, or a halftone dot pattern. Every
 * style gets the same thick dark outline so the title reads on any photo.
 */
function drawCaption(ctx, width, height, caption, subtitle, lettering) {
  const cap = (caption || '').trim().toUpperCase();
  const sub = (subtitle || '').trim().toUpperCase();
  if (!cap && !sub) return;
  const cx = width * 0.06;
  const baseY = height * 0.9;
  ctx.save();
  ctx.translate(cx, baseY);
  ctx.rotate((-3 * Math.PI) / 180);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  // The title shrinks until it fits the poster, so a long caption never
  // runs off the edge — it just gets smaller.
  let capSize = Math.round(width * 0.125);
  const capFont = (s) => `900 ${s}px "CoverDisplay", "Arial Narrow", sans-serif`;
  if (cap) {
    ctx.font = capFont(capSize);
    while (ctx.measureText(cap).width > width * 0.92 && capSize > 24) {
      capSize = Math.round(capSize * 0.9);
      ctx.font = capFont(capSize);
    }
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(4, capSize * 0.09);
    ctx.strokeStyle = 'rgba(10, 8, 16, 0.92)';
    ctx.strokeText(cap, 0, 0);
    if (lettering === 'neon') {
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = capSize * 0.35;
      ctx.fillStyle = '#f0fdff';
      ctx.fillText(cap, 0, 0);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(165, 243, 252, 0.85)';
      ctx.fillText(cap, 0, 0);
    } else if (lettering === 'halftone') {
      const dot = document.createElement('canvas');
      dot.width = 14;
      dot.height = 14;
      const dctx = dot.getContext('2d');
      dctx.fillStyle = '#0b0b12';
      dctx.fillRect(0, 0, 14, 14);
      dctx.fillStyle = '#fde68a';
      dctx.beginPath();
      dctx.arc(7, 7, 4.2, 0, Math.PI * 2);
      dctx.fill();
      ctx.fillStyle = ctx.createPattern(dot, 'repeat');
      ctx.fillText(cap, 0, 0);
    } else {
      const grad = ctx.createLinearGradient(0, -capSize, 0, capSize * 0.15);
      grad.addColorStop(0, '#fde68a');
      grad.addColorStop(0.45, '#fb923c');
      grad.addColorStop(1, '#e11d48');
      ctx.fillStyle = grad;
      ctx.fillText(cap, 0, 0);
    }
  }
  if (sub) {
    const subSize = Math.round(width * 0.032);
    ctx.font = `700 ${subSize}px "CoverDisplay", "Arial Narrow", sans-serif`;
    ctx.lineWidth = Math.max(3, subSize * 0.14);
    ctx.strokeStyle = 'rgba(10, 8, 16, 0.9)';
    const y = cap ? capSize * 0.42 : 0;
    ctx.strokeText(sub, 4, y);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(sub, 4, y);
  }
  ctx.restore();
}

/**
 * Draws the whole poster onto a canvas of the given size. `state` carries
 * the layout, grade, lettering, caption, subtitle and the per-panel crops.
 * With `fast` true the grade pass is skipped, which keeps dragging smooth;
 * the full render always runs on release and on export.
 */
export function renderPoster(canvas, state, photo, fast = false) {
  const size = SIZES[state.sizeId] || SIZES.square;
  const width = size.w;
  const height = size.h;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d');
  const layout = layoutById(state.layoutId);
  ctx.fillStyle = '#0b0b12';
  ctx.fillRect(0, 0, width, height);
  if (photo && photo.naturalWidth > 0) {
    layout.panels.forEach((_, i) => {
      const rect = panelRect(layout, i, width, height);
      const crop = state.crops[i] || { zoom: 1, ox: 0, oy: 0 };
      drawPanelPhoto(ctx, photo, rect, crop);
    });
  } else {
    ctx.fillStyle = '#1e1b2e';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#8b8b9e';
    ctx.font = `600 ${Math.round(width * 0.03)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Load a photo to begin', width / 2, height / 2);
  }
  if (!fast) {
    applyGrade(ctx, width, height, gradeById(state.gradeId));
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = grainPattern(ctx);
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
    applyVignette(ctx, width, height);
  }
  const band = ctx.createLinearGradient(0, height * 0.72, 0, height);
  band.addColorStop(0, 'rgba(5, 4, 12, 0)');
  band.addColorStop(1, 'rgba(5, 4, 12, 0.55)');
  ctx.fillStyle = band;
  ctx.fillRect(0, height * 0.72, width, height * 0.28);
  drawCaption(ctx, width, height, state.caption, state.subtitle, state.letteringId);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `700 ${Math.round(width * 0.02)}px "CoverDisplay", "Arial Narrow", sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText('C O V E R   S T U D I O', Math.round(width * 0.03), Math.round(height * 0.045));
  return canvas;
}

/**
 * The finished poster as a PNG blob, rendered fresh at the requested size.
 * Used by the export buttons and by the screenshot captures.
 */
export function exportBlob(state, photo, sizeId) {
  const canvas = document.createElement('canvas');
  renderPoster(canvas, { ...state, sizeId }, photo, false);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
