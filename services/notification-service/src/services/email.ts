import nodemailer, { type Transporter } from 'nodemailer';
import type { NotificationType } from '@talent-ai/shared-types';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import type { EmailStatus } from '../models/notification.model.js';

export interface EmailMessage {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const TYPE_LABELS: Record<NotificationType, string> = {
  REVIEW_RECEIVED: 'Profile review',
  COINS_AWARDED: 'TalentCredits earned',
  TIER3_UNLOCKED: 'Profile unlocked',
  MATCH_FOUND: 'High-affinity match',
  SYSTEM: 'talent.ai update',
};

/**
 * Branded, table-based transactional email. Inline styles keep it readable in
 * clients that strip `<style>` blocks.
 */
export function renderNotificationEmail(input: {
  type: NotificationType;
  title: string;
  body: string;
}): EmailMessage {
  const safeTitle = escapeHtml(input.title);
  const safeBody = escapeHtml(input.body);
  const badge = escapeHtml(TYPE_LABELS[input.type]);
  const subject = `${input.title} · talent.ai`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(17,24,39,0.08);">
            <tr>
              <td style="background:#111827;padding:24px 28px;">
                <span style="font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#ffffff;">talent<span style="color:#6366f1;">.ai</span></span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <span style="display:inline-block;padding:4px 10px;border-radius:999px;background:#eef2ff;color:#4338ca;font-size:12px;font-weight:600;letter-spacing:0.02em;">${badge}</span>
                <h1 style="margin:16px 0 12px;font-size:22px;line-height:1.3;color:#111827;">${safeTitle}</h1>
                <p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">${safeBody}</p>
                <a href="https://app.talent.ai" style="display:inline-block;margin-top:24px;padding:12px 20px;border-radius:10px;background:#4f46e5;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">Open talent.ai</a>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.5;color:#6b7280;">
                You are receiving this email because of activity on your talent.ai account.
                <br />© ${new Date().getUTCFullYear()} talent.ai — Intelligent hiring at the speed of thought.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `talent.ai — ${TYPE_LABELS[input.type]}`,
    '',
    input.title,
    '',
    input.body,
    '',
    'Open talent.ai: https://app.talent.ai',
  ].join('\n');

  return { subject, html, text };
}

let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  // With no SMTP relay configured, Nodemailer's JSON transport renders the
  // message so local development stays offline and observable in logs.
  transporter = config.email.smtpUrl
    ? nodemailer.createTransport(config.email.smtpUrl)
    : nodemailer.createTransport({ jsonTransport: true });

  return transporter;
}

/**
 * Sends a branded notification email. Email delivery is best-effort: a failure
 * never rolls back the in-app notification that was already persisted.
 */
export async function sendNotificationEmail(input: {
  to: string;
  type: NotificationType;
  title: string;
  body: string;
}): Promise<EmailStatus> {
  if (!config.email.enabled) {
    return 'SKIPPED';
  }

  const message = renderNotificationEmail(input);

  try {
    const info = await getTransporter().sendMail({
      from: config.email.from,
      to: input.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });

    logger.info(
      { to: input.to, messageId: info.messageId, type: input.type },
      'notification email accepted by transport',
    );
    return 'SENT';
  } catch (error) {
    logger.error({ err: error, to: input.to, type: input.type }, 'notification email failed');
    return 'FAILED';
  }
}
