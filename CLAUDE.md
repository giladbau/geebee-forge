# CLAUDE.md — geebee-forge

## Project
- SvelteKit + Cloudflare Pages
- Deploy: push to `main` → GitHub Actions → CF Pages
- Live: https://geebee-forge.pages.dev
- Remote: `origin/main` (no `master` branch — don't create one)

## Stack
- SvelteKit, TypeScript, Vitest
- Threlte (Three.js) for 3D pages (e.g. /unicorn-farm)
- Svelte 5 runes (`$state`, `$derived`, etc.)

## Todoist
Track all work in the **🤖 Data Dev** project via the Todoist MCP tool (configured in your MCP servers).
- **Create a task when starting work** — before writing any code
- Comment on progress if multi-step
- **Complete the task when done** — after committing

## Three.js / Threlte Performance Rules
- **Share geometries**: create Shape/ExtrudeGeometry ONCE at module scope, reuse for all instances
- **Object pools for particles**: pre-allocate fixed arrays, toggle `active` flag — never splice/spread per frame
- **No per-frame allocations**: no `new Array()`, no spread `[...old, ...new]` in animation loops
- **Use `visible={false}`** to skip rendering inactive objects (cheaper than removing from DOM)
- **Cap particle counts**: set a max pool size, recycle oldest when full

## Unicorn Farm Specifics
- All components in `src/routes/unicorn-farm/`
- Interactive elements: flowers (petal burst), rainbow (heart & star particles + wobble), well (bucket animation), hay bales (bounce), crystals (pulse + ring), brick walls (crumble + reassemble)
- Terrain is intentionally compact (~50x50) — farm is the focus, minimal surrounding terrain
- Camera: orthographic isometric with OrbitControls

## Conventions
- Commit messages: `feat(scope):`, `fix(scope):`, `chore(scope):`
- Keep components in their route folder
- When adding interactivity: always `stopPropagation` on click handlers to avoid camera interference
