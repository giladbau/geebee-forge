import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import react from '@astrojs/react';

export default defineConfig({
	output: 'static',
	integrations: [svelte(), react()],
	vite: {
		ssr: {
			noExternal: ['three']
		},
		resolve: {
			alias: {
				'$lib': '/src/lib'
			}
		},
		server: {
			allowedHosts: true
		}
	}
});
