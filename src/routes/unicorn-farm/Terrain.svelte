<script lang="ts">
  import { T, useTask } from '@threlte/core';

  const walls = [
    { wx: -8, wz: -12, len: 6, ry: 0 },
    { wx:  8, wz: -14, len: 5, ry: 0.1 },
    { wx:-16, wz:   5, len: 4, ry: Math.PI / 2 },
    { wx: 14, wz:  12, len: 7, ry: 0.05 },
  ];

  interface StoneState {
    vx: number; vy: number; vz: number;
    ox: number; oy: number; oz: number;
    sx: number; sy: number; sz: number;
  }

  interface WallState {
    phase: 'idle' | 'crumbling' | 'reassembling';
    time: number;
    stones: StoneState[];
  }

  let wallStates: WallState[] = $state(
    walls.map(w => ({
      phase: 'idle' as const,
      time: 0,
      stones: Array.from({ length: w.len * 2 }, () => ({
        vx: 0, vy: 0, vz: 0,
        ox: 0, oy: 0, oz: 0,
        sx: 0, sy: 0, sz: 0,
      })),
    }))
  );

  function crumbleWall(wallIdx: number) {
    const ws = wallStates[wallIdx];
    if (ws.phase !== 'idle') return;
    ws.phase = 'crumbling';
    ws.time = 0;
    for (const stone of ws.stones) {
      stone.vx = (Math.random() - 0.5) * 5;
      stone.vy = Math.random() * 4 + 2;
      stone.vz = (Math.random() - 0.5) * 5;
      stone.ox = 0;
      stone.oy = 0;
      stone.oz = 0;
    }
  }

  const GRAVITY = 9.8;
  const CRUMBLE_DURATION = 3.0;
  const REASSEMBLE_DURATION = 1.0;

  useTask((delta) => {
    for (const ws of wallStates) {
      if (ws.phase === 'idle') continue;

      ws.time += delta;

      if (ws.phase === 'crumbling') {
        if (ws.time >= CRUMBLE_DURATION) {
          ws.phase = 'reassembling';
          ws.time = 0;
          for (const stone of ws.stones) {
            stone.sx = stone.ox;
            stone.sy = stone.oy;
            stone.sz = stone.oz;
          }
        } else {
          for (const stone of ws.stones) {
            stone.ox += stone.vx * delta;
            stone.oy += stone.vy * delta;
            stone.oz += stone.vz * delta;
            stone.vy -= GRAVITY * delta;
            if (stone.oy < -0.3) {
              stone.oy = -0.3;
              stone.vy *= -0.3;
            }
          }
        }
      } else if (ws.phase === 'reassembling') {
        if (ws.time >= REASSEMBLE_DURATION) {
          ws.phase = 'idle';
          for (const stone of ws.stones) {
            stone.ox = 0;
            stone.oy = 0;
            stone.oz = 0;
          }
        } else {
          const t = ws.time / REASSEMBLE_DURATION;
          const ease = t * t * (3 - 2 * t);
          for (const stone of ws.stones) {
            stone.ox = stone.sx * (1 - ease);
            stone.oy = stone.sy * (1 - ease);
            stone.oz = stone.sz * (1 - ease);
          }
        }
      }
    }
  });
</script>

<!-- Main grass ground (reduced from 120x120) -->
<T.Mesh rotation.x={-Math.PI / 2} position.y={-0.05} receiveShadow>
  <T.PlaneGeometry args={[50, 50]} />
  <T.MeshLambertMaterial color="#52b045" />
</T.Mesh>

<!-- Darker grass patches (filtered to farm bounds) -->
{#each [
  [-4, 3], [5, -2], [-2, -5], [7, 6], [-6, 1],
  [14, 5], [-12, 9], [8, -12], [2, 18], [15, -10],
  [10, 20],
] as [x, z]}
  <T.Mesh rotation.x={-Math.PI / 2} position={[x, -0.04, z]}>
    <T.CircleGeometry args={[3.0 + Math.abs(x % 3), 8]} />
    <T.MeshLambertMaterial color="#45a038" />
  </T.Mesh>
{/each}

<!-- Lighter emerald patches -->
{#each [
  [6, 10], [-10, 5], [18, -3], [-5, 16], [12, -8],
] as [x, z]}
  <T.Mesh rotation.x={-Math.PI / 2} position={[x, -0.03, z]}>
    <T.CircleGeometry args={[4, 8]} />
    <T.MeshLambertMaterial color="#5cc050" />
  </T.Mesh>
{/each}

<!-- Dirt path from barn toward center -->
{#each Array.from({ length: 12 }, (_, i) => i) as i}
  <T.Mesh rotation.x={-Math.PI / 2} position={[-14 + i * 2.0, 0.02, -8 + i * 0.6]}>
    <T.PlaneGeometry args={[2.2, 1.4]} />
    <T.MeshLambertMaterial color="#8B7355" />
  </T.Mesh>
{/each}

<!-- Second dirt path toward pond -->
{#each Array.from({ length: 8 }, (_, i) => i) as i}
  <T.Mesh rotation.x={-Math.PI / 2} position={[i * 1.8, 0.02, 6 + i * 0.4]}>
    <T.PlaneGeometry args={[2.0, 1.2]} />
    <T.MeshLambertMaterial color="#8B7355" />
  </T.Mesh>
{/each}

<!-- Gentle terrain edge mounds (smaller, closer than old rolling hills) -->
{#each [
  { pos: [-18, -1.5, -14] as [number, number, number], geo: [6, 7, 2.5, 8] as [number, number, number, number], color: '#4aab3e' },
  { pos: [ 18, -1.5,  16] as [number, number, number], geo: [5, 6, 2.0, 8] as [number, number, number, number], color: '#4aab3e' },
] as hill}
  <T.Mesh position={hill.pos} receiveShadow>
    <T.CylinderGeometry args={hill.geo} />
    <T.MeshLambertMaterial color={hill.color} />
  </T.Mesh>
{/each}

<!-- Stone wall sections (clickable — crumble on click) -->
{#each walls as wall, wallIdx}
  {#each Array.from({ length: wall.len }, (_, i) => i) as i}
    {@const bottom = wallStates[wallIdx].stones[i * 2]}
    {@const top = wallStates[wallIdx].stones[i * 2 + 1]}
    <T.Mesh
      position={[
        wall.wx + Math.cos(wall.ry) * i * 1.2 + bottom.ox,
        0.3 + bottom.oy,
        wall.wz + Math.sin(wall.ry) * i * 1.2 + bottom.oz,
      ]}
      castShadow
      onclick={() => crumbleWall(wallIdx)}
    >
      <T.BoxGeometry args={[1.0, 0.6, 0.5]} />
      <T.MeshLambertMaterial color="#888077" />
    </T.Mesh>
    <T.Mesh
      position={[
        wall.wx + Math.cos(wall.ry) * (i * 1.2 + 0.6) + top.ox,
        0.65 + top.oy,
        wall.wz + Math.sin(wall.ry) * (i * 1.2 + 0.6) + top.oz,
      ]}
      onclick={() => crumbleWall(wallIdx)}
    >
      <T.BoxGeometry args={[0.95, 0.55, 0.45]} />
      <T.MeshLambertMaterial color="#7a7570" />
    </T.Mesh>
  {/each}
{/each}
