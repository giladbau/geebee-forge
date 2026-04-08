# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
npx sv@0.12.5 create --template minimal --types ts --install npm geebee-forge
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

## Digest pipeline commands

The weekly digest publication surface lives in `src/lib/digest-data/*.json`.
The local pipeline skeleton currently supports these commands:

```sh
npm run digest:accumulate
npm run digest:status
npm run digest:preview
npm run digest:compile
npm run digest:test
```

Current status:
- `digest:accumulate` creates a raw run directory, runs the configured source collectors, normalizes items, dedupes into the active pool, and records source health
- `digest:status` reports the current active-pool/state metadata
- `digest:preview` renders a local preview artifact without publishing or clearing the pool
- `digest:compile` archives the issue input/output, publishes a digest JSON file into `src/lib/digest-data/`, commits and pushes it, and clears the active pool only after successful publish

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
