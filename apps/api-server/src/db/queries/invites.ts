import { sql as db } from "../client";
import { generateUUID } from "@crm/utils";

export type TeamInvite = {
	id: string;
	email: string;
	companyId: string;
	role: "owner" | "member" | "admin";
	status: "pending" | "accepted" | "rejected" | "expired" | "cancelled";
	invitedBy: string;
	token: string;
	expiresAt: string;
	acceptedAt: string | null;
	createdAt: string;
	updatedAt: string;
};

export type CreateInviteParams = {
	email: string;
	companyId: string;
	role: "owner" | "member" | "admin";
	invitedBy: string;
	expiresInDays?: number;
};

function mapInvite(row: Record<string, unknown>): TeamInvite {
	return {
		id: row.id as string,
		email: row.email as string,
		companyId: row.company_id as string,
		role: row.role as "owner" | "member" | "admin",
		status: row.status as "pending" | "accepted" | "rejected" | "expired" | "cancelled",
		invitedBy: row.invited_by as string,
		token: row.token as string,
		expiresAt: row.expires_at as string,
		acceptedAt: row.accepted_at as string | null,
		createdAt: row.created_at as string,
		updatedAt: row.updated_at as string,
	};
}

export const inviteQueries = {
	async findAllByCompany(companyId: string): Promise<TeamInvite[]> {
		const result = await db`
      SELECT * FROM team_invites
      WHERE company_id = ${companyId}
      ORDER BY created_at DESC
    `;
		return result.map(mapInvite);
	},

	async findPendingByCompany(companyId: string): Promise<TeamInvite[]> {
		const result = await db`
      SELECT * FROM team_invites
      WHERE company_id = ${companyId}
        AND status = 'pending'
        AND expires_at > NOW()
      ORDER BY created_at DESC
    `;
		return result.map(mapInvite);
	},

	async findById(id: string): Promise<TeamInvite | null> {
		const result = await db`SELECT * FROM team_invites WHERE id = ${id}`;
		return result.length > 0 ? mapInvite(result[0]) : null;
	},

	async findByToken(token: string): Promise<TeamInvite | null> {
		const result = await db`SELECT * FROM team_invites WHERE token = ${token}`;
		return result.length > 0 ? mapInvite(result[0]) : null;
	},

	async findByEmailAndCompany(
		email: string,
		companyId: string,
	): Promise<TeamInvite | null> {
		const result = await db`
      SELECT * FROM team_invites
      WHERE email = ${email}
        AND company_id = ${companyId}
        AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1
    `;
		return result.length > 0 ? mapInvite(result[0]) : null;
	},

	async create(params: CreateInviteParams): Promise<TeamInvite> {
		const expiresInDays = params.expiresInDays || 7;
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + expiresInDays);
		// Generate a unique token using UUID
		const token = generateUUID().replace(/-/g, "") + generateUUID().replace(/-/g, "");

		const result = await db`
      INSERT INTO team_invites (
        email, company_id, role, invited_by, token, expires_at
      )
      VALUES (
        ${params.email},
        ${params.companyId},
        ${params.role},
        ${params.invitedBy},
        ${token},
        ${expiresAt.toISOString()}
      )
      RETURNING *
    `;

		return mapInvite(result[0]);
	},

	async updateStatus(
		id: string,
		status: "pending" | "accepted" | "rejected" | "expired" | "cancelled",
	): Promise<TeamInvite> {
		const acceptedAt =
			status === "accepted" ? new Date().toISOString() : null;
		const result = await db`
      UPDATE team_invites
      SET status = ${status},
          accepted_at = ${acceptedAt},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
		return mapInvite(result[0]);
	},

	async delete(id: string): Promise<void> {
		await db`DELETE FROM team_invites WHERE id = ${id}`;
	},

	async expireOldInvites(): Promise<number> {
		const result = await db`
      UPDATE team_invites
      SET status = 'expired',
          updated_at = NOW()
      WHERE status = 'pending'
        AND expires_at < NOW()
      RETURNING id
    `;
		return result.length;
	},
};
