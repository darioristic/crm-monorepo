import { sql as db } from "../client";

// ============================================
// Auth Credentials Queries
// ============================================

export interface AuthCredential {
  id: string;
  userId: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
}

export const authQueries = {
  // ============================================
  // Credentials Management
  // ============================================

  async findCredentialsByUserId(userId: string): Promise<AuthCredential | null> {
    const result = await db`
      SELECT * FROM auth_credentials 
      WHERE user_id = ${userId}
    `;
    return result.length > 0 ? mapAuthCredential(result[0]) : null;
  },

  async createCredentials(userId: string, passwordHash: string): Promise<AuthCredential> {
    const result = await db`
      INSERT INTO auth_credentials (user_id, password_hash)
      VALUES (${userId}, ${passwordHash})
      RETURNING *
    `;
    return mapAuthCredential(result[0]);
  },

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await db`
      UPDATE auth_credentials 
      SET password_hash = ${passwordHash}, updated_at = NOW()
      WHERE user_id = ${userId}
    `;
  },

  async deleteCredentials(userId: string): Promise<void> {
    await db`DELETE FROM auth_credentials WHERE user_id = ${userId}`;
  },

  async credentialsExist(userId: string): Promise<boolean> {
    const result = await db`
      SELECT COUNT(*) FROM auth_credentials WHERE user_id = ${userId}
    `;
    return Number.parseInt(result[0].count as string, 10) > 0;
  },

  // ============================================
  // Refresh Token Management
  // ============================================

  async createRefreshToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date
  ): Promise<RefreshToken> {
    const expiresAtStr = expiresAt.toISOString();
    const result = await db`
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES (${userId}, ${tokenHash}, ${expiresAtStr})
      RETURNING *
    `;
    return mapRefreshToken(result[0]);
  },

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | null> {
    const result = await db`
      SELECT * FROM refresh_tokens 
      WHERE token_hash = ${tokenHash} 
        AND revoked_at IS NULL
        AND expires_at > NOW()
    `;
    return result.length > 0 ? mapRefreshToken(result[0]) : null;
  },

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await db`
      UPDATE refresh_tokens 
      SET revoked_at = NOW()
      WHERE token_hash = ${tokenHash}
    `;
  },

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await db`
      UPDATE refresh_tokens 
      SET revoked_at = NOW()
      WHERE user_id = ${userId} AND revoked_at IS NULL
    `;
  },

  async cleanupExpiredTokens(): Promise<number> {
    const result = await db`
      DELETE FROM refresh_tokens 
      WHERE expires_at < NOW() OR revoked_at IS NOT NULL
      RETURNING id
    `;
    return result.length;
  },

  async countActiveTokensForUser(userId: string): Promise<number> {
    const result = await db`
      SELECT COUNT(*) FROM refresh_tokens 
      WHERE user_id = ${userId} 
        AND revoked_at IS NULL 
        AND expires_at > NOW()
    `;
    return Number.parseInt(result[0].count as string, 10);
  },
};

// ============================================
// Mapping Functions
// ============================================

function toISOString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  return new Date().toISOString();
}

function mapAuthCredential(row: Record<string, unknown>): AuthCredential {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    passwordHash: row.password_hash as string,
    createdAt: toISOString(row.created_at),
    updatedAt: toISOString(row.updated_at),
  };
}

function mapRefreshToken(row: Record<string, unknown>): RefreshToken {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    tokenHash: row.token_hash as string,
    expiresAt: toISOString(row.expires_at),
    createdAt: toISOString(row.created_at),
    revokedAt: row.revoked_at ? toISOString(row.revoked_at) : null,
  };
}

export default authQueries;
