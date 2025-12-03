/**
 * Email Service - Handles sending emails for invoices, quotes, notifications
 */

import type { ApiResponse, Invoice, Quote, DeliveryNote } from "@crm/types";
import { successResponse, errorResponse } from "@crm/utils";
import { addEmailJob } from "../jobs";
import { sql } from "../db/client";
import { logger } from "../lib/logger";

// ============================================
// Types
// ============================================

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  filename: string;
  content: string; // Base64 encoded
  contentType: string;
}

export interface SendEmailOptions {
  to: EmailRecipient | EmailRecipient[];
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

// ============================================
// Email Templates
// ============================================

function getInvoiceEmailTemplate(invoice: Invoice & { companyName?: string; contactEmail?: string }): EmailTemplate {
  const formattedTotal = new Intl.NumberFormat("sr-RS", {
    style: "currency",
    currency: "EUR",
  }).format(invoice.total);

  const formattedDueDate = new Date(invoice.dueDate).toLocaleDateString("sr-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return {
    subject: `Faktura ${invoice.invoiceNumber} - ${invoice.companyName || ""}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Faktura ${invoice.invoiceNumber}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #1a1a2e; color: #ffffff; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 30px; }
    .invoice-info { background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    .invoice-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e9ecef; }
    .invoice-row:last-child { border-bottom: none; }
    .invoice-label { color: #6c757d; font-size: 14px; }
    .invoice-value { font-weight: 600; color: #1a1a2e; }
    .total-row { background-color: #1a1a2e; color: #ffffff; padding: 15px 20px; border-radius: 8px; margin-top: 20px; }
    .total-row .invoice-value { color: #ffffff; font-size: 20px; }
    .cta-button { display: inline-block; background-color: #0066cc; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 20px; }
    .cta-button:hover { background-color: #0052a3; }
    .footer { background-color: #f8f9fa; padding: 20px 30px; text-align: center; font-size: 12px; color: #6c757d; }
    .footer a { color: #0066cc; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Faktura</h1>
    </div>
    <div class="content">
      <p>Poštovani,</p>
      <p>U prilogu Vam dostavljamo fakturu za usluge/proizvode. Molimo Vas da izvršite uplatu do navedenog datuma dospeća.</p>
      
      <div class="invoice-info">
        <div class="invoice-row">
          <span class="invoice-label">Broj fakture</span>
          <span class="invoice-value">${invoice.invoiceNumber}</span>
        </div>
        <div class="invoice-row">
          <span class="invoice-label">Datum izdavanja</span>
          <span class="invoice-value">${new Date(invoice.issueDate).toLocaleDateString("sr-RS")}</span>
        </div>
        <div class="invoice-row">
          <span class="invoice-label">Datum dospeća</span>
          <span class="invoice-value">${formattedDueDate}</span>
        </div>
        <div class="invoice-row">
          <span class="invoice-label">Status</span>
          <span class="invoice-value">${getStatusLabel(invoice.status)}</span>
        </div>
      </div>
      
      <div class="total-row">
        <div class="invoice-row" style="border: none; padding: 0;">
          <span class="invoice-label" style="color: #adb5bd;">Ukupno za uplatu</span>
          <span class="invoice-value">${formattedTotal}</span>
        </div>
      </div>
      
      ${invoice.notes ? `<p style="margin-top: 20px; font-size: 14px; color: #6c757d;"><strong>Napomena:</strong> ${invoice.notes}</p>` : ""}
      
      <p style="margin-top: 30px;">Ukoliko imate pitanja, slobodno nas kontaktirajte.</p>
      <p>Srdačan pozdrav,<br>Vaš tim</p>
    </div>
    <div class="footer">
      <p>Ova poruka je automatski generisana. Molimo ne odgovarajte direktno na ovaj email.</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `
Faktura ${invoice.invoiceNumber}

Poštovani,

U prilogu Vam dostavljamo fakturu za usluge/proizvode.

Broj fakture: ${invoice.invoiceNumber}
Datum izdavanja: ${new Date(invoice.issueDate).toLocaleDateString("sr-RS")}
Datum dospeća: ${formattedDueDate}
Ukupno za uplatu: ${formattedTotal}

${invoice.notes ? `Napomena: ${invoice.notes}` : ""}

Molimo Vas da izvršite uplatu do navedenog datuma dospeća.

Srdačan pozdrav,
Vaš tim
    `,
  };
}

function getQuoteEmailTemplate(quote: Quote & { companyName?: string }): EmailTemplate {
  const formattedTotal = new Intl.NumberFormat("sr-RS", {
    style: "currency",
    currency: "EUR",
  }).format(quote.total);

  const formattedValidUntil = new Date(quote.validUntil).toLocaleDateString("sr-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return {
    subject: `Ponuda ${quote.quoteNumber} - ${quote.companyName || ""}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ponuda ${quote.quoteNumber}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #2d3748; color: #ffffff; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 30px; }
    .quote-info { background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    .quote-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e9ecef; }
    .quote-row:last-child { border-bottom: none; }
    .quote-label { color: #6c757d; font-size: 14px; }
    .quote-value { font-weight: 600; color: #2d3748; }
    .total-row { background-color: #2d3748; color: #ffffff; padding: 15px 20px; border-radius: 8px; margin-top: 20px; }
    .total-row .quote-value { color: #ffffff; font-size: 20px; }
    .validity-notice { background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin-top: 20px; }
    .cta-button { display: inline-block; background-color: #28a745; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 20px; margin-right: 10px; }
    .cta-button.secondary { background-color: #6c757d; }
    .footer { background-color: #f8f9fa; padding: 20px 30px; text-align: center; font-size: 12px; color: #6c757d; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Ponuda</h1>
    </div>
    <div class="content">
      <p>Poštovani,</p>
      <p>Hvala Vam na interesovanju. U prilogu Vam dostavljamo našu ponudu.</p>
      
      <div class="quote-info">
        <div class="quote-row">
          <span class="quote-label">Broj ponude</span>
          <span class="quote-value">${quote.quoteNumber}</span>
        </div>
        <div class="quote-row">
          <span class="quote-label">Datum ponude</span>
          <span class="quote-value">${new Date(quote.issueDate).toLocaleDateString("sr-RS")}</span>
        </div>
        <div class="quote-row">
          <span class="quote-label">Važi do</span>
          <span class="quote-value">${formattedValidUntil}</span>
        </div>
      </div>
      
      <div class="total-row">
        <div class="quote-row" style="border: none; padding: 0;">
          <span class="quote-label" style="color: #adb5bd;">Ukupna vrednost</span>
          <span class="quote-value">${formattedTotal}</span>
        </div>
      </div>
      
      <div class="validity-notice">
        <strong>⏰ Napomena:</strong> Ova ponuda važi do ${formattedValidUntil}. Nakon tog datuma, cene mogu biti podložne promenama.
      </div>
      
      ${quote.terms ? `<p style="margin-top: 20px; font-size: 14px; color: #6c757d;"><strong>Uslovi:</strong> ${quote.terms}</p>` : ""}
      
      <p style="margin-top: 30px;">Za sva dodatna pitanja, stojimo Vam na raspolaganju.</p>
      <p>Srdačan pozdrav,<br>Vaš tim</p>
    </div>
    <div class="footer">
      <p>Ova poruka je automatski generisana. Molimo ne odgovarajte direktno na ovaj email.</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `
Ponuda ${quote.quoteNumber}

Poštovani,

Hvala Vam na interesovanju. U prilogu Vam dostavljamo našu ponudu.

Broj ponude: ${quote.quoteNumber}
Datum ponude: ${new Date(quote.issueDate).toLocaleDateString("sr-RS")}
Važi do: ${formattedValidUntil}
Ukupna vrednost: ${formattedTotal}

Napomena: Ova ponuda važi do ${formattedValidUntil}. Nakon tog datuma, cene mogu biti podložne promenama.

${quote.terms ? `Uslovi: ${quote.terms}` : ""}

Za sva dodatna pitanja, stojimo Vam na raspolaganju.

Srdačan pozdrav,
Vaš tim
    `,
  };
}

function getPaymentReminderTemplate(invoice: Invoice & { companyName?: string; daysOverdue: number }): EmailTemplate {
  const formattedTotal = new Intl.NumberFormat("sr-RS", {
    style: "currency",
    currency: "EUR",
  }).format(invoice.total - invoice.paidAmount);

  return {
    subject: `Podsećanje: Faktura ${invoice.invoiceNumber} je dospela na naplatu`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Podsećanje za uplatu</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #dc3545; color: #ffffff; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 30px; }
    .warning-box { background-color: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center; }
    .warning-box .days { font-size: 36px; font-weight: bold; color: #dc3545; }
    .invoice-info { background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    .invoice-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e9ecef; }
    .invoice-row:last-child { border-bottom: none; }
    .invoice-label { color: #6c757d; font-size: 14px; }
    .invoice-value { font-weight: 600; color: #1a1a2e; }
    .amount-due { background-color: #dc3545; color: #ffffff; padding: 15px 20px; border-radius: 8px; margin-top: 20px; text-align: center; }
    .amount-due .amount { font-size: 28px; font-weight: bold; }
    .footer { background-color: #f8f9fa; padding: 20px 30px; text-align: center; font-size: 12px; color: #6c757d; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Podsećanje za uplatu</h1>
    </div>
    <div class="content">
      <div class="warning-box">
        <div class="days">${invoice.daysOverdue}</div>
        <div>dana nakon dospeća</div>
      </div>
      
      <p>Poštovani,</p>
      <p>Ovo je prijateljsko podsećanje da faktura <strong>${invoice.invoiceNumber}</strong> još uvek nije plaćena.</p>
      
      <div class="invoice-info">
        <div class="invoice-row">
          <span class="invoice-label">Broj fakture</span>
          <span class="invoice-value">${invoice.invoiceNumber}</span>
        </div>
        <div class="invoice-row">
          <span class="invoice-label">Datum dospeća</span>
          <span class="invoice-value">${new Date(invoice.dueDate).toLocaleDateString("sr-RS")}</span>
        </div>
      </div>
      
      <div class="amount-due">
        <div>Preostalo za uplatu</div>
        <div class="amount">${formattedTotal}</div>
      </div>
      
      <p style="margin-top: 30px;">Molimo Vas da izvršite uplatu što je pre moguće. Ukoliko ste već izvršili uplatu, molimo Vas da zanemarite ovu poruku.</p>
      
      <p>Srdačan pozdrav,<br>Vaš tim</p>
    </div>
    <div class="footer">
      <p>Ova poruka je automatski generisana. Molimo ne odgovarajte direktno na ovaj email.</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `
Podsećanje za uplatu - Faktura ${invoice.invoiceNumber}

Poštovani,

Ovo je prijateljsko podsećanje da faktura ${invoice.invoiceNumber} još uvek nije plaćena.

Broj fakture: ${invoice.invoiceNumber}
Datum dospeća: ${new Date(invoice.dueDate).toLocaleDateString("sr-RS")}
Dana nakon dospeća: ${invoice.daysOverdue}
Preostalo za uplatu: ${formattedTotal}

Molimo Vas da izvršite uplatu što je pre moguće.

Srdačan pozdrav,
Vaš tim
    `,
  };
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Nacrt",
    sent: "Poslato",
    paid: "Plaćeno",
    partial: "Delimično plaćeno",
    overdue: "Dospelo",
    cancelled: "Otkazano",
  };
  return labels[status] || status;
}

// ============================================
// Email Service Class
// ============================================

class EmailService {
  /**
   * Send invoice email to contact
   */
  async sendInvoiceEmail(
    invoiceId: string,
    recipientEmail?: string
  ): Promise<ApiResponse<{ sent: boolean; to: string }>> {
    try {
      // Get invoice with company and contact info
      const invoiceData = await sql`
        SELECT 
          i.*,
          c.name as company_name,
          ct.email as contact_email,
          ct.first_name as contact_first_name,
          ct.last_name as contact_last_name
        FROM invoices i
        LEFT JOIN companies c ON i.company_id = c.id
        LEFT JOIN contacts ct ON i.contact_id = ct.id
        WHERE i.id = ${invoiceId}
      `;

      if (invoiceData.length === 0) {
        return errorResponse("NOT_FOUND", "Invoice not found");
      }

      const invoice = invoiceData[0];
      const toEmail = recipientEmail || invoice.contact_email;

      if (!toEmail) {
        return errorResponse("VALIDATION_ERROR", "No recipient email provided");
      }

      // Get invoice items
      const items = await sql`
        SELECT * FROM invoice_items WHERE invoice_id = ${invoiceId}
      `;

      const fullInvoice = {
        ...invoice,
        items: items.map((item: Record<string, unknown>) => ({
          id: item.id,
          productName: item.product_name,
          description: item.description,
          quantity: parseFloat(item.quantity as string),
          unitPrice: parseFloat(item.unit_price as string),
          discount: parseFloat(item.discount as string),
          total: parseFloat(item.total as string),
        })),
        companyName: invoice.company_name,
      } as Invoice & { companyName: string };

      const template = getInvoiceEmailTemplate(fullInvoice);

      // Queue email job
      await addEmailJob({
        to: toEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      // Update invoice status to sent if it was draft
      if (invoice.status === "draft") {
        await sql`
          UPDATE invoices SET status = 'sent', updated_at = NOW()
          WHERE id = ${invoiceId}
        `;
      }

      logger.info({ invoiceId, to: toEmail }, "Invoice email queued");

      return successResponse({ sent: true, to: toEmail });
    } catch (error) {
      logger.error({ error, invoiceId }, "Failed to send invoice email");
      return errorResponse("INTERNAL_ERROR", "Failed to send invoice email");
    }
  }

  /**
   * Send quote email to contact
   */
  async sendQuoteEmail(
    quoteId: string,
    recipientEmail?: string
  ): Promise<ApiResponse<{ sent: boolean; to: string }>> {
    try {
      const quoteData = await sql`
        SELECT 
          q.*,
          c.name as company_name,
          ct.email as contact_email,
          ct.first_name as contact_first_name,
          ct.last_name as contact_last_name
        FROM quotes q
        LEFT JOIN companies c ON q.company_id = c.id
        LEFT JOIN contacts ct ON q.contact_id = ct.id
        WHERE q.id = ${quoteId}
      `;

      if (quoteData.length === 0) {
        return errorResponse("NOT_FOUND", "Quote not found");
      }

      const quote = quoteData[0];
      const toEmail = recipientEmail || quote.contact_email;

      if (!toEmail) {
        return errorResponse("VALIDATION_ERROR", "No recipient email provided");
      }

      const items = await sql`
        SELECT * FROM quote_items WHERE quote_id = ${quoteId}
      `;

      const fullQuote = {
        ...quote,
        items: items.map((item: Record<string, unknown>) => ({
          id: item.id,
          productName: item.product_name,
          description: item.description,
          quantity: parseFloat(item.quantity as string),
          unitPrice: parseFloat(item.unit_price as string),
          discount: parseFloat(item.discount as string),
          total: parseFloat(item.total as string),
        })),
        companyName: quote.company_name,
      } as Quote & { companyName: string };

      const template = getQuoteEmailTemplate(fullQuote);

      await addEmailJob({
        to: toEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      // Update quote status to sent if it was draft
      if (quote.status === "draft") {
        await sql`
          UPDATE quotes SET status = 'sent', updated_at = NOW()
          WHERE id = ${quoteId}
        `;
      }

      logger.info({ quoteId, to: toEmail }, "Quote email queued");

      return successResponse({ sent: true, to: toEmail });
    } catch (error) {
      logger.error({ error, quoteId }, "Failed to send quote email");
      return errorResponse("INTERNAL_ERROR", "Failed to send quote email");
    }
  }

  /**
   * Send payment reminder for overdue invoices
   */
  async sendPaymentReminder(
    invoiceId: string
  ): Promise<ApiResponse<{ sent: boolean; to: string }>> {
    try {
      const invoiceData = await sql`
        SELECT 
          i.*,
          c.name as company_name,
          ct.email as contact_email,
          EXTRACT(DAY FROM NOW() - i.due_date) as days_overdue
        FROM invoices i
        LEFT JOIN companies c ON i.company_id = c.id
        LEFT JOIN contacts ct ON i.contact_id = ct.id
        WHERE i.id = ${invoiceId} 
          AND i.status IN ('sent', 'partial', 'overdue')
          AND i.due_date < NOW()
      `;

      if (invoiceData.length === 0) {
        return errorResponse("NOT_FOUND", "Overdue invoice not found");
      }

      const invoice = invoiceData[0];
      const toEmail = invoice.contact_email;

      if (!toEmail) {
        return errorResponse("VALIDATION_ERROR", "No recipient email for contact");
      }

      const fullInvoice = {
        ...invoice,
        companyName: invoice.company_name,
        daysOverdue: Math.floor(parseFloat(invoice.days_overdue)),
      } as Invoice & { companyName: string; daysOverdue: number };

      const template = getPaymentReminderTemplate(fullInvoice);

      await addEmailJob({
        to: toEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      // Update invoice status to overdue if not already
      if (invoice.status !== "overdue") {
        await sql`
          UPDATE invoices SET status = 'overdue', updated_at = NOW()
          WHERE id = ${invoiceId}
        `;
      }

      logger.info({ invoiceId, to: toEmail, daysOverdue: fullInvoice.daysOverdue }, "Payment reminder queued");

      return successResponse({ sent: true, to: toEmail });
    } catch (error) {
      logger.error({ error, invoiceId }, "Failed to send payment reminder");
      return errorResponse("INTERNAL_ERROR", "Failed to send payment reminder");
    }
  }

  /**
   * Send bulk payment reminders for all overdue invoices
   */
  async sendBulkPaymentReminders(): Promise<ApiResponse<{ sent: number; failed: number }>> {
    try {
      const overdueInvoices = await sql`
        SELECT i.id
        FROM invoices i
        LEFT JOIN contacts ct ON i.contact_id = ct.id
        WHERE i.status IN ('sent', 'partial')
          AND i.due_date < NOW()
          AND ct.email IS NOT NULL
      `;

      let sent = 0;
      let failed = 0;

      for (const invoice of overdueInvoices) {
        const result = await this.sendPaymentReminder(invoice.id);
        if (result.success) {
          sent++;
        } else {
          failed++;
        }
      }

      logger.info({ sent, failed }, "Bulk payment reminders completed");

      return successResponse({ sent, failed });
    } catch (error) {
      logger.error({ error }, "Failed to send bulk payment reminders");
      return errorResponse("INTERNAL_ERROR", "Failed to send bulk payment reminders");
    }
  }

  /**
   * Send custom email
   */
  async sendCustomEmail(
    options: SendEmailOptions
  ): Promise<ApiResponse<{ sent: boolean }>> {
    try {
      const recipients = Array.isArray(options.to) ? options.to : [options.to];
      
      for (const recipient of recipients) {
        await addEmailJob({
          to: recipient.email,
          subject: options.subject,
          html: options.html,
          text: options.text,
        });
      }

      logger.info({ to: recipients.map((r) => r.email), subject: options.subject }, "Custom email queued");

      return successResponse({ sent: true });
    } catch (error) {
      logger.error({ error }, "Failed to send custom email");
      return errorResponse("INTERNAL_ERROR", "Failed to send email");
    }
  }

  /**
   * Send team invite email
   */
  async sendInviteEmail(params: {
    to: string;
    companyName: string;
    inviteToken: string;
    role: "owner" | "member" | "admin";
  }): Promise<void> {
    const inviteUrl = process.env.FRONTEND_URL 
      ? `${process.env.FRONTEND_URL}/invite/${params.inviteToken}`
      : `http://localhost:3000/invite/${params.inviteToken}`;

    const roleLabels: Record<string, string> = {
      owner: "Vlasnik",
      member: "Član",
      admin: "Administrator",
    };

    const template = {
      subject: `Pozivnica za tim: ${params.companyName}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pozivnica za tim</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #1a1a2e; color: #ffffff; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 30px; }
    .invite-info { background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    .cta-button { display: inline-block; background-color: #0066cc; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 20px; }
    .cta-button:hover { background-color: #0052a3; }
    .footer { background-color: #f8f9fa; padding: 20px 30px; text-align: center; font-size: 12px; color: #6c757d; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Pozivnica za tim</h1>
    </div>
    <div class="content">
      <p>Poštovani,</p>
      <p>Dobili ste pozivnicu da se pridružite timu <strong>${params.companyName}</strong> kao <strong>${roleLabels[params.role] || params.role}</strong>.</p>
      
      <div class="invite-info">
        <p style="margin: 0;"><strong>Kompanija:</strong> ${params.companyName}</p>
        <p style="margin: 10px 0 0 0;"><strong>Uloga:</strong> ${roleLabels[params.role] || params.role}</p>
      </div>
      
      <p>Kliknite na dugme ispod da prihvatite pozivnicu:</p>
      <a href="${inviteUrl}" class="cta-button">Prihvati pozivnicu</a>
      
      <p style="margin-top: 30px; font-size: 14px; color: #6c757d;">
        Ili kopirajte ovaj link u vaš browser:<br>
        <a href="${inviteUrl}">${inviteUrl}</a>
      </p>
      
      <p style="margin-top: 30px; font-size: 12px; color: #6c757d;">
        Napomena: Ova pozivnica važi 7 dana. Ako imate pitanja, kontaktirajte osobu koja vas je pozvala.
      </p>
    </div>
    <div class="footer">
      <p>Ova poruka je automatski generisana. Molimo ne odgovarajte direktno na ovaj email.</p>
    </div>
  </div>
</body>
</html>
      `,
      text: `
Pozivnica za tim: ${params.companyName}

Poštovani,

Dobili ste pozivnicu da se pridružite timu ${params.companyName} kao ${roleLabels[params.role] || params.role}.

Kliknite na link ispod da prihvatite pozivnicu:
${inviteUrl}

Napomena: Ova pozivnica važi 7 dana. Ako imate pitanja, kontaktirajte osobu koja vas je pozvala.
      `,
    };

    await addEmailJob({
      to: params.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    logger.info({ to: params.to, companyName: params.companyName }, "Invite email queued");
  }
}

export const emailService = new EmailService();
export default emailService;

