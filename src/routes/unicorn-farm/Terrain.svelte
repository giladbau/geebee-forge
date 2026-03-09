<script lang="ts">
  import { T } from '@threlte/core';

  const hills: Array<{ pos: [number, number, number]; geo: [number, number, number, number]; color: string }> = [
    { pos: [-22, -2.0, -18], geo: [12, 14, 4,   8], color: '#4aab3e' },
    { pos: [ 24, -1.8,  20], geo: [10, 12, 3.6, 8], color: '#4aab3e' },
    { pos: [ -5, -2.2,  28], geo: [ 8, 10, 4.4, 8], color: '#50b842' },
    { pos: [ 30, -2.5, -15], geo: [14, 16, 5,   8], color: '#488a40' },
  ];
</script>

<!-- Main grass ground 120x120 -->
<T.Mesh rotation.x={-Math.PI / 2} position.y={-0.05} receiveShadow>
  <T.PlaneGeometry args={[120, 120]} />
  <T.MeshLambertMaterial color="#52b045" />
</T.Mesh>

<!-- Darker grass patches -->
{#each [
  [-4, 3], [5, -2], [-2, -5], [7, 6], [-6, 1],
  [14, 5], [-12, 9], [8, -12], [-18, -4], [20, 12],
  [2, 18], [-8, -15], [15, -10], [-22, 6], [10, 20],
] as [x, z]}
  <T.Mesh rotation.x={-Math.PI / 2} position={[x, -0.04, z]}>
    <T.CircleGeometry args={[3.0 + Math.abs(x % 3), 8]} />
    <T.MeshLambertMaterial color="#45a038" />
  </T.Mesh>
{/each}

<!-- Lighter emerald patches -->
{#each [
  [6, 10], [-10, 5], [18, -3], [-5, 16], [12, -8],
] as [x, z]}
  <T.Mesh rotation.x={-Math.PI / 2} position={[x, -0.03, z]}>
    <T.CircleGeometry args={[4, 8]} />
    <T.MeshLambertMaterial color="#5cc050" />
  </T.Mesh>
{/each}

<!-- Dirt path from barn toward center -->
{#each Array.from({ length: 12 }, (_, i) => i) as i}
  <T.Mesh rotation.x={-Math.PI / 2} position={[-14 + i * 2.0, 0.02, -8 + i * 0.6]}>
    <T.PlaneGeometry args={[2.2, 1.4]} />
    <T.MeshLambertMaterial color="#8B7355" />
  </T.Mesh>
{/each}

<!-- Second dirt path toward pond -->
{#each Array.from({ length: 8 }, (_, i) => i) as i}
  <T.Mesh rotation.x={-Math.PI / 2} position={[i * 1.8, 0.02, 6 + i * 0.4]}>
    <T.PlaneGeometry args={[2.0, 1.2]} />
    <T.MeshLambertMaterial color="#8B7355" />
  </T.Mesh>
{/each}

<!-- Rolling hills -->
{#each hills as hill}
  <T.Mesh position={hill.pos} receiveShadow>
    <T.CylinderGeometry args={hill.geo} />
    <T.MeshLambertMaterial color={hill.color} />
  </T.Mesh>
{/each}

<!-- Stone wall sections -->
{#each (
  [
    { wx: -8, wz: -12, len: 6, ry: 0 },
    { wx:  8, wz: -14, len: 5, ry: 0.1 },
    { wx:-16, wz:   5, len: 4, ry: Math.PI / 2 },
    { wx: 14, wz:  12, len: 7, ry: 0.05 },
  ] as Array<{ wx: number; wz: number; len: number; ry: number }>
) as wall}
  {#each Array.from({ length: wall.len }, (_, i) => i) as i}
    <T.Mesh
      position={[wall.wx + Math.cos(wall.ry) * i * 1.2, 0.3, wall.wz + Math.sin(wall.ry) * i * 1.2]}
      castShadow
    >
      <T.BoxGeometry args={[1.0, 0.6, 0.5]} />
      <T.MeshLambertMaterial color="#888077" />
    </T.Mesh>
    <T.Mesh
      position={[wall.wx + Math.cos(wall.ry) * (i * 1.2 + 0.6), 0.65, wall.wz + Math.sin(wall.ry) * (i * 1.2 + 0.6)]}
    >
      <T.BoxGeometry args={[0.95, 0.55, 0.45]} />
      <T.MeshLambertMaterial color="#7a7570" />
    </T.Mesh>
  {/each}
{/each}
