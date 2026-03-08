<script lang="ts">
  import { T } from '@threlte/core';
</script>

<!-- Fence sections around the farm area -->
<!-- Front fence (along Z-) -->
{#each Array.from({ length: 8 }, (_, i) => i) as i}
  {@const x = -8 + i * 2.2}
  <T.Group position={[x, 0, -9]}>
    <!-- Post -->
    <T.Mesh position={[0, 0.5, 0]} castShadow>
      <T.BoxGeometry args={[0.15, 1.0, 0.15]} />
      <T.MeshStandardMaterial color="#c8a870" />
    </T.Mesh>
    <!-- Top cap -->
    <T.Mesh position={[0, 1.05, 0]}>
      <T.BoxGeometry args={[0.2, 0.1, 0.2]} />
      <T.MeshStandardMaterial color="#b89860" />
    </T.Mesh>
    <!-- Rails -->
    <T.Mesh position={[1.1, 0.65, 0]} castShadow>
      <T.BoxGeometry args={[2.2, 0.1, 0.08]} />
      <T.MeshStandardMaterial color="#c8a870" />
    </T.Mesh>
    <T.Mesh position={[1.1, 0.35, 0]} castShadow>
      <T.BoxGeometry args={[2.2, 0.1, 0.08]} />
      <T.MeshStandardMaterial color="#c8a870" />
    </T.Mesh>
  </T.Group>
{/each}

<!-- Right fence (along X+) -->
{#each Array.from({ length: 6 }, (_, i) => i) as i}
  {@const z = -9 + i * 2.8}
  <T.Group position={[10, 0, z]}>
    <T.Mesh position={[0, 0.5, 0]} castShadow>
      <T.BoxGeometry args={[0.15, 1.0, 0.15]} />
      <T.MeshStandardMaterial color="#c8a870" />
    </T.Mesh>
    <T.Mesh position={[0, 1.05, 0]}>
      <T.BoxGeometry args={[0.2, 0.1, 0.2]} />
      <T.MeshStandardMaterial color="#b89860" />
    </T.Mesh>
    <T.Mesh position={[0, 0.65, 1.4]} castShadow>
      <T.BoxGeometry args={[0.08, 0.1, 2.8]} />
      <T.MeshStandardMaterial color="#c8a870" />
    </T.Mesh>
    <T.Mesh position={[0, 0.35, 1.4]} castShadow>
      <T.BoxGeometry args={[0.08, 0.1, 2.8]} />
      <T.MeshStandardMaterial color="#c8a870" />
    </T.Mesh>
  </T.Group>
{/each}

<!-- Left fence (along X-) -->
{#each Array.from({ length: 6 }, (_, i) => i) as i}
  {@const z = -9 + i * 2.8}
  <T.Group position={[-10, 0, z]}>
    <T.Mesh position={[0, 0.5, 0]} castShadow>
      <T.BoxGeometry args={[0.15, 1.0, 0.15]} />
      <T.MeshStandardMaterial color="#c8a870" />
    </T.Mesh>
    <T.Mesh position={[0, 1.05, 0]}>
      <T.BoxGeometry args={[0.2, 0.1, 0.2]} />
      <T.MeshStandardMaterial color="#b89860" />
    </T.Mesh>
    <T.Mesh position={[0, 0.65, 1.4]} castShadow>
      <T.BoxGeometry args={[0.08, 0.1, 2.8]} />
      <T.MeshStandardMaterial color="#c8a870" />
    </T.Mesh>
    <T.Mesh position={[0, 0.35, 1.4]} castShadow>
      <T.BoxGeometry args={[0.08, 0.1, 2.8]} />
      <T.MeshStandardMaterial color="#c8a870" />
    </T.Mesh>
  </T.Group>
{/each}
