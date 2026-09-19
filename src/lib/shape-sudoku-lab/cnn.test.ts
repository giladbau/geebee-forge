import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { rasterize, infer, validateModel } from './cnn.js';
const load = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
describe('trained CNN browser contract', () => {
  it('matches Python/Pillow synthetic reference rasters and logits', () => {
    const model = validateModel(load('../../../public/models/shape-cnn-v1.json'));
    const reference = load('../../../scripts/fixtures/shape-cnn-reference.json');
    for (const f of reference.fixtures) {
      const pixels = rasterize(f.strokes);
      expect(Array.from(pixels), f.id).toEqual(f.pixels);
      const logits = infer(model, pixels).logits;
      expect(Math.max(...logits.map((v: number, i: number) => Math.abs(v - f.logits[i]))), f.id).toBeLessThan(0.0001);
    }
  });
});
