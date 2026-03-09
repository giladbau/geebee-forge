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

  const OBSTACLES: Array<[number, number, number]> = [
    [-14, -10, 4.8],
    [  8, -16, 3.8],
    [ 16, -14, 3.8],
    [ 18,  -6, 3.2],
    [-18,   8, 3.2],
    [ 10,   8, 3.8],
    [-15,  12, 3.8],
    [ -8,   8, 2.8],
    [  8,   0, 2.0],
  ];
  const FARM_LIMIT = 17.0;

  function isBlocked(x: number, z: number): boolean {
    if (Math.abs(x) > FARM_LIMIT || Math.abs(z) > FARM_LIMIT) return true;
    for (const [ox, oz, r] of OBSTACLES) {
      const dx = x - ox, dz = z - oz;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }

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

  const WALK_SPEEDS    = [2.5, 1.2, 2.8, 2.3, 2.6, 2.4, 2.0, 2.7, 2.9];
  const PAUSE_DURATIONS = [1.2, 2.5, 0.8, 1.0, 1.5, 1.2, 1.8, 1.0, 0.8];

  const myWaypoints   = ALL_WAYPOINTS[idx]    ?? ALL_WAYPOINTS[0];
  const walkSpeed     = WALK_SPEEDS[idx]       ?? 2.0;
  const pauseDuration = PAUSE_DURATIONS[idx]   ?? 1.0;

  const _startWp = idx % myWaypoints.length;

  let wpIdx     = $state(_startWp);
  let isPausing = $state(false);
  let pauseTimer = $state(0);

  let posX   = $state(myWaypoints[_startWp][0]);
  let posZ   = $state(myWaypoints[_startWp][1]);
  let facing = $state(0);

  const HIP_Y     = 0.50;
  const LEG_HALF  = 0.22;
  const HOOF_OFF  = 0.46;
  const LEG_SWING = 0.42;

  const LEG_X  = [ 0.26, -0.26,  0.26, -0.26] as const;
  const LEG_Z  = [-0.40, -0.40,  0.40,  0.40] as const;
  const PHASES = [    0,  Math.PI,  Math.PI,  0] as const;

  useTask((delta) => {
    time += delta;

    if (isPausing) {
      pauseTimer -= delta;
      if (pauseTimer <= 0) {
        isPausing = false;
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
        isPausing  = true;
        pauseTimer = pauseDuration * (0.7 + Math.random() * 0.6);
      } else {
        const step = Math.min(walkSpeed * delta, dist);
        const nx = dx / dist;
        const nz = dz / dist;
        posX += nx * step;
        posZ += nz * step;

        const targetFacing = Math.atan2(-nx, -nz);
        let diff = ((targetFacing - facing) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        facing += diff * Math.min(delta * 8.0, 1.0);
      }
    }

    if (jumping) {
      jumpProgress += delta * 3.0;
      if (jumpProgress >= Math.PI) {
        jumping      = false;
        jumpProgress = 0;
      }
    }

    if (sparkles.length > 0) {
      for (let i = sparkles.length - 1; i >= 0; i--) {
        const s = sparkles[i];
        s.x += s.vx * delta;
        s.y += delta * 2.2;
        s.z += s.vz * delta;
        s.life -= delta * 1.6;
        if (s.life <= 0) sparkles.splice(i, 1);
      }
      sparkles = sparkles;
    }
  });

  function handleClick(e: any) {
    e?.stopPropagation?.();
    if (jumping) return;
    jumping      = true;
    jumpProgress = 0;
    const burst = Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return {
        id:   Math.random(),
        x:    Math.cos(a) * 0.25,
        y:    0.8 + Math.random() * 0.4,
        z:    Math.sin(a) * 0.25,
        life: 1.1,
        vx:   Math.cos(a) * (1.5 + Math.random()),
        vz:   Math.sin(a) * (1.5 + Math.random()),
      };
    });
    sparkles = [...sparkles, ...burst];
  }

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

  <!-- Body -->
  <T.Mesh position={[0, 0.82, 0]} castShadow>
    <T.BoxGeometry args={[0.80, 0.60, 1.40]} />
    <T.MeshStandardMaterial {color} emissive={color} emissiveIntensity={0.25} roughness={0.45} />
  </T.Mesh>

  <!-- Neck -->
  <T.Mesh position={[0, 1.18, -0.52]} rotation.x={-0.30}>
    <T.BoxGeometry args={[0.40, 0.48, 0.38]} />
    <T.MeshLambertMaterial {color} emissive={color} emissiveIntensity={0.25} />
  </T.Mesh>

  <!-- Head -->
  <T.Mesh position={[0, 1.48, -0.76]} castShadow>
    <T.BoxGeometry args={[0.54, 0.50, 0.54]} />
    <T.MeshStandardMaterial {color} emissive={color} emissiveIntensity={0.25} roughness={0.45} />
  </T.Mesh>

  <!-- Snout -->
  <T.Mesh position={[0, 1.32, -1.05]}>
    <T.BoxGeometry args={[0.34, 0.26, 0.24]} />
    <T.MeshLambertMaterial color="#ffcccc" />
  </T.Mesh>

  <!-- Eyes -->
  <T.Mesh position={[ 0.20, 1.52, -1.01]}>
    <T.BoxGeometry args={[0.10, 0.10, 0.05]} />
    <T.MeshBasicMaterial color="#111122" />
  </T.Mesh>
  <T.Mesh position={[-0.20, 1.52, -1.01]}>
    <T.BoxGeometry args={[0.10, 0.10, 0.05]} />
    <T.MeshBasicMaterial color="#111122" />
  </T.Mesh>

  <!-- Horn -->
  <T.Mesh position={[0, 1.92, -0.76]}>
    <T.ConeGeometry args={[0.09, 0.64, 4]} />
    <T.MeshBasicMaterial color={hornColor} />
  </T.Mesh>

  <!-- Ears -->
  <T.Mesh position={[ 0.21, 1.74, -0.65]} rotation.z={ 0.3}>
    <T.BoxGeometry args={[0.08, 0.17, 0.08]} />
    <T.MeshLambertMaterial {color} />
  </T.Mesh>
  <T.Mesh position={[-0.21, 1.74, -0.65]} rotation.z={-0.3}>
    <T.BoxGeometry args={[0.08, 0.17, 0.08]} />
    <T.MeshLambertMaterial {color} />
  </T.Mesh>

  <!-- Mane -->
  {#each [0, 0.20, 0.40] as mz}
    <T.Mesh position={[0, 1.60, -0.50 + mz]}>
      <T.BoxGeometry args={[0.15, 0.19, 0.15]} />
      <T.MeshBasicMaterial color={hornColor} />
    </T.Mesh>
  {/each}

  <!-- Legs with walk cycle -->
  {#each { length: 4 } as _, i}
    <T.Group
      position={[LEG_X[i], HIP_Y, LEG_Z[i]]}
      rotation.x={isPausing ? 0 : Math.sin(legCycle + PHASES[i]) * LEG_SWING}
    >
      <T.Mesh position={[0, -LEG_HALF, 0]}>
        <T.BoxGeometry args={[0.20, 0.44, 0.20]} />
        <T.MeshLambertMaterial {color} />
      </T.Mesh>
      <T.Mesh position={[0, -HOOF_OFF, 0]}>
        <T.BoxGeometry args={[0.22, 0.08, 0.22]} />
        <T.MeshLambertMaterial color="#886644" />
      </T.Mesh>
    </T.Group>
  {/each}

  <!-- Tail -->
  <T.Mesh
    position={[0, 0.94, 0.76]}
    rotation.x={0.30 + Math.sin(time * 3.2) * 0.32}
  >
    <T.BoxGeometry args={[0.14, 0.50, 0.14]} />
    <T.MeshBasicMaterial color={hornColor} />
  </T.Mesh>
  <T.Mesh
    position={[0, 0.68, 0.93]}
    rotation.x={0.55 + Math.sin(time * 3.2 + 0.5) * 0.30}
  >
    <T.BoxGeometry args={[0.10, 0.34, 0.10]} />
    <T.MeshBasicMaterial color={hornColor} />
  </T.Mesh>

  <!-- Click sparkles -->
  {#each sparkles as sp (sp.id)}
    <T.Mesh position={[sp.x, sp.y, sp.z]}>
      <T.BoxGeometry args={[0.17, 0.17, 0.17]} />
      <T.MeshBasicMaterial color={hornColor} transparent opacity={sp.life} />
    </T.Mesh>
  {/each}
</T.Group>
