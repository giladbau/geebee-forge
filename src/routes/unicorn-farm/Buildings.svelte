<script lang="ts">
  import { T, useTask } from '@threlte/core';

  // Well glow pulse
  let time = $state(0);
  useTask((delta) => { time += delta; });
</script>

<!-- ════════════════════════════════════════════
     FARMHOUSE  (at [8, 0, -16])
════════════════════════════════════════════ -->
<T.Group position={[8, 0, -16]}>
  <!-- Foundation -->
  <T.Mesh position={[0, 0.12, 0]} receiveShadow>
    <T.BoxGeometry args={[6.5, 0.24, 5.0]} />
    <T.MeshStandardMaterial color="#999080" />
  </T.Mesh>
  <!-- Main body -->
  <T.Mesh position={[0, 1.6, 0]} castShadow receiveShadow>
    <T.BoxGeometry args={[6, 3.2, 4.6]} />
    <T.MeshStandardMaterial color="#e8d8b8" roughness={0.8} />
  </T.Mesh>
  <!-- Roof left slope -->
  <T.Mesh position={[0, 3.6, 0]} rotation.z={Math.PI / 4.5} castShadow>
    <T.BoxGeometry args={[3.2, 3.2, 5.2]} />
    <T.MeshStandardMaterial color="#7a3030" roughness={0.7} />
  </T.Mesh>
  <!-- Roof ridge -->
  <T.Mesh position={[0, 5.0, 0]} castShadow>
    <T.BoxGeometry args={[0.3, 0.5, 5.3]} />
    <T.MeshStandardMaterial color="#5c2020" />
  </T.Mesh>
  <!-- Porch columns -->
  {#each [-1.2, 1.2] as cx}
    <T.Mesh position={[cx, 1.2, -2.42]} castShadow>
      <T.CylinderGeometry args={[0.12, 0.14, 2.4, 8]} />
      <T.MeshStandardMaterial color="#f0e8d0" />
    </T.Mesh>
  {/each}
  <!-- Porch overhang -->
  <T.Mesh position={[0, 2.5, -2.55]} castShadow>
    <T.BoxGeometry args={[3.0, 0.12, 0.8]} />
    <T.MeshStandardMaterial color="#c8a870" />
  </T.Mesh>
  <!-- Front door -->
  <T.Mesh position={[0, 1.0, -2.34]}>
    <T.BoxGeometry args={[1.0, 2.0, 0.08]} />
    <T.MeshStandardMaterial color="#5a3010" />
  </T.Mesh>
  <!-- Door knob -->
  <T.Mesh position={[0.3, 1.0, -2.38]}>
    <T.SphereGeometry args={[0.06, 6, 6]} />
    <T.MeshStandardMaterial color="#d4aa30" metalness={0.9} roughness={0.2} />
  </T.Mesh>
  <!-- Windows front -->
  {#each [-1.8, 1.8] as wx}
    <T.Mesh position={[wx, 1.8, -2.34]}>
      <T.BoxGeometry args={[0.8, 0.8, 0.08]} />
      <T.MeshStandardMaterial color="#ffe8a0" emissive="#ffe8a0" emissiveIntensity={0.25} transparent opacity={0.85} />
    </T.Mesh>
    <T.Mesh position={[wx, 1.8, -2.36]}>
      <T.BoxGeometry args={[0.84, 0.06, 0.05]} />
      <T.MeshStandardMaterial color="#f0e8d0" />
    </T.Mesh>
    <T.Mesh position={[wx, 1.8, -2.36]}>
      <T.BoxGeometry args={[0.06, 0.84, 0.05]} />
      <T.MeshStandardMaterial color="#f0e8d0" />
    </T.Mesh>
  {/each}
  <!-- Chimney -->
  <T.Mesh position={[2.2, 4.0, 1.0]} castShadow>
    <T.BoxGeometry args={[0.7, 2.5, 0.7]} />
    <T.MeshStandardMaterial color="#7a6858" roughness={1.0} />
  </T.Mesh>
  <!-- Smoke (thin cylinders rising) -->
  {#each [0, 0.8, 1.6] as sy}
    {@const pulse = Math.sin(time * 2 + sy) * 0.5 + 0.5}
    <T.Mesh position={[2.2, 5.5 + sy, 1.0]}>
      <T.CylinderGeometry args={[0.06 + sy * 0.04, 0.3, 0.5, 6]} />
      <T.MeshBasicMaterial color="#c0b8b0" transparent opacity={0.4 - sy * 0.1} />
    </T.Mesh>
  {/each}
</T.Group>

<!-- ════════════════════════════════════════════
     SECOND BARN (at [16, 0, -14])
════════════════════════════════════════════ -->
<T.Group position={[16, 0, -14]}>
  <!-- Body -->
  <T.Mesh position={[0, 1.4, 0]} castShadow receiveShadow>
    <T.BoxGeometry args={[4.5, 2.8, 3.6]} />
    <T.MeshStandardMaterial color="#8B4513" />
  </T.Mesh>
  <!-- Roof -->
  <T.Mesh position={[0, 3.2, 0]} rotation.z={Math.PI / 4} castShadow>
    <T.BoxGeometry args={[2.4, 2.4, 3.8]} />
    <T.MeshStandardMaterial color="#902020" />
  </T.Mesh>
  <!-- White trim -->
  {#each [2.27, -2.27] as tx}
    <T.Mesh position={[tx, 1.4, 0]}>
      <T.BoxGeometry args={[0.05, 2.9, 3.7]} />
      <T.MeshStandardMaterial color="#f5f0e0" />
    </T.Mesh>
  {/each}
  <!-- Door -->
  <T.Mesh position={[0, 0.85, -1.83]}>
    <T.BoxGeometry args={[1.2, 1.7, 0.06]} />
    <T.MeshStandardMaterial color="#6B3410" />
  </T.Mesh>
  <!-- Window -->
  <T.Mesh position={[0, 2.0, -1.83]}>
    <T.BoxGeometry args={[0.7, 0.6, 0.06]} />
    <T.MeshStandardMaterial color="#ffe88a" emissive="#ffe88a" emissiveIntensity={0.2} />
  </T.Mesh>
</T.Group>

<!-- ════════════════════════════════════════════
     HAY BALES scattered around the farm
════════════════════════════════════════════ -->
{#each [
  [-10, -7], [-11, -5], [5, -10], [7, -11], [18, 2],
  [19, 4],  [-6, 14], [-4, 15],  [12, 9],
] as [hx, hz]}
  <T.Group position={[hx, 0, hz]}>
    <!-- Bale cylinder (lying on side) -->
    <T.Mesh position={[0, 0.45, 0]} rotation.z={Math.PI / 2} castShadow>
      <T.CylinderGeometry args={[0.45, 0.45, 0.85, 10]} />
      <T.MeshStandardMaterial color="#d4aa44" roughness={0.95} />
    </T.Mesh>
    <!-- Twine bands -->
    {#each [-0.2, 0.2] as bx}
      <T.Mesh position={[bx, 0.45, 0]} rotation.z={Math.PI / 2}>
        <T.TorusGeometry args={[0.46, 0.03, 6, 12]} />
        <T.MeshStandardMaterial color="#a07820" roughness={1.0} />
      </T.Mesh>
    {/each}
  </T.Group>
{/each}

<!-- ════════════════════════════════════════════
     WATER TROUGH  (at [-2, 0, -8])
════════════════════════════════════════════ -->
<T.Group position={[-2, 0, -8]}>
  <!-- Trough body (wooden) -->
  <T.Mesh position={[0, 0.25, 0]} castShadow receiveShadow>
    <T.BoxGeometry args={[2.2, 0.5, 0.8]} />
    <T.MeshStandardMaterial color="#8B6340" roughness={0.9} />
  </T.Mesh>
  <!-- Water inside -->
  <T.Mesh position={[0, 0.44, 0]}>
    <T.BoxGeometry args={[2.0, 0.06, 0.6]} />
    <T.MeshStandardMaterial color="#4a90d9" transparent opacity={0.75} metalness={0.1} roughness={0.1} />
  </T.Mesh>
  <!-- Legs -->
  {#each [[-0.9, -0.3], [0.9, -0.3], [-0.9, 0.3], [0.9, 0.3]] as [lx, lz]}
    <T.Mesh position={[lx, 0.1, lz]} castShadow>
      <T.BoxGeometry args={[0.1, 0.2, 0.1]} />
      <T.MeshStandardMaterial color="#6B4226" roughness={0.9} />
    </T.Mesh>
  {/each}
</T.Group>

<!-- ════════════════════════════════════════════
     MAGICAL WELL  (at [-8, 0, 8])
════════════════════════════════════════════ -->
<T.Group position={[-8, 0, 8]}>
  <!-- Stone base ring -->
  <T.Mesh position={[0, 0.4, 0]} castShadow>
    <T.CylinderGeometry args={[0.9, 1.0, 0.8, 12]} />
    <T.MeshStandardMaterial color="#888077" roughness={1.0} />
  </T.Mesh>
  <!-- Inner wall (slightly smaller) -->
  <T.Mesh position={[0, 0.4, 0]}>
    <T.CylinderGeometry args={[0.65, 0.65, 0.9, 12]} />
    <T.MeshStandardMaterial color="#6a6060" roughness={1.0} />
  </T.Mesh>
  <!-- Glowing magical water -->
  {@const wellGlow = Math.sin(time * 1.6) * 0.3 + 0.7}
  <T.Mesh position={[0, 0.28, 0]}>
    <T.CircleGeometry args={[0.62, 16]} />
    <T.MeshBasicMaterial color="#aa44ff" transparent opacity={wellGlow * 0.9} />
  </T.Mesh>
  <!-- Well posts -->
  {#each [[-0.65, -0.65], [0.65, -0.65]] as [px, pz]}
    <T.Mesh position={[px, 1.2, pz]} castShadow>
      <T.CylinderGeometry args={[0.08, 0.10, 1.6, 6]} />
      <T.MeshStandardMaterial color="#5a3a20" roughness={0.8} />
    </T.Mesh>
  {/each}
  <!-- Crossbeam -->
  <T.Mesh position={[0, 2.1, -0.65]} castShadow>
    <T.BoxGeometry args={[1.5, 0.12, 0.12]} />
    <T.MeshStandardMaterial color="#5a3a20" roughness={0.8} />
  </T.Mesh>
  <!-- Rope -->
  <T.Mesh position={[0, 1.6, -0.65]}>
    <T.BoxGeometry args={[0.04, 1.2, 0.04]} />
    <T.MeshStandardMaterial color="#c8a058" roughness={0.9} />
  </T.Mesh>
  <!-- Bucket -->
  <T.Mesh position={[0, 0.95, -0.65]}>
    <T.CylinderGeometry args={[0.14, 0.10, 0.28, 8]} />
    <T.MeshStandardMaterial color="#4a3a28" roughness={0.8} />
  </T.Mesh>
  <!-- Magic glow light -->
  <T.PointLight
    position={[0, 0.6, 0]}
    color="#aa44ff"
    intensity={wellGlow * 3}
    distance={8}
  />
</T.Group>

<!-- ════════════════════════════════════════════
     MUSHROOM RINGS  (magical circles)
════════════════════════════════════════════ -->
{#each [
  [5, 12, 6],
  [-15, 6, 5],
  [20, 4, 4],
] as [rx, rz, count]}
  {#each Array.from({ length: count }, (_, i) => i) as i}
    {@const angle = (i / count) * Math.PI * 2}
    {@const radius = 1.8}
    {@const mx = rx + Math.cos(angle) * radius}
    {@const mz = rz + Math.sin(angle) * radius}
    <!-- Stem -->
    <T.Mesh position={[mx, 0.2, mz]}>
      <T.CylinderGeometry args={[0.06, 0.08, 0.4, 6]} />
      <T.MeshStandardMaterial color="#e8d8c0" roughness={0.9} />
    </T.Mesh>
    <!-- Cap -->
    <T.Mesh position={[mx, 0.45, mz]}>
      <T.SphereGeometry args={[0.18, 8, 6]} />
      <T.MeshStandardMaterial
        color={['#ff4488', '#cc44ff', '#ff8800'][i % 3]}
        emissive={['#ff4488', '#cc44ff', '#ff8800'][i % 3]}
        emissiveIntensity={0.5}
      />
    </T.Mesh>
    <!-- White dots on cap -->
    {#each [0, 1, 2] as d}
      {@const da = (d / 3) * Math.PI * 2 + angle}
      <T.Mesh position={[mx + Math.cos(da) * 0.10, 0.52, mz + Math.sin(da) * 0.10]}>
        <T.SphereGeometry args={[0.03, 4, 4]} />
        <T.MeshStandardMaterial color="#ffffff" />
      </T.Mesh>
    {/each}
  {/each}
{/each}

<!-- ════════════════════════════════════════════
     FLOATING CRYSTALS
════════════════════════════════════════════ -->
{#each [
  [6, -6], [-12, 14], [22, 8], [-3, -18], [15, 16],
] as [cx, cz], ci}
  {@const floatY = Math.sin(time * 1.2 + ci * 1.1) * 0.3 + 1.8}
  {@const rotY = time * 0.5 + ci * 1.3}
  {@const crystalColor = ['#88eeff', '#ff88ee', '#eeff88', '#88ffcc', '#cc88ff'][ci]}
  <T.Mesh position={[cx, floatY, cz]} rotation.y={rotY} castShadow>
    <T.OctahedronGeometry args={[0.4]} />
    <T.MeshStandardMaterial
      color={crystalColor}
      emissive={crystalColor}
      emissiveIntensity={0.9}
      transparent
      opacity={0.85}
      metalness={0.4}
      roughness={0.1}
    />
  </T.Mesh>
  <!-- Crystal glow -->
  <T.PointLight
    position={[cx, floatY, cz]}
    color={crystalColor}
    intensity={Math.sin(time * 1.2 + ci * 1.1) * 1.0 + 1.5}
    distance={6}
  />
{/each}

<!-- ════════════════════════════════════════════
     SMALL BRIDGE over a stream
════════════════════════════════════════════ -->
<T.Group position={[6, 0, 0]} rotation.y={0.2}>
  <!-- Stream (water plane) -->
  <T.Mesh rotation.x={-Math.PI / 2} position={[0, 0.01, 0]}>
    <T.PlaneGeometry args={[1.5, 10]} />
    <T.MeshStandardMaterial color="#4488cc" transparent opacity={0.7} metalness={0.1} roughness={0.15} />
  </T.Mesh>
  <!-- Bridge deck -->
  <T.Mesh position={[0, 0.14, 0]} castShadow receiveShadow>
    <T.BoxGeometry args={[2.2, 0.14, 3.0]} />
    <T.MeshStandardMaterial color="#a08050" roughness={0.9} />
  </T.Mesh>
  <!-- Plank lines -->
  {#each [-0.9, -0.3, 0.3, 0.9] as bz}
    <T.Mesh position={[0, 0.21, bz]}>
      <T.BoxGeometry args={[2.2, 0.04, 0.12]} />
      <T.MeshStandardMaterial color="#806040" roughness={1.0} />
    </T.Mesh>
  {/each}
  <!-- Railings -->
  {#each [-1.0, 1.0] as rx}
    <T.Mesh position={[rx, 0.5, 0]} castShadow>
      <T.BoxGeometry args={[0.08, 0.72, 3.1]} />
      <T.MeshStandardMaterial color="#907050" roughness={0.9} />
    </T.Mesh>
    {#each [-1.1, 0, 1.1] as pz}
      <T.Mesh position={[rx, 0.35, pz]} castShadow>
        <T.BoxGeometry args={[0.08, 0.50, 0.08]} />
        <T.MeshStandardMaterial color="#907050" roughness={0.9} />
      </T.Mesh>
    {/each}
  {/each}
</T.Group>
