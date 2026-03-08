<script lang="ts">
  import { Canvas } from '@threlte/core';
  import SceneContent from './SceneContent.svelte';
</script>

<!-- Wrapper forces Canvas to fill the full viewport height -->
<div class="scene-wrapper">
  <Canvas>
    <SceneContent />
  </Canvas>
</div>

<style>
  .scene-wrapper {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
  }
  :global(canvas) {
    width: 100% !important;
    height: 100% !important;
  }
</style>
