import type { ApiResponse, User, UserRole } from "@crm/types";
import { errorResponse, generateUUID, now, successResponse } from "@crm/utils";
import bcrypt from "bcryptjs";
import { cache } from "../cache/redis";
import { authQueries } from "../db/queries/auth";
import { userQueries } from "../db/queries/users";
import { logger } from "../lib/logger";

// ============================================
// Configuration
// ============================================

const JWT_SECRET = process.env.JWT_SECRET;
const NODE_ENV = process.env.NODE_ENV || "development";
let EFFECTIVE_JWT_SECRET = JWT_SECRET || "";
if (!EFFECTIVE_JWT_SECRET) {
  if (NODE_ENV === "production") {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    EFFECTIVE_JWT_SECRET = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    logger.warn("JWT_SECRET not set; using ephemeral secret");
  } else {
    EFFECTIVE_JWT_SECRET = "test-jwt-secret-for-integration-tests";
  }
}

const JWT_ACCESS_EXPIRY = 15 * 60; // 15 minutes in seconds
const JWT_REFRESH_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds
const PASSWORD_SALT_ROUNDS = 12;
const _MAX_SESSIONS_PER_USER = 5;

// ============================================
// Types
// ============================================

export interface JWTPayload {
  userId: string;
  role: UserRole;
  tenantId?: string; // null for superadmin, required for tenant_admin and crm_user
  companyId?: string; // optional for crm_user, null for others
  sessionId: string;
  iat: number;
  exp: number;
}

