<script lang="ts">
  import { T, useTask } from '@threlte/core';

  let time = $state(0);

  // ── Well click state ──
  let wellOrbs: Array<{ id: number; x: number; y: number; z: number; life: number; vx: number; vz: number; color: string }> = $state([]);

  function clickWell(e: any) {
    e?.stopPropagation?.();
    const colors = ['#cc66ff', '#aa44ff', '#ff88dd', '#88ccff', '#eebbff'];
    const burst = Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return {
        id: Math.random(),
        x: Math.cos(a) * 0.3,
        y: 0.6,
        z: Math.sin(a) * 0.3,
        life: 1.2 + Math.random() * 0.4,
        vx: Math.cos(a) * (0.4 + Math.random() * 0.6),
        vz: Math.sin(a) * (0.4 + Math.random() * 0.6),
        color: colors[i % colors.length],
      };
    });
    wellOrbs = [...wellOrbs, ...burst];
  }

  // ── Hay bale click state ──
  let clickedBale = $state(-1);
  let baleBounce = $state(0);

  function clickBale(idx: number) {
    return (e: any) => {
      e?.stopPropagation?.();
      clickedBale = idx;
      baleBounce = 1.0;
    };
  }

  // ── Crystal click state ──
  let clickedCrystal = $state(-1);
  let crystalPulse = $state(0);
  let crystalRingScale = $state(0);

  function clickCrystal(idx: number) {
    return (e: any) => {
      e?.stopPropagation?.();
      clickedCrystal = idx;
      crystalPulse = 1.0;
      crystalRingScale = 0.2;
    };
  }

  useTask((delta) => {
    time += delta;

    // Well orbs physics
    for (let i = wellOrbs.length - 1; i >= 0; i--) {
      const o = wellOrbs[i];
      o.x += o.vx * delta * 0.5;
      o.y += delta * 2.5;
      o.z += o.vz * delta * 0.5;
      o.life -= delta * 1.2;
      if (o.life <= 0) wellOrbs.splice(i, 1);
    }
    if (wellOrbs.length) wellOrbs = wellOrbs;

    // Hay bale bounce
    if (clickedBale >= 0) {
      baleBounce -= delta * 3.0;
      if (baleBounce <= 0) {
        clickedBale = -1;
        baleBounce = 0;
      }
    }

    // Crystal pulse + ring
    if (clickedCrystal >= 0) {
      crystalPulse -= delta * 1.8;
      crystalRingScale += delta * 4.0;
      if (crystalPulse <= 0) {
        clickedCrystal = -1;
        crystalPulse = 0;
        crystalRingScale = 0;
      }
    }
  });
</script>

<!-- ════════════════════════════════════════════
     FARMHOUSE  (at [8, 0, -16])
