<script lang="ts">
  import { T, useTask } from '@threlte/core';

  let {
    position = [0, 0, 0] as [number, number, number],
    color = '#ffffff',
    hornColor = '#ffd700',
    idx = 0,
    rainbow = false
  }: {
    position?: [number, number, number];
    color?: string;
    hornColor?: string;
    idx?: number;
    rainbow?: boolean;
  } = $props();

  let time = $state(0);
  let jumping = $state(false);
  let jumpProgress = $state(0);
  let sparkles: Array<{
    id: number; x: number; y: number; z: number;
    life: number; vx: number; vz: number;
    color: string;
  }> = $state([]);

  function hslToHex(h: number, s: number, l: number): string {
    h = ((h % 1) + 1) % 1;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h * 12) % 12;
      const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * Math.max(0, Math.min(1, c))).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  const RAINBOW_SPARKLE_COLORS = ['#ff0000', '#ff8800', '#ffff00', '#00cc00', '#0066ff', '#4400cc', '#8800aa'];

  // ── Obstacle zones: [x, z, radius] ──
  // Sourced from actual component positions with padding for unicorn body
  const OBSTACLES: Array<[number, number, number]> = [
    // Barn (body 5×4)
    [-14, -10, 3.5],
    // Ponds (CircleGeometry r=3 + edge ring)
    [10, 8, 4.0],   [-15, 12, 4.0],
    // Farmhouse (body 6×4.6)
    [8, -16, 4.0],
    // Second barn in Buildings (body 4.5×3.6)
    [16, -14, 3.0],
    // Well (cylinder r=1.0 + posts)
    [-8, 8, 2.0],
    // Water trough (box 2.2×0.8)
    [-2, -8, 1.5],
    // Windmills (base cylinder r=1.2)
    [18, -6, 2.2],  [-18, 8, 2.2],
    // Bridge / stream
    [6, 0, 2.5],
    // Trees (trunk + crown footprint)
    [-8, 3, 1.0],  [-6, 7, 0.9],  [3, -7, 0.9],
    [8, 3, 0.9],   [-3, 8, 0.8],  [6, -8, 1.2],
    [-12, 8, 1.3], [14, 6, 1.0],  [-10, -12, 1.4],
    [12, -12, 1.0],[0, 16, 1.1],  [-16, 0, 1.5],
    [18, 0, 1.2],  [10, 16, 0.9], [-14, 14, 1.2],
    // Hay bales
    [-10, -7, 0.8], [-11, -5, 0.8], [5, -10, 0.8],
    [7, -11, 0.8],  [18, 2, 0.8],   [19, 4, 0.8],
    [-6, 14, 0.8],  [-4, 15, 0.8],  [12, 9, 0.8],
  ];
  const FARM_LIMIT = 17.0;

  function isPointBlocked(x: number, z: number): boolean {
    if (Math.abs(x) > FARM_LIMIT || Math.abs(z) > FARM_LIMIT) return true;
    for (const [ox, oz, r] of OBSTACLES) {
      const dx = x - ox, dz = z - oz;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }

  function segmentHitsCircle(
    x1: number, z1: number, x2: number, z2: number,
    cx: number, cz: number, r: number
  ): boolean {
    const dx = x2 - x1, dz = z2 - z1;
    const fx = x1 - cx, fz = z1 - cz;
    const a = dx * dx + dz * dz;
    if (a < 1e-8) return false;
    const b = 2 * (fx * dx + fz * dz);
    const c = fx * fx + fz * fz - r * r;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return false;
    const sq = Math.sqrt(disc);
    const t1 = (-b - sq) / (2 * a);
    const t2 = (-b + sq) / (2 * a);
    return t1 <= 1 && t2 >= 0;
  }

  function isPathBlocked(x1: number, z1: number, x2: number, z2: number): boolean {
    for (const [ox, oz, r] of OBSTACLES) {
      if (segmentHitsCircle(x1, z1, x2, z2, ox, oz, r)) return true;
    }
    return false;
  }

  function pickTarget(fromX: number, fromZ: number): [number, number] {
    for (let i = 0; i < 20; i++) {
      const x = (Math.random() - 0.5) * 2 * FARM_LIMIT;
      const z = (Math.random() - 0.5) * 2 * FARM_LIMIT;
      if (!isPointBlocked(x, z) && !isPathBlocked(fromX, fromZ, x, z)) {
        return [x, z];
      }
    }
    // Fallback: try 36 directions with a short step
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const x = fromX + Math.cos(a) * 3;
      const z = fromZ + Math.sin(a) * 3;
      if (!isPointBlocked(x, z) && !isPathBlocked(fromX, fromZ, x, z)) {
        return [x, z];
      }
    }
    return [fromX, fromZ];
  }

  const WALK_SPEEDS    = [2.5, 1.2, 2.8, 2.3, 2.6, 2.4, 2.0, 2.7, 2.9];
  const PAUSE_DURATIONS = [1.2, 2.5, 0.8, 1.0, 1.5, 1.2, 1.8, 1.0, 0.8];
  const walkSpeed     = WALK_SPEEDS[idx]     ?? 2.0;
  const pauseDuration = PAUSE_DURATIONS[idx] ?? 1.0;

  let isPausing  = $state(false);
  let pauseTimer = $state(0);
  let posX   = $state(position[0]);
  let posZ   = $state(position[2]);
  let facing = $state(0);

  const _initTarget = pickTarget(position[0], position[2]);
  let targetX = $state(_initTarget[0]);
  let targetZ = $state(_initTarget[1]);

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
        [targetX, targetZ] = pickTarget(posX, posZ);
      }
    } else {
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
    const count = rainbow ? 12 : 8;
    const burst = Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2;
      return {
        id:   Math.random(),
        x:    Math.cos(a) * 0.25,
        y:    0.8 + Math.random() * 0.4,
        z:    Math.sin(a) * 0.25,
        life: 1.1,
        vx:   Math.cos(a) * (1.5 + Math.random()),
        vz:   Math.sin(a) * (1.5 + Math.random()),
        color: rainbow ? RAINBOW_SPARKLE_COLORS[i % RAINBOW_SPARKLE_COLORS.length] : hornColor,
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

  // Rainbow color cycling — only computed when rainbow=true
  let baseHue = $derived(rainbow ? (time * 0.3) % 1 : 0);
  let hornHue = $derived(rainbow ? (time * 0.8) % 1 : 0);
  let bodyColor = $derived(rainbow ? hslToHex(baseHue, 0.85, 0.65) : color);
  let bodyEmissive = $derived(rainbow ? hslToHex(baseHue, 0.9, 0.5) : color);
  let hornGlow = $derived(rainbow ? hslToHex(hornHue, 1.0, 0.75) : hornColor);
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
    <T.MeshStandardMaterial color={bodyColor} emissive={bodyEmissive} emissiveIntensity={rainbow ? 0.4 : 0.25} roughness={0.45} />
  </T.Mesh>

  <!-- Neck -->
  <T.Mesh position={[0, 1.18, -0.52]} rotation.x={-0.30}>
    <T.BoxGeometry args={[0.40, 0.48, 0.38]} />
    <T.MeshLambertMaterial color={bodyColor} emissive={bodyEmissive} emissiveIntensity={rainbow ? 0.4 : 0.25} />
  </T.Mesh>

  <!-- Head -->
  <T.Mesh position={[0, 1.48, -0.76]} castShadow>
    <T.BoxGeometry args={[0.54, 0.50, 0.54]} />
    <T.MeshStandardMaterial color={bodyColor} emissive={bodyEmissive} emissiveIntensity={rainbow ? 0.4 : 0.25} roughness={0.45} />
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

  <!-- Horn — faster cycling & brighter when rainbow -->
  <T.Mesh position={[0, 1.92, -0.76]}>
    <T.ConeGeometry args={[0.09, 0.64, 4]} />
    <T.MeshBasicMaterial color={hornGlow} />
  </T.Mesh>

  <!-- Ears -->
  <T.Mesh position={[ 0.21, 1.74, -0.65]} rotation.z={ 0.3}>
    <T.BoxGeometry args={[0.08, 0.17, 0.08]} />
    <T.MeshLambertMaterial color={bodyColor} />
  </T.Mesh>
  <T.Mesh position={[-0.21, 1.74, -0.65]} rotation.z={-0.3}>
    <T.BoxGeometry args={[0.08, 0.17, 0.08]} />
    <T.MeshLambertMaterial color={bodyColor} />
  </T.Mesh>

  <!-- Mane — each segment offset in hue for rainbow gradient -->
  {#each [0, 0.20, 0.40] as mz, mi}
    <T.Mesh position={[0, 1.60, -0.50 + mz]}>
      <T.BoxGeometry args={[0.15, 0.19, 0.15]} />
      <T.MeshBasicMaterial color={rainbow ? hslToHex(baseHue + 0.25 + mi * 0.15, 1.0, 0.55) : hornColor} />
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
        <T.MeshLambertMaterial color={bodyColor} />
      </T.Mesh>
      <T.Mesh position={[0, -HOOF_OFF, 0]}>
        <T.BoxGeometry args={[0.22, 0.08, 0.22]} />
        <T.MeshLambertMaterial color="#886644" />
      </T.Mesh>
    </T.Group>
  {/each}

  <!-- Tail — offset hue from body -->
  <T.Mesh
    position={[0, 0.94, 0.76]}
    rotation.x={0.30 + Math.sin(time * 3.2) * 0.32}
  >
    <T.BoxGeometry args={[0.14, 0.50, 0.14]} />
    <T.MeshBasicMaterial color={rainbow ? hslToHex(baseHue + 0.5, 1.0, 0.55) : hornColor} />
  </T.Mesh>
  <T.Mesh
    position={[0, 0.68, 0.93]}
    rotation.x={0.55 + Math.sin(time * 3.2 + 0.5) * 0.30}
  >
    <T.BoxGeometry args={[0.10, 0.34, 0.10]} />
    <T.MeshBasicMaterial color={rainbow ? hslToHex(baseHue + 0.65, 1.0, 0.55) : hornColor} />
  </T.Mesh>

  <!-- Click sparkles — multicolored when rainbow -->
  {#each sparkles as sp (sp.id)}
    <T.Mesh position={[sp.x, sp.y, sp.z]}>
      <T.BoxGeometry args={[0.17, 0.17, 0.17]} />
      <T.MeshBasicMaterial color={sp.color} transparent opacity={sp.life} />
    </T.Mesh>
  {/each}
</T.Group>
