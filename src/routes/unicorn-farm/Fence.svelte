<script lang="ts">
  import { T } from '@threlte/core';

  // Fence spans roughly -20 to +20 on X, -20 to +20 on Z
  // but leaves a gap for the farm entrance

  const POST_H    = 1.1;
  const RAIL_THICKNESS = 0.10;
  const POST_COLOR = '#c8a870';
  const RAIL_COLOR = '#c8a870';
  const CAP_COLOR  = '#b89860';
</script>

<!-- ── Front fence (along Z = -20, X from -20 to +20) ── -->
{#each Array.from({ length: 18 }, (_, i) => i) as i}
  {@const x = -18 + i * 2.2}
  <T.Group position={[x, 0, -20]}>
    <T.Mesh position={[0, POST_H / 2, 0]} castShadow>
      <T.BoxGeometry args={[0.15, POST_H, 0.15]} />
      <T.MeshStandardMaterial color={POST_COLOR} />
    </T.Mesh>
    <T.Mesh position={[0, POST_H + 0.06, 0]}>
      <T.BoxGeometry args={[0.20, 0.12, 0.20]} />
      <T.MeshStandardMaterial color={CAP_COLOR} />
    </T.Mesh>
    <T.Mesh position={[1.1, 0.75, 0]} castShadow>
      <T.BoxGeometry args={[2.2, RAIL_THICKNESS, 0.08]} />
      <T.MeshStandardMaterial color={RAIL_COLOR} />
    </T.Mesh>
    <T.Mesh position={[1.1, 0.40, 0]} castShadow>
      <T.BoxGeometry args={[2.2, RAIL_THICKNESS, 0.08]} />
      <T.MeshStandardMaterial color={RAIL_COLOR} />
    </T.Mesh>
  </T.Group>
{/each}

<!-- ── Right fence (along X = +20, Z from -20 to +20) ── -->
{#each Array.from({ length: 14 }, (_, i) => i) as i}
  {@const z = -20 + i * 2.9}
  <T.Group position={[20, 0, z]}>
    <T.Mesh position={[0, POST_H / 2, 0]} castShadow>
      <T.BoxGeometry args={[0.15, POST_H, 0.15]} />
      <T.MeshStandardMaterial color={POST_COLOR} />
    </T.Mesh>
    <T.Mesh position={[0, POST_H + 0.06, 0]}>
      <T.BoxGeometry args={[0.20, 0.12, 0.20]} />
      <T.MeshStandardMaterial color={CAP_COLOR} />
    </T.Mesh>
    <T.Mesh position={[0, 0.75, 1.45]} castShadow>
      <T.BoxGeometry args={[0.08, RAIL_THICKNESS, 2.9]} />
      <T.MeshStandardMaterial color={RAIL_COLOR} />
    </T.Mesh>
    <T.Mesh position={[0, 0.40, 1.45]} castShadow>
      <T.BoxGeometry args={[0.08, RAIL_THICKNESS, 2.9]} />
      <T.MeshStandardMaterial color={RAIL_COLOR} />
    </T.Mesh>
  </T.Group>
{/each}

<!-- ── Left fence (along X = -20, Z from -20 to +20) ── -->
{#each Array.from({ length: 14 }, (_, i) => i) as i}
  {@const z = -20 + i * 2.9}
  <T.Group position={[-20, 0, z]}>
    <T.Mesh position={[0, POST_H / 2, 0]} castShadow>
      <T.BoxGeometry args={[0.15, POST_H, 0.15]} />
      <T.MeshStandardMaterial color={POST_COLOR} />
    </T.Mesh>
    <T.Mesh position={[0, POST_H + 0.06, 0]}>
      <T.BoxGeometry args={[0.20, 0.12, 0.20]} />
      <T.MeshStandardMaterial color={CAP_COLOR} />
    </T.Mesh>
    <T.Mesh position={[0, 0.75, 1.45]} castShadow>
      <T.BoxGeometry args={[0.08, RAIL_THICKNESS, 2.9]} />
      <T.MeshStandardMaterial color={RAIL_COLOR} />
    </T.Mesh>
    <T.Mesh position={[0, 0.40, 1.45]} castShadow>
      <T.BoxGeometry args={[0.08, RAIL_THICKNESS, 2.9]} />
      <T.MeshStandardMaterial color={RAIL_COLOR} />
    </T.Mesh>
  </T.Group>
{/each}

<!-- ── Back fence (along Z = +20, X from -20 to +20) ── -->
{#each Array.from({ length: 18 }, (_, i) => i) as i}
  {@const x = -18 + i * 2.2}
  <T.Group position={[x, 0, 20]}>
    <T.Mesh position={[0, POST_H / 2, 0]} castShadow>
      <T.BoxGeometry args={[0.15, POST_H, 0.15]} />
      <T.MeshStandardMaterial color={POST_COLOR} />
    </T.Mesh>
    <T.Mesh position={[0, POST_H + 0.06, 0]}>
      <T.BoxGeometry args={[0.20, 0.12, 0.20]} />
      <T.MeshStandardMaterial color={CAP_COLOR} />
    </T.Mesh>
    <T.Mesh position={[1.1, 0.75, 0]} castShadow>
      <T.BoxGeometry args={[2.2, RAIL_THICKNESS, 0.08]} />
      <T.MeshStandardMaterial color={RAIL_COLOR} />
    </T.Mesh>
    <T.Mesh position={[1.1, 0.40, 0]} castShadow>
      <T.BoxGeometry args={[2.2, RAIL_THICKNESS, 0.08]} />
      <T.MeshStandardMaterial color={RAIL_COLOR} />
    </T.Mesh>
  </T.Group>
{/each}
