// Panel layouts for Cover Studio. A layout is a set of panels that tile the
// poster. Each panel is a rectangle given as fractions of the poster's width
// and height: [x, y, width, height], all between 0 and 1. A small gap is left
// between panels so the grid reads as separate frames. Every layout works at
// any of the three post sizes because it is all fractions — the renderer
// multiplies by the poster's real pixel size.
//
// The same photo fills every panel, but each panel frames it differently:
// the panel's crop (a zoom and an offset) decides which part of the photo
// shows. That is what makes one photo feel like a multi-shot poster.

export const LAYOUTS = [
  {
    id: 'hero-left',
    name: 'Hero Left',
    blurb: 'One big frame left, two stacked frames right.',
    panels: [
      [0, 0, 0.62, 1],
      [0.632, 0, 0.368, 0.494],
      [0.632, 0.506, 0.368, 0.494],
    ],
  },
  {
    id: 'hero-top',
    name: 'Hero Top',
    blurb: 'One wide frame on top, two frames below it.',
    panels: [
      [0, 0, 1, 0.6],
      [0, 0.612, 0.494, 0.388],
      [0.506, 0.612, 0.494, 0.388],
    ],
  },
  {
    id: 'triple',
    name: 'Triple',
    blurb: 'Three tall frames side by side.',
    panels: [
      [0, 0, 0.3253, 1],
      [0.3373, 0, 0.3253, 1],
      [0.6747, 0, 0.3253, 1],
    ],
  },
  {
    id: 'quad',
    name: 'Quad',
    blurb: 'Four frames in a two-by-two grid.',
    panels: [
      [0, 0, 0.494, 0.494],
      [0.506, 0, 0.494, 0.494],
      [0, 0.506, 0.494, 0.494],
      [0.506, 0.506, 0.494, 0.494],
    ],
  },
  {
    id: 'five',
    name: 'Five Frame',
    blurb: 'One tall hero frame with four small frames beside it.',
    panels: [
      [0, 0, 0.5, 1],
      [0.512, 0, 0.238, 0.494],
      [0.762, 0, 0.238, 0.494],
      [0.512, 0.506, 0.238, 0.494],
      [0.762, 0.506, 0.238, 0.494],
    ],
  },
];

/** The layout with this id, or the first layout when the id is unknown. */
export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) || LAYOUTS[0];
}

/**
 * A panel's rectangle in pixels for a poster of this size. The layout
 * fractions already leave the gap between panels, so this is a plain scale.
 */
export function panelRect(layout, index, width, height) {
  const [fx, fy, fw, fh] = layout.panels[index];
  return {
    x: Math.round(fx * width),
    y: Math.round(fy * height),
    w: Math.round(fw * width),
    h: Math.round(fh * height),
  };
}

/**
 * A fresh set of crops for a layout: one crop per panel. A crop is a zoom
 * (1 means the photo just covers the panel, larger zooms in) and an offset
 * in each axis from -1 to 1, which slides the photo inside the panel. The
 * defaults frame the photo's centre in the first panel and drift outward
 * for the rest, so the poster feels varied without any work.
 */
export function defaultCrops(layout) {
  const drifts = [
    [0, 0],
    [-0.35, -0.2],
    [0.35, 0.2],
    [-0.2, 0.35],
    [0.3, -0.35],
  ];
  return layout.panels.map((_, i) => ({
    zoom: 1 + (i % 3) * 0.18,
    ox: drifts[i % drifts.length][0],
    oy: drifts[i % drifts.length][1],
  }));
}

/** The same crops with a new random drift per panel, for the shuffle button. */
export function shuffledCrops(layout) {
  return layout.panels.map(() => ({
    zoom: 1 + Math.random() * 0.9,
    ox: Math.random() * 1.4 - 0.7,
    oy: Math.random() * 1.4 - 0.7,
  }));
}
