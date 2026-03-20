import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
	plugins: [svelte({ hot: !process.env.VITEST })],
	resolve: {
		conditions: ['browser'],
		alias: {
			'$lib': '/src/lib'
		}
	},
	test: {
		environment: 'jsdom',
		globals: true,
		include: ['src/**/*.test.ts'],
	},
});
