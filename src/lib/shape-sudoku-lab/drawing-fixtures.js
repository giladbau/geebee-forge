// Authored synthetic regressions, NOT captured user/Pencil samples.
// Coordinates are tile percentages. Sparse vertices model fast event delivery.
export const drawingFixtures = [
  { id: 'four-unit-square', name: 'square', strokes: [[[48,48],[52,48],[52,52],[48,52],[48,48]]] },
  { id: 'repeated-square-edge', name: 'square', strokes: [[[15,15],[85,15],[85,85],[15,85],[15,15], ...Array.from({length:20},(_,i) => [i%2?15:85,15])]] },
  { id: 'repeated-square-edge-pen-lift', name: 'square', strokes: [[[15,15],[85,15],[85,85],[15,85],[15,15]], Array.from({length:20},(_,i) => [i%2?85:15,15])] },
  { id: 'quick-triangle', name: 'triangle', strokes: [[[50,12],[89,87],[11,87],[50,12]]] },
  { id: 'quick-square', name: 'square', strokes: [[[15,15],[85,15],[85,85],[15,85],[15,15]]] },
  { id: 'small-square', name: 'square', strokes: [[[47,47],[53,47],[53,53],[47,53],[47,47]]] },
  { id: 'small-triangle', name: 'triangle', strokes: [[[50,47],[53,53],[47,53],[50,47]]] },
  { id: 'gapped-triangle', name: 'triangle', strokes: [[[48,15],[87,86],[13,88],[45,21]]] },
  { id: 'rounded-square', name: 'square', strokes: [[[23,15],[77,15],[84,21],[86,77],[79,85],[22,84],[15,77],[15,23],[23,15]]] },
  { id: 'overshot-square', name: 'square', strokes: [[[16,17],[84,15],[86,84],[15,86],[16,12]]] },
  { id: 'uneven-triangle', name: 'triangle', strokes: [[[47,15],[67,49],[87,86],[52,88],[14,86],[28,56],[47,15]]] },
  { id: 'separate-square-sides', name: 'square', strokes: [[[84,84],[15,84]],[[15,16],[83,16]],[[15,83],[15,17]],[[84,17],[84,83]]] },
  { id: 'pen-lift-triangle', name: 'triangle', strokes: [[[50,13],[87,86]],[[14,87],[49,15]],[[86,87],[15,87]]] },
  { id: 'quick-cross', name: 'cross', strokes: [[[50,15],[50,85]],[[15,50],[85,50]]] },
  { id: 'quick-arrow', name: 'arrow', strokes: [[[12,50],[87,50]],[[58,20],[87,50],[58,80]]] },
  { id: 'retraced-square-edge', name: 'square', strokes: [[[15,15],[85,15],[85,85],[15,85],[15,15]],[[15,15],[85,15],[15,15],[85,15],[15,15]]] },
  { id: 'duplicate-events-square', name: 'square', strokes: [[[15,15],[15,15],[85,15],[85,15],[85,85],[15,85],[15,15],[15,15]]] },
  { id: 'rounded-triangle', name: 'triangle', strokes: [[[45,21],[50,15],[55,21],[84,78],[85,84],[78,87],[21,87],[15,84],[18,77],[45,21]]] },
];
export const negativeFixtures = [
  { id: 'ambiguous-square-trapezoid', name: null, strokes: [[[25,15],[75,15],[85,85],[15,85],[25,15]]] },
  { id: 'tap', name: null, strokes: [[[50,50],[50,50]]] },
  { id: 'tiny-jitter', name: null, strokes: [[[50,50],[51,50],[51,51],[50,51],[50,50]]] },
  { id: 'line', name: null, strokes: [[[12,12],[88,88]]] },
  { id: 'open-L', name: null, strokes: [[[15,15],[15,85],[85,85]]] },
  { id: 'missing-square-side', name: null, strokes: [[[15,15],[85,15],[85,85],[15,85]]] },
  { id: 'X-not-cross', name: null, strokes: [[[15,15],[85,85]],[[15,85],[85,15]]] },
  { id: 'zigzag', name: null, strokes: [[[10,10],[90,25],[10,40],[90,55],[10,70],[90,90]]] },
  { id: 'circle', name: null, strokes: [Array.from({length: 65}, (_,i) => [50+36*Math.cos(i*Math.PI/32),50+36*Math.sin(i*Math.PI/32)])] },
  { id: 'oval', name: null, strokes: [Array.from({length: 65}, (_,i) => [50+36*Math.cos(i*Math.PI/32),50+28*Math.sin(i*Math.PI/32)])] },
];
// Same geometric path, different event frequency (never bridge pen lifts).
export function densify(strokes, steps = 10) {
  return strokes.map(s => s.flatMap((p,i) => i ? Array.from({length:steps},(_,j) => s[i-1].map((v,k) => v+(p[k]-v)*(j+1)/steps)) : [p]));
}
