export interface TenantContext {
  tenantId: string;
  tenantStatus: "active" | "suspended" | "deleted";
}

export interface TenantContextRequest extends Request {
  tenantContext?: TenantContext;
}
