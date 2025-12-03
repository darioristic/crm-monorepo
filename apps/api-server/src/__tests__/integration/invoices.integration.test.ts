import { describe, it, expect, beforeAll } from 'vitest';
import { sql } from '../../db/client';
import {
	createTestUser,
	createTestCompany,
	createTestSession,
	getAuthHeaders,
} from './helpers';

const API_URL = process.env.API_URL || 'http://localhost:3001';

describe('Invoices API Integration Tests', () => {
	let testUser: { email: string; password: string; id?: string };
	let testCompany: { id: string; name: string };
	let authHeaders: Record<string, string>;
	let sessionToken: string;

	beforeAll(async () => {
		testUser = await createTestUser();
		testCompany = await createTestCompany();
		sessionToken = await createTestSession(testUser.id!);
		authHeaders = await getAuthHeaders(sessionToken);
	});

	it('should list invoices', async () => {
		const response = await fetch(`${API_URL}/api/v1/invoices`, {
			method: 'GET',
			headers: authHeaders,
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(Array.isArray(data.data)).toBe(true);
	});

	it('should create a new invoice', async () => {
		const invoiceData = {
			companyId: testCompany.id,
			customerId: testUser.id,
			amount: 1000.0,
			currency: 'USD',
			status: 'draft',
			dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
		};

		const response = await fetch(`${API_URL}/api/v1/invoices`, {
			method: 'POST',
			headers: {
				...authHeaders,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(invoiceData),
		});

		expect(response.status).toBe(201);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.data.invoice).toHaveProperty('id');
		expect(data.data.invoice.amount).toBe(invoiceData.amount);

		// Cleanup
		if (data.data.invoice.id) {
			await sql`DELETE FROM invoices WHERE id = ${data.data.invoice.id}`;
		}
	});

	it('should get invoice by ID', async () => {
		// Create an invoice first
		const createResponse = await fetch(`${API_URL}/api/v1/invoices`, {
			method: 'POST',
			headers: {
				...authHeaders,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				companyId: testCompany.id,
				customerId: testUser.id,
				amount: 500.0,
				currency: 'USD',
				status: 'draft',
			}),
		});

		const createData = await createResponse.json();
		const invoiceId = createData.data.invoice.id;

		// Get the invoice
		const response = await fetch(`${API_URL}/api/v1/invoices/${invoiceId}`, {
			method: 'GET',
			headers: authHeaders,
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.data.invoice.id).toBe(invoiceId);

		// Cleanup
		await sql`DELETE FROM invoices WHERE id = ${invoiceId}`;
	});

	it('should update invoice', async () => {
		// Create an invoice first
		const createResponse = await fetch(`${API_URL}/api/v1/invoices`, {
			method: 'POST',
			headers: {
				...authHeaders,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				companyId: testCompany.id,
				customerId: testUser.id,
				amount: 750.0,
				currency: 'USD',
				status: 'draft',
			}),
		});

		const createData = await createResponse.json();
		const invoiceId = createData.data.invoice.id;

		// Update the invoice
		const response = await fetch(`${API_URL}/api/v1/invoices/${invoiceId}`, {
			method: 'PUT',
			headers: {
				...authHeaders,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				amount: 1500.0,
				status: 'sent',
			}),
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.data.invoice.amount).toBe(1500.0);
		expect(data.data.invoice.status).toBe('sent');

		// Cleanup
		await sql`DELETE FROM invoices WHERE id = ${invoiceId}`;
	});

	it('should get overdue invoices', async () => {
		const response = await fetch(`${API_URL}/api/v1/invoices/overdue`, {
			method: 'GET',
			headers: authHeaders,
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(Array.isArray(data.data)).toBe(true);
	});
});

