import { describe, it, expect, beforeAll } from 'vitest';
import { sql } from '../../db/client';
import {
	createTestUser,
	createTestCompany,
	createTestSession,
	getAuthHeaders,
	cleanupCompany,
} from './helpers';

const API_URL = process.env.API_URL || 'http://localhost:3001';

describe('Companies API Integration Tests', () => {
	let testUser: { email: string; password: string; id?: string };
	let authHeaders: Record<string, string>;
	let sessionToken: string;

	beforeAll(async () => {
		testUser = await createTestUser();
		sessionToken = await createTestSession(testUser.id!);
		authHeaders = await getAuthHeaders(sessionToken);
	});

	it('should get current company', async () => {
		const response = await fetch(`${API_URL}/api/v1/companies/current`, {
			method: 'GET',
			headers: authHeaders,
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.data).toHaveProperty('company');
	});

	it('should list all companies', async () => {
		const response = await fetch(`${API_URL}/api/v1/companies`, {
			method: 'GET',
			headers: authHeaders,
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(Array.isArray(data.data)).toBe(true);
	});

	it('should create a new company', async () => {
		const companyData = {
			name: `Integration Test Company ${Date.now()}`,
			industry: 'Technology',
		};

		const response = await fetch(`${API_URL}/api/v1/companies`, {
			method: 'POST',
			headers: {
				...authHeaders,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(companyData),
		});

		expect(response.status).toBe(201);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.data.company.name).toBe(companyData.name);

		// Cleanup
		if (data.data.company.id) {
			await cleanupCompany(data.data.company.id);
		}
	});

	it('should get company by ID', async () => {
		// Create a test company first
		const company = await createTestCompany();

		const response = await fetch(`${API_URL}/api/v1/companies/${company.id}`, {
			method: 'GET',
			headers: authHeaders,
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.data.company.id).toBe(company.id);

		// Cleanup
		await cleanupCompany(company.id);
	});

	it('should update company', async () => {
		const company = await createTestCompany();
		const updatedName = `Updated Company ${Date.now()}`;

		const response = await fetch(`${API_URL}/api/v1/companies/${company.id}`, {
			method: 'PUT',
			headers: {
				...authHeaders,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				name: updatedName,
			}),
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.data.company.name).toBe(updatedName);

		// Cleanup
		await cleanupCompany(company.id);
	});

	it('should delete company', async () => {
		const company = await createTestCompany();

		const response = await fetch(`${API_URL}/api/v1/companies/${company.id}`, {
			method: 'DELETE',
			headers: authHeaders,
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.success).toBe(true);

		// Verify company is deleted
		const getResponse = await fetch(`${API_URL}/api/v1/companies/${company.id}`, {
			method: 'GET',
			headers: authHeaders,
		});
		expect(getResponse.status).toBe(404);
	});
});

