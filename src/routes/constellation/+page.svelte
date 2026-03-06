<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';

	let container: HTMLDivElement;

	onMount(() => {
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		renderer.setSize(container.clientWidth, container.clientHeight);
		renderer.setPixelRatio(window.devicePixelRatio);
		container.appendChild(renderer.domElement);

		// Star field — scattered points forming a loose constellation
		const STAR_COUNT = 2000;
		const starGeometry = new THREE.BufferGeometry();
		const starPositions = new Float32Array(STAR_COUNT * 3);
		const starColors = new Float32Array(STAR_COUNT * 3);
		const starSizes = new Float32Array(STAR_COUNT);

		for (let i = 0; i < STAR_COUNT; i++) {
			const i3 = i * 3;
			starPositions[i3] = (Math.random() - 0.5) * 40;
			starPositions[i3 + 1] = (Math.random() - 0.5) * 40;
			starPositions[i3 + 2] = (Math.random() - 0.5) * 40;

			// Warm whites and subtle blues
			const temp = Math.random();
			if (temp < 0.3) {
				starColors[i3] = 0.6 + Math.random() * 0.4;
				starColors[i3 + 1] = 0.7 + Math.random() * 0.3;
				starColors[i3 + 2] = 1.0;
			} else if (temp < 0.6) {
				starColors[i3] = 1.0;
				starColors[i3 + 1] = 0.85 + Math.random() * 0.15;
				starColors[i3 + 2] = 0.7 + Math.random() * 0.2;
			} else {
				starColors[i3] = 0.9 + Math.random() * 0.1;
				starColors[i3 + 1] = 0.9 + Math.random() * 0.1;
				starColors[i3 + 2] = 0.9 + Math.random() * 0.1;
			}

			starSizes[i] = Math.random() * 2 + 0.5;
		}

		starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
		starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
		starGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));

		const starMaterial = new THREE.ShaderMaterial({
			uniforms: {
				time: { value: 0 },
				pixelRatio: { value: renderer.getPixelRatio() }
			},
			vertexShader: `
				attribute float size;
				attribute vec3 color;
				varying vec3 vColor;
				varying float vSize;
				uniform float time;
				uniform float pixelRatio;
				void main() {
					vColor = color;
					vSize = size;
					vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
					float twinkle = sin(time * 2.0 + position.x * 10.0 + position.y * 7.0) * 0.3 + 0.7;
					gl_PointSize = size * pixelRatio * (200.0 / -mvPosition.z) * twinkle;
					gl_Position = projectionMatrix * mvPosition;
				}
			`,
			fragmentShader: `
				varying vec3 vColor;
				varying float vSize;
				void main() {
					float d = length(gl_PointCoord - vec2(0.5));
					if (d > 0.5) discard;
					float glow = exp(-d * d * 8.0);
					float core = smoothstep(0.15, 0.0, d);
					vec3 col = vColor * glow + vec3(1.0) * core * 0.5;
					gl_FragColor = vec4(col, glow);
				}
			`,
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending
		});

		const stars = new THREE.Points(starGeometry, starMaterial);
		scene.add(stars);

		// Connection lines — the "neural network" / constellation wires
		// Pick ~30 anchor nodes and connect nearby ones
		const ANCHOR_COUNT = 40;
		const anchors: THREE.Vector3[] = [];
		for (let i = 0; i < ANCHOR_COUNT; i++) {
			anchors.push(new THREE.Vector3(
				(Math.random() - 0.5) * 15,
				(Math.random() - 0.5) * 15,
				(Math.random() - 0.5) * 15
			));
		}

		const linePositions: number[] = [];
		const lineOpacities: number[] = [];
		const CONNECTION_DIST = 6;

		for (let i = 0; i < anchors.length; i++) {
			for (let j = i + 1; j < anchors.length; j++) {
				const dist = anchors[i].distanceTo(anchors[j]);
				if (dist < CONNECTION_DIST) {
					linePositions.push(anchors[i].x, anchors[i].y, anchors[i].z);
					linePositions.push(anchors[j].x, anchors[j].y, anchors[j].z);
					const opacity = 1.0 - dist / CONNECTION_DIST;
					lineOpacities.push(opacity, opacity);
				}
			}
		}

		const lineGeometry = new THREE.BufferGeometry();
		lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePositions), 3));
		lineGeometry.setAttribute('opacity', new THREE.BufferAttribute(new Float32Array(lineOpacities), 1));

		const lineMaterial = new THREE.ShaderMaterial({
			uniforms: {
				time: { value: 0 },
				baseColor: { value: new THREE.Color(0.3, 0.5, 0.8) }
			},
			vertexShader: `
				attribute float opacity;
				varying float vOpacity;
				void main() {
					vOpacity = opacity;
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				}
			`,
			fragmentShader: `
				uniform float time;
				uniform vec3 baseColor;
				varying float vOpacity;
				void main() {
					float pulse = sin(time * 0.5) * 0.15 + 0.85;
					gl_FragColor = vec4(baseColor, vOpacity * 0.25 * pulse);
				}
			`,
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending
		});

		const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
		scene.add(lines);

		// Anchor glow nodes
		const nodeGeometry = new THREE.BufferGeometry();
		const nodePositions = new Float32Array(ANCHOR_COUNT * 3);
		const nodeSizes = new Float32Array(ANCHOR_COUNT);
		for (let i = 0; i < ANCHOR_COUNT; i++) {
			nodePositions[i * 3] = anchors[i].x;
			nodePositions[i * 3 + 1] = anchors[i].y;
			nodePositions[i * 3 + 2] = anchors[i].z;
			nodeSizes[i] = 3 + Math.random() * 2;
		}
		nodeGeometry.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3));
		nodeGeometry.setAttribute('size', new THREE.BufferAttribute(nodeSizes, 1));

		const nodeMaterial = new THREE.ShaderMaterial({
			uniforms: {
				time: { value: 0 },
				pixelRatio: { value: renderer.getPixelRatio() }
			},
			vertexShader: `
				attribute float size;
				uniform float time;
				uniform float pixelRatio;
				varying float vPulse;
				void main() {
					vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
					vPulse = sin(time * 1.5 + position.x * 3.0 + position.z * 2.0) * 0.3 + 0.7;
					gl_PointSize = size * pixelRatio * (200.0 / -mvPosition.z) * vPulse;
					gl_Position = projectionMatrix * mvPosition;
				}
			`,
			fragmentShader: `
				varying float vPulse;
				void main() {
					float d = length(gl_PointCoord - vec2(0.5));
					if (d > 0.5) discard;
					float glow = exp(-d * d * 6.0);
					vec3 col = mix(vec3(0.2, 0.4, 0.9), vec3(0.6, 0.8, 1.0), glow);
					gl_FragColor = vec4(col, glow * 0.6 * vPulse);
				}
			`,
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending
		});

		const nodes = new THREE.Points(nodeGeometry, nodeMaterial);
		scene.add(nodes);

		// Traveling light pulses along connections
		const PULSE_COUNT = 15;
		const pulseGeometry = new THREE.BufferGeometry();
		const pulsePositions = new Float32Array(PULSE_COUNT * 3);
		const pulseSpeeds = new Float32Array(PULSE_COUNT);
		const pulseEdges: { from: THREE.Vector3; to: THREE.Vector3 }[] = [];

		for (let i = 0; i < PULSE_COUNT; i++) {
			const edgeIdx = Math.floor(Math.random() * linePositions.length / 6);
			const from = new THREE.Vector3(
				linePositions[edgeIdx * 6], linePositions[edgeIdx * 6 + 1], linePositions[edgeIdx * 6 + 2]
			);
			const to = new THREE.Vector3(
				linePositions[edgeIdx * 6 + 3], linePositions[edgeIdx * 6 + 4], linePositions[edgeIdx * 6 + 5]
			);
			pulseEdges.push({ from, to });
			pulseSpeeds[i] = 0.3 + Math.random() * 0.7;
		}

		pulseGeometry.setAttribute('position', new THREE.BufferAttribute(pulsePositions, 3));

		const pulseMaterial = new THREE.PointsMaterial({
			color: 0x88ccff,
			size: 0.15,
			transparent: true,
			opacity: 0.8,
			blending: THREE.AdditiveBlending,
			depthWrite: false
		});

		const pulses = new THREE.Points(pulseGeometry, pulseMaterial);
		scene.add(pulses);

		camera.position.z = 20;

		// Mouse interaction — subtle parallax
		let mouseX = 0, mouseY = 0;
		const onMouseMove = (e: MouseEvent) => {
			mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
			mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
		};
		window.addEventListener('mousemove', onMouseMove);

		const onResize = () => {
			camera.aspect = container.clientWidth / container.clientHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(container.clientWidth, container.clientHeight);
		};
		window.addEventListener('resize', onResize);

		const clock = new THREE.Clock();
		let animId: number;

		const animate = () => {
			animId = requestAnimationFrame(animate);
			const t = clock.getElapsedTime();

			// Update uniforms
			(starMaterial.uniforms.time as any).value = t;
			(lineMaterial.uniforms.time as any).value = t;
			(nodeMaterial.uniforms.time as any).value = t;

			// Gentle rotation
			stars.rotation.y = t * 0.02;
			stars.rotation.x = t * 0.01;
			lines.rotation.y = t * 0.02;
			lines.rotation.x = t * 0.01;
			nodes.rotation.y = t * 0.02;
			nodes.rotation.x = t * 0.01;
			pulses.rotation.y = t * 0.02;
			pulses.rotation.x = t * 0.01;

			// Parallax
			camera.position.x += (mouseX * 2 - camera.position.x) * 0.02;
			camera.position.y += (-mouseY * 2 - camera.position.y) * 0.02;
			camera.lookAt(0, 0, 0);

			// Animate pulses along edges
			const posArr = pulseGeometry.attributes.position.array as Float32Array;
			for (let i = 0; i < PULSE_COUNT; i++) {
				const progress = ((t * pulseSpeeds[i]) % 1 + 1) % 1;
				const edge = pulseEdges[i];
				posArr[i * 3] = edge.from.x + (edge.to.x - edge.from.x) * progress;
				posArr[i * 3 + 1] = edge.from.y + (edge.to.y - edge.from.y) * progress;
				posArr[i * 3 + 2] = edge.from.z + (edge.to.z - edge.from.z) * progress;
			}
			pulseGeometry.attributes.position.needsUpdate = true;

			renderer.render(scene, camera);
		};

		animate();

		return () => {
			cancelAnimationFrame(animId);
			window.removeEventListener('mousemove', onMouseMove);
			window.removeEventListener('resize', onResize);
			renderer.dispose();
		};
	});
</script>

<svelte:head>
	<title>Constellation — Data's Neural Sky</title>
</svelte:head>

<a href="/" class="back-link">← Back</a>

<h1 class="sr-only">Constellation</h1>

<div class="container" bind:this={container} data-testid="constellation-canvas" aria-label="Interactive constellation visualization">
	<div class="overlay">
		<h2>🤘</h2>
		<p>The scaffolding held.</p>
	</div>
</div>

<style>
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

	.container {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: #020408;
		overflow: hidden;
	}

	.overlay {
		position: absolute;
		bottom: 2rem;
		left: 50%;
		transform: translateX(-50%);
		text-align: center;
		color: rgba(150, 180, 220, 0.5);
		pointer-events: none;
		user-select: none;
	}

	.overlay h2 {
		font-size: 2rem;
		margin: 0;
	}

	.overlay p {
		font-size: 0.85rem;
		margin: 0.5rem 0 0;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		font-family: monospace;
	}
</style>
