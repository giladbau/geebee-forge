<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import * as THREE from 'three';
  import Terrain from './Terrain.svelte';
  import Unicorn from './Unicorn.svelte';
  import Barn from './Barn.svelte';
  import Windmill from './Windmill.svelte';
  import Fence from './Fence.svelte';
  import Trees from './Trees.svelte';
  import MagicElements from './MagicElements.svelte';
  import Pond from './Pond.svelte';

  // Isometric camera setup
  const camSize = 18;
  const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.5;

  // Isometric angle: ~45° rotation, ~35.264° elevation (true isometric)
  const camPos: [number, number, number] = [20, 20, 20];
</script>

<!-- Orthographic camera for isometric view -->
<T.OrthographicCamera
  makeDefault
  position={camPos}
  left={-camSize * aspect}
  right={camSize * aspect}
  top={camSize}
  bottom={-camSize}
  near={0.1}
  far={200}
  zoom={1}
  oncreate={(ref) => { ref.lookAt(0, 0, 0); }}
/>

<!-- Warm magical lighting -->
<T.AmbientLight intensity={0.5} color="#ffeedd" />
<T.DirectionalLight
  position={[15, 25, 10]}
  intensity={1.0}
  color="#fff5e6"
  castShadow
  shadow.mapSize.width={2048}
  shadow.mapSize.height={2048}
  shadow.camera.left={-25}
  shadow.camera.right={25}
  shadow.camera.top={25}
  shadow.camera.bottom={-25}
/>
<T.DirectionalLight position={[-10, 15, -10]} intensity={0.3} color="#c8a0ff" />
<T.HemisphereLight args={["#8060c0", "#304020", 0.4]} />

<!-- Scene elements -->
<Terrain />
<Pond position={[6, 0.01, 5]} />

<Unicorn position={[-3, 0, -2]} color="#ffffff" hornColor="#ffd700" idx={0} />
<Unicorn position={[2, 0, 3]} color="#ffb6c1" hornColor="#ff69b4" idx={1} />
<Unicorn position={[-5, 0, 4]} color="#b0e0ff" hornColor="#6ec6ff" idx={2} />
<Unicorn position={[5, 0, -3]} color="#d8b0ff" hornColor="#a060e0" idx={3} />

<Barn position={[-7, 0, -6]} />
<Windmill position={[8, 0, -5]} />

<Fence />

<Trees />

<MagicElements />
