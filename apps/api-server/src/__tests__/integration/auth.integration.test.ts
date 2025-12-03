import { describe, it, expect, beforeAll } from 'vitest';
import { sql } from '../../db/client';
import { createTestUser, createTestSession, getAuthHeaders } from './helpers';

const API_URL = process.env.API_URL || 'http://localhost:3001';

describe('Authentication Integration Tests', () => {
	let testUser: { email: string; password: string; id?: string };

	beforeAll(async () => {
		testUser = await createTestUser({
			email: 'integration-test@example.com',
			password: 'TestPassword123!',
		});
	});

	it('should register a new user', async () => {
		const response = await fetch(`${API_URL}/api/v1/auth/register`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				email: `newuser-${Date.now()}@example.com`,
				password: 'SecurePassword123!',
				name: 'Test User',
			}),
		});

		expect(response.status).toBe(201);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.data).toHaveProperty('user');
		expect(data.data.user).toHaveProperty('email');
	});

	it('should login with valid credentials', async () => {
		const response = await fetch(`${API_URL}/api/v1/auth/login`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				email: testUser.email,
				password: testUser.password,
			}),
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.data).toHaveProperty('accessToken');
		expect(data.data).toHaveProperty('refreshToken');
		expect(response.headers.get('set-cookie')).toBeTruthy();
	});

	it('should reject login with invalid credentials', async () => {
		const response = await fetch(`${API_URL}/api/v1/auth/login`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				email: testUser.email,
				password: 'WrongPassword123!',
			}),
		});

		expect(response.status).toBe(401);
		const data = await response.json();
		expect(data.success).toBe(false);
	});

	it('should refresh access token', async () => {
		// First login to get tokens
		const loginResponse = await fetch(`${API_URL}/api/v1/auth/login`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				email: testUser.email,
				password: testUser.password,
			}),
		});

		const loginData = await loginResponse.json();
		const refreshToken = loginData.data.refreshToken;

		// Use refresh token
		const refreshResponse = await fetch(`${API_URL}/api/v1/auth/refresh`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				refreshToken,
			}),
		});

		expect(refreshResponse.status).toBe(200);
		const refreshData = await refreshResponse.json();
		expect(refreshData.success).toBe(true);
		expect(refreshData.data).toHaveProperty('accessToken');
	});

	it('should logout and invalidate session', async () => {
		// Create a session first
		const sessionToken = await createTestSession(testUser.id!);

		const response = await fetch(`${API_URL}/api/v1/auth/logout`, {
			method: 'POST',
			headers: await getAuthHeaders(sessionToken),
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.success).toBe(true);
	});
});

