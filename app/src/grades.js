// Colour grades for Cover Studio. Each grade is a gradient map: a photo's
// brightness is remapped through the grade's colour stops, so the same photo
// can feel like a warm sunset, a neon night, or a faded postcard. A grade is
// just data — a name, a short description, and a list of stops. A stop is a
// position from 0 (shadows) to 1 (highlights) with a hex colour. The renderer
// turns the stops into a 256-entry lookup table and applies it per pixel.

export const GRADES = [
  {
    id: 'sunset',
    name: 'Sunset',
    blurb: 'Warm dusk — deep purple shadows, hot orange midtones.',
    stops: [
      [0.0, '#160a24'],
      [0.3, '#6d28a8'],
      [0.55, '#db2777'],
      [0.78, '#f97316'],
      [1.0, '#fde68a'],
    ],
  },
  {
    id: 'neon',
    name: 'Neon Night',
    blurb: 'Late-night glow — indigo darks, cyan and magenta brights.',
    stops: [
      [0.0, '#030014'],
      [0.3, '#1e1b4b'],
      [0.55, '#0891b2'],
      [0.78, '#d946ef'],
      [1.0, '#fef9c3'],
    ],
  },
  {
    id: 'vice',
    name: 'Vice Pastel',
    blurb: 'Soft pastel haze — lilac, pink and pale gold.',
    stops: [
      [0.0, '#1e1b4b'],
      [0.35, '#7c3aed'],
      [0.6, '#e879f9'],
      [0.82, '#fda4af'],
      [1.0, '#fef3c7'],
    ],
  },
  {
    id: 'gold',
    name: 'Gold Rush',
    blurb: 'Amber hour — honeyed gold over dark bronze shadows.',
    stops: [
      [0.0, '#1c1005'],
      [0.3, '#451a03'],
      [0.58, '#b45309'],
      [0.8, '#f59e0b'],
      [1.0, '#fef08a'],
    ],
  },
  {
    id: 'ink',
    name: 'Mono Ink',
    blurb: 'High-contrast black and white with a warm paper highlight.',
    stops: [
      [0.0, '#000000'],
      [0.35, '#1f2937'],
      [0.65, '#6b7280'],
      [0.85, '#d1d5db'],
      [1.0, '#fafaf9'],
    ],
  },
];

/** A hex colour (#rrggbb) as [r, g, b] numbers. */
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * A grade's stops as a 256-entry lookup table: table[i] is the [r, g, b]
 * colour a pixel of brightness i/255 maps to. Stops are blended linearly.
 */
export function gradeTable(grade) {
  const table = new Uint8Array(256 * 3);
  const stops = grade.stops.map(([pos, hex]) => [pos, hexToRgb(hex)]);
  let seg = 0;
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    while (seg < stops.length - 2 && t > stops[seg + 1][0]) seg++;
    const [p0, c0] = stops[seg];
    const [p1, c1] = stops[seg + 1];
    const f = p1 === p0 ? 0 : Math.min(1, Math.max(0, (t - p0) / (p1 - p0)));
    table[i * 3] = Math.round(c0[0] + (c1[0] - c0[0]) * f);
    table[i * 3 + 1] = Math.round(c0[1] + (c1[1] - c0[1]) * f);
    table[i * 3 + 2] = Math.round(c0[2] + (c1[2] - c0[2]) * f);
  }
  return table;
}

/** The grade with this id, or the first grade when the id is unknown. */
export function gradeById(id) {
  return GRADES.find((g) => g.id === id) || GRADES[0];
}
