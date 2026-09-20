import { expect, it } from 'vitest';
import { SHAPES, gameSymbolForLabel } from './shape-symbols';
import { LABELS } from './shape-sudoku-lab/cnn';

it('preserves immutable model class order and maps every label to a unique game symbol', () => {
 expect(LABELS).toEqual(['triangle','square','star','circle','sun','crescent','cloud','lightning','rainbow']);
 expect(LABELS.map(gameSymbolForLabel)).toEqual([0,1,2,3,8,4,5,6,7]);
 expect(new Set(LABELS.map(gameSymbolForLabel)).size).toBe(9);
 expect(gameSymbolForLabel('unknown')).toBeNull();
});
it('reserves sun for size nine while retaining shape colors', () => {
 expect(SHAPES.at(-1)).toEqual({name:'sun',color:'#6C9B79'});
 for(let size=3;size<=8;size++) expect(SHAPES.slice(0,size).some(shape=>shape.name==='sun')).toBe(false);
 expect(Object.fromEntries(SHAPES.map(shape=>[shape.name,shape.color]))).toEqual({
  triangle:'#D97872',square:'#6489C4',star:'#C8759E',circle:'#C99C43',sun:'#6C9B79',
  crescent:'#8976B6',cloud:'#CE8559',lightning:'#559995',rainbow:'#7376B5',
 });
});
