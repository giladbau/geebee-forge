<script lang="ts">
  import { T, useTask } from '@threlte/core';

  let time = $state(0);
  let shakenTree = $state(-1);
  let shakeIntensity = $state(0);

  const trees: Array<{ x: number; z: number; trunkH: number; crownSize: number; color: string }> = [
    { x: -8, z: 3, trunkH: 1.8, crownSize: 1.6, color: '#2d7a1e' },
    { x: -6, z: 7, trunkH: 2.2, crownSize: 1.8, color: '#338822' },
    { x: 3, z: -7, trunkH: 1.5, crownSize: 1.4, color: '#2a6b18' },
    { x: 8, z: 3, trunkH: 2.0, crownSize: 1.5, color: '#2d7a1e' },
    { x: -3, z: 8, trunkH: 1.6, crownSize: 1.3, color: '#388a28' },
  ];

  const bushes: Array<{ x: number; z: number; size: number }> = [
    { x: -4, z: -7, size: 0.7 },
    { x: 6, z: 7, size: 0.6 },
    { x: -8, z: -3, size: 0.8 },
    { x: 9, z: -1, size: 0.5 },
    { x: 1, z: 8, size: 0.65 },
    { x: -9, z: 6, size: 0.55 },
  ];

  useTask((delta) => {
    time += delta;
    if (shakenTree >= 0) {
      shakeIntensity -= delta * 3;
      if (shakeIntensity <= 0) {
        shakenTree = -1;
        shakeIntensity = 0;
      }
    }
  });

  function shakeTree(idx: number) {
    return (e: any) => {
      e?.stopPropagation?.();
      shakenTree = idx;
      shakeIntensity = 1;
    };
  }
</script>

<!-- Trees -->
{#each trees as tree, idx}
  {@const shakeX = shakenTree === idx ? Math.sin(time * 25) * shakeIntensity * 0.15 : 0}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <T.Group position={[tree.x, 0, tree.z]} onclick={shakeTree(idx)}>
    <!-- Trunk -->
    <T.Mesh position={[0, tree.trunkH / 2, 0]} castShadow>
      <T.BoxGeometry args={[0.3, tree.trunkH, 0.3]} />
      <T.MeshStandardMaterial color="#6B4226" />
    </T.Mesh>

    <!-- Crown (stacked voxel layers) -->
    <T.Group position.x={shakeX}>
      <T.Mesh position={[0, tree.trunkH + 0.3, 0]} castShadow>
        <T.BoxGeometry args={[tree.crownSize * 1.4, tree.crownSize * 0.6, tree.crownSize * 1.4]} />
        <T.MeshStandardMaterial color={tree.color} />
      </T.Mesh>
      <T.Mesh position={[0, tree.trunkH + 0.8, 0]} castShadow>
        <T.BoxGeometry args={[tree.crownSize * 1.1, tree.crownSize * 0.5, tree.crownSize * 1.1]} />
        <T.MeshStandardMaterial color={tree.color} />
      </T.Mesh>
      <T.Mesh position={[0, tree.trunkH + 1.2, 0]} castShadow>
        <T.BoxGeometry args={[tree.crownSize * 0.7, tree.crownSize * 0.4, tree.crownSize * 0.7]} />
        <T.MeshStandardMaterial color={tree.color} />
      </T.Mesh>
    </T.Group>
  </T.Group>
{/each}

<!-- Bushes -->
{#each bushes as bush}
  <T.Group position={[bush.x, 0, bush.z]}>
    <T.Mesh position={[0, bush.size * 0.4, 0]} castShadow>
      <T.BoxGeometry args={[bush.size, bush.size * 0.8, bush.size]} />
      <T.MeshStandardMaterial color="#2a7020" />
    </T.Mesh>
    <T.Mesh position={[bush.size * 0.3, bush.size * 0.3, bush.size * 0.2]} castShadow>
      <T.BoxGeometry args={[bush.size * 0.5, bush.size * 0.6, bush.size * 0.5]} />
      <T.MeshStandardMaterial color="#338828" />
    </T.Mesh>
  </T.Group>
{/each}
