import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
	output: 'server',
	adapter: cloudflare(),
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
