<script lang="ts">
  import { T } from '@threlte/core';

  const POST_H = 1.1;
  const RAIL_THICKNESS = 0.10;
  const POST_COLOR = '#c8a870';
  const RAIL_COLOR = '#c8a870';
  const CAP_COLOR = '#b89860';

  const horizontalFences = [
    { z: -20, count: 18, start: -18, spacing: 2.2 },
    { z:  20, count: 18, start: -18, spacing: 2.2 },
  ];

  const verticalFences = [
    { x:  20, count: 14, start: -20, spacing: 2.9 },
    { x: -20, count: 14, start: -20, spacing: 2.9 },
  ];

  const RAIL_HEIGHTS = [0.75, 0.40];
</script>

<!-- Horizontal fences (front and back, rails along X) -->
{#each horizontalFences as fence}
  {#each Array.from({ length: fence.count }, (_, i) => i) as i}
    {@const x = fence.start + i * fence.spacing}
    <T.Group position={[x, 0, fence.z]}>
      <T.Mesh position={[0, POST_H / 2, 0]}>
        <T.BoxGeometry args={[0.15, POST_H, 0.15]} />
        <T.MeshLambertMaterial color={POST_COLOR} />
      </T.Mesh>
      <T.Mesh position={[0, POST_H + 0.06, 0]}>
        <T.BoxGeometry args={[0.20, 0.12, 0.20]} />
        <T.MeshLambertMaterial color={CAP_COLOR} />
      </T.Mesh>
      {#each RAIL_HEIGHTS as railY}
        <T.Mesh position={[1.1, railY, 0]}>
          <T.BoxGeometry args={[2.2, RAIL_THICKNESS, 0.08]} />
          <T.MeshLambertMaterial color={RAIL_COLOR} />
        </T.Mesh>
      {/each}
    </T.Group>
  {/each}
{/each}

<!-- Vertical fences (left and right, rails along Z) -->
{#each verticalFences as fence}
  {#each Array.from({ length: fence.count }, (_, i) => i) as i}
    {@const z = fence.start + i * fence.spacing}
    <T.Group position={[fence.x, 0, z]}>
      <T.Mesh position={[0, POST_H / 2, 0]}>
        <T.BoxGeometry args={[0.15, POST_H, 0.15]} />
        <T.MeshLambertMaterial color={POST_COLOR} />
      </T.Mesh>
      <T.Mesh position={[0, POST_H + 0.06, 0]}>
        <T.BoxGeometry args={[0.20, 0.12, 0.20]} />
        <T.MeshLambertMaterial color={CAP_COLOR} />
      </T.Mesh>
      {#each RAIL_HEIGHTS as railY}
        <T.Mesh position={[0, railY, 1.45]}>
          <T.BoxGeometry args={[0.08, RAIL_THICKNESS, 2.9]} />
          <T.MeshLambertMaterial color={RAIL_COLOR} />
        </T.Mesh>
      {/each}
    </T.Group>
  {/each}
{/each}
