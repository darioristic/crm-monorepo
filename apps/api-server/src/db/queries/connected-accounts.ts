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

function mapConnectedAccount(row: Record<string, unknown>): ConnectedAccount {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    accountType: row.account_type as string,
    accountName: row.account_name as string,
    accountNumber: row.account_number as string | null,
    bankName: row.bank_name as string | null,
    iban: row.iban as string | null,
    swift: row.swift as string | null,
    currency: row.currency as string,
    balance: parseFloat((row.balance as string) || "0"),
    isActive: row.is_active as boolean,
    connectedBy: row.connected_by as string,
    connectedAt: row.connected_at as string,
    lastSyncedAt: row.last_synced_at as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
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
