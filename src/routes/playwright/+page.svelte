<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';

	let playing = $state(true);
	let sceneWithout: HTMLDivElement;
	let sceneWith: HTMLDivElement;

	// Mutable ref so animation loops can read current value across closure boundary
	const playRef = { value: true };

	function togglePlay() {
		playing = !playing;
		playRef.value = playing;
	}

	onMount(() => {
		const cleanups: (() => void)[] = [];

		try {
			initScenes(cleanups);
		} catch {
			// WebGL not available (e.g. jsdom test environment)
		}

		return () => cleanups.forEach(fn => fn());
	});

	function initScenes(cleanups: (() => void)[]) {
		// --- WITHOUT VISION scene (decent render — proper bridge, fewer details) ---
		{
			const scene = new THREE.Scene();
			scene.background = new THREE.Color(0x1a2535);
			scene.fog = new THREE.FogExp2(0x2a3040, 0.018);

			const w = sceneWithout.clientWidth || 400;
			const h = sceneWithout.clientHeight || 300;
			const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200);
			camera.position.set(0, 4, 20);
			camera.lookAt(0, 4, 0);

			const renderer = new THREE.WebGLRenderer({ antialias: true });
			renderer.setSize(w, h);
			renderer.setPixelRatio(window.devicePixelRatio);
			renderer.toneMapping = THREE.NoToneMapping;
			sceneWithout.appendChild(renderer.domElement);

			// Lighting — functional but flatter/harsher than "with vision"
			const ambientLight = new THREE.AmbientLight(0x2a3a5a, 0.5);
			scene.add(ambientLight);

			const dirLight = new THREE.DirectionalLight(0xc0c8d0, 1.0);
			dirLight.position.set(8, 12, 6);
			scene.add(dirLight);

			// Tower material — cool gray-blue, solid
			const towerMat = new THREE.MeshStandardMaterial({
				color: 0x607090,
				roughness: 0.8,
				metalness: 0.2
			});

			// Two tall bridge towers
			const towerGeo = new THREE.BoxGeometry(1, 10, 1);
			const tower1 = new THREE.Mesh(towerGeo, towerMat);
			tower1.position.set(-5, 5, 0);
			scene.add(tower1);

			const tower2 = new THREE.Mesh(towerGeo, towerMat);
			tower2.position.set(5, 5, 0);
			scene.add(tower2);

			// Road deck
			const roadMat = new THREE.MeshStandardMaterial({
				color: 0x3a3a44,
				roughness: 0.9,
				metalness: 0.1
			});
			const roadGeo = new THREE.BoxGeometry(18, 0.4, 3);
			const road = new THREE.Mesh(roadGeo, roadMat);
			road.position.set(0, 0.2, 0);
			scene.add(road);

			// Suspension cables — parabolic curves (same geometry, fewer suspenders)
			const cableMat = new THREE.LineBasicMaterial({ color: 0x8090a0, linewidth: 1 });
			const cableSegments = 40;

			for (const side of [-1, 1]) {
				const cablePoints: THREE.Vector3[] = [];
				for (let i = 0; i <= cableSegments; i++) {
					const t = i / cableSegments;
					const x = -9 + t * 18;
					const sag = 0.015 * (x * x);
					const y = 10 - sag;
					cablePoints.push(new THREE.Vector3(x, Math.max(y, 0.5), side * 0.8));
				}
				const cableGeo = new THREE.BufferGeometry().setFromPoints(cablePoints);
				const cable = new THREE.Line(cableGeo, cableMat);
				scene.add(cable);

				// Fewer vertical suspenders (every 6 instead of every 3)
				for (let i = 3; i < cableSegments - 3; i += 6) {
					const pt = cablePoints[i];
					const suspenderPoints = [
						pt.clone(),
						new THREE.Vector3(pt.x, 0.4, pt.z)
					];
					const suspGeo = new THREE.BufferGeometry().setFromPoints(suspenderPoints);
					const suspender = new THREE.Line(suspGeo, new THREE.LineBasicMaterial({ color: 0x708090, transparent: true, opacity: 0.5 }));
					scene.add(suspender);
				}
			}

			const clock = new THREE.Clock();
			let animId: number;
			const animate = () => {
				animId = requestAnimationFrame(animate);
				if (!playRef.value) return;
				const t = clock.getElapsedTime();
				// Slow orbit — matches "with vision" speed
				camera.position.x = Math.sin(t * 0.15) * 2;
				camera.position.y = 4 + Math.sin(t * 0.1) * 0.3;
				camera.lookAt(0, 4, 0);
				renderer.render(scene, camera);
			};
			animate();

			cleanups.push(() => {
				cancelAnimationFrame(animId);
				renderer.dispose();
			});
		}

		// --- WITH VISION scene (rich, atmospheric, detailed) ---
		{
			const scene = new THREE.Scene();
			scene.background = new THREE.Color(0x0a1520);
			scene.fog = new THREE.FogExp2(0x1a2a3a, 0.02);

			const w = sceneWith.clientWidth || 400;
			const h = sceneWith.clientHeight || 300;
			const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200);
			camera.position.set(2, 4, 20);
			camera.lookAt(0, 4, 0);

			const renderer = new THREE.WebGLRenderer({ antialias: true });
			renderer.setSize(w, h);
			renderer.setPixelRatio(window.devicePixelRatio);
			renderer.toneMapping = THREE.ACESFilmicToneMapping;
			renderer.toneMappingExposure = 1.2;
			sceneWith.appendChild(renderer.domElement);

			// Lighting
			const ambientLight = new THREE.AmbientLight(0x1a2a4a, 0.6);
			scene.add(ambientLight);

			const dirLight = new THREE.DirectionalLight(0xf59e0b, 1.2);
			dirLight.position.set(10, 15, 8);
			scene.add(dirLight);

			const fillLight = new THREE.DirectionalLight(0x3b82f6, 0.4);
			fillLight.position.set(-8, 5, -5);
			scene.add(fillLight);

			// Tower material
			const towerMat = new THREE.MeshStandardMaterial({
				color: 0x8b4513,
				roughness: 0.7,
				metalness: 0.3
			});

			// Two tall bridge towers
			const towerGeo = new THREE.BoxGeometry(1, 10, 1);
			const tower1 = new THREE.Mesh(towerGeo, towerMat);
			tower1.position.set(-5, 5, 0);
			scene.add(tower1);

			const tower2 = new THREE.Mesh(towerGeo, towerMat);
			tower2.position.set(5, 5, 0);
			scene.add(tower2);

			// Tower cross-beams
			const crossGeo = new THREE.BoxGeometry(0.3, 0.3, 1.2);
			const cross1 = new THREE.Mesh(crossGeo, towerMat);
			cross1.position.set(-5, 8, 0);
			scene.add(cross1);
			const cross2 = new THREE.Mesh(crossGeo, towerMat);
			cross2.position.set(5, 8, 0);
			scene.add(cross2);

			// Road deck
			const roadMat = new THREE.MeshStandardMaterial({
				color: 0x444444,
				roughness: 0.9,
				metalness: 0.1
			});
			const roadGeo = new THREE.BoxGeometry(18, 0.4, 3);
			const road = new THREE.Mesh(roadGeo, roadMat);
			road.position.set(0, 0.2, 0);
			scene.add(road);

			// Suspension cables — parabolic curves
			const cableMat = new THREE.LineBasicMaterial({ color: 0xccaa66, linewidth: 1 });
			const cableSegments = 40;

			for (const side of [-1, 1]) {
				const cablePoints: THREE.Vector3[] = [];
				for (let i = 0; i <= cableSegments; i++) {
					const t = i / cableSegments;
					const x = -9 + t * 18;
					const sag = 0.015 * (x * x);
					const y = 10 - sag;
					cablePoints.push(new THREE.Vector3(x, Math.max(y, 0.5), side * 0.8));
				}
				const cableGeo = new THREE.BufferGeometry().setFromPoints(cablePoints);
				const cable = new THREE.Line(cableGeo, cableMat);
				scene.add(cable);

				// Vertical suspender cables from main cable down to road
				for (let i = 2; i < cableSegments - 2; i += 3) {
					const pt = cablePoints[i];
					const suspenderPoints = [
						pt.clone(),
						new THREE.Vector3(pt.x, 0.4, pt.z)
					];
					const suspGeo = new THREE.BufferGeometry().setFromPoints(suspenderPoints);
					const suspender = new THREE.Line(suspGeo, new THREE.LineBasicMaterial({ color: 0x998866, transparent: true, opacity: 0.6 }));
					scene.add(suspender);
				}
			}

			// Water plane
			const waterGeo = new THREE.PlaneGeometry(60, 60);
			const waterMat = new THREE.MeshStandardMaterial({
				color: 0x0a2a4a,
				roughness: 0.3,
				metalness: 0.5,
				transparent: true,
				opacity: 0.7
			});
			const water = new THREE.Mesh(waterGeo, waterMat);
			water.rotation.x = -Math.PI / 2;
			water.position.y = -1;
			scene.add(water);

			const clock = new THREE.Clock();
			let animId: number;

			const animate = () => {
				animId = requestAnimationFrame(animate);
				if (!playRef.value) return;
				const t = clock.getElapsedTime();

				// Gentle camera orbit
				camera.position.x = 2 + Math.sin(t * 0.15) * 3;
				camera.position.y = 4 + Math.sin(t * 0.1) * 0.5;
				camera.lookAt(0, 4, 0);

				renderer.render(scene, camera);
			};
			animate();

			cleanups.push(() => {
				cancelAnimationFrame(animId);
				renderer.dispose();
			});
		}
	}
