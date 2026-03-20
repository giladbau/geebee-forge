<script lang="ts">
  import { T, useTask } from '@threlte/core';

  let { position = [0, 0, 0] }: { position?: [number, number, number] } = $props();

  let rippleScale = $state(1);
  let rippleOpacity = $state(0);
  let rippleActive = $state(false);
  let time = $state(0);

  useTask((delta) => {
    time += delta;
    if (rippleActive) {
      rippleScale += delta * 3;
      rippleOpacity -= delta * 0.8;
      if (rippleOpacity <= 0) {
        rippleActive = false;
        rippleScale = 1;
        rippleOpacity = 0;
      }
    }
  });

  function handleClick() {
    rippleActive = true;
    rippleScale = 1;
    rippleOpacity = 0.6;
  }
</script>

<T.Group position={position}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <T.Mesh
    rotation.x={-Math.PI / 2}
    position.y={0.02}
    onclick={handleClick}
  >
    <T.CircleGeometry args={[3, 12]} />
    <T.MeshStandardMaterial
      color="#3a7ec8"
      transparent
      opacity={0.8}
      metalness={0.3}
      roughness={0.2}
    />
  </T.Mesh>

  <!-- Pond edge -->
  <T.Mesh rotation.x={-Math.PI / 2} position.y={0.01}>
    <T.RingGeometry args={[2.8, 3.3, 12]} />
    <T.MeshLambertMaterial color="#6d8b5e" />
  </T.Mesh>

  <!-- Ripple effect -->
  {#if rippleActive}
    <T.Mesh rotation.x={-Math.PI / 2} position.y={0.05} scale={[rippleScale, rippleScale, 1]}>
      <T.RingGeometry args={[0.8, 1.0, 12]} />
      <T.MeshBasicMaterial color="#88ccff" transparent opacity={rippleOpacity} />
    </T.Mesh>
    <T.Mesh rotation.x={-Math.PI / 2} position.y={0.05} scale={[rippleScale * 0.6, rippleScale * 0.6, 1]}>
      <T.RingGeometry args={[0.5, 0.65, 12]} />
      <T.MeshBasicMaterial color="#aaddff" transparent opacity={rippleOpacity * 0.7} />
    </T.Mesh>
  {/if}

  <!-- Lily pads -->
  {#each [[0.8, -0.5], [-1.2, 0.3], [0.2, 1.0]] as [lx, lz]}
    <T.Mesh rotation.x={-Math.PI / 2} position={[lx, 0.04, lz]}>
      <T.CircleGeometry args={[0.3, 6]} />
      <T.MeshLambertMaterial color="#2d6b1e" />
    </T.Mesh>
  {/each}
</T.Group>
