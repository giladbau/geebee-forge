<script lang="ts">
  import { T } from '@threlte/core';
  import * as THREE from 'three';
</script>

<!-- Main grass ground -->
<T.Mesh rotation.x={-Math.PI / 2} position.y={-0.05} receiveShadow>
  <T.PlaneGeometry args={[50, 50]} />
  <T.MeshStandardMaterial color="#4a8c3f" />
</T.Mesh>

<!-- Slightly darker patches for variety -->
{#each [[-4, 3], [5, -2], [-2, -5], [7, 6], [-6, 1]] as [x, z]}
  <T.Mesh rotation.x={-Math.PI / 2} position={[x, -0.04, z]} receiveShadow>
    <T.CircleGeometry args={[2.5, 16]} />
    <T.MeshStandardMaterial color="#3d7a34" />
  </T.Mesh>
{/each}

<!-- Dirt path from barn -->
{#each Array.from({ length: 8 }, (_, i) => i) as i}
  <T.Mesh rotation.x={-Math.PI / 2} position={[-7 + i * 1.8, -0.03, -4 + i * 0.3]} receiveShadow>
    <T.PlaneGeometry args={[2, 1.2]} />
    <T.MeshStandardMaterial color="#8B7355" />
  </T.Mesh>
{/each}
