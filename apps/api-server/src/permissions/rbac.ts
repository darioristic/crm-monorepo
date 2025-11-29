import type { UserRole } from "@crm/types";
import { errorResponse } from "@crm/utils";
import type { AuthContext } from "../middleware/auth";

// ============================================
// Permission Types
// ============================================

export type Resource =
	| "users"
	| "companies"
	| "projects"
	| "tasks"
	| "milestones"
	| "quotes"
	| "invoices"
	| "delivery_notes"
	| "leads"
	| "contacts"
	| "deals"
	| "reports"
	| "settings"
	| "api_keys";

export type Action =
	| "create"
	| "read"
	| "update"
	| "delete"
	| "list"
	| "export";

// ============================================
// Permission Rules
// ============================================

interface PermissionRule {
	action: Action;
	resource: Resource;
	condition?: (auth: AuthContext, resourceId?: string, data?: unknown) => boolean | Promise<boolean>;
}

// Admin has full access - no conditions needed
const ADMIN_PERMISSIONS: PermissionRule[] = [
	{ action: "create", resource: "users" },
	{ action: "read", resource: "users" },
	{ action: "update", resource: "users" },
	{ action: "delete", resource: "users" },
	{ action: "list", resource: "users" },
	{ action: "create", resource: "companies" },
	{ action: "read", resource: "companies" },
	{ action: "update", resource: "companies" },
	{ action: "delete", resource: "companies" },
	{ action: "list", resource: "companies" },
	{ action: "create", resource: "projects" },
	{ action: "read", resource: "projects" },
	{ action: "update", resource: "projects" },
	{ action: "delete", resource: "projects" },
	{ action: "list", resource: "projects" },
	{ action: "create", resource: "tasks" },
	{ action: "read", resource: "tasks" },
	{ action: "update", resource: "tasks" },
	{ action: "delete", resource: "tasks" },
	{ action: "list", resource: "tasks" },
	{ action: "create", resource: "milestones" },
	{ action: "read", resource: "milestones" },
	{ action: "update", resource: "milestones" },
	{ action: "delete", resource: "milestones" },
	{ action: "list", resource: "milestones" },
	{ action: "create", resource: "quotes" },
	{ action: "read", resource: "quotes" },
	{ action: "update", resource: "quotes" },
	{ action: "delete", resource: "quotes" },
	{ action: "list", resource: "quotes" },
	{ action: "create", resource: "invoices" },
	{ action: "read", resource: "invoices" },
	{ action: "update", resource: "invoices" },
	{ action: "delete", resource: "invoices" },
	{ action: "list", resource: "invoices" },
	{ action: "create", resource: "delivery_notes" },
	{ action: "read", resource: "delivery_notes" },
	{ action: "update", resource: "delivery_notes" },
	{ action: "delete", resource: "delivery_notes" },
	{ action: "list", resource: "delivery_notes" },
	{ action: "create", resource: "leads" },
	{ action: "read", resource: "leads" },
	{ action: "update", resource: "leads" },
	{ action: "delete", resource: "leads" },
	{ action: "list", resource: "leads" },
	{ action: "create", resource: "contacts" },
	{ action: "read", resource: "contacts" },
	{ action: "update", resource: "contacts" },
	{ action: "delete", resource: "contacts" },
	{ action: "list", resource: "contacts" },
	{ action: "create", resource: "deals" },
	{ action: "read", resource: "deals" },
	{ action: "update", resource: "deals" },
	{ action: "delete", resource: "deals" },
	{ action: "list", resource: "deals" },
	{ action: "read", resource: "reports" },
	{ action: "list", resource: "reports" },
	{ action: "export", resource: "reports" },
	{ action: "read", resource: "settings" },
	{ action: "update", resource: "settings" },
	{ action: "create", resource: "api_keys" },
	{ action: "read", resource: "api_keys" },
	{ action: "delete", resource: "api_keys" },
	{ action: "list", resource: "api_keys" },
];

// User has limited access with conditions
const USER_PERMISSIONS: PermissionRule[] = [
	// Users - can only read themselves
	{ action: "read", resource: "users", condition: (auth, resourceId) => auth.userId === resourceId },
	{ action: "update", resource: "users", condition: (auth, resourceId) => auth.userId === resourceId },
	
	// Companies - can only read their own company
	{ action: "read", resource: "companies", condition: (auth, resourceId) => auth.companyId === resourceId },
	{ action: "list", resource: "companies", condition: (auth) => !!auth.companyId },
	
	// Projects - can access if they're a team member or manager
	{ action: "read", resource: "projects" },
	{ action: "list", resource: "projects" },
	{ action: "update", resource: "projects" }, // Will be filtered by ownership check
	
	// Tasks - can access if assigned to them
	{ action: "create", resource: "tasks" },
	{ action: "read", resource: "tasks" },
	{ action: "update", resource: "tasks" },
	{ action: "list", resource: "tasks" },
	
	// Milestones - read access
	{ action: "read", resource: "milestones" },
	{ action: "list", resource: "milestones" },
	
	// Quotes - can create and read, update own quotes
	{ action: "create", resource: "quotes" },
	{ action: "read", resource: "quotes" },
	{ action: "update", resource: "quotes" }, // Will check createdBy
	{ action: "list", resource: "quotes" },
	
	// Invoices - limited access, cannot modify invoice number
	{ action: "read", resource: "invoices" },
	{ action: "list", resource: "invoices" },
	
	// Delivery notes - read and create
	{ action: "create", resource: "delivery_notes" },
	{ action: "read", resource: "delivery_notes" },
	{ action: "list", resource: "delivery_notes" },
	
	// Leads - can manage assigned leads
	{ action: "read", resource: "leads" },
	{ action: "update", resource: "leads" },
	{ action: "list", resource: "leads" },
	
	// Contacts - read access
	{ action: "read", resource: "contacts" },
	{ action: "list", resource: "contacts" },
	
	// Deals - can manage assigned deals
	{ action: "read", resource: "deals" },
	{ action: "update", resource: "deals" },
	{ action: "list", resource: "deals" },
	
	// Reports - limited access
	{ action: "read", resource: "reports" },
	{ action: "list", resource: "reports" },
];

