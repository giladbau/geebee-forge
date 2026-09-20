import type { Strokes } from './shape-sudoku-lab/cnn';
/** UNCALIBRATED development gate. Softmax is not probability of correctness.
 * No puzzle/size/solution input: never re-rank to a legal move.
 * Scores must be in canonical LABELS order, NOT the CNN's sorted ranked order.
 */
export function provisionalRecognition(ink:Strokes,scores:number[]):number|null {
 if(scores.length!==9||!scores.every(v=>Number.isFinite(v)&&v>=0&&v<=1))return null;
 const points=ink.flat();if(points.length<3||points.some(p=>p.length!==2||!p.every(Number.isFinite)))return null;
 const width=Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0]));
 const height=Math.max(...points.map(p=>p[1]))-Math.min(...points.map(p=>p[1]));
 const extent=Math.max(width,height);if(extent<.08||Math.min(width,height)/extent<.12)return null;
 const length=ink.reduce((sum,s)=>sum+s.slice(1).reduce((n,p,i)=>n+Math.hypot(p[0]-s[i][0],p[1]-s[i][1]),0),0);
 if(length/extent>20)return null;
 const ranked=scores.map((score,label)=>({score,label})).sort((a,b)=>b.score-a.score);
 return ranked[0].score>=.8&&ranked[0].score-ranked[1].score>=.35?ranked[0].label:null;
}
