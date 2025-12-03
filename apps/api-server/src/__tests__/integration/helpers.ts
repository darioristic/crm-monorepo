import { sql } from '../../db/client';
import { redis } from '../../cache/redis';
import { hashPassword } from '../../services/auth.service';
import { userQueries } from '../../db/queries/users';
import { authQueries } from '../../db/queries/auth';
import type { User, Company } from '@crm/types';

export interface TestUser {
	email: string;
	password: string;
	id?: string;
	companyId?: string;
	firstName?: string;
	lastName?: string;
}

export async function createTestUser(
	userData: Partial<TestUser> = {},
): Promise<TestUser> {
	const email = userData.email || `test-${Date.now()}@example.com`;
	const password = userData.password || 'TestPassword123!';
	const firstName = userData.firstName || 'Test';
	const lastName = userData.lastName || 'User';

	// Hash password using the actual auth service
	const hashedPassword = await hashPassword(password);

	// Create user
	const [user] = await sql`
		INSERT INTO users (first_name, last_name, email, role, company_id, created_at, updated_at)
		VALUES (${firstName}, ${lastName}, ${email}, 'user', ${userData.companyId || null}, NOW(), NOW())
		RETURNING id, email, company_id
	`;

	// Create auth credentials
	await authQueries.createCredentials(user.id, hashedPassword);

	return {
		email: user.email,
		password,
		id: user.id,
		companyId: user.company_id,
		firstName,
		lastName,
	};
}

export async function createTestCompany(
	companyData: Partial<Company> = {},
): Promise<Company> {
	const name = companyData.name || `Test Company ${Date.now()}`;
	const industry = companyData.industry || 'Technology';
	const address = companyData.address || '123 Test Street, Test City';

	const [company] = await sql`
		INSERT INTO companies (name, industry, address, created_at, updated_at)
		VALUES (${name}, ${industry}, ${address}, NOW(), NOW())
		RETURNING *
	`;

	return company as Company;
}

export async function createTestSession(userId: string): Promise<string> {
	// Create a test session token
	const sessionToken = `test-session-${Date.now()}-${Math.random()}`;
	await redis.setex(`session:${sessionToken}`, 3600, userId);
	return sessionToken;
}

export async function getAuthHeaders(
	sessionToken: string,
): Promise<Record<string, string>> {
	return {
		Authorization: `Bearer ${sessionToken}`,
		'Content-Type': 'application/json',
	};
}

export async function cleanupUser(userId: string): Promise<void> {
	// Delete auth credentials first (foreign key constraint)
	await authQueries.deleteCredentials(userId);
	// Delete user
	await sql`DELETE FROM users WHERE id = ${userId}`;
}

export async function cleanupCompany(companyId: string): Promise<void> {
	// Delete company (cascade will handle related records)
	await sql`DELETE FROM companies WHERE id = ${companyId}`;
}

