<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	// ── Flight constants ──────────────────────────────────────────────
	const FLIGHT = 'LY90';
	const CALLSIGN = 'ELY90';
	const ORIGIN = { code: 'HKT', city: 'Phuket', lat: 8.1132, lon: 98.3169 };
	const DEST = { code: 'TLV', city: 'Tel Aviv', lat: 32.0114, lon: 34.8867 };
	const AIRCRAFT = 'Boeing 777-200';
	const SCHED_DEP_UTC = '15:35';
	const SCHED_ARR_UTC = '01:40';
	const DEP_LOCAL = '22:35';
	const ARR_LOCAL = '04:40';
	const API_URL = `https://api.adsb.lol/v2/callsign/${CALLSIGN}`;
	const REFRESH_MS = 30_000;

	const TEXTURE_BASE = 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/';

	// ── State ─────────────────────────────────────────────────────────
	type AcData = {
		flight: string;
		lat: number;
		lon: number;
		alt_baro: number;
		gs: number;
		track: number;
		t?: string;
	};

	let acData: AcData | null = $state(null);
	let status: 'Not Departed' | 'Airborne' | 'Landed' = $state('Not Departed');
	let lastUpdated: string = $state('—');
	let globeLoaded = $state(false);
	let intervalId: ReturnType<typeof setInterval> | undefined;

	// ── Canvas ref ────────────────────────────────────────────────────
	let canvasEl: HTMLCanvasElement;

	// ── Three.js scene refs (set in onMount) ──────────────────────────
	let threeRefs: {
		planeMarker: any;
		planeMesh: any;
		planeGlow: any;
		planeLight: any;
		arcTraveled: any;
		arcRemaining: any;
		controls: any;
	} | null = null;

	// ── Derived display values ────────────────────────────────────────
	let altitude = $derived(acData ? acData.alt_baro.toLocaleString() : '—');
	let speed = $derived(acData ? String(acData.gs) : '—');
	let heading = $derived(acData ? String(acData.track) : '—');

	// ── Route progress (0.0–1.0) ──────────────────────────────────────
	function haversineDist(lat1: number, lon1: number, lat2: number, lon2: number): number {
		const R = 6371;
		const dLat = (lat2 - lat1) * Math.PI / 180;
		const dLon = (lon2 - lon1) * Math.PI / 180;
		const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
		return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
	}

	let routeProgress = $derived.by(() => {
		if (status === 'Landed') return 1;
		if (status === 'Airborne' && acData) {
			const total = haversineDist(ORIGIN.lat, ORIGIN.lon, DEST.lat, DEST.lon);
			const flown = haversineDist(ORIGIN.lat, ORIGIN.lon, acData.lat, acData.lon);
			return Math.min(1, Math.max(0, flown / total));
		}
		return 0;
	});

	function statusColor(s: string) {
		if (s === 'Airborne') return '#22c55e';
		if (s === 'Landed') return '#eab308';
		return '#888';
	}

	function resolveEmptyStatus(): 'Not Departed' | 'Landed' {
		const now = new Date();
		const today = now.toISOString().slice(0, 10);
		const depUTC = new Date(`${today}T15:35:00Z`);
		const tomorrow = new Date(depUTC.getTime() + 86_400_000).toISOString().slice(0, 10);
		const arrUTC = new Date(`${tomorrow}T01:40:00Z`);
		if (now < depUTC) return 'Not Departed';
		if (now > arrUTC) return 'Landed';
		return 'Not Departed';
	}

	// ── Fetch ADSB data ───────────────────────────────────────────────
	async function fetchFlight() {
		try {
			const res = await fetch(API_URL);
			const data = await res.json();
			if (data.ac && data.ac.length > 0) {
				acData = data.ac[0];
				status = 'Airborne';
				lastUpdated = new Date().toLocaleTimeString();
				updateGlobePlane();
			} else {
				acData = null;
				status = resolveEmptyStatus();
				lastUpdated = new Date().toLocaleTimeString();
				updateGlobePlane();
			}
		} catch {
			// keep previous state
		}
	}

	// ── Three.js helpers ──────────────────────────────────────────────
	function latLonToXYZ(THREE: any, lat: number, lon: number, R = 1) {
		const phi   = (90 - lat) * (Math.PI / 180);
		const theta = (lon + 180) * (Math.PI / 180);
		return new THREE.Vector3(
			-R * Math.sin(phi) * Math.cos(theta),
			 R * Math.cos(phi),
			 R * Math.sin(phi) * Math.sin(theta)
		);
	}

	function slerpVec(THREE: any, p1: any, p2: any, t: number) {
		const omega = Math.acos(Math.min(1, p1.dot(p2)));
		if (omega < 0.001) return p1.clone();
		const s = Math.sin(omega);
		return new THREE.Vector3(
			(Math.sin((1-t)*omega)/s)*p1.x + (Math.sin(t*omega)/s)*p2.x,
			(Math.sin((1-t)*omega)/s)*p1.y + (Math.sin(t*omega)/s)*p2.y,
			(Math.sin((1-t)*omega)/s)*p1.z + (Math.sin(t*omega)/s)*p2.z
		);
	}

	function buildArcPoints(THREE: any, segments = 128): any[] {
		const p1 = latLonToXYZ(THREE, ORIGIN.lat, ORIGIN.lon).normalize();
		const p2 = latLonToXYZ(THREE, DEST.lat, DEST.lon).normalize();
		const pts = [];
		for (let i = 0; i <= segments; i++) {
			const t = i / segments;
			const v = slerpVec(THREE, p1, p2, t);
			const lift = 1 + 0.06 * Math.sin(Math.PI * t);
			pts.push(v.multiplyScalar(lift));
		}
		return pts;
	}

	function updateGlobePlane() {
		if (!threeRefs) return;
		// Will be updated on next animation frame via reactive closure
	}

	onMount(async () => {
		const THREE = await import('three');
		const { OrbitControls } = await import('three/addons/controls/OrbitControls.js' as any);

		// ── Scene ─────────────────────────────────────────────────────
		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0x000000);

		const W = canvasEl.clientWidth || 800;
		const H = canvasEl.clientHeight || 500;
		const camera = new THREE.PerspectiveCamera(45, W / H, 0.01, 100);
		camera.position.set(1.8, 0.8, 2.2);

		const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
		renderer.setSize(W, H, false);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

		// ── Controls ──────────────────────────────────────────────────
		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		controls.dampingFactor = 0.05;
		controls.minDistance = 1.5;
		controls.maxDistance = 5;
		controls.enablePan = false;
		controls.autoRotate = true;
		controls.autoRotateSpeed = 0.4;
		let resumeTimer: ReturnType<typeof setTimeout>;
		controls.addEventListener('start', () => { clearTimeout(resumeTimer); controls.autoRotate = false; });
		controls.addEventListener('end', () => { resumeTimer = setTimeout(() => controls.autoRotate = true, 5000); });

		// ── Stars ─────────────────────────────────────────────────────
		const starGeo = new THREE.BufferGeometry();
		const starVerts = [];
		for (let i = 0; i < 800; i++) {
			const theta = Math.random() * Math.PI * 2;
			const phi = Math.acos(2 * Math.random() - 1);
			const r = 40 + Math.random() * 10;
			starVerts.push(
				r * Math.sin(phi) * Math.cos(theta),
				r * Math.sin(phi) * Math.sin(theta),
				r * Math.cos(phi)
			);
		}
		starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
		const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, sizeAttenuation: true, transparent: true, opacity: 0.7 });
		scene.add(new THREE.Points(starGeo, starMat));

		// ── Lighting ──────────────────────────────────────────────────
		scene.add(new THREE.AmbientLight(0x1a1a2e, 0.4));
		const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
		keyLight.position.set(5, 3, 5);
		scene.add(keyLight);
		const rimLight = new THREE.DirectionalLight(0x4a7fff, 0.3);
		rimLight.position.set(-5, 1, -5);
		scene.add(rimLight);

		// ── Earth ─────────────────────────────────────────────────────
		const loader = new THREE.TextureLoader();
		const earthGeo = new THREE.SphereGeometry(1, 64, 64);
		const earthMat = new THREE.MeshPhongMaterial({
			map:         loader.load(TEXTURE_BASE + 'earth_atmos_2048.jpg'),
			normalMap:   loader.load(TEXTURE_BASE + 'earth_normal_2048.jpg'),
			specularMap: loader.load(TEXTURE_BASE + 'earth_specular_2048.jpg'),
			specular:    new THREE.Color(0x333333),
			shininess:   15,
		});
		scene.add(new THREE.Mesh(earthGeo, earthMat));

		// ── Atmosphere ────────────────────────────────────────────────
		const atmosGeo = new THREE.SphereGeometry(1.15, 64, 64);
		const atmosMat = new THREE.ShaderMaterial({
			vertexShader: `
				varying vec3 vNormal;
				void main() {
					vNormal = normalize(normalMatrix * normal);
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				}`,
			fragmentShader: `
				varying vec3 vNormal;
				void main() {
					float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 4.0);
					gl_FragColor = vec4(0.29, 0.498, 1.0, 1.0) * intensity;
				}`,
			blending: THREE.AdditiveBlending,
			side: THREE.BackSide,
			transparent: true,
		});
		scene.add(new THREE.Mesh(atmosGeo, atmosMat));

		// ── Airport markers ───────────────────────────────────────────
		const dotGeo = new THREE.SphereGeometry(0.01, 16, 16);
		const dotMat = new THREE.MeshBasicMaterial({ color: 0x4a7fff });
		[ORIGIN, DEST].forEach(ap => {
			const dot = new THREE.Mesh(dotGeo, dotMat);
			dot.position.copy(latLonToXYZ(THREE, ap.lat, ap.lon, 1.01));
			scene.add(dot);
			// Ring
			const ringGeo = new THREE.RingGeometry(0.015, 0.020, 32);
			const ringMat = new THREE.MeshBasicMaterial({ color: 0x4a7fff, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
			const ring = new THREE.Mesh(ringGeo, ringMat);
			ring.position.copy(latLonToXYZ(THREE, ap.lat, ap.lon, 1.012));
			ring.lookAt(0, 0, 0);
			scene.add(ring);
		});

		// ── Route arc (two segments: traveled + remaining) ────────────
		const allPts = buildArcPoints(THREE);
		const splitIdx = Math.round(routeProgress * allPts.length);

		const traveledGeo = new THREE.BufferGeometry().setFromPoints(allPts.slice(0, Math.max(2, splitIdx)));
		const traveledMat = new THREE.LineBasicMaterial({ color: 0x4a7fff, transparent: true, opacity: 1.0 });
		const arcTraveled = new THREE.Line(traveledGeo, traveledMat);
		scene.add(arcTraveled);

		const remainingGeo = new THREE.BufferGeometry().setFromPoints(allPts.slice(Math.max(0, splitIdx)));
		const remainingMat = new THREE.LineDashedMaterial({ color: 0x4a7fff, transparent: true, opacity: 0.35, dashSize: 0.04, gapSize: 0.025 });
		const arcRemaining = new THREE.Line(remainingGeo, remainingMat);
		arcRemaining.computeLineDistances();
		scene.add(arcRemaining);

		// ── Plane marker ──────────────────────────────────────────────
		const coneGeo = new THREE.ConeGeometry(0.012, 0.04, 4);
		coneGeo.rotateX(Math.PI / 2);
		const coneMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
		const planeMesh = new THREE.Mesh(coneGeo, coneMat);

		// Glow sprite
		const glowCanvas = document.createElement('canvas');
		glowCanvas.width = 64; glowCanvas.height = 64;
		const gctx = glowCanvas.getContext('2d')!;
		const grad = gctx.createRadialGradient(32, 32, 0, 32, 32, 32);
		grad.addColorStop(0, 'rgba(74, 127, 255, 0.8)');
		grad.addColorStop(1, 'rgba(74, 127, 255, 0)');
		gctx.fillStyle = grad;
		gctx.fillRect(0, 0, 64, 64);
		const glowTex = new THREE.CanvasTexture(glowCanvas);
		const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, transparent: true }));
		glowSprite.scale.set(0.08, 0.08, 1);

		const planeGroup = new THREE.Group();
		planeGroup.add(planeMesh);
		planeGroup.add(glowSprite);
		scene.add(planeGroup);

		// Plane point light
		const planeLight = new THREE.PointLight(0x4a7fff, 0, 0.3, 2);
		scene.add(planeLight);

		threeRefs = { planeMarker: planeGroup, planeMesh, planeGlow: glowSprite, planeLight, arcTraveled, arcRemaining, controls };

		// ── Position plane ────────────────────────────────────────────
		function positionPlane() {
			let planeLat = ORIGIN.lat, planeLon = ORIGIN.lon;
			if (status === 'Landed') { planeLat = DEST.lat; planeLon = DEST.lon; }
			else if (status === 'Airborne' && acData) { planeLat = acData.lat; planeLon = acData.lon; }

			const pos = latLonToXYZ(THREE, planeLat, planeLon, 1.04);
			planeGroup.position.copy(pos);
			planeLight.position.copy(pos);

			// Orient cone along arc tangent
			const t = routeProgress;
			const t2 = Math.min(1, t + 0.01);
			const p1 = allPts[Math.floor(t * (allPts.length-1))];
			const p2 = allPts[Math.floor(t2 * (allPts.length-1))];
			if (p1 && p2) {
				planeGroup.lookAt(p2);
			} else {
				planeGroup.lookAt(0, 0, 0);
				planeGroup.rotateX(Math.PI);
			}
		}
		positionPlane();

		// ── Update arc splits ─────────────────────────────────────────
		function updateArc(progress: number) {
			const idx = Math.round(progress * allPts.length);
			const tPts = allPts.slice(0, Math.max(2, idx));
			const rPts = allPts.slice(Math.max(0, idx - 1));
			arcTraveled.geometry.setFromPoints(tPts);
			arcRemaining.geometry.setFromPoints(rPts);
			arcRemaining.computeLineDistances();
		}

		// ── Animation loop ────────────────────────────────────────────
		let animId: number;
		let t = 0;
		let loadFrames = 0;
		const startPos = camera.position.clone().multiplyScalar(1.3);
		const endPos = camera.position.clone();
		camera.position.copy(startPos);

		function animate() {
			animId = requestAnimationFrame(animate);
			t += 0.016;

			// Camera ease-in on load
			if (loadFrames < 90) {
				const f = loadFrames / 90;
				const ease = 1 - Math.pow(1 - f, 3);
				camera.position.lerpVectors(startPos, endPos, ease);
				loadFrames++;
			}

			// Animate remaining arc dash
			(arcRemaining.material as any).dashOffset -= 0.003;

			// Pulse plane glow when airborne
			if (status === 'Airborne') {
				const pulse = Math.sin(t * 2) * 0.5 + 1.0;
				glowSprite.scale.set(0.06 + 0.03 * pulse, 0.06 + 0.03 * pulse, 1);
				planeLight.intensity = 0.8 * pulse;
			} else {
				glowSprite.scale.set(0, 0, 1);
				planeLight.intensity = 0;
			}

			controls.update();
			renderer.render(scene, camera);

			if (!globeLoaded) globeLoaded = true;
		}
		animate();

		// ── Sync globe state with ADSB data ───────────────────────────
		const syncInterval = setInterval(() => {
			positionPlane();
			updateArc(routeProgress);
		}, 1000);

		// ── Resize ────────────────────────────────────────────────────
		const onResize = () => {
			const w = canvasEl.clientWidth;
			const h = canvasEl.clientHeight;
			camera.aspect = w / h;
			camera.updateProjectionMatrix();
			renderer.setSize(w, h, false);
		};
		window.addEventListener('resize', onResize);

		// ── Data fetching ─────────────────────────────────────────────
		await fetchFlight();
		intervalId = setInterval(fetchFlight, REFRESH_MS);

		// ── Cleanup ───────────────────────────────────────────────────
		return () => {
			cancelAnimationFrame(animId);
			clearInterval(syncInterval);
			window.removeEventListener('resize', onResize);
			clearTimeout(resumeTimer);
			controls.dispose();
			renderer.dispose();
			scene.traverse((obj: any) => {
				obj.geometry?.dispose();
				const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
				mats.forEach((m: any) => m?.dispose());
			});
		};
	});

	onDestroy(() => {
		if (intervalId) clearInterval(intervalId);
	});
