<script lang="ts">
  import { T, useTask } from '@threlte/core';

  let {
    position = [0, 0, 0] as [number, number, number],
    color = '#ffffff',
    hornColor = '#ffd700',
    idx = 0
  }: {
    position?: [number, number, number];
    color?: string;
    hornColor?: string;
    idx?: number;
  } = $props();

  let time = $state(0);
  let jumping = $state(false);
  let jumpProgress = $state(0);
  let sparkles: Array<{
    id: number; x: number; y: number; z: number;
    life: number; vx: number; vz: number;
  }> = $state([]);

  // Varied walking params per unicorn (use let + $derived so Svelte 5 tracks prop refs)
  let walkSpeed  = $derived(0.45 + idx * 0.08);
  let walkRadius = $derived(2.8 + (idx % 5) * 0.9);
  let startAngle = $derived((idx * Math.PI * 2) / 9);

  // Capture position as orbit centre ($derived so Svelte 5 doesn't warn about prop capture)
  let baseX = $derived(position[0]);
  let baseZ = $derived(position[2]);

  let posX = $state(0);
  let posZ = $state(0);
  let facing = $state(0);

  // ── Leg geometry constants ──────────────────────────────────────────
  // Hip pivot is at y = HIP_Y.  Leg mesh center at [0, -LEG_HALF, 0] rel. hip.
  // Hoof mesh center at [0, -HOOF_OFFSET, 0] rel. hip.
  // At rotation.x = 0 (straight down):
  //   hoof centre y  = HIP_Y - HOOF_OFFSET
  //   hoof bottom y  = HIP_Y - HOOF_OFFSET - HOOF_HALF
  // We want hoof bottom = 0 when group y = 0:
  //   ⟹  HIP_Y = HOOF_OFFSET + HOOF_HALF  = 0.46 + 0.04 = 0.50  ✓
  const HIP_Y      = 0.50;
  const LEG_HALF   = 0.22;   // half of 0.44 tall leg
  const HOOF_OFF   = 0.46;   // distance from hip centre to hoof centre
  const HOOF_HALF  = 0.04;
  const LEG_SWING  = 0.42;   // radians swing amplitude

  // Diagonal (trot) gait: front-right + back-left together (phase 0),
  // front-left + back-right together (phase π)
  // Order: front-right, front-left, back-right, back-left
  const LEG_X   = [ 0.26, -0.26,  0.26, -0.26] as const;
  const LEG_Z   = [-0.40, -0.40,  0.40,  0.40] as const;
  const PHASES  = [    0,  Math.PI,  Math.PI,  0] as const;

  useTask((delta) => {
    time += delta;

    // Walking in a circle around the base position
    const angle = startAngle + time * walkSpeed;
    posX   = baseX + Math.cos(angle) * walkRadius;
    posZ   = baseZ + Math.sin(angle) * walkRadius;
    facing = -angle + Math.PI / 2;

    // Jump countdown
    if (jumping) {
      jumpProgress += delta * 3.0;
      if (jumpProgress >= Math.PI) {
        jumping      = false;
        jumpProgress = 0;
      }
    }

    // Sparkle physics
    sparkles = sparkles
      .map(s => ({
        ...s,
        x: s.x + s.vx * delta,
        y: s.y + delta * 2.2,
        z: s.z + s.vz * delta,
        life: s.life - delta * 1.6,
      }))
      .filter(s => s.life > 0);
  });

  function handleClick(e: any) {
    e?.stopPropagation?.();
    if (jumping) return;
    jumping      = true;
    jumpProgress = 0;
    // Radial sparkle burst
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      sparkles = [
        ...sparkles,
        {
          id:  Math.random(),
          x:   Math.cos(a) * 0.25,
          y:   0.8 + Math.random() * 0.4,
          z:   Math.sin(a) * 0.25,
          life: 1.1,
          vx:  Math.cos(a) * (1.5 + Math.random()),
          vz:  Math.sin(a) * (1.5 + Math.random()),
        },
      ];
    }
  }

  // ── Derived animation values ─────────────────────────────────────────
  // Trot bounce: ONLY upward (abs-sin), so feet never sink below ground
  let trotBob = $derived(
    jumping ? 0 : Math.abs(Math.sin(time * walkSpeed * 5)) * 0.09
  );
  // Jump arc
  let jumpY = $derived(jumping ? Math.sin(jumpProgress) * 2.2 : 0);
  // Group y is always ≥ 0; at rest ≥ 0, max 0.09 trot or 2.2 jump
  let groupY = $derived(trotBob + jumpY);

  // Leg swing driven by walk speed (matches locomotion rate)
  // 4× walkSpeed gives ≈2 full step-pairs per revolution
  let legCycle = $derived(time * walkSpeed * 8);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<T.Group
  position.x={posX}
  position.y={groupY}
  position.z={posZ}
  rotation.y={facing}
  onclick={handleClick}
