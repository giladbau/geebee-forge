<script lang="ts">
  import { T } from '@threlte/core';
</script>

<!-- ── Main grass ground 120×120 ── -->
<T.Mesh rotation.x={-Math.PI / 2} position.y={-0.05} receiveShadow>
  <T.PlaneGeometry args={[120, 120]} />
  <T.MeshStandardMaterial color="#52b045" roughness={0.9} />
</T.Mesh>

<!-- ── Darker grass patches (variety) ── -->
{#each [
  [-4, 3], [5, -2], [-2, -5], [7, 6], [-6, 1],
  [14, 5], [-12, 9], [8, -12], [-18, -4], [20, 12],
  [2, 18], [-8, -15], [15, -10], [-22, 6], [10, 20],
] as [x, z]}
  <T.Mesh rotation.x={-Math.PI / 2} position={[x, -0.04, z]} receiveShadow>
    <T.CircleGeometry args={[3.0 + Math.abs(x % 3), 16]} />
    <T.MeshStandardMaterial color="#45a038" />
  </T.Mesh>
{/each}

<!-- ── Lighter emerald patches ── -->
{#each [
  [6, 10], [-10, 5], [18, -3], [-5, 16], [12, -8],
] as [x, z]}
  <T.Mesh rotation.x={-Math.PI / 2} position={[x, -0.03, z]} receiveShadow>
    <T.CircleGeometry args={[4, 12]} />
    <T.MeshStandardMaterial color="#5cc050" />
  </T.Mesh>
{/each}

<!-- ── Dirt path from barn toward center ── -->
{#each Array.from({ length: 12 }, (_, i) => i) as i}
  <T.Mesh rotation.x={-Math.PI / 2} position={[-14 + i * 2.0, -0.03, -8 + i * 0.6]} receiveShadow>
    <T.PlaneGeometry args={[2.2, 1.4]} />
    <T.MeshStandardMaterial color="#8B7355" />
  </T.Mesh>
{/each}

<!-- ── Second dirt path toward pond ── -->
{#each Array.from({ length: 8 }, (_, i) => i) as i}
  <T.Mesh rotation.x={-Math.PI / 2} position={[i * 1.8, -0.03, 6 + i * 0.4]} receiveShadow>
    <T.PlaneGeometry args={[2.0, 1.2]} />
    <T.MeshStandardMaterial color="#8B7355" />
  </T.Mesh>
{/each}

<!-- ── Rolling hills (raised terrain bumps using tall cylinders) ── -->
<!-- Hill 1 -->
<T.Mesh position={[-22, -2.0, -18]} receiveShadow castShadow>
  <T.CylinderGeometry args={[12, 14, 4, 16]} />
  <T.MeshStandardMaterial color="#4aab3e" roughness={0.95} />
</T.Mesh>
<!-- Hill 2 -->
<T.Mesh position={[24, -1.8, 20]} receiveShadow castShadow>
  <T.CylinderGeometry args={[10, 12, 3.6, 16]} />
  <T.MeshStandardMaterial color="#4aab3e" roughness={0.95} />
</T.Mesh>
<!-- Hill 3 (smaller) -->
<T.Mesh position={[-5, -2.2, 28]} receiveShadow castShadow>
  <T.CylinderGeometry args={[8, 10, 4.4, 14]} />
  <T.MeshStandardMaterial color="#50b842" roughness={0.95} />
</T.Mesh>
<!-- Hill 4 (background ridge) -->
<T.Mesh position={[30, -2.5, -15]} receiveShadow castShadow>
  <T.CylinderGeometry args={[14, 16, 5, 12]} />
  <T.MeshStandardMaterial color="#488a40" roughness={0.95} />
</T.Mesh>

<!-- ── Stone wall sections ── -->
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
      receiveShadow
    >
      <T.BoxGeometry args={[1.0, 0.6, 0.5]} />
      <T.MeshStandardMaterial color="#888077" roughness={1.0} />
    </T.Mesh>
    <T.Mesh
      position={[wall.wx + Math.cos(wall.ry) * (i * 1.2 + 0.6), 0.65, wall.wz + Math.sin(wall.ry) * (i * 1.2 + 0.6)]}
      castShadow
    >
      <T.BoxGeometry args={[0.95, 0.55, 0.45]} />
      <T.MeshStandardMaterial color="#7a7570" roughness={1.0} />
    </T.Mesh>
  {/each}
{/each}
