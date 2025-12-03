import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PORT || 3000;
const API_PORT = process.env.API_PORT || 3001;
const BASE_URL = `http://localhost:${PORT}`;
const API_URL = `http://localhost:${API_PORT}`;

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: [
		['html'],
		['list'],
		...(process.env.CI ? [['github']] : []),
	],
	use: {
		baseURL: BASE_URL,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
		{
			name: 'firefox',
			use: { ...devices['Desktop Firefox'] },
		},
		{
			name: 'webkit',
			use: { ...devices['Desktop Safari'] },
		},
	],
	webServer: [
		{
			command: 'bun run dev',
			url: BASE_URL,
			reuseExistingServer: !process.env.CI,
			timeout: 120 * 1000,
		},
		{
			command: 'cd ../api-server && bun run dev',
			url: `${API_URL}/api/v1/health`,
			reuseExistingServer: !process.env.CI,
			timeout: 120 * 1000,
		},
	],
});

