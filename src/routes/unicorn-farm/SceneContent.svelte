<script lang="ts">
  import { T } from '@threlte/core';
  import { OrbitControls, interactivity } from '@threlte/extras';
  import Terrain from './Terrain.svelte';
  import Unicorn from './Unicorn.svelte';
  import Barn from './Barn.svelte';
  import Windmill from './Windmill.svelte';
  import Fence from './Fence.svelte';
  import Trees from './Trees.svelte';
  import MagicElements from './MagicElements.svelte';
  import Pond from './Pond.svelte';
  import Buildings from './Buildings.svelte';

  interactivity();

  const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.77;
  const camPos: [number, number, number] = [40, 40, 40];
</script>

<!-- Isometric orthographic camera — wide enough for the expanded world -->
<T.OrthographicCamera
  makeDefault
  position={camPos}
  left={-14 * aspect}
  right={14 * aspect}
  top={14}
  bottom={-14}
  near={0.1}
  far={500}
  zoom={12}
  oncreate={(ref) => {
    ref.lookAt(0, 0, 0);
    ref.updateProjectionMatrix();
  }}
>
  <OrbitControls
    enableRotate
    enableZoom
    enablePan
    minZoom={3}
    maxZoom={80}
    maxPolarAngle={Math.PI / 2.2}
    dampingFactor={0.08}
  />
</T.OrthographicCamera>

<!-- Magical lighting setup -->
<T.AmbientLight intensity={0.3} color="#ffe8cc" />
<T.DirectionalLight
  position={[30, 50, 20]}
  intensity={2.2}
  color="#fff8e0"
  castShadow
  shadow.mapSize.width={1024}
  shadow.mapSize.height={1024}
  shadow.camera.left={-40}
  shadow.camera.right={40}
  shadow.camera.top={40}
  shadow.camera.bottom={-40}
/>
<T.DirectionalLight position={[-20, 25, -15]} intensity={0.8} color="#cc88ff" />
<T.HemisphereLight args={["#5030a0", "#204010", 0.7]} />

<!-- Sky/background -->
<T.Color attach="background" args={[0.05, 0.02, 0.10]} />

<!-- ─── TERRAIN (100×100) ─── -->
<Terrain />

<!-- ─── WATER ─── -->
<Pond position={[10, 0.01, 8]} />
<Pond position={[-15, 0.01, 12]} />

<!-- ─── 9 UNICORNS scattered around the farm ─── -->
<Unicorn position={[-3,  0, -2]}  color="#ffffff"  hornColor="#ffd700"  idx={0} />
<Unicorn position={[ 4,  0,  4]}  color="#ffb6c1"  hornColor="#ff69b4"  idx={1} />
<Unicorn position={[-6,  0,  6]}  color="#b0e0ff"  hornColor="#6ec6ff"  idx={2} />
<Unicorn position={[ 7,  0, -4]}  color="#d8b0ff"  hornColor="#a060e0"  idx={3} />
<Unicorn position={[12,  0,  5]}  color="#fff0b0"  hornColor="#ffcc00"  idx={4} />
<Unicorn position={[-12, 0, -3]}  color="#c8ffb0"  hornColor="#80ff40"  idx={5} />
<Unicorn position={[ 2,  0, 14]}  color="#ffddbb"  hornColor="#ff8844"  idx={6} />
<Unicorn position={[-9,  0, 10]}  color="#f0f0ff"  hornColor="#aa88ff"  idx={7} />
<Unicorn position={[16,  0, -8]}  color="#ffd6ff"  hornColor="#ff44cc"  idx={8} />

<!-- ─── MAIN BARN ─── -->
<Barn position={[-14, 0, -10]} />

<!-- ─── EXTRA BUILDINGS (farmhouse, second barn, hay bales, magic well, etc.) ─── -->
<Buildings />

<!-- ─── WINDMILLS ─── -->
<Windmill position={[18, 0, -6]} />
<Windmill position={[-18, 0, 8]} />

<!-- ─── FENCE ─── -->
<Fence />

<!-- ─── TREES everywhere ─── -->
<Trees />

<!-- ─── MAGIC (flowers, sparkles, rainbow, glowing circles) ─── -->
<MagicElements />
