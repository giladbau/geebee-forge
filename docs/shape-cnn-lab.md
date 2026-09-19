# Trained CNN drawing lab

Experimental route: `/shape-sudoku-lab/`. Main game components and rules are unchanged.

The user's epoch-21 `tiny_cnn_v1` checkpoint is exported to compact JSON inference tensors in `public/models/shape-cnn-v1.json`. No optimizer, private paths, split records, or diagnostics are shipped. JSON is deliberately used instead of binary weights and needs no external runtime or CDN. Its source checkpoint SHA-256 is recorded in the asset and diagnostic download.

The dedicated browser worker runs three convolution/ReLU/max-pool layers, adaptive average pooling, and the classifier. Input is 64×64 white ink on black with aspect-preserving centering, padding 4, line width 2. The width-2 rasterizer ports relevant Pillow scan conversion; see the bundled Pillow license. Canvas display styling is independent of model preprocessing. Every nonempty drawing receives a closed-set guess; softmax scores are uncalibrated, and no geometric fallback or puzzle solution is used.

## Reproduce export (inference only)

Use the shape-classifier Python environment containing PyTorch and Pillow:

```sh
/path/to/shape-classifier/.venv/bin/python scripts/export-shape-cnn.py \
  --source /path/to/shape-classifier/src --checkpoint /path/to/best.pt
npm ci
npm test
npm run build
npm run test:shape-cnn:browser
```

The checkpoint is loaded using `weights_only=True`. No training or backward pass occurs. Do not commit the original checkpoint or private user stroke exports.

## Verification

- 42 unit/component tests passed, including 40 Python-reference synthetic fixtures within the CNN parity test.
- Built-route Chromium worker parity: 40/40 top predictions agree with PyTorch; zero differing raster pixels on those fixtures; maximum absolute logit error approximately 0.00000363.
- Real browser pointer input checks: capture, separate pen lifts, pointer cancellation restores prior ink/result, clearing a later cell during the timer window preserves earlier ink, actual downloaded JSON parses, failed worker clears pending status/timers, model-load failure is visible and retry works.
- Responsive bounds at widths 320, 390, 768, and 1024, with no horizontal document overflow.
- No unexpected browser errors during the successful flow. Page network requests are same-origin GETs; the worker only fetches the model, and inference/diagnostics stay local.
- Synthetic fixtures verify implementation equivalence, not human recognition accuracy. Actual iPad Safari/Pencil performance and real-user accuracy remain unverified.
- `npm run check` prompts to install unavailable `@astrojs/check` in this checkout rather than performing a check; it is not reported as passed. Build and tests use the locked dependencies.

Download diagnostics after a useful drawing session. It includes strokes, rankings, timing, model/build identity and the latest 100 events; nothing is uploaded automatically. Clearing a cell does not clear the in-memory diagnostic history.