>

  <!-- ── Body ── -->
  <T.Mesh position={[0, 0.82, 0]} castShadow>
    <T.BoxGeometry args={[0.80, 0.60, 1.40]} />
    <T.MeshStandardMaterial {color} emissive={color} emissiveIntensity={0.25} roughness={0.45} />
  </T.Mesh>

  <!-- ── Neck ── -->
  <T.Mesh position={[0, 1.18, -0.52]} rotation.x={-0.30} castShadow>
    <T.BoxGeometry args={[0.40, 0.48, 0.38]} />
    <T.MeshStandardMaterial {color} emissive={color} emissiveIntensity={0.25} roughness={0.45} />
  </T.Mesh>

  <!-- ── Head ── -->
  <T.Mesh position={[0, 1.48, -0.76]} castShadow>
    <T.BoxGeometry args={[0.54, 0.50, 0.54]} />
    <T.MeshStandardMaterial {color} emissive={color} emissiveIntensity={0.25} roughness={0.45} />
  </T.Mesh>

  <!-- ── Snout ── -->
  <T.Mesh position={[0, 1.32, -1.05]}>
    <T.BoxGeometry args={[0.34, 0.26, 0.24]} />
    <T.MeshStandardMaterial color="#ffcccc" />
  </T.Mesh>

  <!-- ── Eyes ── -->
  <T.Mesh position={[ 0.20, 1.52, -1.01]}>
    <T.BoxGeometry args={[0.10, 0.10, 0.05]} />
    <T.MeshStandardMaterial color="#111122" emissive="#4444ff" emissiveIntensity={0.5} />
  </T.Mesh>
  <T.Mesh position={[-0.20, 1.52, -1.01]}>
    <T.BoxGeometry args={[0.10, 0.10, 0.05]} />
    <T.MeshStandardMaterial color="#111122" emissive="#4444ff" emissiveIntensity={0.5} />
  </T.Mesh>

  <!-- ── Horn ── -->
  <T.Mesh position={[0, 1.92, -0.76]} castShadow>
    <T.ConeGeometry args={[0.09, 0.64, 4]} />
    <T.MeshStandardMaterial color={hornColor} emissive={hornColor} emissiveIntensity={2.0} />
  </T.Mesh>

  <!-- ── Ears ── -->
  <T.Mesh position={[ 0.21, 1.74, -0.65]} rotation.z={ 0.3}>
    <T.BoxGeometry args={[0.08, 0.17, 0.08]} />
    <T.MeshStandardMaterial {color} />
  </T.Mesh>
  <T.Mesh position={[-0.21, 1.74, -0.65]} rotation.z={-0.3}>
    <T.BoxGeometry args={[0.08, 0.17, 0.08]} />
    <T.MeshStandardMaterial {color} />
  </T.Mesh>

  <!-- ── Mane (glowing strands down the neck) ── -->
  {#each [0, 0.20, 0.40] as mz}
    <T.Mesh position={[0, 1.60, -0.50 + mz]}>
      <T.BoxGeometry args={[0.15, 0.19, 0.15]} />
      <T.MeshStandardMaterial color={hornColor} emissive={hornColor} emissiveIntensity={0.9} />
    </T.Mesh>
  {/each}

  <!-- ── Legs with walk cycle ────────────────────────────────── -->
  <!--
    Hip pivot at [lx, HIP_Y, lz].
    Leg + hoof hang below.  At rotation.x = 0, hoof bottom = 0 (ground level).
    When swinging, hoof rises — never sinks below group.y = 0.
  -->
  {#each { length: 4 } as _, i}
    <T.Group
      position={[LEG_X[i], HIP_Y, LEG_Z[i]]}
      rotation.x={Math.sin(legCycle + PHASES[i]) * LEG_SWING}
    >
      <!-- Leg shaft -->
      <T.Mesh position={[0, -LEG_HALF, 0]} castShadow>
        <T.BoxGeometry args={[0.20, 0.44, 0.20]} />
        <T.MeshStandardMaterial {color} roughness={0.5} />
      </T.Mesh>
      <!-- Hoof -->
      <T.Mesh position={[0, -HOOF_OFF, 0]}>
        <T.BoxGeometry args={[0.22, 0.08, 0.22]} />
        <T.MeshStandardMaterial color="#886644" roughness={0.8} />
      </T.Mesh>
    </T.Group>
  {/each}

  <!-- ── Tail (wags) ── -->
  <T.Mesh
    position={[0, 0.94, 0.76]}
    rotation.x={0.30 + Math.sin(time * 3.2) * 0.32}
    castShadow
  >
    <T.BoxGeometry args={[0.14, 0.50, 0.14]} />
    <T.MeshStandardMaterial color={hornColor} emissive={hornColor} emissiveIntensity={0.75} />
  </T.Mesh>
  <T.Mesh
    position={[0, 0.68, 0.93]}
    rotation.x={0.55 + Math.sin(time * 3.2 + 0.5) * 0.30}
    castShadow
  >
    <T.BoxGeometry args={[0.10, 0.34, 0.10]} />
    <T.MeshStandardMaterial color={hornColor} emissive={hornColor} emissiveIntensity={0.95} />
  </T.Mesh>

  <!-- ── Click sparkles ── -->
  {#each sparkles as sp (sp.id)}
    <T.Mesh position={[sp.x, sp.y, sp.z]}>
      <T.BoxGeometry args={[0.17, 0.17, 0.17]} />
      <T.MeshBasicMaterial color={hornColor} transparent opacity={sp.life} />
    </T.Mesh>
  {/each}

  <!-- ── Horn glow light ── -->
  <T.PointLight position={[0, 1.92, -0.76]} color={hornColor} intensity={3.5} distance={7} />
</T.Group>
