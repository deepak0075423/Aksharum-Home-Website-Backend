import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

export interface SmtpConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
  notifyTo: string;
}

export const DEFAULT_SMTP: SmtpConfig = {
  enabled: false,
  host: '',
  port: 587,
  secure: false,
  user: '',
  pass: '',
  fromName: 'Aksharum',
  fromEmail: '',
  notifyTo: '',
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSmtpConfig(): Promise<SmtpConfig> {
    const row = await this.prisma.setting.findUnique({ where: { key: 'smtp' } });
    return { ...DEFAULT_SMTP, ...((row?.value as object) ?? {}) };
  }

  private buildTransport(cfg: SmtpConfig) {
    return nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    });
  }

  /**
   * Sends a notification to the configured inbox. Never throws —
   * a broken SMTP setup must not break public form submissions.
   */
  async notify(subject: string, html: string): Promise<void> {
    try {
      const cfg = await this.getSmtpConfig();
      if (!cfg.enabled || !cfg.host) return;
      const to = cfg.notifyTo || cfg.fromEmail;
      if (!to) return;
      await this.buildTransport(cfg).sendMail({
        from: `"${cfg.fromName || 'Aksharum'}" <${cfg.fromEmail || cfg.user}>`,
        to,
        subject,
        html,
      });
    } catch (err) {
      this.logger.warn(`Notification email failed: ${(err as Error).message}`);
    }
  }

  /** Used by the admin "send test email" button. Throws on failure. */
  async sendTest(to: string, overrides?: Partial<SmtpConfig>): Promise<void> {
    const cfg = { ...(await this.getSmtpConfig()), ...(overrides ?? {}) };
    if (!cfg.host) throw new Error('SMTP host is not configured');
    await this.buildTransport(cfg).sendMail({
      from: `"${cfg.fromName || 'Aksharum'}" <${cfg.fromEmail || cfg.user}>`,
      to,
      subject: 'Aksharum SMTP test',
      html: '<p>Your SMTP settings are working. This is a test email from the Aksharum admin panel.</p>',
    });
  }

  escape(v: unknown): string {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /** Small helper to render a key/value table for notification emails. */
  table(rows: Record<string, unknown>): string {
    const tr = Object.entries(rows)
      .map(
        ([k, v]) =>
          `<tr><td style="padding:6px 12px;color:#666;white-space:nowrap">${this.escape(k)}</td><td style="padding:6px 12px">${this.escape(
            Array.isArray(v) ? v.join(', ') : v,
          )}</td></tr>`,
      )
      .join('');
    return `<table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">${tr}</table>`;
  }
}
