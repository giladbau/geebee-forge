<script lang="ts">
  import { T, useTask } from '@threlte/core';

  let time = $state(0);
  let clickedFlower = $state(-1);
  let flowerBloom = $state(0);

  // Floating sparkles — more, faster, bigger
  const sparkleCount = 55;
  let sparkles = $state(
    Array.from({ length: sparkleCount }, (_, i) => ({
      x: (Math.random() - 0.5) * 18,
      y: Math.random() * 4 + 0.5,
      z: (Math.random() - 0.5) * 18,
      speed: 0.7 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
      color: ['#ffee22', '#ff66cc', '#44eeff', '#cc88ff', '#88ff88', '#ff8844'][Math.floor(Math.random() * 6)]
    }))
  );

  // Flowers
  const flowers: Array<{ x: number; z: number; color: string; petalColor: string }> = [
    { x: -2, z: 6, color: '#ff69b4', petalColor: '#ff99cc' },
    { x: 1, z: -5, color: '#ff4488', petalColor: '#ff77aa' },
    { x: -6, z: -1, color: '#dd44ff', petalColor: '#ee88ff' },
    { x: 4, z: 6, color: '#ff8844', petalColor: '#ffaa66' },
    { x: -1, z: -8, color: '#44aaff', petalColor: '#77ccff' },
    { x: 7, z: 1, color: '#ffdd00', petalColor: '#ffee55' },
    { x: -5, z: 5, color: '#ff66aa', petalColor: '#ff99cc' },
    { x: 3, z: -1, color: '#aa44ff', petalColor: '#cc88ff' },
  ];

  // Rainbow arc points
  const rainbowColors = ['#ff0000', '#ff8800', '#ffff00', '#00cc00', '#0066ff', '#4400cc', '#8800aa'];

  useTask((delta) => {
    time += delta;

    // Animate sparkles floating up faster, reset lower
    sparkles = sparkles.map(s => ({
      ...s,
      y: s.y + delta * s.speed,
      x: s.x + Math.sin(time + s.phase) * delta * 0.5,
    })).map(s => s.y > 7 ? { ...s, y: 0.3, x: (Math.random() - 0.5) * 18, z: (Math.random() - 0.5) * 18 } : s);

    // Flower bloom animation
    if (clickedFlower >= 0) {
      flowerBloom -= delta * 2;
      if (flowerBloom <= 0) {
        clickedFlower = -1;
        flowerBloom = 0;
      }
    }
  });

  function bloomFlower(idx: number) {
    return (e: any) => {
      e?.stopPropagation?.();
      clickedFlower = idx;
      flowerBloom = 1;
    };
  }
</script>

<!-- Floating sparkles — big and bright -->
{#each sparkles as sp, i}
  {@const flicker = Math.sin(time * 6 + i) * 0.5 + 0.5}
  <T.Mesh position={[sp.x, sp.y, sp.z]} scale={0.22 + flicker * 0.2}>
    <T.BoxGeometry args={[1, 1, 1]} />
    <T.MeshBasicMaterial color={sp.color} transparent opacity={0.9 + flicker * 0.1} />
  </T.Mesh>
{/each}

<!-- Glowing flowers -->
{#each flowers as flower, idx}
  {@const bloomScale = clickedFlower === idx ? 1 + flowerBloom * 0.8 : 1}
  {@const sway = Math.sin(time * 1.5 + idx * 0.7) * 0.05}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <T.Group
    position={[flower.x, 0, flower.z]}
    scale={bloomScale}
    rotation.z={sway}
    onclick={bloomFlower(idx)}
  >
    <!-- Stem -->
    <T.Mesh position={[0, 0.25, 0]}>
      <T.BoxGeometry args={[0.06, 0.5, 0.06]} />
      <T.MeshStandardMaterial color="#2a8020" />
    </T.Mesh>
    <!-- Center -->
    <T.Mesh position={[0, 0.55, 0]}>
      <T.BoxGeometry args={[0.15, 0.15, 0.15]} />
      <T.MeshStandardMaterial color="#ffee44" emissive="#ffee44" emissiveIntensity={0.3} />
    </T.Mesh>
    <!-- Petals (4 directions) -->
    {#each [[0.15, 0], [-0.15, 0], [0, 0.15], [0, -0.15]] as [px, pz]}
      <T.Mesh position={[px, 0.55, pz]}>
        <T.BoxGeometry args={[0.12, 0.12, 0.12]} />
        <T.MeshStandardMaterial color={flower.color} emissive={flower.color} emissiveIntensity={0.5} />
      </T.Mesh>
    {/each}
    <!-- Leaf -->
    <T.Mesh position={[0.12, 0.18, 0]} rotation.z={-0.5}>
      <T.BoxGeometry args={[0.15, 0.06, 0.08]} />
      <T.MeshStandardMaterial color="#2a8020" />
    </T.Mesh>
    <!-- Glow when bloomed -->
    {#if clickedFlower === idx}
      <T.PointLight position={[0, 0.6, 0]} color={flower.color} intensity={2 * flowerBloom} distance={3} />
    {/if}
  </T.Group>
{/each}

<!-- Rainbow arc -->
<T.Group position={[-3, 0, -4]}>
  {#each rainbowColors as color, i}
    {#each Array.from({ length: 12 }, (_, j) => j) as j}
      {@const angle = (j / 11) * Math.PI}
      {@const radius = 6 + i * 0.25}
      {@const rx = Math.cos(angle) * radius}
      {@const ry = Math.sin(angle) * radius}
      <T.Mesh position={[rx, ry, i * 0.1]}>
        <T.BoxGeometry args={[0.4, 0.2, 0.15]} />
        <T.MeshBasicMaterial color={color} transparent opacity={0.85} />
      </T.Mesh>
    {/each}
  {/each}
</T.Group>

<!-- Ground glow spots (magical circles) — brighter pulse -->
{#each [[-1, 2], [4, -5], [-6, 5], [3, -8]] as [gx, gz], i}
  {@const pulse = Math.sin(time * 1.8 + i * 1.5) * 0.4 + 0.6}
  <T.Mesh rotation.x={-Math.PI / 2} position={[gx, 0.02, gz]}>
    <T.CircleGeometry args={[1.2, 20]} />
    <T.MeshBasicMaterial color="#cc55ff" transparent opacity={pulse * 0.55} />
  </T.Mesh>
  <T.PointLight position={[gx, 0.5, gz]} color="#cc55ff" intensity={pulse * 2.5} distance={5} />
{/each}
