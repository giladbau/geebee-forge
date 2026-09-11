// Canonical shape outline generators.
// Each returns an array of points in a 100x100 unit canvas, centered roughly within [0,100]x[0,100].
// Points are sampled counter-clockwise or in a natural stroke order; stroke breaks are not represented here.

export const SHAPE_NAMES = [
  'triangle',
  'square',
  'heart',
  'star',
  'pentagon',
  'hexagon',
  'cross',
  'trapezoid',
  'arrow',
];

function polygon(corners) {
  return corners;
}

function samplePolyline(points, count) {
  // Resample a piecewise-linear path to `count` roughly equidistant points.
  if (points.length < 2) return points.slice();
  const total = points.reduce((sum, p, i) => {
    if (i === 0) return 0;
    const dx = p[0] - points[i - 1][0];
    const dy = p[1] - points[i - 1][1];
    return sum + Math.hypot(dx, dy);
  }, 0);
  if (total === 0) return points.slice(0, 1);
  const step = total / (count - 1);
  const out = [points[0].slice()];
  let dist = 0;
  let next = step;
  for (let i = 1; i < points.length && out.length < count; i++) {
    const a = points[i - 1];
    const b = points[i];
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (out.length < count && next <= dist + seg + 1e-6) {
      const t = (next - dist) / (seg || 1);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      next += step;
    }
    dist += seg;
  }
  while (out.length < count) out.push(points[points.length - 1].slice());
  return out;
}

function rot(points, angleDeg, cx = 50, cy = 50) {
  const r = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return points.map(([x, y]) => [
    cx + (x - cx) * cos - (y - cy) * sin,
    cy + (y - cy) * cos + (x - cx) * sin,
  ]);
}

// Triangle pointing up.
function triangle(count = 32) {
  return samplePolyline(
    polygon([
      [50, 7],
      [94, 90],
      [6, 90],
      [50, 7],
    ]),
    count,
  );
}

function square(count = 32) {
  return samplePolyline(
    polygon([
      [10, 10],
      [90, 10],
      [90, 90],
      [10, 90],
      [10, 10],
    ]),
    count,
  );
}

function heart(count = 40) {
  // Parametric heart centered at (50,50), scale ~82 wide x 84 tall.
  const pts = [];
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push([50 + x * 2.55, 50 + y * 2.55 - 2]);
  }
  return pts;
}

function star(count = 40) {
  return samplePolyline(
    polygon([
      [50, 5],
      [61, 36],
      [95, 37],
      [68, 57],
      [77, 90],
      [50, 71],
      [23, 90],
      [32, 57],
      [5, 37],
      [39, 36],
      [50, 5],
    ]),
    count,
  );
}

function pentagon(count = 32) {
  return samplePolyline(
    polygon([
      [50, 5],
      [95, 38],
      [78, 91],
      [22, 91],
      [5, 38],
      [50, 5],
    ]),
    count,
  );
}

function hexagon(count = 32) {
  return samplePolyline(
    polygon([
      [25, 7],
      [75, 7],
      [97, 50],
      [75, 93],
      [25, 93],
      [3, 50],
      [25, 7],
    ]),
    count,
  );
}

function cross(count = 32) {
  return samplePolyline(
    polygon([
      [35, 6],
      [65, 6],
      [65, 35],
      [94, 35],
      [94, 65],
      [65, 65],
      [65, 94],
      [35, 94],
      [35, 65],
      [6, 65],
      [6, 35],
      [35, 35],
      [35, 6],
    ]),
    count,
  );
}

function trapezoid(count = 32) {
  return samplePolyline(
    polygon([
      [25, 12],
      [75, 12],
      [95, 88],
      [5, 88],
      [25, 12],
    ]),
    count,
  );
}

function arrow(count = 32) {
  return samplePolyline(
    polygon([
      [55, 7],
      [96, 50],
      [55, 93],
      [55, 68],
      [5, 68],
      [5, 32],
      [55, 32],
      [55, 7],
    ]),
    count,
  );
}

const generators = {
  triangle,
  square,
  heart,
  star,
  pentagon,
  hexagon,
  cross,
  trapezoid,
  arrow,
};

export function canonicalPoints(name, count) {
  const gen = generators[name];
  if (!gen) throw new Error(`Unknown shape ${name}`);
  return gen(count);
}

export function allCanonical(count = 48) {
  const outlines = SHAPE_NAMES.map((name) => ({ name, points: canonicalPoints(name, count) }));
  const lineSymbols = [
    { name: 'cross', strokes: [[[50, 6], [50, 94]], [[6, 50], [94, 50]]] },
    { name: 'arrow', strokes: [[[5, 50], [95, 50]], [[60, 15], [95, 50], [60, 85]]] },
    { name: 'star', strokes: [[[50, 5], [78, 91], [5, 38], [95, 38], [22, 91], [50, 5]]] },
  ];
  return [...outlines, ...lineSymbols.map(t => ({ ...t, strokes: t.strokes.map(s => samplePolyline(s, count)) }))];
}