</script>

<svelte:head>
	<title>Playwright + Vision | geebee-forge</title>
</svelte:head>

<main data-testid="playwright-demo">
	<a href="/" class="back-link">← Back</a>

	<h1>Playwright + Vision</h1>
	<p class="subtitle">Same prompt. Two outputs. One AI can see.</p>

	<p class="prompt-text" data-testid="demo-prompt">
		Prompt: "Generate a suspension bridge over calm water at twilight"
	</p>

	<div class="comparison" data-testid="comparison-container">
		<div class="panel" data-testid="panel-without-vision" role="region" aria-label="Scene without vision">
			<div class="panel-label without">Without Vision</div>
			<div class="scene-wrapper">
				<div class="scene-container" bind:this={sceneWithout} data-testid="scene-without" aria-label="Three.js scene without vision">
				</div>
				<div class="annotations">
					<span class="annotation" style="top: 18%; left: 12%;">fewer cables</span>
					<span class="annotation" style="top: 50%; right: 12%;">flat lighting</span>
					<span class="annotation" style="bottom: 12%; left: 20%;">no reflections</span>
				</div>
			</div>
			<p class="panel-desc">Decent render — proper structure and atmosphere, but fewer cables, no water reflections, flatter lighting.</p>
		</div>

		<div class="vs-divider" aria-hidden="true">VS</div>

		<div class="panel panel-vision" data-testid="panel-with-vision" role="region" aria-label="Scene with vision">
			<div class="panel-label with">With Vision</div>
			<div class="scene-wrapper">
				<div class="scene-container" bind:this={sceneWith} data-testid="scene-with" aria-label="Three.js scene with vision">
				</div>
				<div class="annotations">
					<span class="annotation good" style="top: 12%; left: 8%;">suspension cables</span>
					<span class="annotation good" style="top: 40%; right: 8%;">atmospheric fog</span>
					<span class="annotation good" style="bottom: 12%; left: 15%;">water reflection</span>
				</div>
			</div>
			<p class="panel-desc">Vision-guided — suspension cables, atmospheric fog, warm lighting, water reflections.</p>
		</div>
	</div>

	<button
		data-testid="play-button"
		aria-label={playing ? 'Pause comparison animation' : 'Play comparison animation'}
		onclick={togglePlay}
	>
		{playing ? 'Pause' : 'Play'}
	</button>
