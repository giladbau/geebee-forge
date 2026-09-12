

import { allCanonical } from './shapes.js';

function centroid(pts) {
  let x = 0;
  let y = 0;
  for (const [px, py] of pts) {
    x += px;
    y += py;
  }
  return [x / pts.length, y / pts.length];
}

function resample(pts, count) {
  if (pts.length === 0) return [];
  const total = pts.reduce((sum, p, i) => {
    if (i === 0) return 0;
    const dx = p[0] - pts[i - 1][0];
    const dy = p[1] - pts[i - 1][1];
    return sum + Math.hypot(dx, dy);
  }, 0);
  if (total === 0 || pts.length === 1) {
    const c = centroid(pts);
    return Array.from({ length: count }, () => c.slice());
  }
  const step = total / (count - 1);
  const out = [pts[0].slice()];
  let dist = 0;
  let next = step;
  for (let i = 1; i < pts.length && out.length < count; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (out.length < count && next <= dist + seg + 1e-6) {
      const t = (next - dist) / seg;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      next += step;
    }
    dist += seg;
  }
  while (out.length < count) out.push(pts[pts.length - 1].slice());
  return out;
}

function normalize(pts) {
  // Scale into unit square preserving aspect ratio, center at (0,0).
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const w = Math.max(maxX - minX, 1e-6);
  const h = Math.max(maxY - minY, 1e-6);
  const scale = 1 / Math.max(w, h);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return pts.map(([x, y]) => [(x - cx) * scale, (y - cy) * scale]);
}

function asStrokes(input) {
  return typeof input[0]?.[0] === 'number' ? [input] : input;
}
function pathLength(pts) {
  return pts.reduce((sum, p, i) => sum + (i ? Math.hypot(p[0]-pts[i-1][0], p[1]-pts[i-1][1]) : 0), 0);
}
function cloud(strokes, count) {
  // Normalize the actual geometry BEFORE sampling: resampling may miss a
  // corner/extremum. Sample by spatial resolution, not a shared point budget:
  // retracing one edge must not starve the other edges of representative ink.
  const normalized = normalize(strokes.flat());
  let offset = 0;
  const unique = new Map();
  for (const stroke of strokes) {
    const s = normalized.slice(offset, offset + stroke.length);
    offset += stroke.length;
    for (const p of resample(s, Math.max(2, Math.ceil(pathLength(s) * count) + 1))) {
      // Occupancy, rather than time spent on an edge, determines cloud weight.
      const key = p.map(v => Math.round(v * count)).join(',');
      if (!unique.has(key)) unique.set(key, p);
    }
  }
  return [...unique.values()];
}
function distance(a, b) {
  const directed = (from, to) => {
    let sum = 0;
    for (const p of from) {
      let nearest = Infinity;
      for (const q of to) nearest = Math.min(nearest, (p[0]-q[0])**2 + (p[1]-q[1])**2);
      sum += nearest;
    }
    return sum / from.length;
  };
  return Math.sqrt((directed(a,b) + directed(b,a)) / 2);
}

export class Recognizer {
  constructor(opts = {}) {
    this.sampleCount = opts.sampleCount || 48;
    this.templates = [];
    // Single Relaxed mode. Distances are geometric scores, not probabilities.
    // Input coordinates are tile percentages. Gate accidental taps by extent,
    // not event count or accumulated length (both depend on delivery/retracing).
    this.minSpan = opts.minSpan ?? 4;
    this.uncertainThreshold = opts.uncertainThreshold || 0.06;
    this.distanceCap = opts.distanceCap || 0.9;
  }

  train(templates) {
    this.templates = [];
    const names = new Set(templates.map(t => t.name));
    const variants = allCanonical(this.sampleCount).filter(t => t.strokes && names.has(t.name));
    for (const t of [...templates, ...variants]) {
      // Match geometry under bounded hand tilt and stretch, rather than forcing
      // every drawing into the one upright, equal-aspect prototype. Square has
      // quarter-turn symmetry; line crosses deliberately do not include X.
      const angles = Array.from({length:t.name === 'square' ? 19 : 9}, (_,i) => i*5-(t.name === 'square' ? 45 : 20));
      for (const angle of angles) for (const aspect of [0.625,0.7,0.8,0.9,1,1.1,1.25,1.4,1.6]) {
        const a = angle*Math.PI/180;
        const transformed = asStrokes(t.strokes ?? t.points).map(s => s.map(([x,y]) => {
          const px=(x-50)*aspect, py=y-50;
          return [px*Math.cos(a)-py*Math.sin(a),px*Math.sin(a)+py*Math.cos(a)];
        }));
        this.templates.push({ name:t.name, points:cloud(transformed,this.sampleCount) });
      }
    }
  }

  recognize(rawPoints) {
    if (this.templates.length === 0) {
      throw new Error('No templates trained');
    }
    const strokes = asStrokes(rawPoints).filter(s => s.length > 1 && pathLength(s) > 0);
    const points = strokes.flat();
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    if (!points.length || !points.every(p => p.every(Number.isFinite)) || span < this.minSpan) {
      return { name: null, confidence: 0, uncertain: true, distances: {}, rankedDistances: [], rejectionReasons: [!points.length ? 'no-usable-ink' : !points.every(p => p.every(Number.isFinite)) ? 'non-finite-coordinates' : 'below-minimum-span'], span: Number.isFinite(span) ? span : null };
    }

    const input = cloud(strokes, this.sampleCount);
    let bestName = null;
    let bestDist = Infinity;
    const distances = {};
    for (const t of this.templates) {
      const d = distance(input, t.points);
      distances[t.name] = Math.min(distances[t.name] ?? Infinity, d);
      if (d < bestDist) {
        bestDist = d;
        bestName = t.name;
      }
    }

    const confidence = Math.max(0, 1 - bestDist / this.distanceCap);
    // Point-cloud distances have a different scale than ordered-path RMS.
    // An unsupported round outline is a rejection prototype, not a puzzle symbol.
    const circle = Array.from({ length: this.sampleCount }, (_, i) => [
      0.5 * Math.cos(i * 2 * Math.PI / this.sampleCount),
      0.5 * Math.sin(i * 2 * Math.PI / this.sampleCount),
    ]);
    const ranked = Object.values(distances).sort((a, b) => a - b);
    // A good absolute fit is not enough when two different symbols fit alike.
    const ambiguous = ranked.length > 1 && ranked[1] - ranked[0] < 0.012;
    // Reject rounded outlines under the same aspect freedom as symbols.
    const circleDistance = Math.min(...[0.625,0.8,1,1.25,1.6].map(aspect =>
      distance(input, normalize(circle.map(([x,y]) => [x*aspect,y])))));
    const rejectionReasons = [];
    if (bestDist >= this.uncertainThreshold) rejectionReasons.push('distance-threshold');
    if (ambiguous) rejectionReasons.push('ambiguous-candidates');
    if (circleDistance < bestDist) rejectionReasons.push('circle-veto');
    const uncertain = rejectionReasons.length > 0;
    return {
      rankedDistances: Object.entries(distances).map(([name, distance]) => ({ name, distance })).sort((a,b) => a.distance-b.distance),
      rejectionReasons, bestName, bestDistance: bestDist, circleDistance,
      margin: ranked[1] - ranked[0], span,
      thresholds: { distance: this.uncertainThreshold, ambiguityMargin: 0.012, minSpan: this.minSpan },
      name: uncertain ? null : bestName,
      confidence: uncertain ? 0 : confidence,
      uncertain,
      distances,
    };
  }
}
