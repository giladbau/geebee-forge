# CLAUDE.md — geebee-forge

## Project
- SvelteKit + Cloudflare Pages
- Deploy: push to `main` → GitHub Actions → CF Pages
- Live: https://geebee-forge.pages.dev

## Stack
- SvelteKit, TypeScript, Vitest
- Threlte (Three.js) for 3D pages (e.g. /unicorn-farm)
- Svelte 5 runes (`$state`, `$derived`, etc.)

## Todoist
Track all work in the **🤖 Data Dev** project.
- Create a task when starting work
- Comment on progress if multi-step
- Complete the task when done
- Use the Todoist MCP tool — it's configured in your MCP servers

## Conventions
- Commit messages: `feat(scope):`, `fix(scope):`, `chore(scope):`
- Keep components in their route folder (e.g. `src/routes/unicorn-farm/`)
- Three.js: share geometries/materials, use object pools for particles — never create per-frame
