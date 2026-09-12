// Synthetic stress matrix, NOT human/Pencil evidence. Run before/after changes.
import { Recognizer } from '../src/lib/shape-sudoku-lab/recognizer.js';
import { allCanonical } from '../src/lib/shape-sudoku-lab/shapes.js';
const r = new Recognizer(); r.train(allCanonical(64));
const square = [[20,20],[80,20],[80,80],[20,80],[20,20]];
const rows = [];
function probe(id, strokes) {
 const result = r.recognize(strokes);
 const ranked = Object.entries(result.distances).sort((a,b)=>a[1]-b[1]);
 rows.push({id, result:result.name, best:ranked[0]?.[0], distance:ranked[0]?.[1], margin:ranked[1]?.[1]-ranked[0]?.[1], reasons:result.rejectionReasons});
}
for (const angle of [0,5,10,15,20,30,45]) for (const aspect of [0.65,0.8,1,1.2,1.5]) {
 const a=angle*Math.PI/180;
 probe(`square rotation=${angle} aspect=${aspect}`, [square.map(([x,y])=>[50+(x-50)*aspect*Math.cos(a)-(y-50)*Math.sin(a),50+(x-50)*aspect*Math.sin(a)+(y-50)*Math.cos(a)])]);
}
for (const skew of [3,6,10,15]) probe(`square top skew=${skew}`, [[[20+skew,20],[80-skew,20],[80,80],[20,80],[20+skew,20]]]);
for (const offset of [0,3,6,10,20]) probe(`retry offset=${offset}`, [square,square.map(([x,y])=>[x+offset,y+offset])]);
console.log(JSON.stringify({source:'synthetic stress probes, not user drawings', rows, acceptedAsSquare:rows.filter(r=>r.result==='square').length, total:rows.length},null,2));