</main>

<style>
	main {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 2rem;
	}

	.back-link {
		position: fixed;
		top: 1rem;
		left: 1rem;
		color: rgba(255, 255, 255, 0.6);
		text-decoration: none;
		font-size: 0.9rem;
		z-index: 10;
		transition: color 0.2s;
	}

	.back-link:hover {
		color: rgba(255, 255, 255, 1);
	}

	h1 {
		font-size: 2.5rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		margin: 0;
		background: linear-gradient(135deg, #e0e0e0, #f59e0b);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.subtitle {
		color: #888;
		font-size: 1rem;
		margin: 0.5rem 0 1rem;
		letter-spacing: 0.05em;
	}

	.prompt-text {
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
		font-size: 0.85rem;
		color: #999;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid #2a2a2a;
		border-radius: 6px;
		padding: 0.6rem 1.2rem;
		margin: 0 0 1.5rem;
		max-width: 1100px;
		text-align: center;
	}

	.comparison {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: 0.75rem;
		width: 100%;
		max-width: 1100px;
		align-items: center;
	}

	@media (max-width: 700px) {
		.comparison {
			grid-template-columns: 1fr;
		}
	}

	.panel {
		background: #1a1a1a;
		border: 1px solid #2a2a2a;
		border-radius: 12px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.panel-vision {
		border-color: rgba(245, 158, 11, 0.3);
		animation: glow-pulse 3s ease-in-out infinite;
	}

	@keyframes glow-pulse {
		0%, 100% { box-shadow: 0 0 8px rgba(245, 158, 11, 0.1); }
		50% { box-shadow: 0 0 20px rgba(245, 158, 11, 0.25); }
	}

	.vs-divider {
		font-size: 1.4rem;
		font-weight: 800;
		color: #f59e0b;
		text-align: center;
		letter-spacing: 0.1em;
		padding: 0 0.25rem;
		user-select: none;
	}

	@media (max-width: 700px) {
		.vs-divider {
			padding: 0.5rem 0;
		}
	}

	.panel-label {
		padding: 0.75rem 1rem;
		font-size: 0.85rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.panel-label.without {
		color: #888;
		background: #111;
	}

	.panel-label.with {
		color: #f59e0b;
		background: linear-gradient(90deg, rgba(245, 158, 11, 0.1), transparent);
	}

	.scene-wrapper {
		position: relative;
		width: 100%;
		height: 300px;
	}

	.scene-container {
		width: 100%;
		height: 100%;
		background: #111;
	}

	.scene-container :global(canvas) {
		display: block;
		width: 100% !important;
		height: 100% !important;
	}

	.annotations {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		pointer-events: none;
	}

	.annotation {
		position: absolute;
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.2rem 0.5rem;
		border-radius: 3px;
		background: rgba(0, 0, 0, 0.6);
		color: #ff6b6b;
		border: 1px solid rgba(255, 107, 107, 0.3);
		white-space: nowrap;
	}

	.annotation.good {
		color: #4ade80;
		border-color: rgba(74, 222, 128, 0.3);
	}

	.panel-desc {
		padding: 0.75rem 1rem;
		margin: 0;
		font-size: 0.8rem;
		color: #777;
		line-height: 1.4;
		border-top: 1px solid #2a2a2a;
	}

	button {
		margin-top: 1.5rem;
		padding: 0.6rem 1.8rem;
		font-size: 0.9rem;
		font-weight: 500;
		color: #e0e0e0;
		background: #1a1a1a;
		border: 1px solid #2a2a2a;
		border-radius: 6px;
		cursor: pointer;
		transition: background 0.2s, border-color 0.2s;
	}

	button:hover {
		background: rgba(245, 158, 11, 0.1);
		border-color: #f59e0b;
	}
</style>
