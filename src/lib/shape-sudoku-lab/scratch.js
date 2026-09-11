// Conservative scratch-erase classifier.
// A scratch is a continuous back-and-forth scribble that stays roughly within the tile's ink bounds.
// Slashes, Xs, and stars are explicitly NOT scratches.

export function isScratch(points, opts = {}) {
  const minPoints = opts.minPoints || 20;
  if (points.length < minPoints) return false;

  const minWiggle = opts.minWiggle || 3;
  const maxAspect = opts.maxAspect || 3.5;
  const minCoverageRatio = opts.minCoverageRatio || 0.55;

  // Compute bounding box of the gesture.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  // Closed or nearly closed outlines (including stars) are not erasers.
  // Conservative rejection is preferable to deleting a child's shape.
  const span = Math.max(maxX - minX, maxY - minY);
  const first = points[0], last = points[points.length - 1];
  if (Math.hypot(last[0] - first[0], last[1] - first[1]) < span * 0.3) return false;
  const w = Math.max(maxX - minX, 1);
  const h = Math.max(maxY - minY, 1);

  // Count direction reversals along the dominant axis.
  let wiggles = 0;
  let lastDX = 0;
  let lastDY = 0;
  for (let i = 2; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    if (i === 2) {
      lastDX = dx;
      lastDY = dy;
      continue;
    }
    const dot = lastDX * dx + lastDY * dy;
    if (dot < 0) {
      wiggles++;
    }
    lastDX = dx;
    lastDY = dy;
  }

  // Reject very linear (slash/X-like) gestures by bounding box aspect ratio.
  const aspect = Math.max(w, h) / Math.min(w, h);
  if (aspect > maxAspect) return false;

  // Require several back-and-forth direction changes.
  if (wiggles < minWiggle) return false;

  // Require the gesture to span most of the tile in both axes (coverage test).
  const coverage = Math.min(w, h) / Math.max(w, h);
  if (coverage < minCoverageRatio) return false;

  return true;
}
