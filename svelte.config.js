import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// Vercel deployment adapter
		// Keep builds and deployed functions on a Vercel-supported Node runtime.
		// The local toolchain may expose a newer Node version that adapter-vercel
		// cannot infer, so make the deployment target explicit.
		adapter: adapter({ runtime: 'nodejs24.x' })
	}
};

export default config;