export interface SessionData {
  userId: string;
  userRole: UserRole;
  tenantId?: string;
  companyId?: string;
  email: string;
  createdAt: string;
  expiresAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResult {
  user: Omit<User, "lastLoginAt"> & { lastLoginAt?: string };
  tokens: AuthTokens;
  sessionId: string;
}

// ============================================
// Password Hashing (using bcryptjs)
// ============================================

export async function hashPassword(password: string): Promise<string> {
  if (password.length === 0) {
    throw new Error("Password cannot be empty");
  }
  return await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (password.length === 0) {
    return false;
  }
  // Use Bun's native password verification (supports both bcrypt and argon2)
  return await Bun.password.verify(password, hash);
}

// ============================================
// JWT Functions (using Web Crypto API)
// ============================================

function base64UrlEncode(data: string): string {
  return btoa(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64UrlDecode(data: string): string {
  const padded = data + "=".repeat((4 - (data.length % 4)) % 4);
  return atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
}

async function createHmacSignature(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

async function verifyHmacSignature(
  data: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const expectedSignature = await createHmacSignature(data, secret);
  return signature === expectedSignature;
}

export async function generateJWT(
  userId: string,
  role: UserRole,
  companyId: string | undefined,
  sessionId: string
): Promise<string>;

export async function generateJWT(
  userId: string,
  role: UserRole,
  tenantId: string | undefined,
  companyId: string | undefined,
  sessionId: string
): Promise<string>;

export async function generateJWT(
  userId: string,
  role: UserRole,
  p3?: string,
  p4?: string,
  p5?: string
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);

  let tenantId: string | undefined;
  let companyId: string | undefined;
  let sessionId: string;

  if (p5 !== undefined) {
    tenantId = p3;
    companyId = p4;
    sessionId = p5;
  } else {
    tenantId = undefined;
    companyId = p3;
    sessionId = p4 as string;
  }

  const payload: JWTPayload = {
    userId,
    role,
    tenantId,
    companyId,
    sessionId,
    iat: now,
    exp: now + JWT_ACCESS_EXPIRY,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await createHmacSignature(
    `${encodedHeader}.${encodedPayload}`,
    EFFECTIVE_JWT_SECRET
  );

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export async function validateJWT(token: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;

    // Verify signature
    const isValid = await verifyHmacSignature(
      `${encodedHeader}.${encodedPayload}`,
      signature,
      EFFECTIVE_JWT_SECRET
    );
    if (!isValid) return null;

    // Decode payload
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as JWTPayload;

    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// ============================================
// Refresh Token Functions
// ============================================

export async function generateRefreshToken(userId: string): Promise<string> {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const token = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Hash the token before storing
  const tokenHash = await hashTokenForStorage(token);

  // Calculate expiry
  const expiresAt = new Date(Date.now() + JWT_REFRESH_EXPIRY * 1000);

  // Store in database
  await authQueries.createRefreshToken(userId, tokenHash, expiresAt);

  return token;
}

async function hashTokenForStorage(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ============================================
// Session Management
// ============================================

async function createSession(
  userId: string,
  role: UserRole,
  tenantId: string | undefined,
  companyId: string | undefined,
  email: string
): Promise<string> {
  const sessionId = generateUUID();
  const sessionData: SessionData = {
    userId,
    userRole: role,
    tenantId,
    companyId,
    email,
    createdAt: now(),
    expiresAt: new Date(Date.now() + JWT_REFRESH_EXPIRY * 1000).toISOString(),
  };

  // Store session in Redis
  try {
    await cache.setSession(
      sessionId,
      sessionData as unknown as Record<string, unknown>,
      JWT_REFRESH_EXPIRY
    );
  } catch (error) {
    logger.error({ error, sessionId, userId }, "Failed to create session in Redis");
    // Continue anyway - session ID is still valid, just not cached
    // This allows login to proceed even if Redis is down
  }

  return sessionId;
}

async function getSession(sessionId: string): Promise<SessionData | null> {
  return cache.getSession<SessionData>(sessionId);
}

async function deleteSession(sessionId: string): Promise<void> {
  await cache.deleteSession(sessionId);
}

// ============================================
// Auth Service Class
// ============================================

class AuthService {
  // ============================================
  // Login
  // ============================================

  async login(email: string, password: string): Promise<ApiResponse<LoginResult>> {
    try {
      // Find user by email
      const user = await userQueries.findByEmail(email.toLowerCase().trim());
      if (!user) {
        return errorResponse("UNAUTHORIZED", "Invalid email or password");
      }

      // Check if user is active
      if (user.status !== "active") {
        return errorResponse("UNAUTHORIZED", "Account is not active");
      }

      // Get credentials
      const credentials = await authQueries.findCredentialsByUserId(user.id);
      if (!credentials) {
        return errorResponse("UNAUTHORIZED", "Invalid email or password");
      }

      // Verify password
      const isValidPassword = await verifyPassword(password, credentials.passwordHash);
      if (!isValidPassword) {
        return errorResponse("UNAUTHORIZED", "Invalid email or password");
      }

      // Get tenantId from user
      let tenantId = user.tenantId;

      // If user doesn't have tenantId, try to get it from their company or assign default
      if (!tenantId && user.role !== "superadmin") {
        try {
          const { db } = await import("../db/client");
          const { companies, tenants, users: usersTable } = await import("../db/schema/index");
          const { eq } = await import("drizzle-orm");

          // Try to get tenantId from user's company
          if (user.companyId) {
            const userCompany = await db
              .select({ tenantId: companies.tenantId })
              .from(companies)
              .where(eq(companies.id, user.companyId))
              .limit(1);

            if (userCompany.length > 0 && userCompany[0].tenantId) {
              tenantId = userCompany[0].tenantId;
              // Update user with tenantId for future logins
              await db
                .update(usersTable)
                .set({ tenantId, updatedAt: new Date() })
                .where(eq(usersTable.id, user.id));
              logger.info({ userId: user.id, tenantId }, "Assigned tenantId from company");
            }
          }

          // If still no tenantId, get first available tenant
          if (!tenantId) {
            const firstTenant = await db
              .select()
              .from(tenants)
              .where(eq(tenants.status, "active"))
              .limit(1);

            if (firstTenant.length > 0) {
              tenantId = firstTenant[0].id;
              // Update user with tenantId
              await db
                .update(usersTable)
                .set({ tenantId, updatedAt: new Date() })
                .where(eq(usersTable.id, user.id));
              logger.info({ userId: user.id, tenantId }, "Assigned default tenantId");
            }
          }
        } catch (error) {
          logger.error({ error, userId: user.id }, "Failed to assign tenantId during login");
        }
      }

      // Create session
      const sessionId = await createSession(
        user.id,
        user.role,
        tenantId,
        user.companyId,
        user.email
      );

      // Generate tokens
      const accessToken = await generateJWT(
        user.id,
        user.role,
        tenantId,
        user.companyId,
        sessionId
      );
      const refreshToken = await generateRefreshToken(user.id);

      // Update last login
      await userQueries.updateLastLogin(user.id);

      return successResponse({
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
          status: user.status,
          avatarUrl: user.avatarUrl,
          phone: user.phone,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          lastLoginAt: now(),
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: JWT_ACCESS_EXPIRY,
        },
        sessionId,
      });
    } catch (error) {
      logger.error(error, "Login error");
      return errorResponse("SERVER_ERROR", "Login failed");
    }
  }

  // ============================================
  // Logout
  // ============================================

  async logout(sessionId: string, userId?: string): Promise<ApiResponse<{ success: boolean }>> {
    try {
      // Delete session from Redis
      await deleteSession(sessionId);

      // Optionally revoke all refresh tokens for user
      if (userId) {
        await authQueries.revokeAllUserRefreshTokens(userId);
      }

      return successResponse({ success: true });
    } catch (error) {
      logger.error(error, "Logout error");
      return errorResponse("SERVER_ERROR", "Logout failed");
    }
  }

  // ============================================
  // Refresh Token
  // ============================================

  async refreshTokens(
    refreshToken: string
  ): Promise<ApiResponse<AuthTokens & { sessionId: string }>> {
    try {
      // Hash the token to look it up
      const tokenHash = await hashTokenForStorage(refreshToken);

      // Find the token in database
      const storedToken = await authQueries.findRefreshTokenByHash(tokenHash);
      if (!storedToken) {
        return errorResponse("UNAUTHORIZED", "Invalid or expired refresh token");
      }

      // Get user
      const user = await userQueries.findById(storedToken.userId);
      if (!user || user.status !== "active") {
        return errorResponse("UNAUTHORIZED", "User not found or inactive");
      }

      // Revoke old refresh token
      await authQueries.revokeRefreshToken(tokenHash);

      // Get tenantId from user
      const tenantId = user.tenantId;

      // Create new session
      const sessionId = await createSession(
        user.id,
        user.role,
        tenantId,
        user.companyId,
        user.email
      );

      // Generate new tokens
      const newAccessToken = await generateJWT(
        user.id,
        user.role,
        tenantId,
        user.companyId,
        sessionId
      );
      const newRefreshToken = await generateRefreshToken(user.id);

      return successResponse({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: JWT_ACCESS_EXPIRY,
        sessionId,
      });
    } catch (error) {
      logger.error(error, "Refresh token error");
      return errorResponse("SERVER_ERROR", "Token refresh failed");
    }
  }

  // ============================================
  // Session Validation
  // ============================================

  async validateSession(sessionId: string): Promise<SessionData | null> {
    return getSession(sessionId);
  }

  // ============================================
  // Password Management
  // ============================================

  async setPassword(userId: string, password: string): Promise<ApiResponse<{ success: boolean }>> {
    try {
      if (password.length < 8) {
        return errorResponse("VALIDATION_ERROR", "Password must be at least 8 characters");
      }

      const passwordHash = await hashPassword(password);

      // Check if credentials exist
      const exists = await authQueries.credentialsExist(userId);
      if (exists) {
        await authQueries.updatePassword(userId, passwordHash);
      } else {
        await authQueries.createCredentials(userId, passwordHash);
      }

      return successResponse({ success: true });
    } catch (error) {
      logger.error(error, "Set password error");
      return errorResponse("SERVER_ERROR", "Failed to set password");
    }
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<ApiResponse<{ success: boolean }>> {
    try {
      // Get current credentials
      const credentials = await authQueries.findCredentialsByUserId(userId);
      if (!credentials) {
        return errorResponse("NOT_FOUND", "Credentials not found");
      }

      // Verify current password
      const isValid = await verifyPassword(currentPassword, credentials.passwordHash);
      if (!isValid) {
        return errorResponse("UNAUTHORIZED", "Current password is incorrect");
      }

      // Validate new password
      if (newPassword.length < 8) {
        return errorResponse("VALIDATION_ERROR", "Password must be at least 8 characters");
      }

      // Update password
      const newHash = await hashPassword(newPassword);
      await authQueries.updatePassword(userId, newHash);

      // Revoke all refresh tokens (force re-login on all devices)
      await authQueries.revokeAllUserRefreshTokens(userId);

      return successResponse({ success: true });
    } catch (error) {
      logger.error(error, "Change password error");
      return errorResponse("SERVER_ERROR", "Failed to change password");
    }
  }

  // ============================================
  // User Registration (with password)
  // ============================================

  async registerUser(userData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role?: UserRole;
    companyId?: string;
  }): Promise<ApiResponse<User>> {
    try {
      // Check if email exists
      const existing = await userQueries.findByEmail(userData.email);
      if (existing) {
        return errorResponse("CONFLICT", "Email already registered");
      }

      // Validate password
      if (userData.password.length < 8) {
        return errorResponse("VALIDATION_ERROR", "Password must be at least 8 characters");
      }

      // Create user
      const user = await userQueries.createWithId({
        id: generateUUID(),
        firstName: userData.firstName.trim(),
        lastName: userData.lastName.trim(),
        email: userData.email.toLowerCase().trim(),
        role: userData.role || "crm_user",
        companyId: userData.companyId,
        status: "active",
        createdAt: now(),
        updatedAt: now(),
      });

      // Create credentials
      const passwordHash = await hashPassword(userData.password);
      await authQueries.createCredentials(user.id, passwordHash);

      return successResponse(user);
    } catch (error) {
      logger.error(error, "Register user error");
      return errorResponse("SERVER_ERROR", "Failed to register user");
    }
  }

  // ============================================
  // Get Current User
  // ============================================

  async getCurrentUser(userId: string): Promise<ApiResponse<User>> {
    try {
      const user = await userQueries.findById(userId);
      if (!user) {
        return errorResponse("NOT_FOUND", "User not found");
      }
      return successResponse(user);
    } catch (error) {
      logger.error(error, "Get current user error");
      return errorResponse("SERVER_ERROR", "Failed to get user");
    }
  }
}

export const authService = new AuthService();
export default authService;
