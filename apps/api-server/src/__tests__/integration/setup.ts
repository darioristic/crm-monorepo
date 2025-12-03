import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { sql, db } from '../../db/client';
import { redis } from '../../cache/redis';

// Test database configuration
const TEST_DATABASE_URL =
	process.env.TEST_DATABASE_URL ||
	'postgresql://crm_user:crm_password@localhost:5432/crm_test';

// Override environment variables for integration tests
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/2';
process.env.JWT_SECRET = 'test-jwt-secret-for-integration-tests';
process.env.ENABLE_WORKERS = 'false';

let testDbInitialized = false;

async function setupTestDatabase() {
	if (testDbInitialized) return;

	try {
		// Test connection
		await sql`SELECT 1`;
		console.log('✅ Test database connected');

		// Run migrations if needed (you might want to use a separate test DB)
		// For now, we'll assume migrations are already run
		testDbInitialized = true;
	} catch (error) {
		console.error('❌ Failed to connect to test database:', error);
		throw error;
	}
}

async function cleanupTestDatabase() {
	try {
		// Clean up test data - be careful with this in production!
		// This is a simple cleanup - you might want more sophisticated cleanup
		const tables = [
			'invites',
			'notification_settings',
			'notifications',
			'orders',
			'connected_accounts',
		];

		for (const table of tables) {
			try {
				await sql.unsafe(`TRUNCATE TABLE ${table} CASCADE`);
			} catch (err) {
				// Table might not exist or have dependencies
				console.warn(`Could not truncate ${table}:`, err);
			}
		}
	} catch (error) {
		console.error('Error cleaning up test database:', error);
	}
}

async function cleanupRedis() {
	try {
		const keys = await redis.keys('test:*');
		if (keys.length > 0) {
			await redis.del(...keys);
		}
	} catch (error) {
		console.error('Error cleaning up Redis:', error);
	}
}

beforeAll(async () => {
	console.log('🧪 Setting up integration test environment...');
	await setupTestDatabase();
	await cleanupRedis();
	console.log('✅ Integration test environment ready');
});

afterAll(async () => {
	console.log('🧹 Cleaning up integration test environment...');
	await cleanupTestDatabase();
	await cleanupRedis();
	await sql.end();
	redis.disconnect();
	console.log('✅ Integration test environment cleaned up');
});

beforeEach(async () => {
	// Clean up before each test
	await cleanupTestDatabase();
	await cleanupRedis();
});

afterEach(async () => {
	// Additional cleanup after each test if needed
});

