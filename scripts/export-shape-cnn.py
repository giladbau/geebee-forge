#!/usr/bin/env python3
"""Export ONLY inference tensors and public synthetic parity fixtures. Never trains.
Run with the shape-classifier environment; --source points at its src directory.
The checkpoint is read with weights_only=True. No private split/telemetry is exported.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import random
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkpoint', type=Path, required=True)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path('public/models/shape-cnn-v1.json'))
    parser.add_argument('--reference', type=Path, default=Path('scripts/fixtures/shape-cnn-reference.json'))
    args = parser.parse_args()
    sys.path.insert(0, str(args.source))
    import torch
    import PIL
    from shape_classifier.checkpoints import load_checkpoint
    from shape_classifier.rendering import render_drawing
    torch.set_num_threads(1)
    model, payload = load_checkpoint(args.checkpoint)
    tensors = {name: {'shape': list(t.shape), 'values': t.flatten().tolist()}
               for name, t in model.state_dict().items()}
    output = {'format': 'shape-cnn-json-v1', 'checkpointSha256': hashlib.sha256(args.checkpoint.read_bytes()).hexdigest(),
              'epoch': payload['epoch'], 'labels': payload['class_names'],
              'modelConfig': payload['model_config'], 'renderingConfig': payload['rendering_config'],
              'tensors': tensors}
    # Authored controls, NOT human-drawing accuracy evidence. Points are x,y pairs.
    fixtures = [
        ('empty', []), ('dot', [[[20, 20]]]),
        ('repeated-dot', [[[20, 20], [20, 20]]]),
        ('triangle', [[[50, 5], [95, 90], [5, 90], [50, 5]]]),
        ('square-pen-lifts', [[[10, 10], [90, 10]], [[90, 10], [90, 90]], [[90, 90], [10, 90]], [[10, 90], [10, 10]]]),
        ('circle', [[[50+40*math.cos(i*math.pi/32), 50+40*math.sin(i*math.pi/32)] for i in range(65)]]),
        ('lightning', [[[60, 0], [10, 55], [45, 55], [30, 100], [90, 40], [55, 40], [60, 0]]]),
        ('rainbow', [[[50+r*math.cos(i*math.pi/32), 80-r*math.sin(i*math.pi/32)] for i in range(33)] for r in (40, 30, 20)]),
        ('horizontal', [[[0, 0], [100, 0]]]), ('vertical', [[[0, 0], [0, 100]]]),
    ]
    rng = random.Random(711)
    for i in range(30):
        fixtures.append((f'synthetic-random-{i}', [[[rng.uniform(-100, 200), rng.uniform(-100, 200)] for _ in range(rng.randint(2, 15))] for _ in range(rng.randint(1, 4))]))
    references = []
    with torch.inference_mode():
        for name, strokes in fixtures:
            drawing = [[[p[0] for p in s], [p[1] for p in s]] for s in strokes]
            pixels = list(render_drawing(drawing).getdata())
            normalized = [p/255 for p in pixels]
            logits = model(torch.tensor(normalized, dtype=torch.float32).reshape(1, 1, 64, 64))[0].tolist()
            references.append({'id': name, 'strokes': strokes, 'pixels': normalized, 'logits': logits})
    for path, data in [(args.output, output), (args.reference, {'source': 'authored synthetic controls; not human accuracy', 'pillow': PIL.__version__, 'torch': torch.__version__, 'checkpointSha256': output['checkpointSha256'], 'fixtures': references})]:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, separators=(',', ':'), allow_nan=False)+'\n')
        print(f'{path}: {path.stat().st_size} bytes')


if __name__ == '__main__':
    main()
