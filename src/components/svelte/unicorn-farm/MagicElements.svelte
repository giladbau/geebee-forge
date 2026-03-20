<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import * as THREE from 'three';

  let time = $state(0);
  let clickedFlower = $state(-1);
  let flowerBloom = $state(0);
  let rainbowWobble = $state(0);
  let petalParticles: Array<{ id: number; x: number; y: number; z: number; life: number; vx: number; vy: number; vz: number; color: string }> = $state([]);

  // --- Shared geometries (created once) ---
  const heartShape = new THREE.Shape();
  heartShape.moveTo(0, 0.3);
  heartShape.bezierCurveTo(0, 0.5, 0.35, 0.5, 0.35, 0.3);
  heartShape.bezierCurveTo(0.35, 0.1, 0, -0.1, 0, -0.35);
  heartShape.bezierCurveTo(0, -0.1, -0.35, 0.1, -0.35, 0.3);
  heartShape.bezierCurveTo(-0.35, 0.5, 0, 0.5, 0, 0.3);
  const heartGeo = new THREE.ExtrudeGeometry(heartShape, { depth: 0.1, bevelEnabled: false });

  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 0.4 : 0.18;
    const sx = Math.cos(angle) * r;
    const sy = Math.sin(angle) * r;
    if (i === 0) starShape.moveTo(sx, sy);
    else starShape.lineTo(sx, sy);
  }
  starShape.closePath();
  const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.1, bevelEnabled: false });

  // --- Rainbow particle pool ---
  const POOL_SIZE = 60;

  interface PoolParticle {
    active: boolean;
    x: number; y: number; z: number;
    vx: number; vy: number; vz: number;
    life: number;
    color: string;
    shape: 'heart' | 'star';
    spin: number;
  }

  let rainbowPool: PoolParticle[] = $state(
    Array.from({ length: POOL_SIZE }, () => ({
      active: false,
      x: 0, y: -100, z: 0,
      vx: 0, vy: 0, vz: 0,
      life: 0,
      color: '#ff0000',
      shape: 'heart' as const,
      spin: 0,
    }))
  );

  let nextPoolIdx = 0;

  const fireflyCount = 35;
  let fireflies = $state(
    Array.from({ length: fireflyCount }, (_, i) => ({
      x:     (Math.random() - 0.5) * 40,
      y:     Math.random() * 3.5 + 0.3,
      z:     (Math.random() - 0.5) * 40,
      speed: 0.5 + Math.random() * 1.0,
      phase: Math.random() * Math.PI * 2,
      color: ['#ffee22', '#ff66cc', '#44eeff', '#cc88ff', '#88ff88', '#ff8844'][Math.floor(Math.random() * 6)],
    }))
  );

  const flowers: Array<{ x: number; z: number; color: string }> = [
    { x: -2,  z:  6,  color: '#ff69b4' },
    { x:  1,  z: -5,  color: '#ff4488' },
    { x: -6,  z: -1,  color: '#dd44ff' },
    { x:  4,  z:  6,  color: '#ff8844' },
    { x: -1,  z: -8,  color: '#44aaff' },
    { x:  7,  z:  1,  color: '#ffdd00' },
    { x: -5,  z:  5,  color: '#ff66aa' },
    { x:  3,  z: -1,  color: '#aa44ff' },
    { x: 10,  z:  5,  color: '#ff99cc' },
    { x:-10,  z:  8,  color: '#66ffaa' },
    { x:  8,  z:-10,  color: '#ff6644' },
    { x:-12,  z: -6,  color: '#44ddff' },
    { x: 14,  z: 10,  color: '#ffcc44' },
    { x: -8,  z: 15,  color: '#cc44ff' },
    { x: 16,  z: -4,  color: '#ff44aa' },
    { x:-16,  z: 12,  color: '#44ffcc' },
  ];

  const rainbowColors = ['#ff0000','#ff8800','#ffff00','#00cc00','#0066ff','#4400cc','#8800aa'];

  useTask((delta) => {
    time += delta;

    for (let i = 0; i < fireflies.length; i++) {
      const s = fireflies[i];
      s.x += Math.sin(time + s.phase) * delta * 0.6;
      s.y += delta * s.speed;
      s.z += Math.cos(time * 0.7 + s.phase) * delta * 0.4;
      if (s.y > 5) {
        s.y = 0.3;
        s.x = (Math.random() - 0.5) * 40;
        s.z = (Math.random() - 0.5) * 40;
      }
    }
    fireflies = fireflies;

    if (clickedFlower >= 0) {
      flowerBloom -= delta * 1.5;
      if (flowerBloom <= 0) {
        clickedFlower = -1;
        flowerBloom   = 0;
      }
    }

    // Petal particle physics
    for (let i = petalParticles.length - 1; i >= 0; i--) {
      const p = petalParticles[i];
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.z += p.vz * delta;
      p.vy -= delta * 4.0; // gravity
      p.life -= delta * 1.4;
      if (p.life <= 0) petalParticles.splice(i, 1);
    }
    if (petalParticles.length) petalParticles = petalParticles;

    // Rainbow pool physics
    let anyActive = false;
    for (let i = 0; i < POOL_SIZE; i++) {
      const p = rainbowPool[i];
      if (!p.active) continue;
      anyActive = true;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.z += p.vz * delta;
      p.vy -= delta * 3.5;
      p.spin += delta * 4.0;
      p.life -= delta * 0.5;
      if (p.life <= 0) {
        p.active = false;
        p.y = -100;
      }
    }
    if (anyActive) rainbowPool = rainbowPool;

    // Rainbow wobble decay
    if (rainbowWobble > 0) {
      rainbowWobble = Math.max(0, rainbowWobble - delta / 0.6);
    }
  });

  function bloomFlower(idx: number) {
    return (e: any) => {
      e?.stopPropagation?.();
      clickedFlower = idx;
      flowerBloom   = 1.0;
      // Spawn petal particles
      const f = flowers[idx];
      const burst = Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return {
          id: Math.random(),
          x: f.x + Math.cos(a) * 0.15,
          y: 0.6,
          z: f.z + Math.sin(a) * 0.15,
          life: 1.0 + Math.random() * 0.4,
          vx: Math.cos(a) * (1.5 + Math.random() * 1.5),
          vy: 2.0 + Math.random() * 2.0,
          vz: Math.sin(a) * (1.5 + Math.random() * 1.5),
          color: f.color,
        };
      });
      petalParticles = [...petalParticles, ...burst];
    };
  }

  function clickRainbow(e: any) {
    e?.stopPropagation?.();
    const cx = -5, cy = 4, cz = -5;
    const count = 28;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const upAngle = Math.random() * Math.PI * 0.6;
      const speed = 2.5 + Math.random() * 3.0;
      const p = rainbowPool[nextPoolIdx];
      p.active = true;
      p.x = cx + (Math.random() - 0.5) * 2;
      p.y = cy + Math.random() * 2;
      p.z = cz + (Math.random() - 0.5) * 2;
      p.life = 1.0 + Math.random() * 1.0;
      p.vx = Math.cos(a) * Math.cos(upAngle) * speed;
      p.vy = Math.sin(upAngle) * speed + 1.5;
      p.vz = Math.sin(a) * Math.cos(upAngle) * speed;
      p.color = rainbowColors[Math.floor(Math.random() * rainbowColors.length)];
      p.shape = i % 2 === 0 ? 'heart' : 'star';
      p.spin = Math.random() * Math.PI * 2;
      nextPoolIdx = (nextPoolIdx + 1) % POOL_SIZE;
    }
    rainbowPool = rainbowPool;
    rainbowWobble = 1.0;
  }
