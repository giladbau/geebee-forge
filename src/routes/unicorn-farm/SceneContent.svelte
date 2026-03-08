<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { OrbitControls } from '@threlte/extras';
  import * as THREE from 'three';
  import Terrain from './Terrain.svelte';
  import Unicorn from './Unicorn.svelte';
  import Barn from './Barn.svelte';
  import Windmill from './Windmill.svelte';
  import Fence from './Fence.svelte';
  import Trees from './Trees.svelte';
  import MagicElements from './MagicElements.svelte';
  import Pond from './Pond.svelte';

  // Isometric camera — camSize tuned so the farm fills the viewport.
  // Scene spans camera-space x ≈ -9.5…+9.5, y ≈ -4…+4 (after centering on -1.5,0,-1.5).
  // camSize=5 gives frustum ±5*aspect wide and ±5 tall — tightly framing the farm.
  const camSize = 5;
  const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.77;

  // True isometric direction: camera at equal X/Y/Z offset from origin
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
  far={300}
  zoom={25}
  oncreate={(ref) => {
    ref.lookAt(-1.5, 0, -1.5);
    ref.updateProjectionMatrix();
  }}
>
  <OrbitControls
    enableRotate
    enableZoom
    enablePan
    minZoom={5}
    maxZoom={150}
    maxPolarAngle={Math.PI / 2.2}
    dampingFactor={0.08}
  />
</T.OrthographicCamera>

<!-- Warm magical lighting — high contrast -->
<T.AmbientLight intensity={0.25} color="#ffe8cc" />
<T.DirectionalLight
  position={[15, 30, 10]}
  intensity={2.0}
  color="#fff8e0"
  castShadow
  shadow.mapSize.width={2048}
  shadow.mapSize.height={2048}
  shadow.camera.left={-30}
  shadow.camera.right={30}
  shadow.camera.top={30}
  shadow.camera.bottom={-30}
/>
<T.DirectionalLight position={[-10, 15, -10]} intensity={0.7} color="#cc88ff" />
<T.HemisphereLight args={["#7040c0", "#285018", 0.6]} />

<!-- Sky/background color -->
<T.Color attach="background" args={[0.06, 0.03, 0.12]} />

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
