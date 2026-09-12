import { describe, it, expect } from 'vitest';
import { Recognizer } from './recognizer.js';
import { allCanonical } from './shapes.js';
import { isScratch } from './scratch.js';
import { drawingFixtures, negativeFixtures, densify } from './drawing-fixtures.js';
const recognizer = new Recognizer();
recognizer.train(allCanonical(64));
describe('diagnostic contract (synthetic inputs)', () => {
  it('reports all candidate scores without changing rejection', () => {
    const result = recognizer.recognize(negativeFixtures.find(f => f.id === 'circle')!.strokes);
    expect(result.name).toBeNull();
    expect(result.rejectionReasons).toContain('circle-veto');
    expect(result.rankedDistances).toHaveLength(9);
    expect(result.rankedDistances.map(r => r.distance)).toEqual(result.rankedDistances.map(r => r.distance).toSorted((a,b) => a-b));
    expect(result.thresholds?.distance).toBe(0.06);
  });
  it('explains taps and retains no false probabilities', () => {
    expect(recognizer.recognize([]).rejectionReasons).toEqual(['no-usable-ink']);
    expect(recognizer.recognize([[[50,50],[51,51]]]).rejectionReasons).toEqual(['below-minimum-span']);
    expect(recognizer.recognize(drawingFixtures[0].strokes).rejectionReasons).toEqual([]);
  });
});
describe('canonical compatibility', () => {
  for (const [index, template] of allCanonical(64).entries()) {
    it(`${template.name} variant ${index}`, () => {
      const strokes: number[][][] = 'strokes' in template ? template.strokes : [template.points];
      expect(recognizer.recognize(strokes).name).toBe(template.name);
      expect(recognizer.recognize(strokes.toReversed().map(s => s.toReversed())).name).toBe(template.name);
      if ('points' in template && template.name !== 'heart') {
        const ring = template.points.slice(0,-1);
        const shifted = [...ring.slice(13), ...ring.slice(0,13)];
        expect(recognizer.recognize([...shifted,shifted[0]]).name).toBe(template.name);
      }
    });
  }
});
describe('synthetic free drawing (not user samples)', () => {
  for (const f of [...drawingFixtures, ...negativeFixtures]) {
    it(f.id, () => {
      expect(recognizer.recognize(f.strokes).name).toBe(f.name);
      expect(recognizer.recognize(densify(f.strokes)).name).toBe(f.name);
      expect(recognizer.recognize(f.strokes.toReversed().map(s => s.toReversed())).name).toBe(f.name);
      if (f.name) {
        expect(recognizer.recognize(f.strokes.map(s => s.map(([x,y]) => [x*1.7+12,y*1.7-25]))).name).toBe(f.name);
        for (const s of densify(f.strokes)) expect(isScratch(s)).toBe(false);
      } else {
        expect(recognizer.recognize(f.strokes).confidence).toBe(0);
      }
    });
  }
});