</script>

<svelte:head>
	<title>LY90 Flight Tracker</title>
</svelte:head>

<div class="dashboard">
	<!-- ── Flight Header ─────────────────────────────────────────── -->
	<header class="flight-header">
		<div class="flight-id">
			<h1><span class="flight-icon">✈</span> {FLIGHT}</h1>
			<span class="airline">El Al</span>
			<span class="aircraft">{AIRCRAFT}</span>
		</div>

		<div class="route">
			<div class="airport origin">
				<span class="code">{ORIGIN.code}</span>
				<span class="city">{ORIGIN.city}</span>
				<span class="time">Dep {DEP_LOCAL} ICT</span>
				<span class="utc">{SCHED_DEP_UTC} UTC</span>
			</div>
			<div class="route-arrow">
				<div class="route-track">
					<div class="route-fill" style="width: {routeProgress * 100}%"></div>
					<span class="route-plane-icon" style="left: {routeProgress * 100}%">✈</span>
				</div>
			</div>
			<div class="airport dest">
				<span class="code">{DEST.code}</span>
				<span class="city">{DEST.city}</span>
				<span class="time">Arr {ARR_LOCAL} IST</span>
				<span class="utc">{SCHED_ARR_UTC} UTC</span>
			</div>
		</div>

		<div class="status-badge" data-testid="status-badge" style="background: {statusColor(status)}10; color: {statusColor(status)}; border-color: {statusColor(status)}30; box-shadow: 0 0 16px {statusColor(status)}12">
			<span class="status-dot" class:pulsing={status === 'Airborne'} style="background: {statusColor(status)}; box-shadow: 0 0 6px {statusColor(status)}80"></span>
			{status}
		</div>
	</header>

	<!-- ── Live Telemetry ─────────────────────────────────────────── -->
	<section class="live-data" data-testid="live-data" class:dimmed={status !== 'Airborne'}>
		<div class="metric">
			<span class="metric-label">Altitude</span>
			<span class="metric-value">{altitude} <span class="metric-unit">ft</span></span>
		</div>
		<div class="metric">
			<span class="metric-label">Speed</span>
			<span class="metric-value">{speed} <span class="metric-unit">kts</span></span>
		</div>
		<div class="metric">
			<span class="metric-label">Heading</span>
			<span class="metric-value">{heading} <span class="metric-unit">°</span></span>
		</div>
		<div class="metric updated">
			<span class="metric-label">Last Update</span>
			<span class="metric-value small">{lastUpdated}</span>
		</div>
	</section>

	<!-- ── 3D Globe ───────────────────────────────────────────────── -->
	<section class="globe-section" data-testid="map-container">
		{#if !globeLoaded}
			<div class="globe-loading">
				<div class="globe-spinner"></div>
			</div>
		{/if}
		<canvas bind:this={canvasEl}></canvas>
	</section>

	<a href="/" class="back-link">← Back to GeeBee Forge</a>
</div>

<style>
	.dashboard {
		min-height: 100vh;
		max-width: 960px;
		margin: 0 auto;
		padding: 2.5rem 1.5rem;
	}

	/* ── Flight Header ──────────────────────────────────────────── */
	.flight-header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1.5rem;
		margin-bottom: 2.5rem;
		padding-bottom: 2rem;
		border-bottom: 1px solid #1a1a1a;
		position: relative;
	}

	.flight-header::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 10%;
		right: 10%;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(74, 127, 255, 0.2), transparent);
	}

	.flight-id h1 {
		font-size: 3rem;
		font-weight: 800;
		margin: 0;
		color: #fff;
		letter-spacing: -0.03em;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		line-height: 1;
	}

	.flight-icon {
		font-size: 1.6rem;
		color: #4a7fff;
		display: inline-block;
		transform: rotate(-30deg);
	}

	.airline {
		display: block;
		color: #4a7fff;
		font-size: 0.78rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		margin-top: 0.35rem;
	}

	.aircraft {
		display: block;
		color: #555;
		font-size: 0.72rem;
		margin-top: 0.1rem;
	}

	.route {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		justify-content: center;
	}

	.airport { text-align: center; min-width: 70px; }

	.code {
		display: block;
		font-size: 1.75rem;
		font-weight: 800;
		color: #e0e0e0;
		letter-spacing: 0.02em;
	}

	.city { display: block; color: #777; font-size: 0.72rem; margin-top: 0.1rem; }

	.time {
		display: block;
		color: #6ba3ff;
		font-size: 0.7rem;
		margin-top: 0.4rem;
		font-variant-numeric: tabular-nums;
	}

	.utc { display: block; color: #4a4a4a; font-size: 0.62rem; font-variant-numeric: tabular-nums; }

	.route-arrow {
		display: flex;
		align-items: center;
		flex: 1;
		max-width: 140px;
		min-width: 60px;
	}

	.route-track { position: relative; flex: 1; height: 2px; background: #2a2a2a; }

	.route-fill {
		position: absolute;
		left: 0; top: 0; height: 100%;
		background: #4a7fff;
		transition: width 1s ease;
	}

	.route-plane-icon {
		position: absolute;
		top: 50%;
		transform: translate(-50%, -50%);
		transition: left 1s ease;
		font-size: 1.2rem;
		color: #4a7fff;
		line-height: 1;
	}

	.status-badge {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.45rem 1.1rem;
		border-radius: 999px;
		font-size: 0.78rem;
		font-weight: 600;
		border: 1px solid;
		white-space: nowrap;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		transition: box-shadow 0.4s ease, background 0.4s ease;
	}

	.status-dot {
		width: 7px; height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
		transition: background 0.4s ease, box-shadow 0.4s ease;
	}

	.status-dot.pulsing { animation: pulse 2s ease-in-out infinite; }

	/* ── Live Telemetry ─────────────────────────────────────────── */
	.live-data {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1px;
		background: #222;
		border: 1px solid #2a2a2a;
		border-radius: 12px;
		margin-bottom: 0;
		overflow: hidden;
		transition: opacity 0.4s ease;
	}

	.live-data.dimmed { opacity: 0.3; }

	.metric {
		text-align: center;
		padding: 1.25rem 0.75rem;
		background: #131313;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.metric-label {
		display: block;
		color: #555;
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-weight: 500;
	}

	.metric-value {
		display: block;
		font-size: 1.75rem;
		font-weight: 700;
		color: #fff;
		font-variant-numeric: tabular-nums;
		line-height: 1.1;
	}

	.metric-unit { font-size: 0.7rem; color: #555; font-weight: 400; margin-left: 0.15rem; }
	.metric-value.small { font-size: 1rem; color: #777; font-weight: 500; }

	/* ── Globe ───────────────────────────────────────────────────── */
	.globe-section {
		width: 100%;
		height: 60vh;
		min-height: 400px;
		max-height: 700px;
		position: relative;
		background: #000;
		overflow: hidden;
		border-top: 1px solid rgba(74, 127, 255, 0.1);
		border-bottom: 1px solid rgba(74, 127, 255, 0.1);
		margin-bottom: 2rem;
	}

	.globe-section canvas {
		position: absolute;
		inset: 0;
		width: 100% !important;
		height: 100% !important;
	}

	.globe-loading {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #000;
		z-index: 1;
	}

	.globe-spinner {
		width: 32px; height: 32px;
		border: 2px solid rgba(74, 127, 255, 0.2);
		border-top-color: #4a7fff;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	/* ── Back link ───────────────────────────────────────────────── */
	.back-link {
		display: inline-block;
		color: #6ba3ff;
		text-decoration: none;
		font-size: 0.8rem;
		opacity: 0.6;
		transition: opacity 0.2s ease;
	}

	.back-link:hover { opacity: 1; }

	/* ── Animations ─────────────────────────────────────────────── */
	@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
	@keyframes spin { to { transform: rotate(360deg); } }

	/* ── Responsive ──────────────────────────────────────────────── */
	@media (max-width: 640px) {
		.dashboard { padding: 1.5rem 1rem; }
		.flight-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
		.flight-id h1 { font-size: 2.4rem; }
		.route { width: 100%; justify-content: flex-start; }
		.live-data { grid-template-columns: repeat(2, 1fr); }
		.metric-value { font-size: 1.4rem; }
		.globe-section { height: 50vh; min-height: 300px; }
	}
</style>
