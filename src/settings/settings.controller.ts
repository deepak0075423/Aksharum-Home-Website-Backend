import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { AdminGuard } from '../common/admin.guard';
import { DEFAULT_SMTP, MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

class SmtpDto {
  @IsBoolean()
  enabled!: boolean;

  @IsString()
  host!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;

  @IsBoolean()
  secure!: boolean;

  @IsOptional()
  @IsString()
  user?: string;

  @IsOptional()
  @IsString()
  pass?: string;

  @IsOptional()
  @IsString()
  fromName?: string;

  @IsOptional()
  @IsString()
  fromEmail?: string;

  @IsOptional()
  @IsString()
  notifyTo?: string;
}

class SiteDto {
  @IsBoolean()
  careersOpen!: boolean;

  @IsOptional()
  @IsString()
  careersClosedMessage?: string;
}

class TestMailDto {
  @IsEmail()
  to!: string;
}

// Each flag is optional so the admin panel can toggle one file without
// having to send the state of the other two.
class SeoDto {
  @IsOptional()
  @IsBoolean()
  sitemap?: boolean;

  @IsOptional()
  @IsBoolean()
  robots?: boolean;

  @IsOptional()
  @IsBoolean()
  llms?: boolean;
}

// Which of the three SEO files the site serves. Stored per environment
// (local, staging and production each have their own database), so switching
// them off locally never touches production.
//
// Off by default, deliberately: an environment nobody has configured yet — a
// fresh clone, a new staging box — should not be handing crawlers a sitemap.
// Production therefore needs these switched on once, from Settings → SEO files.
const DEFAULT_SEO = {
  sitemap: false,
  robots: false,
  llms: false,
};

const DEFAULT_SITE = {
  careersOpen: true,
  careersClosedMessage:
    'We are not accepting applications right now. Please check back soon!',
};

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  private async getSetting(key: string, fallback: object) {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return { ...fallback, ...((row?.value as object) ?? {}) };
  }

  /** Drops undefined entries so partial merges never erase stored values. */
  private defined(obj: object): object {
    return Object.fromEntries(
      Object.entries(obj).filter(([, v]) => v !== undefined),
    );
  }

  private upsert(key: string, value: object) {
    return this.prisma.setting.upsert({
      where: { key },
      create: { key, value: value as any },
      update: { value: value as any },
    });
  }

  // Public: consumed by the career page script (are applications open?)
  @Get('public')
  async publicSettings() {
    const site = await this.getSetting('site', DEFAULT_SITE);
    return site;
  }

  // Public: read by the Next.js sitemap.xml / robots.txt / llms.txt routes
  // to decide whether to serve each file at all.
  @Get('seo')
  async seoFlags() {
    return this.getSetting('seo', DEFAULT_SEO);
  }

  @Get()
  @UseGuards(AdminGuard)
  async all() {
    return {
      smtp: await this.getSetting('smtp', DEFAULT_SMTP),
      site: await this.getSetting('site', DEFAULT_SITE),
      seo: await this.getSetting('seo', DEFAULT_SEO),
    };
  }

  @Put('smtp')
  @UseGuards(AdminGuard)
  async saveSmtp(@Body() dto: SmtpDto) {
    const current = await this.getSetting('smtp', DEFAULT_SMTP);
    // Empty password in the form means "keep the stored one"
    const pass = dto.pass === '' || dto.pass === undefined ? (current as any).pass : dto.pass;
    await this.upsert('smtp', { ...current, ...this.defined(dto), pass });
    return { ok: true };
  }

  @Put('site')
  @UseGuards(AdminGuard)
  async saveSite(@Body() dto: SiteDto) {
    const current = await this.getSetting('site', DEFAULT_SITE);
    await this.upsert('site', { ...current, ...this.defined(dto) });
    return { ok: true };
  }

  @Put('seo')
  @UseGuards(AdminGuard)
  async saveSeo(@Body() dto: SeoDto) {
    const current = await this.getSetting('seo', DEFAULT_SEO);
    await this.upsert('seo', { ...current, ...this.defined(dto) });
    return { ok: true };
  }

  @Post('smtp/test')
  @UseGuards(AdminGuard)
  @HttpCode(200)
  async testSmtp(@Body() dto: TestMailDto) {
    try {
      await this.mail.sendTest(dto.to);
      return { ok: true, message: `Test email sent to ${dto.to}` };
    } catch (err) {
      throw new BadRequestException(
        `SMTP test failed: ${(err as Error).message}`,
      );
    }
  }
}