</script>

{#each fireflies as ff, i}
  {@const flicker = Math.sin(time * 7 + i) * 0.5 + 0.5}
  <T.Mesh position={[ff.x, ff.y, ff.z]} scale={0.14 + flicker * 0.14}>
    <T.BoxGeometry args={[1, 1, 1]} />
    <T.MeshBasicMaterial color={ff.color} transparent opacity={0.75 + flicker * 0.25} />
  </T.Mesh>
{/each}

{#each flowers as flower, idx}
  {@const bloomScale = clickedFlower === idx ? 1 + flowerBloom * 1.8 : 1}
  {@const sway = Math.sin(time * 1.5 + idx * 0.7) * 0.05}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <T.Group
    position={[flower.x, 0, flower.z]}
    scale={bloomScale}
    rotation.z={sway}
    onclick={bloomFlower(idx)}
  >
    <T.Mesh position={[0, 0.28, 0]}>
      <T.BoxGeometry args={[0.06, 0.56, 0.06]} />
      <T.MeshLambertMaterial color="#2a8020" />
    </T.Mesh>
    <T.Mesh position={[0, 0.60, 0]}>
      <T.BoxGeometry args={[0.16, 0.16, 0.16]} />
      <T.MeshBasicMaterial color="#ffee44" />
    </T.Mesh>
    {#each [
      [0.17, 0, 0], [-0.17, 0, 0], [0, 0, 0.17], [0, 0, -0.17],
      [0.12, 0, 0.12], [-0.12, 0, 0.12], [0.12, 0, -0.12], [-0.12, 0, -0.12],
    ] as [px, py, pz]}
      <T.Mesh position={[px, 0.60, pz]}>
        <T.BoxGeometry args={[0.11, 0.11, 0.11]} />
        <T.MeshBasicMaterial color={flower.color} />
      </T.Mesh>
    {/each}
    <T.Mesh position={[0.14, 0.20, 0]} rotation.z={-0.5}>
      <T.BoxGeometry args={[0.16, 0.06, 0.08]} />
      <T.MeshLambertMaterial color="#2a8020" />
    </T.Mesh>
  </T.Group>
{/each}

<!-- Petal particles -->
{#each petalParticles as petal}
  <T.Mesh position={[petal.x, petal.y, petal.z]} scale={0.06 + petal.life * 0.06}>
    <T.BoxGeometry args={[1, 0.4, 1]} />
    <T.MeshBasicMaterial color={petal.color} transparent opacity={Math.min(petal.life, 1.0)} />
  </T.Mesh>
{/each}

<!-- Rainbow particles (pooled, shared geometries) -->
{#each rainbowPool as rp}
  {@const s = 0.28 + rp.life * 0.35}
  <T.Mesh
    visible={rp.active}
    geometry={rp.shape === 'heart' ? heartGeo : starGeo}
    position={[rp.x, rp.y, rp.z]}
    rotation.y={rp.spin}
    scale={s}
  >
    <T.MeshBasicMaterial color={rp.color} transparent opacity={Math.min(rp.life, 1.0)} />
  </T.Mesh>
{/each}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<T.Group position={[-5, 0, -5]} rotation.z={rainbowWobble * Math.sin(time * 30) * 0.12} onclick={clickRainbow}>
  {#each rainbowColors as color, i}
    {#each Array.from({ length: 10 }, (_, j) => j) as j}
      {@const angle  = (j / 9) * Math.PI}
      {@const radius = 7 + i * 0.55}
      {@const rx = Math.cos(angle) * radius}
      {@const ry = Math.sin(angle) * radius}
      <T.Mesh position={[rx, ry, i * 0.18]}>
        <T.BoxGeometry args={[0.72, 0.52, 0.28]} />
        <T.MeshBasicMaterial color={color} transparent opacity={0.90} />
      </T.Mesh>
    {/each}
  {/each}
</T.Group>

{#each [
  [-1, 2], [4, -5], [-6, 5], [3, -8],
  [12, 8], [-14, 3], [8, 18], [-5, -16],
] as [gx, gz], i}
  {@const pulse = Math.sin(time * 1.6 + i * 1.3) * 0.4 + 0.6}
  <T.Mesh rotation.x={-Math.PI / 2} position={[gx, 0.02, gz]}>
    <T.CircleGeometry args={[1.4, 8]} />
    <T.MeshBasicMaterial color="#cc55ff" transparent opacity={pulse * 0.50} />
  </T.Mesh>
{/each}

{#each [[10, -2], [-8, -10], [18, 14], [-18, 8]] as [sx, sz], si}
  {@const spinY  = time * (0.8 + si * 0.3)}
  {@const glow   = Math.sin(time * 2 + si) * 0.3 + 0.7}
  {@const starColor = ['#ffcc00','#ff44aa','#44ffcc','#aa88ff'][si]}
  <T.Group position={[sx, 0.8, sz]} rotation.y={spinY}>
    {#each [0, Math.PI / 3, Math.PI * 2/3] as ra}
      <T.Mesh rotation.y={ra}>
        <T.BoxGeometry args={[1.2, 0.08, 0.08]} />
        <T.MeshBasicMaterial color={starColor} transparent opacity={glow} />
      </T.Mesh>
    {/each}
  </T.Group>
{/each}
