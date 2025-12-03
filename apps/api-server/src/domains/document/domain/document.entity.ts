export interface DocumentMetadata {
	[key: string]: unknown;
}

export class Document {
	constructor(
		public readonly id: string,
		public readonly tenantId: string,
		public readonly companyId: string,
		public readonly createdBy: string,
		public readonly content: string | null,
		public readonly metadata: DocumentMetadata | null,
		public readonly createdAt: Date,
		public readonly updatedAt: Date,
	) {}

	static create(
		tenantId: string,
		companyId: string,
		createdBy: string,
		content?: string,
		metadata?: DocumentMetadata,
	): Document {
		const now = new Date();
		return new Document(
			crypto.randomUUID(),
			tenantId,
			companyId,
			createdBy,
			content || null,
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

	updateContent(content: string): Document {
		return new Document(
			this.id,
			this.tenantId,
			this.companyId,
			this.createdBy,
			content,
			this.metadata,
			this.createdAt,
			new Date(),
		);
	}
}

