import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		setupFiles: ['./src/__tests__/integration/setup.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: [
				'node_modules/',
				'src/__tests__/',
				'**/*.d.ts',
				'**/*.config.*',
				'**/dist/',
			],
		},
		include: ['src/__tests__/integration/**/*.test.ts'],
		exclude: ['node_modules', 'dist', 'src/__tests__/**/*.test.ts'],
		testTimeout: 30000,
		hookTimeout: 30000,
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
});

