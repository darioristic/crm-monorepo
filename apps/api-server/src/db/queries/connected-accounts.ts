import { sql as db } from "../client";

export type ConnectedAccount = {
	id: string;
	companyId: string;
	accountType: string;
	accountName: string;
	accountNumber: string | null;
	bankName: string | null;
	iban: string | null;
	swift: string | null;
	currency: string;
	balance: number;
	isActive: boolean;
	connectedBy: string;
	connectedAt: string;
	lastSyncedAt: string | null;
	createdAt: string;
	updatedAt: string;
};

function mapConnectedAccount(row: any): ConnectedAccount {
	return {
		id: row.id,
		companyId: row.company_id,
		accountType: row.account_type,
		accountName: row.account_name,
		accountNumber: row.account_number,
		bankName: row.bank_name,
		iban: row.iban,
		swift: row.swift,
		currency: row.currency,
		balance: parseFloat(row.balance || 0),
		isActive: row.is_active,
		connectedBy: row.connected_by,
		connectedAt: row.connected_at,
		lastSyncedAt: row.last_synced_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export const connectedAccountQueries = {
	async findByCompany(companyId: string): Promise<ConnectedAccount[]> {
		const result = await db`
      SELECT * FROM connected_accounts
      WHERE company_id = ${companyId}
        AND is_active = true
      ORDER BY created_at DESC
    `;
		return result.map(mapConnectedAccount);
	},

	async findById(id: string): Promise<ConnectedAccount | null> {
		const result = await db`SELECT * FROM connected_accounts WHERE id = ${id}`;
		return result.length > 0 ? mapConnectedAccount(result[0]) : null;
	},
};

