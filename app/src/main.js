// Cover Studio's behaviour: the state, the controls, the photo, the
// dragging, and the exports. The rendering itself lives in render.js; this
// file only decides what to render and when.
//
// State is one plain object: which layout, grade and lettering are picked,
// the caption and subtitle text, the export size, and one crop (zoom and
// offsets) per panel. Every control writes to the state and asks for a
// re-render. Nothing is sent anywhere: the photo stays in the browser.

import { GRADES, gradeById } from './grades.js';
import { LAYOUTS, layoutById, panelRect, defaultCrops, shuffledCrops } from './layouts.js';
import { SIZES, renderPoster, exportBlob } from './render.js';

const $ = (id) => document.getElementById(id);

const state = {
  layoutId: 'hero-left',
  gradeId: 'sunset',
  letteringId: 'gradient',
  caption: 'SUNSET HEIST',
  subtitle: 'ONE LAST DRIVE',
  sizeId: 'square',
  crops: [],
  photoName: 'pier.jpg',
};

let photo = null;
let renderQueued = false;
let dragging = null;

const poster = $('poster');

/** Asks for a re-render on the next animation frame, at most once per frame. */
function requestRender(fast = false) {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    if (photo) renderPoster(poster, state, photo, fast);
  });
}

/** Builds a row of toggle buttons from a list of options. */
function buildToggles(container, options, current, onPick, chip) {
  container.innerHTML = '';
  options.forEach((opt) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'toggle' + (opt.id === current ? ' active' : '');
    b.textContent = opt.name;
    if (chip) {
      const dot = document.createElement('span');
      dot.className = 'chip';
      dot.style.background = chip(opt);
      b.prepend(dot);
    }
    b.addEventListener('click', () => {
      container.querySelectorAll('.toggle').forEach((t) => t.classList.remove('active'));
      b.classList.add('active');
      onPick(opt.id);
    });
    container.appendChild(b);
  });
}

function refreshControls() {
  buildToggles($('layout-pick'), LAYOUTS, state.layoutId, (id) => {
    state.layoutId = id;
    state.crops = defaultCrops(layoutById(id));
    requestRender();
  });
  buildToggles($('grade-pick'), GRADES, state.gradeId, (id) => {
    state.gradeId = id;
    requestRender();
  }, (g) => `linear-gradient(135deg, ${g.stops[1][1]}, ${g.stops[3][1]})`);
  buildToggles(
    $('lettering-pick'),
    [
      { id: 'gradient', name: 'Sunset Gradient' },
      { id: 'neon', name: 'Neon Glow' },
      { id: 'halftone', name: 'Halftone Dots' },
    ],
    state.letteringId,
    (id) => {
      state.letteringId = id;
      requestRender();
    },
  );
  buildToggles(
    $('size-pick'),
    Object.values(SIZES),
    state.sizeId,
    (id) => {
      state.sizeId = id;
      requestRender();
    },
  );
}

