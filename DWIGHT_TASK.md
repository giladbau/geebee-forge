# Dwight Task — Build /playwright demo for geebee-forge

## Context
geebee-forge is a SvelteKit 5 demo hub at ~/geebee-forge.
It has a /constellation page (Three.js star field). You're adding /playwright.

## What to build
A new route: `src/routes/playwright/+page.svelte`

## The concept (from @petergostev's tweet)
Peter Gostev compared OpenAI Codex outputs for the SAME prompt:
- **"With vision" (Playwright Interactive skill)**: Codex can *see* the UI it's building via GPT-5.4 computer-use, producing a much more coherent, high-fidelity, complete output
- **"Without vision"**: Codex generates blindly, producing a sparse, incomplete output missing many elements

The specific comparison showed two **3D bridge renders** (like Golden Gate Bridge in fog):
- Top/left (WITH vision): Rich atmospheric fog, detailed cable geometry, warm lighting, full scene composition
- Bottom/right (WITHOUT vision): Sparse geometry, no atmosphere, missing cables, flat appearance

## The demo to build
A side-by-side Three.js visualization showing:

### LEFT PANEL — "Without Vision" (blind)
- Dark label: "Without Vision"
- A sparse Three.js scene: simplified bridge silhouette, flat gray, no atmosphere, missing structural details
- Fewer geometry elements, no fog, harsh flat lighting
- Optional: an "AI cursor" that moves randomly/blindly

### RIGHT PANEL — "With Vision" (sighted)
- Label: "With Vision"
- A rich Three.js scene: suspension bridge with cables, atmospheric fog, warm amber/blue lighting, misty background, water below
- More geometry, volumetric fog using Three.js FogExp2, better composition
- Optional: a scanning/vision indicator effect

### Interactive elements
- Play/pause toggle button (`data-testid="play-pause-btn"`) — starts an animation or comparison transition
- The scene should animate (camera slowly orbiting, or a wipe transition between states)
- Step-through option optional

### Page structure
```html
<svelte:head><title>Playwright + Vision | geebee-forge</title></svelte:head>
<a href="/" class="back-link">← Back</a>
<h1>Playwright + Vision</h1>
<p class="subtitle">Same prompt. Two outputs. One AI can see.</p>

<div class="comparison" data-testid="comparison-container">
  <div class="panel" data-testid="panel-without">
    <div class="panel-label">Without Vision</div>
    <div data-testid="scene-without" aria-label="Three.js scene without vision"></div>
  </div>
  <div class="panel" data-testid="panel-with">
    <div class="panel-label">With Vision</div>
    <div data-testid="scene-with" aria-label="Three.js scene with vision"></div>
  </div>
</div>

<button data-testid="play-pause-btn" aria-label="Play or pause comparison animation">Play</button>
```

### Dark theme (match existing)
- Background: #0a0a0a
- Cards/panels: #1a1a1a borders #2a2a2a
- Text: #e0e0e0
- Accent (vision side): warm amber #f59e0b or electric blue #3b82f6

## Three.js bridge specifics
For the "with vision" scene, build something like:
- Two tall bridge towers (BoxGeometry pillars)
- Suspension cables (thin Lines or LineSegments, parabolic curve from towers down to road level)
- Road deck (flat box)
- Atmospheric fog: `scene.fog = new THREE.FogExp2(0x1a2a3a, 0.02)`
- Subtle water plane below (semi-transparent)
- Camera: slightly low angle, tilted up toward the towers
- Lighting: directional warm light + ambient blue

For the "without vision" scene:
- Just the two towers, no cables, no fog, no water
- Flat gray MeshBasicMaterial (no lighting)
- Camera: same position but more centered/boring

## Landing page update
Add a card for /playwright in `src/routes/+page.svelte`:
```html
<div class="card">
  <h2>Playwright + Vision</h2>
  <p>Same prompt. Two outputs. One AI can see.</p>
  <a href="/playwright">Launch Demo</a>
</div>
```

## Tests (already written by Stanley)
Run `npm test` after implementation — all 9 existing tests should still pass, plus the 5 new playwright-demo test files. Don't worry if some new tests need minor adjustments to match your implementation (you can edit them).

## Completion
When done:
1. Run `npm test` and `npm run build`
2. Fix any failures
3. `git add -A && git commit -m "feat: add playwright+vision comparison demo" && git push origin HEAD`
4. Run: `openclaw system event --text "Dwight done: /playwright demo built, tests pass, pushed to git" --mode now`