════════════════════════════════════════════ -->
<T.Group position={[8, 0, -16]}>
  <!-- Foundation -->
  <T.Mesh position={[0, 0.12, 0]} receiveShadow>
    <T.BoxGeometry args={[6.5, 0.24, 5.0]} />
    <T.MeshLambertMaterial color="#999080" />
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
  <T.Mesh position={[0, 5.0, 0]}>
    <T.BoxGeometry args={[0.3, 0.5, 5.3]} />
    <T.MeshLambertMaterial color="#5c2020" />
  </T.Mesh>
  <!-- Porch columns -->
  {#each [-1.2, 1.2] as cx}
    <T.Mesh position={[cx, 1.2, -2.42]}>
      <T.CylinderGeometry args={[0.12, 0.14, 2.4, 6]} />
      <T.MeshLambertMaterial color="#f0e8d0" />
    </T.Mesh>
  {/each}
  <!-- Porch overhang -->
  <T.Mesh position={[0, 2.5, -2.55]}>
    <T.BoxGeometry args={[3.0, 0.12, 0.8]} />
    <T.MeshLambertMaterial color="#c8a870" />
  </T.Mesh>
  <!-- Front door -->
  <T.Mesh position={[0, 1.0, -2.34]}>
    <T.BoxGeometry args={[1.0, 2.0, 0.08]} />
    <T.MeshLambertMaterial color="#5a3010" />
  </T.Mesh>
  <!-- Door knob -->
  <T.Mesh position={[0.3, 1.0, -2.38]}>
    <T.SphereGeometry args={[0.06, 4, 4]} />
    <T.MeshLambertMaterial color="#d4aa30" />
  </T.Mesh>
  <!-- Windows front -->
  {#each [-1.8, 1.8] as wx}
    <T.Mesh position={[wx, 1.8, -2.34]}>
      <T.BoxGeometry args={[0.8, 0.8, 0.08]} />
      <T.MeshBasicMaterial color="#ffe8a0" transparent opacity={0.85} />
    </T.Mesh>
    <T.Mesh position={[wx, 1.8, -2.36]}>
      <T.BoxGeometry args={[0.84, 0.06, 0.05]} />
      <T.MeshLambertMaterial color="#f0e8d0" />
    </T.Mesh>
    <T.Mesh position={[wx, 1.8, -2.36]}>
      <T.BoxGeometry args={[0.06, 0.84, 0.05]} />
      <T.MeshLambertMaterial color="#f0e8d0" />
    </T.Mesh>
  {/each}
  <!-- Chimney -->
  <T.Mesh position={[2.2, 4.0, 1.0]} castShadow>
    <T.BoxGeometry args={[0.7, 2.5, 0.7]} />
    <T.MeshLambertMaterial color="#7a6858" />
  </T.Mesh>
  <!-- Smoke (thin cylinders rising) -->
  {#each [0, 0.8, 1.6] as sy}
    <T.Mesh position={[2.2, 5.5 + sy, 1.0]}>
      <T.CylinderGeometry args={[0.06 + sy * 0.04, 0.3, 0.5, 4]} />
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
      <T.MeshLambertMaterial color="#f5f0e0" />
    </T.Mesh>
  {/each}
  <!-- Door -->
  <T.Mesh position={[0, 0.85, -1.83]}>
    <T.BoxGeometry args={[1.2, 1.7, 0.06]} />
    <T.MeshLambertMaterial color="#6B3410" />
  </T.Mesh>
  <!-- Window -->
  <T.Mesh position={[0, 2.0, -1.83]}>
    <T.BoxGeometry args={[0.7, 0.6, 0.06]} />
    <T.MeshBasicMaterial color="#ffe88a" />
  </T.Mesh>
</T.Group>

<!-- ════════════════════════════════════════════
     HAY BALES scattered around the farm
════════════════════════════════════════════ -->
{#each [
  [-10, -7], [-11, -5], [5, -10], [7, -11], [18, 2],
  [19, 4],  [-6, 14], [-4, 15],  [12, 9],
] as [hx, hz], bi}
  {@const bounceY = clickedBale === bi ? Math.sin(baleBounce * Math.PI) * 0.8 : 0}
  {@const bounceRot = clickedBale === bi ? Math.sin(baleBounce * Math.PI * 3) * 0.3 : 0}
  <T.Group position={[hx, bounceY, hz]} rotation.x={bounceRot} onclick={clickBale(bi)}>
    <!-- Bale cylinder (lying on side) -->
    <T.Mesh position={[0, 0.45, 0]} rotation.z={Math.PI / 2}>
      <T.CylinderGeometry args={[0.45, 0.45, 0.85, 8]} />
      <T.MeshLambertMaterial color="#d4aa44" />
    </T.Mesh>
    <!-- Twine bands -->
    {#each [-0.2, 0.2] as bx}
      <T.Mesh position={[bx, 0.45, 0]} rotation.z={Math.PI / 2}>
        <T.TorusGeometry args={[0.46, 0.03, 4, 8]} />
        <T.MeshLambertMaterial color="#a07820" />
      </T.Mesh>
    {/each}
  </T.Group>
{/each}

<!-- ════════════════════════════════════════════
     WATER TROUGH  (at [-2, 0, -8])
════════════════════════════════════════════ -->
<T.Group position={[-2, 0, -8]}>
  <!-- Trough body (wooden) -->
  <T.Mesh position={[0, 0.25, 0]} castShadow>
    <T.BoxGeometry args={[2.2, 0.5, 0.8]} />
    <T.MeshLambertMaterial color="#8B6340" />
  </T.Mesh>
  <!-- Water inside -->
  <T.Mesh position={[0, 0.44, 0]}>
    <T.BoxGeometry args={[2.0, 0.06, 0.6]} />
    <T.MeshBasicMaterial color="#4a90d9" transparent opacity={0.75} />
  </T.Mesh>
  <!-- Legs -->
  {#each [[-0.9, -0.3], [0.9, -0.3], [-0.9, 0.3], [0.9, 0.3]] as [lx, lz]}
    <T.Mesh position={[lx, 0.1, lz]}>
      <T.BoxGeometry args={[0.1, 0.2, 0.1]} />
      <T.MeshLambertMaterial color="#6B4226" />
    </T.Mesh>
  {/each}
</T.Group>

<!-- ════════════════════════════════════════════
     MAGICAL WELL  (at [-8, 0, 8])
════════════════════════════════════════════ -->
<T.Group position={[-8, 0, 8]} onclick={clickWell}>
  <!-- Stone base ring -->
  <T.Mesh position={[0, 0.4, 0]} castShadow>
    <T.CylinderGeometry args={[0.9, 1.0, 0.8, 8]} />
    <T.MeshLambertMaterial color="#888077" />
  </T.Mesh>
  <!-- Inner wall (slightly smaller) -->
  <T.Mesh position={[0, 0.4, 0]}>
    <T.CylinderGeometry args={[0.65, 0.65, 0.9, 8]} />
    <T.MeshLambertMaterial color="#6a6060" />
  </T.Mesh>
  <!-- Glowing magical water -->
  {@const wellGlow = Math.sin(time * 1.6) * 0.3 + 0.7}
  <T.Mesh position={[0, 0.28, 0]}>
    <T.CircleGeometry args={[0.62, 8]} />
    <T.MeshBasicMaterial color="#aa44ff" transparent opacity={wellGlow * 0.9} />
  </T.Mesh>
  <!-- Well posts -->
  {#each [[-0.65, -0.65], [0.65, -0.65]] as [px, pz]}
    <T.Mesh position={[px, 1.2, pz]}>
      <T.CylinderGeometry args={[0.08, 0.10, 1.6, 4]} />
      <T.MeshLambertMaterial color="#5a3a20" />
    </T.Mesh>
  {/each}
  <!-- Crossbeam -->
  <T.Mesh position={[0, 2.1, -0.65]}>
    <T.BoxGeometry args={[1.5, 0.12, 0.12]} />
    <T.MeshLambertMaterial color="#5a3a20" />
  </T.Mesh>
  <!-- Rope -->
  <T.Mesh position={[0, 1.6, -0.65]}>
    <T.BoxGeometry args={[0.04, 1.2, 0.04]} />
    <T.MeshLambertMaterial color="#c8a058" />
  </T.Mesh>
  <!-- Bucket -->
  <T.Mesh position={[0, 0.95, -0.65]}>
    <T.CylinderGeometry args={[0.14, 0.10, 0.28, 6]} />
    <T.MeshLambertMaterial color="#4a3a28" />
  </T.Mesh>
  <!-- Magic glow light -->
  <T.PointLight
    position={[0, 0.6, 0]}
    color="#aa44ff"
    intensity={wellGlow * 3}
    distance={8}
  />
  <!-- Well orb particles -->
  {#each wellOrbs as orb}
    <T.Mesh position={[orb.x, orb.y, orb.z]} scale={0.08 + orb.life * 0.1}>
      <T.SphereGeometry args={[1, 4, 4]} />
      <T.MeshBasicMaterial color={orb.color} transparent opacity={Math.min(orb.life, 1.0)} />
    </T.Mesh>
  {/each}
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
      <T.CylinderGeometry args={[0.06, 0.08, 0.4, 4]} />
      <T.MeshLambertMaterial color="#e8d8c0" />
    </T.Mesh>
    <!-- Cap -->
    {@const capColor = ['#ff4488', '#cc44ff', '#ff8800'][i % 3]}
    <T.Mesh position={[mx, 0.45, mz]}>
      <T.SphereGeometry args={[0.18, 6, 4]} />
      <T.MeshBasicMaterial color={capColor} />
    </T.Mesh>
    <!-- White dots on cap -->
    {#each [0, 1, 2] as d}
      {@const da = (d / 3) * Math.PI * 2 + angle}
      <T.Mesh position={[mx + Math.cos(da) * 0.10, 0.52, mz + Math.sin(da) * 0.10]}>
        <T.SphereGeometry args={[0.03, 3, 3]} />
        <T.MeshBasicMaterial color="#ffffff" />
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
  {@const isPulsing = clickedCrystal === ci}
  {@const pulseScale = isPulsing ? 1 + crystalPulse * 0.6 : 1}
  {@const pulseEmissive = isPulsing ? 0.9 + crystalPulse * 4.0 : 0.9}
  <T.Group position={[cx, floatY, cz]}>
    <T.Mesh rotation.y={rotY} scale={pulseScale} onclick={clickCrystal(ci)}>
      <T.OctahedronGeometry args={[0.4]} />
      <T.MeshStandardMaterial
        color={crystalColor}
        emissive={crystalColor}
        emissiveIntensity={pulseEmissive}
        transparent
        opacity={0.85}
        metalness={0.4}
        roughness={0.1}
      />
    </T.Mesh>
    <!-- Light ring on pulse -->
    {#if isPulsing}
      <T.Mesh rotation.x={-Math.PI / 2} scale={crystalRingScale}>
        <T.TorusGeometry args={[1, 0.06, 4, 12]} />
        <T.MeshBasicMaterial color={crystalColor} transparent opacity={crystalPulse * 0.8} />
      </T.Mesh>
      <T.PointLight
        color={crystalColor}
        intensity={crystalPulse * 8}
        distance={6}
      />
    {/if}
  </T.Group>
{/each}

<!-- ════════════════════════════════════════════
     SMALL BRIDGE over a stream
════════════════════════════════════════════ -->
<T.Group position={[6, 0, 0]} rotation.y={0.2}>
  <!-- Stream (water plane) -->
  <T.Mesh rotation.x={-Math.PI / 2} position={[0, 0.01, 0]}>
    <T.PlaneGeometry args={[1.5, 10]} />
    <T.MeshBasicMaterial color="#4488cc" transparent opacity={0.7} />
  </T.Mesh>
  <!-- Bridge deck -->
  <T.Mesh position={[0, 0.14, 0]} castShadow>
    <T.BoxGeometry args={[2.2, 0.14, 3.0]} />
    <T.MeshLambertMaterial color="#a08050" />
  </T.Mesh>
  <!-- Plank lines -->
  {#each [-0.9, -0.3, 0.3, 0.9] as bz}
    <T.Mesh position={[0, 0.21, bz]}>
      <T.BoxGeometry args={[2.2, 0.04, 0.12]} />
      <T.MeshLambertMaterial color="#806040" />
    </T.Mesh>
  {/each}
  <!-- Railings -->
  {#each [-1.0, 1.0] as rx}
    <T.Mesh position={[rx, 0.5, 0]}>
      <T.BoxGeometry args={[0.08, 0.72, 3.1]} />
      <T.MeshLambertMaterial color="#907050" />
    </T.Mesh>
    {#each [-1.1, 0, 1.1] as pz}
      <T.Mesh position={[rx, 0.35, pz]}>
        <T.BoxGeometry args={[0.08, 0.50, 0.08]} />
        <T.MeshLambertMaterial color="#907050" />
      </T.Mesh>
    {/each}
  {/each}
</T.Group>
