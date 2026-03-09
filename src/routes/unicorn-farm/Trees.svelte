<script lang="ts">
  import { T, useTask } from '@threlte/core';

  let time = $state(0);
  let shakenTree = $state(-1);
  let shakeIntensity = $state(0);

  const trees: Array<{
    x: number; z: number; trunkH: number;
    crownSize: number; color: string; type: 'round' | 'tall' | 'wide';
  }> = [
    { x: -8,  z:  3,  trunkH: 1.8, crownSize: 1.6, color: '#2d7a1e', type: 'round' },
    { x: -6,  z:  7,  trunkH: 2.2, crownSize: 1.8, color: '#338822', type: 'round' },
    { x:  3,  z: -7,  trunkH: 1.5, crownSize: 1.4, color: '#2a6b18', type: 'tall'  },
    { x:  8,  z:  3,  trunkH: 2.0, crownSize: 1.5, color: '#2d7a1e', type: 'round' },
    { x: -3,  z:  8,  trunkH: 1.6, crownSize: 1.3, color: '#388a28', type: 'wide'  },
    { x:  6,  z: -8,  trunkH: 2.4, crownSize: 2.0, color: '#266b15', type: 'round' },
    { x:-12,  z:  8,  trunkH: 2.6, crownSize: 2.2, color: '#2d8022', type: 'round' },
    { x: 14,  z:  6,  trunkH: 1.9, crownSize: 1.6, color: '#309020', type: 'tall'  },
    { x:-10,  z:-12,  trunkH: 2.8, crownSize: 2.4, color: '#246015', type: 'wide'  },
    { x: 12,  z:-12,  trunkH: 2.0, crownSize: 1.7, color: '#2d7a1e', type: 'round' },
    { x:  0,  z: 16,  trunkH: 2.2, crownSize: 1.9, color: '#338822', type: 'round' },
    { x:-16,  z:  0,  trunkH: 3.0, crownSize: 2.6, color: '#1e6010', type: 'tall'  },
    { x: 18,  z:  0,  trunkH: 2.5, crownSize: 2.1, color: '#2d8022', type: 'wide'  },
    { x: 10,  z: 16,  trunkH: 1.8, crownSize: 1.5, color: '#388a28', type: 'round' },
    { x:-14,  z: 14,  trunkH: 2.4, crownSize: 2.0, color: '#2a7018', type: 'round' },
    { x: 22,  z: 10,  trunkH: 3.2, crownSize: 2.8, color: '#1e6010', type: 'tall'  },
    { x:-20,  z: 10,  trunkH: 2.8, crownSize: 2.4, color: '#246015', type: 'round' },
    { x:  6,  z:-18,  trunkH: 2.6, crownSize: 2.2, color: '#2d7a1e', type: 'wide'  },
    { x:-10,  z: 22,  trunkH: 2.2, crownSize: 1.8, color: '#309020', type: 'round' },
    { x: 20,  z: 20,  trunkH: 3.0, crownSize: 2.6, color: '#1e6010', type: 'tall'  },
    { x:-22,  z:-10,  trunkH: 2.4, crownSize: 2.0, color: '#246015', type: 'round' },
    { x: 16,  z:-20,  trunkH: 2.8, crownSize: 2.4, color: '#2d8022', type: 'wide'  },
    { x:-18,  z:-18,  trunkH: 3.4, crownSize: 3.0, color: '#1c5810', type: 'round' },
    { x: 28,  z: -5,  trunkH: 2.6, crownSize: 2.2, color: '#2a7018', type: 'tall'  },
    { x:-26,  z:  4,  trunkH: 2.2, crownSize: 1.9, color: '#338822', type: 'round' },
  ];

  const bushes: Array<{ x: number; z: number; size: number }> = [
    { x: -4, z: -7, size: 0.70 }, { x:  6, z:  7, size: 0.60 },
    { x: -8, z: -3, size: 0.80 }, { x:  9, z: -1, size: 0.55 },
    { x:  1, z:  8, size: 0.65 }, { x: -9, z:  6, size: 0.55 },
    { x: 14, z:  2, size: 0.75 }, { x:-11, z: 10, size: 0.60 },
    { x:  5, z:-14, size: 0.70 }, { x:-14, z:  4, size: 0.65 },
    { x: 16, z: -9, size: 0.80 }, { x: -2, z: 12, size: 0.55 },
    { x: 20, z: 14, size: 0.90 }, { x:-20, z: -5, size: 0.70 },
  ];

  useTask((delta) => {
    time += delta;
    if (shakenTree >= 0) {
      shakeIntensity -= delta * 2.5;
      if (shakeIntensity <= 0) {
        shakenTree    = -1;
        shakeIntensity = 0;
      }
    }
  });

  function shakeTree(idx: number) {
    return (e: any) => {
      e?.stopPropagation?.();
      shakenTree    = idx;
      shakeIntensity = 1;
    };
  }

  function windSway(idx: number): number {
    return Math.sin(time * 0.8 + idx * 0.6) * 0.02;
  }

  const CROWN_LAYERS: Record<string, Array<[number, number, number]>> = {
    round: [
      [0.30, 1.50, 0.65],
      [0.90, 1.15, 0.55],
      [1.35, 0.70, 0.45],
    ],
    tall: [
      [0.20, 0.90, 0.80],
      [0.85, 0.65, 0.70],
      [1.40, 0.40, 0.65],
      [1.90, 0.22, 0.50],
    ],
    wide: [
      [0.20, 1.80, 0.50],
      [0.70, 1.40, 0.45],
      [1.10, 0.90, 0.40],
    ],
  };
</script>

<!-- Trees -->
{#each trees as tree, idx}
  {@const shakeX = shakenTree === idx
    ? Math.sin(time * 22) * shakeIntensity * 0.18
    : windSway(idx)}

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <T.Group position={[tree.x, 0, tree.z]} onclick={shakeTree(idx)}>
    <!-- Trunk -->
    <T.Mesh position={[0, tree.trunkH / 2, 0]} castShadow>
      <T.BoxGeometry args={[0.32, tree.trunkH, 0.32]} />
      <T.MeshLambertMaterial color="#6B4226" />
    </T.Mesh>

    <!-- Crown layers -->
    <T.Group position.x={shakeX}>
      {#each CROWN_LAYERS[tree.type] as [yOff, wMult, hMult]}
        <T.Mesh position={[0, tree.trunkH + yOff, 0]} castShadow>
          <T.BoxGeometry args={[tree.crownSize * wMult, tree.crownSize * hMult, tree.crownSize * wMult]} />
          <T.MeshLambertMaterial color={tree.color} />
        </T.Mesh>
      {/each}
    </T.Group>
  </T.Group>
{/each}

<!-- Bushes -->
{#each bushes as bush}
  <T.Group position={[bush.x, 0, bush.z]}>
    <T.Mesh position={[0, bush.size * 0.4, 0]}>
      <T.BoxGeometry args={[bush.size, bush.size * 0.8, bush.size]} />
      <T.MeshLambertMaterial color="#2a7020" />
    </T.Mesh>
    <T.Mesh position={[bush.size * 0.3, bush.size * 0.3, bush.size * 0.2]}>
      <T.BoxGeometry args={[bush.size * 0.55, bush.size * 0.65, bush.size * 0.55]} />
      <T.MeshLambertMaterial color="#338828" />
    </T.Mesh>
  </T.Group>
{/each}
