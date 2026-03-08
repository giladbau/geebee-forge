<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import * as THREE from 'three';

  let {
    position = [0, 0, 0],
    color = '#ffffff',
    hornColor = '#ffd700',
    idx = 0
  }: {
    position?: [number, number, number];
    color?: string;
    hornColor?: string;
    idx?: number;
  } = $props();

  let bobOffset = $state(0);
  let walkOffset = $state(0);
  let jumping = $state(false);
  let jumpHeight = $state(0);
  let sparkles: Array<{ id: number; x: number; y: number; z: number; life: number }> = $state([]);
  let time = $state(0);

  // Each unicorn walks in a small circle/path
  const walkSpeed = 0.15 + idx * 0.05;
  const walkRadius = 1.5 + idx * 0.3;
  const startAngle = idx * Math.PI / 2;

  let posX = $state(position[0]);
  let posZ = $state(position[2]);
  let rotation = $state(0);

  useTask((delta) => {
    time += delta;

    // Walking in a gentle circle
    walkOffset += delta * walkSpeed;
    const angle = startAngle + walkOffset;
    posX = position[0] + Math.cos(angle) * walkRadius;
    posZ = position[2] + Math.sin(angle) * walkRadius;
    rotation = -angle + Math.PI / 2;

    // Gentle bobbing
    bobOffset = Math.sin(time * 2 + idx) * 0.08;

    // Jump animation
    if (jumping) {
      jumpHeight += delta * 8;
      if (jumpHeight > Math.PI) {
        jumping = false;
        jumpHeight = 0;
      }
    }

    // Update sparkles
    sparkles = sparkles
      .map(s => ({ ...s, y: s.y + delta * 2, life: s.life - delta }))
      .filter(s => s.life > 0);
  });

  function handleClick(e: any) {
    e?.stopPropagation?.();
    if (!jumping) {
      jumping = true;
      jumpHeight = 0;
      // Spawn sparkles
      for (let i = 0; i < 8; i++) {
        sparkles.push({
          id: Math.random(),
          x: (Math.random() - 0.5) * 2,
          y: Math.random() * 0.5 + 1,
          z: (Math.random() - 0.5) * 2,
          life: 1.0
        });
      }
    }
  }

  let jumpY = $derived(jumping ? Math.sin(jumpHeight) * 2 : 0);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<T.Group
  position.x={posX}
  position.y={bobOffset + jumpY}
  position.z={posZ}
  rotation.y={rotation}
  onclick={handleClick}
>
  <!-- Body -->
  <T.Mesh position={[0, 0.7, 0]} castShadow>
    <T.BoxGeometry args={[0.8, 0.7, 1.4]} />
    <T.MeshStandardMaterial {color} />
  </T.Mesh>

  <!-- Head -->
  <T.Mesh position={[0, 1.15, -0.6]} castShadow>
    <T.BoxGeometry args={[0.55, 0.55, 0.55]} />
    <T.MeshStandardMaterial {color} />
  </T.Mesh>

  <!-- Snout -->
  <T.Mesh position={[0, 1.0, -0.9]} castShadow>
    <T.BoxGeometry args={[0.35, 0.3, 0.25]} />
    <T.MeshStandardMaterial color="#ffcccc" />
  </T.Mesh>

  <!-- Eyes -->
  <T.Mesh position={[0.18, 1.25, -0.83]}>
    <T.BoxGeometry args={[0.1, 0.1, 0.05]} />
    <T.MeshStandardMaterial color="#222222" />
  </T.Mesh>
  <T.Mesh position={[-0.18, 1.25, -0.83]}>
    <T.BoxGeometry args={[0.1, 0.1, 0.05]} />
    <T.MeshStandardMaterial color="#222222" />
  </T.Mesh>

  <!-- Horn -->
  <T.Mesh position={[0, 1.6, -0.6]} castShadow>
    <T.ConeGeometry args={[0.1, 0.6, 4]} />
    <T.MeshStandardMaterial color={hornColor} emissive={hornColor} emissiveIntensity={0.4} />
  </T.Mesh>

  <!-- Ears -->
  <T.Mesh position={[0.18, 1.45, -0.55]} rotation.z={0.3}>
    <T.BoxGeometry args={[0.08, 0.2, 0.08]} />
    <T.MeshStandardMaterial {color} />
  </T.Mesh>
  <T.Mesh position={[-0.18, 1.45, -0.55]} rotation.z={-0.3}>
    <T.BoxGeometry args={[0.08, 0.2, 0.08]} />
    <T.MeshStandardMaterial {color} />
  </T.Mesh>

  <!-- Legs -->
  {#each [[0.25, 0, -0.4], [-0.25, 0, -0.4], [0.25, 0, 0.4], [-0.25, 0, 0.4]] as [lx, ly, lz], i}
    <T.Mesh position={[lx, 0.2 + Math.sin(time * 3 + i * Math.PI / 2 + idx) * 0.05, lz]} castShadow>
      <T.BoxGeometry args={[0.2, 0.45, 0.2]} />
      <T.MeshStandardMaterial {color} />
    </T.Mesh>
    <!-- Hoof -->
    <T.Mesh position={[lx, 0.02, lz]}>
      <T.BoxGeometry args={[0.22, 0.06, 0.22]} />
      <T.MeshStandardMaterial color="#886644" />
    </T.Mesh>
  {/each}

  <!-- Tail (mane-like, colorful) -->
  <T.Mesh position={[0, 0.9, 0.75]} rotation.x={0.3 + Math.sin(time * 1.5) * 0.15}>
    <T.BoxGeometry args={[0.12, 0.5, 0.12]} />
    <T.MeshStandardMaterial color={hornColor} />
  </T.Mesh>
  <T.Mesh position={[0, 0.65, 0.85]} rotation.x={0.5 + Math.sin(time * 1.5 + 0.5) * 0.15}>
    <T.BoxGeometry args={[0.1, 0.35, 0.1]} />
    <T.MeshStandardMaterial color={hornColor} emissive={hornColor} emissiveIntensity={0.2} />
  </T.Mesh>

  <!-- Mane -->
  {#each [0, 0.2, 0.4] as mz}
    <T.Mesh position={[0, 1.35, -0.45 + mz]}>
      <T.BoxGeometry args={[0.15, 0.2, 0.15]} />
      <T.MeshStandardMaterial color={hornColor} emissive={hornColor} emissiveIntensity={0.15} />
    </T.Mesh>
  {/each}

  <!-- Click sparkles -->
  {#each sparkles as sp (sp.id)}
    <T.Mesh position={[sp.x, sp.y, sp.z]}>
      <T.BoxGeometry args={[0.12, 0.12, 0.12]} />
      <T.MeshBasicMaterial
        color={hornColor}
        transparent
        opacity={sp.life}
      />
    </T.Mesh>
  {/each}

  <!-- Point light on horn for magical glow -->
  <T.PointLight position={[0, 1.8, -0.6]} color={hornColor} intensity={0.5} distance={3} />
</T.Group>
