export interface ProvisioningRequest {
	name: string;
	slug: string;
	adminEmail: string;
	adminPassword: string;
	adminFirstName: string;
	adminLastName: string;
	metadata?: Record<string, unknown>;
}

export interface ProvisioningStatus {
	tenantId: string;
	status: "pending" | "in_progress" | "completed" | "failed";
	step: string;
	error?: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface ProvisioningResult {
	tenantId: string;
	locationId: string;
	adminUserId: string;
	status: "completed";
	apiKey?: string;
}

