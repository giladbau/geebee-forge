<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import * as THREE from 'three';

  let { position = [0, 0, 0] }: { position?: [number, number, number] } = $props();

  let doorOpen = $state(false);
  let doorAngle = $state(0);
  let time = $state(0);

  useTask((delta) => {
    time += delta;
    // Animate door
    const targetAngle = doorOpen ? -Math.PI / 2 : 0;
    doorAngle += (targetAngle - doorAngle) * delta * 4;
  });

  function handleClick(e: any) {
    e?.stopPropagation?.();
    doorOpen = !doorOpen;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<T.Group position={position} onclick={handleClick}>
  <!-- Main barn body -->
  <T.Mesh position={[0, 1.5, 0]} castShadow>
    <T.BoxGeometry args={[5, 3, 4]} />
    <T.MeshStandardMaterial color="#8B4513" />
  </T.Mesh>

  <!-- Roof (triangular prism via two slanted boxes) -->
  <T.Mesh position={[0, 3.4, 0]} rotation.z={Math.PI / 4} castShadow>
    <T.BoxGeometry args={[2.8, 2.8, 4.2]} />
    <T.MeshStandardMaterial color="#a02020" />
  </T.Mesh>

  <!-- Roof trim -->
  <T.Mesh position={[0, 4.4, 0]} castShadow>
    <T.BoxGeometry args={[0.3, 0.6, 4.4]} />
    <T.MeshStandardMaterial color="#8B0000" />
  </T.Mesh>

  <!-- White trim lines -->
  <T.Mesh position={[2.52, 1.5, 0]}>
    <T.BoxGeometry args={[0.05, 3.1, 4.1]} />
    <T.MeshStandardMaterial color="#f5f0e0" />
  </T.Mesh>
  <T.Mesh position={[-2.52, 1.5, 0]}>
    <T.BoxGeometry args={[0.05, 3.1, 4.1]} />
    <T.MeshStandardMaterial color="#f5f0e0" />
  </T.Mesh>

  <!-- Cross beams on front -->
  <T.Mesh position={[0, 1.5, -2.03]}>
    <T.BoxGeometry args={[4.5, 0.12, 0.05]} />
    <T.MeshStandardMaterial color="#f5f0e0" />
  </T.Mesh>
  <T.Mesh position={[0, 2.5, -2.03]}>
    <T.BoxGeometry args={[4.5, 0.12, 0.05]} />
    <T.MeshStandardMaterial color="#f5f0e0" />
  </T.Mesh>

  <!-- Door frame -->
  <T.Mesh position={[0, 0.9, -2.03]}>
    <T.BoxGeometry args={[1.4, 1.8, 0.08]} />
    <T.MeshStandardMaterial color="#5a2d0c" />
  </T.Mesh>

  <!-- Animated door -->
  <T.Group position={[-0.65, 0, -2.05]} rotation.y={doorAngle}>
    <T.Mesh position={[0.325, 0.9, 0]}>
      <T.BoxGeometry args={[0.65, 1.7, 0.06]} />
      <T.MeshStandardMaterial color="#6B3410" />
    </T.Mesh>
  </T.Group>
  <T.Group position={[0.65, 0, -2.05]} rotation.y={-doorAngle}>
    <T.Mesh position={[-0.325, 0.9, 0]}>
      <T.BoxGeometry args={[0.65, 1.7, 0.06]} />
      <T.MeshStandardMaterial color="#6B3410" />
    </T.Mesh>
  </T.Group>

  <!-- Windows -->
  {#each [-1.5, 1.5] as wx}
    <T.Mesh position={[wx, 2.0, -2.03]}>
      <T.BoxGeometry args={[0.6, 0.6, 0.08]} />
      <T.MeshStandardMaterial color="#ffe88a" emissive="#ffe88a" emissiveIntensity={0.3} />
    </T.Mesh>
    <!-- Window frame -->
    <T.Mesh position={[wx, 2.0, -2.05]}>
      <T.BoxGeometry args={[0.7, 0.08, 0.05]} />
      <T.MeshStandardMaterial color="#f5f0e0" />
    </T.Mesh>
    <T.Mesh position={[wx, 2.0, -2.05]}>
      <T.BoxGeometry args={[0.08, 0.7, 0.05]} />
      <T.MeshStandardMaterial color="#f5f0e0" />
    </T.Mesh>
  {/each}

  <!-- Warm light inside barn -->
  {#if doorOpen}
    <T.PointLight position={[0, 1.5, -1.5]} color="#ffcc66" intensity={2} distance={6} />
  {/if}
</T.Group>
