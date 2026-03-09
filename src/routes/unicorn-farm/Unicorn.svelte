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

  // ── Obstacle definitions [x, z, radius] ──────────────────────────────
  // Keep unicorns clear of buildings, windmills, ponds, well
  const OBSTACLES: Array<[number, number, number]> = [
    [-14, -10, 4.8],  // Main barn
    [  8, -16, 3.8],  // Farmhouse
    [ 16, -14, 3.8],  // Second barn
    [ 18,  -6, 3.2],  // Windmill 1
    [-18,   8, 3.2],  // Windmill 2
    [ 10,   8, 3.8],  // Pond 1
    [-15,  12, 3.8],  // Pond 2
    [ -8,   8, 2.8],  // Magic well
    [  8,   0, 2.0],  // Small bridge area
  ];
  const FARM_LIMIT = 17.0; // soft wall — keep inside fences

  function isBlocked(x: number, z: number): boolean {
    if (Math.abs(x) > FARM_LIMIT || Math.abs(z) > FARM_LIMIT) return true;
    for (const [ox, oz, r] of OBSTACLES) {
      const dx = x - ox, dz = z - oz;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }

  // ── Per-unicorn waypoint routes [x, z] ───────────────────────────────
  // Carefully verified to avoid all obstacles listed above.
  //
  //   idx 0 (White)  – wanderer: barn side → center → pond
  //   idx 1 (Pink)   – grazer:  tight loops near spawn
  //   idx 2 (Blue)   – left fence walker
  //   idx 3 (Purple) – front-field wanderer
  //   idx 4 (Yellow) – right-side explorer
  //   idx 5 (Green)  – left-side explorer
  //   idx 6 (Orange) – back-area wanderer
  //   idx 7 (Ghost)  – left mid-area wanderer
  //   idx 8 (Pink2)  – front-right corner explorer
  const ALL_WAYPOINTS: Array<Array<[number, number]>> = [
    [[-8, -6], [-3, -2], [6,  5], [-5,  4]],
    [[ 4,  4], [ 6,  6], [5,  2], [ 3,  5], [7,  3]],
    [[-16, -5], [-16,  2], [-14, 5], [-10, 14], [0, 14]],
    [[ 7, -4], [12, -6], [6, -12], [0, -8], [4, -2]],
    [[12,  5], [15,  2], [13, 10], [ 7, 12], [10,  4]],
    [[-12, -3], [-8, -8], [-10, 3], [-5, -2], [-2, -6]],
    [[ 2, 14], [ 8, 14], [-2, 16], [-8, 10], [ 0,  8]],
    [[-14,  4], [-12, -4], [-8, -10], [-6, -6], [-10,  6]],
    [[15, -8], [10, -10], [6, -8], [12, -4], [15, -5]],
  ];

  // Walk speed (units/s) and pause time (s) per unicorn type
  // Grazers (idx 1) move slower with longer pauses
  const WALK_SPEEDS    = [2.5, 1.2, 2.8, 2.3, 2.6, 2.4, 2.0, 2.7, 2.9];
  const PAUSE_DURATIONS = [1.2, 2.5, 0.8, 1.0, 1.5, 1.2, 1.8, 1.0, 0.8];

  // Constants derived from idx (won't change after mount)
  const myWaypoints   = ALL_WAYPOINTS[idx]    ?? ALL_WAYPOINTS[0];
  const walkSpeed     = WALK_SPEEDS[idx]       ?? 2.0;
  const pauseDuration = PAUSE_DURATIONS[idx]   ?? 1.0;

  // Stagger starting waypoint so unicorns spread out immediately
  const _startWp = idx % myWaypoints.length;

  let wpIdx     = $state(_startWp);
  let isPausing = $state(false);
  let pauseTimer = $state(0);

  // Start at the staggered waypoint position
  let posX   = $state(myWaypoints[_startWp][0]);
  let posZ   = $state(myWaypoints[_startWp][1]);
  let facing = $state(0);

  // ── Leg geometry constants ────────────────────────────────────────────
  const HIP_Y     = 0.50;
  const LEG_HALF  = 0.22;
  const HOOF_OFF  = 0.46;
  const LEG_SWING = 0.42;

  // Diagonal trot gait: front-right + back-left (phase 0), front-left + back-right (phase π)
  const LEG_X  = [ 0.26, -0.26,  0.26, -0.26] as const;
  const LEG_Z  = [-0.40, -0.40,  0.40,  0.40] as const;
  const PHASES = [    0,  Math.PI,  Math.PI,  0] as const;

  useTask((delta) => {
    time += delta;

    // ── Waypoint navigation ───────────────────────────────────────────
    if (isPausing) {
      pauseTimer -= delta;
      if (pauseTimer <= 0) {
        isPausing = false;
        // Advance to next waypoint, skipping any that land inside an obstacle
        let attempts = 0;
        do {
          wpIdx = (wpIdx + 1) % myWaypoints.length;
          attempts++;
        } while (
          isBlocked(myWaypoints[wpIdx][0], myWaypoints[wpIdx][1]) &&
          attempts < myWaypoints.length
        );
      }
    } else {
      const targetX = myWaypoints[wpIdx][0];
      const targetZ = myWaypoints[wpIdx][1];
      const dx = targetX - posX;
      const dz = targetZ - posZ;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 0.3) {
        // Arrived — enter pause
        isPausing  = true;
        pauseTimer = pauseDuration * (0.7 + Math.random() * 0.6);
      } else {
        // Move toward waypoint at walkSpeed
        const step = Math.min(walkSpeed * delta, dist);
        const nx = dx / dist;
        const nz = dz / dist;
        posX += nx * step;
        posZ += nz * step;

        // ── Fix facing direction ─────────────────────────────────────
        // Unicorn model faces -Z (head at z=-0.76, tail at z=+0.76).
        // To face world direction (nx, nz):
        //   rotation.y = atan2(-nx, -nz)
        const targetFacing = Math.atan2(-nx, -nz);

        // Shortest-path angle interpolation (no snapping)
        let diff = ((targetFacing - facing) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        facing += diff * Math.min(delta * 8.0, 1.0);
      }
    }

    // ── Jump countdown ────────────────────────────────────────────────
    if (jumping) {
      jumpProgress += delta * 3.0;
      if (jumpProgress >= Math.PI) {
        jumping      = false;
        jumpProgress = 0;
      }
    }

    // ── Sparkle physics ───────────────────────────────────────────────
    sparkles = sparkles
      .map(s => ({
        ...s,
        x:    s.x + s.vx * delta,
        y:    s.y + delta * 2.2,
        z:    s.z + s.vz * delta,
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

  // ── Derived animation values ──────────────────────────────────────────
  // Trot bounce only while actually walking (pausing unicorns stand still)
  let trotBob  = $derived(
    jumping || isPausing ? 0 : Math.abs(Math.sin(time * walkSpeed * 5)) * 0.09
  );
  let jumpY    = $derived(jumping ? Math.sin(jumpProgress) * 2.2 : 0);
  let groupY   = $derived(trotBob + jumpY);
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

  <!-- ── Legs with walk cycle ──────────────────────────────────────── -->
  {#each { length: 4 } as _, i}
    <T.Group
      position={[LEG_X[i], HIP_Y, LEG_Z[i]]}
      rotation.x={isPausing ? 0 : Math.sin(legCycle + PHASES[i]) * LEG_SWING}
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
