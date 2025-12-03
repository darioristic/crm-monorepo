export interface CompanyContext {
	companyId: string;
	tenantId: string;
}

export interface CompanyContextRequest extends Request {
	companyContext?: CompanyContext;
	tenantContext?: { tenantId: string; tenantStatus: string };
}

