<script lang="ts">
  import { T, useTask } from '@threlte/core';

  let { position = [0, 0, 0] }: { position?: [number, number, number] } = $props();

  let bladeRotation = $state(0);
  let boosted = $state(false);
  let boostTimer = $state(0);
  let sparkles: Array<{ id: number; x: number; y: number; z: number; life: number; vx: number; vy: number; vz: number }> = $state([]);

  function clickWindmill(e: any) {
    e?.stopPropagation?.();
    boosted = true;
    boostTimer = 2.0;
    // Burst sparkles from blade hub area
    const burst = Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      return {
        id: Math.random(),
        x: Math.cos(a) * 0.5,
        y: 3.5 + Math.random() * 0.5,
        z: -1.0 + Math.sin(a) * 0.5,
        life: 1.0 + Math.random() * 0.3,
        vx: Math.cos(a) * (2 + Math.random()),
        vy: 1.0 + Math.random() * 1.5,
        vz: Math.sin(a) * (2 + Math.random()),
      };
    });
    sparkles = [...sparkles, ...burst];
  }

  useTask((delta) => {
    const speed = boosted ? 12.0 : 1.2;
    bladeRotation += delta * speed;

    if (boosted) {
      boostTimer -= delta;
      if (boostTimer <= 0) {
        boosted = false;
        boostTimer = 0;
      }
    }

    for (let i = sparkles.length - 1; i >= 0; i--) {
      const s = sparkles[i];
      s.x += s.vx * delta;
      s.y += s.vy * delta;
      s.z += s.vz * delta;
      s.vy -= delta * 3.0; // gravity
      s.life -= delta * 1.5;
      if (s.life <= 0) sparkles.splice(i, 1);
    }
    if (sparkles.length) sparkles = sparkles;
  });
</script>

<T.Group position={position} onclick={clickWindmill}>
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

  <!-- Windmill sparkles -->
  {#each sparkles as sp}
    <T.Mesh position={[sp.x, sp.y, sp.z]} scale={0.06 + sp.life * 0.08}>
      <T.BoxGeometry args={[1, 1, 1]} />
      <T.MeshBasicMaterial color="#ffee44" transparent opacity={Math.min(sp.life, 1.0)} />
    </T.Mesh>
  {/each}
</T.Group>
