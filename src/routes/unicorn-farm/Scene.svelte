<script lang="ts">
  import { Canvas } from '@threlte/core';
  import SceneContent from './SceneContent.svelte';
</script>

<Canvas>
  <SceneContent />
</Canvas>

<style>
  :global(canvas) {
    width: 100% !important;
    height: 100% !important;
  }
</style>
