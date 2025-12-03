export type TenantStatus = "active" | "suspended" | "deleted";

export interface TenantMetadata {
	[key: string]: unknown;
}

export class Tenant {
	constructor(
		public readonly id: string,
		public readonly name: string,
		public readonly slug: string,
		public readonly status: TenantStatus,
		public readonly metadata: TenantMetadata | null,
		public readonly createdAt: Date,
		public readonly updatedAt: Date,
		public readonly deletedAt: Date | null,
	) {}

	static create(
		name: string,
		slug: string,
		metadata?: TenantMetadata,
	): Tenant {
		const now = new Date();
		return new Tenant(
			crypto.randomUUID(),
			name,
			slug,
			"active",
			metadata || null,
			now,
			now,
			null,
		);
	}

	isActive(): boolean {
		return this.status === "active" && this.deletedAt === null;
	}

	isSuspended(): boolean {
		return this.status === "suspended";
	}

	isDeleted(): boolean {
		return this.status === "deleted" || this.deletedAt !== null;
	}

	suspend(): Tenant {
		return new Tenant(
			this.id,
			this.name,
			this.slug,
			"suspended",
			this.metadata,
			this.createdAt,
			new Date(),
			this.deletedAt,
		);
	}

	reactivate(): Tenant {
		return new Tenant(
			this.id,
			this.name,
			this.slug,
			"active",
			this.metadata,
			this.createdAt,
			new Date(),
			this.deletedAt,
		);
	}

	delete(): Tenant {
		return new Tenant(
			this.id,
			this.name,
			this.slug,
			"deleted",
			this.metadata,
			this.createdAt,
			new Date(),
			new Date(),
		);
	}
}

