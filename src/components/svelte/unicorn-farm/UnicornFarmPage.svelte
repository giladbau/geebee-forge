<script lang="ts">
  import { onMount } from 'svelte';

  let SceneComponent: any = $state(null);

  onMount(async () => {
    const mod = await import('./Scene.svelte');
    SceneComponent = mod.default;
  });
</script>

<div class="farm-page">
  {#if SceneComponent}
    <SceneComponent />
  {:else}
    <div class="loading">
      <p>Loading the magical farm...</p>
    </div>
  {/if}

  <div class="title-overlay">
    <h1>Unicorn Farm</h1>
    <p>Click unicorns &bull; Scroll to zoom &bull; Drag to orbit</p>
  </div>
</div>

<style>
  .farm-page {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    position: relative;
    background: #1a0a2e;
  }
  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #c8a0ff;
    font-size: 1.4rem;
  }
  .title-overlay {
    position: absolute;
    bottom: 1.5rem;
    left: 50%;
    transform: translateX(-50%);
    text-align: center;
    z-index: 10;
    pointer-events: none;
  }
  .title-overlay h1 {
    font-size: 1.6rem;
    margin: 0;
    color: #f0d0ff;
    text-shadow: 0 0 20px rgba(180, 100, 255, 0.6);
  }
  .title-overlay p {
    margin: 0.3rem 0 0;
    color: #a080c0;
    font-size: 0.85rem;
  }
</style>
