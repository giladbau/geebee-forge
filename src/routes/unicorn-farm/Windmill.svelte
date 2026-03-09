<script lang="ts">
  import { T, useTask } from '@threlte/core';

  let { position = [0, 0, 0] }: { position?: [number, number, number] } = $props();

  let bladeRotation = $state(0);

  useTask((delta) => {
    bladeRotation += delta * 7.0;
  });
</script>

<T.Group position={position}>
  <!-- Tower base (stone) -->
  <T.Mesh position={[0, 2, 0]} castShadow>
    <T.CylinderGeometry args={[0.9, 1.2, 4, 6]} />
    <T.MeshLambertMaterial color="#a0a0a0" />
  </T.Mesh>

  <!-- Tower top (cone roof) -->
  <T.Mesh position={[0, 4.5, 0]} castShadow>
    <T.ConeGeometry args={[1.3, 1.5, 6]} />
    <T.MeshLambertMaterial color="#704030" />
  </T.Mesh>

  <!-- Stone detail bands -->
  <T.Mesh position={[0, 1.0, 0]}>
    <T.CylinderGeometry args={[1.22, 1.22, 0.15, 6]} />
    <T.MeshLambertMaterial color="#888888" />
  </T.Mesh>
  <T.Mesh position={[0, 2.5, 0]}>
    <T.CylinderGeometry args={[0.95, 0.95, 0.15, 6]} />
    <T.MeshLambertMaterial color="#888888" />
  </T.Mesh>

  <!-- Blade hub -->
  <T.Group position={[0, 3.5, -1.0]} rotation.z={bladeRotation}>
    <!-- Hub -->
    <T.Mesh>
      <T.CylinderGeometry args={[0.2, 0.2, 0.2, 6]} />
      <T.MeshLambertMaterial color="#5a3a20" />
    </T.Mesh>

    <!-- 4 Blades -->
    {#each [0, Math.PI / 2, Math.PI, Math.PI * 1.5] as angle}
      <T.Group rotation.z={angle}>
        <!-- Blade arm -->
        <T.Mesh position={[0, 1.5, 0]}>
          <T.BoxGeometry args={[0.08, 2.8, 0.05]} />
          <T.MeshLambertMaterial color="#5a3a20" />
        </T.Mesh>
        <!-- Blade sail -->
        <T.Mesh position={[0.2, 1.5, 0.02]}>
          <T.BoxGeometry args={[0.35, 2.4, 0.03]} />
          <T.MeshLambertMaterial color="#f0e8d0" />
        </T.Mesh>
      </T.Group>
    {/each}
  </T.Group>

  <!-- Window -->
  <T.Mesh position={[0, 2.5, -1.0]}>
    <T.BoxGeometry args={[0.4, 0.5, 0.1]} />
    <T.MeshBasicMaterial color="#ffe88a" />
  </T.Mesh>

  <!-- Door -->
  <T.Mesh position={[0, 0.5, -1.22]}>
    <T.BoxGeometry args={[0.5, 1.0, 0.08]} />
    <T.MeshLambertMaterial color="#5a3a20" />
  </T.Mesh>
</T.Group>
