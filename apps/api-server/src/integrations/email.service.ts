import type { DeliveryNote, Invoice, Quote, User } from "@crm/types";
import { logger } from "../lib/logger";

// ============================================
// Email Configuration
// ============================================

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

const emailConfig: EmailConfig = {
  host: process.env.SMTP_HOST || "smtp.example.com",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
  from: process.env.SMTP_FROM || "noreply@crm.local",
};

// ============================================
// Email Templates
// ============================================

type TemplateType =
  | "invoice_created"
  | "invoice_sent"
  | "invoice_paid"
  | "invoice_overdue"
  | "quote_created"
  | "quote_sent"
  | "quote_accepted"
  | "quote_rejected"
  | "delivery_shipped"
  | "delivery_delivered"
  | "welcome"
  | "password_reset"
  | "notification";

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

const templates: Record<TemplateType, (data: Record<string, unknown>) => EmailTemplate> = {
  invoice_created: (data) => ({
    subject: `Invoice ${data.invoiceNumber} Created`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Invoice Created</h1>
        <p>A new invoice has been created:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Invoice Number:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.invoiceNumber}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Company:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.companyName}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Total:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">$${data.total}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Due Date:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.dueDate}</td></tr>
        </table>
        <p>Please review and process accordingly.</p>
      </div>
    `,
    text: `Invoice ${data.invoiceNumber} created for ${data.companyName}. Total: $${data.total}. Due: ${data.dueDate}`,
  }),

  invoice_sent: (data) => ({
    subject: `Invoice ${data.invoiceNumber} - Payment Due`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Invoice</h1>
        <p>Dear ${data.contactName || "Customer"},</p>
        <p>Please find attached invoice ${data.invoiceNumber}.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Invoice Number:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.invoiceNumber}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Total Amount:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">$${data.total}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Due Date:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.dueDate}</td></tr>
        </table>
        <p>Thank you for your business.</p>
      </div>
    `,
    text: `Invoice ${data.invoiceNumber}. Amount: $${data.total}. Due: ${data.dueDate}. Thank you for your business.`,
  }),

  invoice_paid: (data) => ({
    subject: `Payment Received - Invoice ${data.invoiceNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #28a745;">Payment Received</h1>
        <p>Thank you! We have received your payment for invoice ${data.invoiceNumber}.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Invoice Number:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.invoiceNumber}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Amount Paid:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">$${data.paidAmount}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Payment Date:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.paymentDate}</td></tr>
        </table>
      </div>
    `,
    text: `Payment received for invoice ${data.invoiceNumber}. Amount: $${data.paidAmount}. Date: ${data.paymentDate}`,
  }),

  invoice_overdue: (data) => ({
    subject: `OVERDUE: Invoice ${data.invoiceNumber} - Payment Required`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #dc3545;">Payment Overdue</h1>
        <p>Dear ${data.contactName || "Customer"},</p>
        <p>This is a reminder that invoice ${data.invoiceNumber} is now overdue.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Invoice Number:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.invoiceNumber}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Outstanding Amount:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">$${data.outstandingAmount}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Days Overdue:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.daysOverdue}</td></tr>
        </table>
        <p>Please arrange payment as soon as possible.</p>
      </div>
    `,
    text: `OVERDUE: Invoice ${data.invoiceNumber}. Outstanding: $${data.outstandingAmount}. ${data.daysOverdue} days overdue.`,
  }),

  quote_created: (data) => ({
    subject: `Quote ${data.quoteNumber} Created`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Quote Created</h1>
        <p>A new quote has been created:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Quote Number:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.quoteNumber}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Company:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.companyName}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Total:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">$${data.total}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Valid Until:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.validUntil}</td></tr>
        </table>
      </div>
    `,
    text: `Quote ${data.quoteNumber} created for ${data.companyName}. Total: $${data.total}. Valid until: ${data.validUntil}`,
  }),

  quote_sent: (data) => ({
    subject: `Quote ${data.quoteNumber} from CRM`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Quote</h1>
        <p>Dear ${data.contactName || "Customer"},</p>
        <p>Thank you for your interest. Please find our quote below:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Quote Number:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.quoteNumber}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Total:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">$${data.total}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Valid Until:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.validUntil}</td></tr>
        </table>
        <p>Please contact us if you have any questions.</p>
      </div>
    `,
    text: `Quote ${data.quoteNumber}. Total: $${data.total}. Valid until: ${data.validUntil}`,
  }),

  quote_accepted: (data) => ({
    subject: `Quote ${data.quoteNumber} Accepted!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #28a745;">Quote Accepted</h1>
        <p>Great news! Quote ${data.quoteNumber} has been accepted by ${data.companyName}.</p>
        <p><strong>Value:</strong> $${data.total}</p>
        <p>Next steps: Create an invoice and proceed with the order.</p>
      </div>
    `,
    text: `Quote ${data.quoteNumber} accepted by ${data.companyName}. Value: $${data.total}`,
  }),

  quote_rejected: (data) => ({
    subject: `Quote ${data.quoteNumber} Rejected`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #dc3545;">Quote Rejected</h1>
        <p>Quote ${data.quoteNumber} has been rejected by ${data.companyName}.</p>
        <p><strong>Value:</strong> $${data.total}</p>
        ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ""}
      </div>
    `,
    text: `Quote ${data.quoteNumber} rejected by ${data.companyName}. Value: $${data.total}`,
  }),

  delivery_shipped: (data) => ({
    subject: `Shipment ${data.deliveryNumber} - Your Order is on the Way`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Order Shipped</h1>
        <p>Dear ${data.contactName || "Customer"},</p>
        <p>Your order has been shipped!</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Delivery Number:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.deliveryNumber}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Carrier:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.carrier || "N/A"}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Tracking:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.trackingNumber || "N/A"}</td></tr>
        </table>
      </div>
    `,
    text: `Shipment ${data.deliveryNumber} is on the way. Carrier: ${data.carrier || "N/A"}. Tracking: ${data.trackingNumber || "N/A"}`,
  }),

  delivery_delivered: (data) => ({
    subject: `Delivery ${data.deliveryNumber} - Order Delivered`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #28a745;">Order Delivered</h1>
        <p>Dear ${data.contactName || "Customer"},</p>
        <p>Your order has been delivered!</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Delivery Number:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.deliveryNumber}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Delivered:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.deliveryDate}</td></tr>
        </table>
        <p>Thank you for your business!</p>
      </div>
    `,
    text: `Order ${data.deliveryNumber} delivered on ${data.deliveryDate}. Thank you!`,
  }),

  welcome: (data) => ({
    subject: "Welcome to CRM!",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Welcome!</h1>
        <p>Dear ${data.firstName},</p>
        <p>Your account has been created. Here are your details:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Email:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.email}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Role:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.role}</td></tr>
        </table>
        <p>Get started by logging in to your dashboard.</p>
      </div>
    `,
    text: `Welcome ${data.firstName}! Your CRM account has been created. Email: ${data.email}`,
  }),

  password_reset: (data) => ({
    subject: "Password Reset Request",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Password Reset</h1>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <p><a href="${data.resetLink}" style="display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 4px;">Reset Password</a></p>
        <p>This link expires in ${data.expiresIn || "24 hours"}.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `,
    text: `Password reset requested. Click here to reset: ${data.resetLink}. Expires in ${data.expiresIn || "24 hours"}.`,
  }),

  notification: (data) => ({
    subject: (data.subject as string) || "CRM Notification",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">${data.title || "Notification"}</h1>
        <p>${data.message}</p>
        ${data.actionUrl ? `<p><a href="${data.actionUrl}" style="display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 4px;">${data.actionText || "View Details"}</a></p>` : ""}
      </div>
    `,
    text: `${data.title || "Notification"}: ${data.message}`,
  }),
};

// ============================================
// Email Service
// ============================================

interface SendEmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

class EmailService {
  private config: EmailConfig;
  private enabled: boolean;

  constructor() {
    this.config = emailConfig;
    this.enabled = !!this.config.auth.user && !!this.config.auth.pass;

    if (!this.enabled) {
      logger.info("📧 Email service disabled (no SMTP credentials configured)");
    }
  }

  // Send raw email
  async send(
    options: SendEmailOptions,
    subject: string,
    html: string,
    text?: string
  ): Promise<EmailResult> {
    if (!this.enabled) {
      logger.info(`📧 [DEV] Would send email to ${options.to}: ${subject}`);
      return { success: true, messageId: `dev-${Date.now()}` };
    }

    try {
      // In production, use nodemailer or similar
      // For now, log and simulate
      logger.info(`📧 Sending email to ${options.to}: ${subject}`);

      // Simulate email sending (replace with actual SMTP implementation)
      const response = await this.sendViaSMTP({
        from: this.config.from,
        to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
        cc: options.cc
          ? Array.isArray(options.cc)
            ? options.cc.join(", ")
            : options.cc
          : undefined,
        bcc: options.bcc
          ? Array.isArray(options.bcc)
            ? options.bcc.join(", ")
            : options.bcc
          : undefined,
        replyTo: options.replyTo,
        subject,
        html,
        text: text || this.htmlToText(html),
        attachments: options.attachments,
      });

      return response;
    } catch (error) {
      logger.error("Email send error:", error);
      return { success: false, error: String(error) };
    }
  }

  // Send templated email
  async sendTemplate(
    template: TemplateType,
    data: Record<string, unknown>,
    options: SendEmailOptions
  ): Promise<EmailResult> {
    const templateFn = templates[template];
    if (!templateFn) {
      return { success: false, error: `Template '${template}' not found` };
    }

    const { subject, html, text } = templateFn(data);
    return this.send(options, subject, html, text);
  }

  // Convenience methods for specific email types
  async sendInvoiceEmail(
    invoice: Invoice,
    companyName: string,
    toEmail: string,
    type: "created" | "sent" | "paid" | "overdue" = "sent"
  ): Promise<EmailResult> {
    const templateMap = {
      created: "invoice_created" as const,
      sent: "invoice_sent" as const,
      paid: "invoice_paid" as const,
      overdue: "invoice_overdue" as const,
    };

    return this.sendTemplate(
      templateMap[type],
      {
        invoiceNumber: invoice.invoiceNumber,
        companyName,
        total: invoice.total.toFixed(2),
        dueDate: new Date(invoice.dueDate).toLocaleDateString(),
        paidAmount: invoice.paidAmount.toFixed(2),
        outstandingAmount: (invoice.total - invoice.paidAmount).toFixed(2),
        paymentDate: new Date().toLocaleDateString(),
        daysOverdue: Math.floor(
          (Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)
        ),
      },
      { to: toEmail }
    );
  }

  async sendQuoteEmail(
    quote: Quote,
    companyName: string,
    toEmail: string,
    type: "created" | "sent" | "accepted" | "rejected" = "sent"
  ): Promise<EmailResult> {
    const templateMap = {
      created: "quote_created" as const,
      sent: "quote_sent" as const,
      accepted: "quote_accepted" as const,
      rejected: "quote_rejected" as const,
    };

    return this.sendTemplate(
      templateMap[type],
      {
        quoteNumber: quote.quoteNumber,
        companyName,
        total: quote.total.toFixed(2),
        validUntil: new Date(quote.validUntil).toLocaleDateString(),
      },
      { to: toEmail }
    );
  }

  async sendDeliveryEmail(
    delivery: DeliveryNote,
    companyName: string,
    toEmail: string,
    type: "shipped" | "delivered" = "shipped"
  ): Promise<EmailResult> {
    const templateMap = {
      shipped: "delivery_shipped" as const,
      delivered: "delivery_delivered" as const,
    };

    return this.sendTemplate(
      templateMap[type],
      {
        deliveryNumber: delivery.deliveryNumber,
        companyName,
        carrier: delivery.carrier,
        trackingNumber: delivery.trackingNumber,
        deliveryDate: delivery.deliveryDate
          ? new Date(delivery.deliveryDate).toLocaleDateString()
          : "N/A",
      },
      { to: toEmail }
    );
  }

  async sendWelcomeEmail(user: User): Promise<EmailResult> {
    return this.sendTemplate(
      "welcome",
      {
        firstName: user.firstName,
        email: user.email,
        role: user.role,
      },
      { to: user.email }
    );
  }

  async sendPasswordResetEmail(email: string, resetLink: string): Promise<EmailResult> {
    return this.sendTemplate(
      "password_reset",
      {
        resetLink,
        expiresIn: "24 hours",
      },
      { to: email }
    );
  }

  async sendNotification(
    toEmail: string,
    title: string,
    message: string,
    actionUrl?: string,
    actionText?: string
  ): Promise<EmailResult> {
    return this.sendTemplate(
      "notification",
      {
        title,
        message,
        actionUrl,
        actionText,
      },
      { to: toEmail }
    );
  }

  // Private methods
  private async sendViaSMTP(options: {
    from: string;
    to: string;
    cc?: string;
    bcc?: string;
    replyTo?: string;
    subject: string;
    html: string;
    text: string;
    attachments?: Array<{
      filename: string;
      content: string | Buffer;
      contentType?: string;
    }>;
  }): Promise<EmailResult> {
    // This is a placeholder - in production, use nodemailer
    // For development, we just log
    logger.info("📧 SMTP Send:", {
      from: options.from,
      to: options.to,
      subject: options.subject,
    });

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      success: true,
      messageId: `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    };
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Check if email service is configured
  isEnabled(): boolean {
    return this.enabled;
  }
}

export const emailService = new EmailService();
export default emailService;
