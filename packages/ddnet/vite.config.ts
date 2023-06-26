import {defineConfig} from 'vite';

export default defineConfig({
	test: {
		globals: true,
		coverage: {
			provider: 'istanbul',
			reporter: ['text'],
		},
		browser: {
			name: 'chrome',
			headless: true,
		},
	},
	optimizeDeps: {
		esbuildOptions: {
			supported: {
				bigint: true,
			},
		},
	},
});