// Permission map by role
const ROLE_PERMISSIONS: Record<UserRole, PermissionRule[]> = {
	admin: ADMIN_PERMISSIONS,
	user: USER_PERMISSIONS,
};

// ============================================
// Permission Check Functions
// ============================================

/**
 * Check if user has permission for an action on a resource
 */
export async function hasPermission(
	auth: AuthContext,
	action: Action,
	resource: Resource,
	resourceId?: string,
	data?: unknown,
): Promise<boolean> {
	const permissions = ROLE_PERMISSIONS[auth.role] || [];

	const matchingPermission = permissions.find(
		(p) => p.action === action && p.resource === resource,
	);

	if (!matchingPermission) {
		return false;
	}

	// If no condition, permission is granted
	if (!matchingPermission.condition) {
		return true;
	}

	// Check condition
	return matchingPermission.condition(auth, resourceId, data);
}

/**
 * Check permission and return 403 response if denied
 */
export async function checkPermission(
	auth: AuthContext,
	action: Action,
	resource: Resource,
	resourceId?: string,
	data?: unknown,
): Promise<Response | null> {
	const allowed = await hasPermission(auth, action, resource, resourceId, data);

	if (!allowed) {
		return forbiddenResponse(action, resource);
	}

	return null;
}

/**
 * Require permission - throws/returns if denied
 */
export function requirePermission(
	action: Action,
	resource: Resource,
) {
	return async (
		auth: AuthContext,
		resourceId?: string,
		data?: unknown,
	): Promise<Response | null> => {
		return checkPermission(auth, action, resource, resourceId, data);
	};
}

// ============================================
// Specific Permission Checks
// ============================================

/**
 * Check if user can delete (admin only for users/companies)
 */
export function canDelete(auth: AuthContext, resource: Resource): boolean {
	if (auth.role === "admin") return true;
	
	// Users cannot delete users or companies
	if (resource === "users" || resource === "companies") {
		return false;
	}
	
	return true;
}

/**
 * Check if user can modify invoice number (admin only)
 */
export function canModifyInvoiceNumber(auth: AuthContext): boolean {
	return auth.role === "admin";
}

/**
 * Check if user can access project
 * User can access if they're manager or team member
 */
export async function canAccessProject(
	auth: AuthContext,
	project: { managerId: string; teamMembers?: string[] },
): Promise<boolean> {
	if (auth.role === "admin") return true;
	
	if (project.managerId === auth.userId) return true;
	
	if (project.teamMembers?.includes(auth.userId)) return true;
	
	return false;
}

/**
 * Check if user can access task
 * User can access if assigned to them or they can access the parent project
 */
export function canAccessTask(
	auth: AuthContext,
	task: { assignedTo?: string },
): boolean {
	if (auth.role === "admin") return true;
	
	if (task.assignedTo === auth.userId) return true;
	
	return false;
}

/**
 * Filter data based on user permissions
 */
export function filterByOwnership<T extends { assignedTo?: string }>(
	auth: AuthContext,
	items: T[],
): T[] {
	if (auth.role === "admin") return items;
	
	return items.filter((item) => item.assignedTo === auth.userId);
}

/**
 * Filter projects by access
 */
export function filterProjectsByAccess<T extends { managerId: string; teamMembers?: string[] }>(
	auth: AuthContext,
	projects: T[],
): T[] {
	if (auth.role === "admin") return projects;
	
	return projects.filter(
		(p) => p.managerId === auth.userId || p.teamMembers?.includes(auth.userId),
	);
}

// ============================================
// Response Helpers
// ============================================

function forbiddenResponse(action: Action, resource: Resource): Response {
	return new Response(
		JSON.stringify(
			errorResponse(
				"FORBIDDEN",
				`You don't have permission to ${action} ${resource}`,
			),
		),
		{
			status: 403,
			headers: { "Content-Type": "application/json" },
		},
	);
}

// ============================================
// Permission List (for UI)
// ============================================

export function getPermissionsForRole(role: UserRole): { action: Action; resource: Resource }[] {
	return ROLE_PERMISSIONS[role].map((p) => ({
		action: p.action,
		resource: p.resource,
	}));
}

