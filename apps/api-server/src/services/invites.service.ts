import type { ApiResponse } from "@crm/types";
import { Errors, errorResponse, isValidEmail, successResponse } from "@crm/utils";
import { sql as db } from "../db/client";
import { companyQueries } from "../db/queries/companies";
import { inviteQueries } from "../db/queries/invites";
import { userQueries } from "../db/queries/users";
import { serviceLogger } from "../lib/logger";
import { emailService } from "./email.service";

export type CreateInviteRequest = {
  email: string;
  role: "owner" | "member" | "admin";
};

export type InviteResponse = {
  id: string;
  email: string;
  role: "owner" | "member" | "admin";
  status: "pending" | "accepted" | "rejected" | "expired" | "cancelled";
  expiresAt: string;
  createdAt: string;
};

class InvitesService {
  async getInvites(companyId: string): Promise<ApiResponse<InviteResponse[]>> {
    try {
      const invites = await inviteQueries.findPendingByCompany(companyId);
      return successResponse(
        invites.map((invite) => ({
          id: invite.id,
          email: invite.email,
          role: invite.role,
          status: invite.status,
          expiresAt: invite.expiresAt,
          createdAt: invite.createdAt,
        }))
      );
    } catch (error) {
      serviceLogger.error(error, "Error fetching invites:");
      return errorResponse("DATABASE_ERROR", "Failed to fetch invites");
    }
  }

  async createInvite(
    companyId: string,
    inviteData: CreateInviteRequest,
    invitedBy: string
  ): Promise<ApiResponse<InviteResponse>> {
    try {
      // Validate email
      if (!isValidEmail(inviteData.email)) {
        return errorResponse("VALIDATION_ERROR", "Invalid email address");
      }

      // Check if company exists
      const company = await companyQueries.findById(companyId);
      if (!company) {
        return Errors.NotFound("Company").toResponse();
      }

      // Check if user already exists
      const existingUser = await userQueries.findByEmail(inviteData.email);
      if (existingUser) {
        // Check if user is already a member of this company
        const membership = await db`
          SELECT * FROM users_on_company
          WHERE user_id = ${existingUser.id}
            AND company_id = ${companyId}
        `;
        if (membership.length > 0) {
          return errorResponse("CONFLICT", "User is already a member of this company");
        }
      }

      // Check if there's already a pending invite for this email and company
      const existingInvite = await inviteQueries.findByEmailAndCompany(inviteData.email, companyId);
      if (existingInvite) {
        return errorResponse("CONFLICT", "An invite is already pending for this email");
      }

      // Create invite
      const invite = await inviteQueries.create({
        email: inviteData.email,
        companyId,
        role: inviteData.role,
        invitedBy,
        expiresInDays: 7,
      });

      // Send invitation email
      try {
        await emailService.sendInviteEmail({
          to: inviteData.email,
          companyName: company.name,
          inviteToken: invite.token,
          role: inviteData.role,
        });
      } catch (emailError) {
        serviceLogger.error(emailError, "Failed to send invite email");
        // Don't fail the invite creation if email fails
      }

      return successResponse({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        status: invite.status,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      });
    } catch (error) {
      serviceLogger.error(error, "Error creating invite:");
      return errorResponse("DATABASE_ERROR", "Failed to create invite");
    }
  }

  async deleteInvite(inviteId: string, companyId: string): Promise<ApiResponse<void>> {
    try {
      const invite = await inviteQueries.findById(inviteId);
      if (!invite) {
        return Errors.NotFound("Invite").toResponse();
      }

      if (invite.companyId !== companyId) {
        return errorResponse("FORBIDDEN", "Invite does not belong to this company");
      }

      await inviteQueries.delete(inviteId);
      return successResponse(undefined);
    } catch (error) {
      serviceLogger.error(error, "Error deleting invite:");
      return errorResponse("DATABASE_ERROR", "Failed to delete invite");
    }
  }

  async acceptInvite(token: string, userId: string): Promise<ApiResponse<void>> {
    try {
      const invite = await inviteQueries.findByToken(token);
      if (!invite) {
        return Errors.NotFound("Invite").toResponse();
      }

      if (invite.status !== "pending") {
        return errorResponse("CONFLICT", "Invite is no longer valid");
      }

      if (new Date(invite.expiresAt) < new Date()) {
        await inviteQueries.updateStatus(invite.id, "expired");
        return errorResponse("CONFLICT", "Invite has expired");
      }

      // Get user to verify email matches
      const user = await userQueries.findById(userId);
      if (!user || user.email !== invite.email) {
        return errorResponse("FORBIDDEN", "Invite email does not match user email");
      }

      // Add user to company
      await db`
        INSERT INTO users_on_company (user_id, company_id, role)
        VALUES (${userId}, ${invite.companyId}, ${invite.role})
        ON CONFLICT (user_id, company_id) DO UPDATE
        SET role = ${invite.role}, created_at = NOW()
      `;

      // Update invite status
      await inviteQueries.updateStatus(invite.id, "accepted");

      return successResponse(undefined);
    } catch (error) {
      serviceLogger.error(error, "Error accepting invite:");
      return errorResponse("DATABASE_ERROR", "Failed to accept invite");
    }
  }
}

export const invitesService = new InvitesService();
