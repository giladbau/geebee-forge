

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
  const total = strokes.reduce((sum, s) => sum + pathLength(s), 0);
  // Allocate by ink length, never interpolate across a pen lift.
  return normalize(strokes.flatMap(s => resample(s, Math.max(2, Math.round(count * pathLength(s) / total)))));
}
function distance(a, b) {
  const directed = (from, to) => from.reduce((sum, p) => sum + Math.min(...to.map(q => (p[0]-q[0])**2 + (p[1]-q[1])**2)), 0) / from.length;
  return Math.sqrt((directed(a,b) + directed(b,a)) / 2);
}

export class Recognizer {
  constructor(opts = {}) {
    this.sampleCount = opts.sampleCount || 48;
    this.templates = [];
    // Single Relaxed mode. Distances are geometric scores, not probabilities.
    this.minPoints = opts.minPoints || 12;
    this.minStrokeLength = opts.minStrokeLength || 18;
    this.uncertainThreshold = opts.uncertainThreshold || 0.06;
    this.distanceCap = opts.distanceCap || 0.9;
  }

  train(templates) {
    this.templates = [];
    const names = new Set(templates.map(t => t.name));
    const variants = allCanonical(this.sampleCount).filter(t => t.strokes && names.has(t.name));
    for (const t of [...templates, ...variants]) {
      const forward = cloud(asStrokes(t.strokes ?? t.points), this.sampleCount);
      this.templates.push({ name: t.name, points: forward });
    }
  }

  recognize(rawPoints) {
    if (this.templates.length === 0) {
      throw new Error('No templates trained');
    }
    const strokes = asStrokes(rawPoints).filter(s => s.length);
    if (strokes.flat().length < this.minPoints) {
      return { name: null, confidence: 0, uncertain: true, distances: {} };
    }
    const strokeLength = strokes.reduce((sum, s) => sum + pathLength(s), 0);
    if (strokeLength < this.minStrokeLength) {
      return { name: null, confidence: 0, uncertain: true, distances: {} };
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
    const uncertain = bestDist >= this.uncertainThreshold || distance(input, circle) < bestDist;
    return {
      name: uncertain ? null : bestName,
      confidence: uncertain ? 0 : confidence,
      uncertain,
      distances,
    };
  }
}
