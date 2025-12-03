export class Activity {
	constructor(
		public readonly id: string,
		public readonly tenantId: string,
		public readonly companyId: string,
		public readonly type: string,
		public readonly title: string,
		public readonly description: string | null,
		public readonly userId: string,
		public readonly entityType: string,
		public readonly entityId: string,
		public readonly metadata: string | null,
		public readonly createdAt: Date,
		public readonly updatedAt: Date,
	) {}

	static create(
		tenantId: string,
		companyId: string,
		type: string,
		title: string,
		userId: string,
		entityType: string,
		entityId: string,
		description?: string,
		metadata?: string,
	): Activity {
		const now = new Date();
		return new Activity(
			crypto.randomUUID(),
			tenantId,
			companyId,
			type,
			title,
			description || null,
			userId,
			entityType,
			entityId,
			metadata || null,
			now,
			now,
		);
	}

	belongsToTenant(tenantId: string): boolean {
		return this.tenantId === tenantId;
	}

	belongsToCompany(companyId: string): boolean {
		return this.companyId === companyId;
	}

	belongsToTenantAndCompany(tenantId: string, companyId: string): boolean {
		return this.tenantId === tenantId && this.companyId === companyId;
	}
}

