import {it,expect} from 'vitest';
import {provisionalRecognition} from './drawing-recognition';
it('rejects synthetic incomplete lines, dense scribbles and uncertain scores independent of puzzle',()=>{
 const scores=[.95,.01,.01,.01,.005,.005,.005,.0025,.0025];
 expect(provisionalRecognition([[[0,0],[1,0]]],scores)).toBe(null);
 const scribble=[Array.from({length:80},(_,i)=>[i%2,i%3/2])];
 expect(provisionalRecognition(scribble,scores)).toBe(null);
 const triangle=[[[0,1],[.5,0],[1,1],[0,1]]];
 expect(provisionalRecognition(triangle,Array(9).fill(1/9))).toBe(null);
 expect(provisionalRecognition(triangle,scores)).toBe(0);
 expect(provisionalRecognition(triangle,[NaN])).toBe(null);
});