/** Loads a photo from a URL (a sample) or a data URL (an upload). */
function loadPhoto(src, name) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      photo = img;
      state.photoName = name;
      $('photo-name').textContent = name;
      requestRender();
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Could not load ${name}`));
    img.src = src;
  });
}

function loadSample(name) {
  return loadPhoto(`samples/${name}`, name);
}

/** A canvas point (client coordinates) as poster pixels. */
function toPosterCoords(clientX, clientY) {
  const rect = poster.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * poster.width,
    y: ((clientY - rect.top) / rect.height) * poster.height,
  };
}

/** Which panel, if any, holds this poster point, and its pixel rectangle. */
function panelAt(x, y) {
  const layout = layoutById(state.layoutId);
  for (let i = 0; i < layout.panels.length; i++) {
    const r = panelRect(layout, i, poster.width, poster.height);
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return { index: i, rect: r };
  }
  return null;
}

poster.addEventListener('pointerdown', (e) => {
  const p = toPosterCoords(e.clientX, e.clientY);
  const hit = panelAt(p.x, p.y);
  if (!hit || !photo) return;
  dragging = { index: hit.index, rect: hit.rect, lastX: p.x, lastY: p.y };
  poster.setPointerCapture(e.pointerId);
  poster.style.cursor = 'grabbing';
});

poster.addEventListener('pointermove', (e) => {
  if (!dragging || !photo) return;
  const p = toPosterCoords(e.clientX, e.clientY);
  const dx = p.x - dragging.lastX;
  const dy = p.y - dragging.lastY;
  dragging.lastX = p.x;
  dragging.lastY = p.y;
  const crop = state.crops[dragging.index];
  const r = dragging.rect;
  const scale = Math.max(r.w / photo.naturalWidth, r.h / photo.naturalHeight) * crop.zoom;
  const overflowX = Math.max(1, (photo.naturalWidth * scale - r.w) / 2);
  const overflowY = Math.max(1, (photo.naturalHeight * scale - r.h) / 2);
  crop.ox = Math.max(-1, Math.min(1, crop.ox - dx / overflowX));
  crop.oy = Math.max(-1, Math.min(1, crop.oy - dy / overflowY));
  requestRender(true);
});

function endDrag() {
  if (!dragging) return;
  dragging = null;
  poster.style.cursor = 'grab';
  requestRender();
}
poster.addEventListener('pointerup', endDrag);
poster.addEventListener('pointercancel', endDrag);

poster.addEventListener('wheel', (e) => {
  e.preventDefault();
  const p = toPosterCoords(e.clientX, e.clientY);
  const hit = panelAt(p.x, p.y);
  if (!hit || !photo) return;
  const crop = state.crops[hit.index];
  crop.zoom = Math.max(1, Math.min(2.5, crop.zoom * Math.exp(-e.deltaY * 0.0012)));
  requestRender();
}, { passive: false });

$('photo-file').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => loadPhoto(reader.result, file.name).catch(() => {
    $('photo-name').textContent = 'That file could not be read as a photo.';
  });
  reader.readAsDataURL(file);
});

$('sample-pier').addEventListener('click', () => loadSample('pier.jpg'));
$('sample-boulevard').addEventListener('click', () => loadSample('boulevard.jpg'));

$('caption-input').addEventListener('input', (e) => {
  state.caption = e.target.value;
  requestRender();
});
$('subtitle-input').addEventListener('input', (e) => {
  state.subtitle = e.target.value;
  requestRender();
});

$('shuffle-crops').addEventListener('click', () => {
  state.crops = shuffledCrops(layoutById(state.layoutId));
  requestRender();
});
$('reset-crops').addEventListener('click', () => {
  state.crops = defaultCrops(layoutById(state.layoutId));
  requestRender();
});

document.querySelectorAll('[data-export]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const sizeId = btn.getAttribute('data-export');
    const blob = await exportBlob(state, photo, sizeId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cover-${sizeId}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  });
});

/**
 * A small handle for automated captures: the screenshot script drives the
 * app through this instead of clicking around. Everything it calls is a
 * real user action the app already offers.
 */
window.__coverStudio = {
  state,
  ready: null,
  setPhoto: (name) => loadSample(name),
  setCaption: (text) => {
    state.caption = text;
    $('caption-input').value = text;
    requestRender();
  },
  setSubtitle: (text) => {
    state.subtitle = text;
    $('subtitle-input').value = text;
    requestRender();
  },
  setLayout: (id) => {
    state.layoutId = id;
    state.crops = defaultCrops(layoutById(id));
    refreshControls();
    requestRender();
  },
  setGrade: (id) => {
    state.gradeId = id;
    refreshControls();
    requestRender();
  },
  setLettering: (id) => {
    state.letteringId = id;
    refreshControls();
    requestRender();
  },
  setSize: (id) => {
    state.sizeId = id;
    refreshControls();
    requestRender();
  },
  exportDataURL: async (sizeId) => {
    const blob = await exportBlob(state, photo, sizeId);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  },
};

// Boot: build the controls, wait for the display font, load the first
// sample photo, and render. The font must be ready before the first render
// or the caption would fall back to a plain sans.
state.crops = defaultCrops(layoutById(state.layoutId));
refreshControls();
window.__coverStudio.ready = (async () => {
  try {
    await document.fonts.load('900 100px "CoverDisplay"');
    await document.fonts.ready;
  } catch (_) {
    // A missing font falls back to the system sans; the app still works.
  }
  await loadSample('pier.jpg');
})();
