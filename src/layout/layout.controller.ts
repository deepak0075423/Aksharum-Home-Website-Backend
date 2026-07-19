import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Post,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AdminGuard } from '../common/admin.guard';
import { LayoutService } from './layout.service';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif', '.ico'];
mkdirSync(UPLOAD_DIR, { recursive: true });

function imageUpload(prefix: string) {
  return FileInterceptor('file', {
    storage: diskStorage({
      destination: UPLOAD_DIR,
      filename: (_req, file, cb) =>
        cb(null, `${prefix}-${Date.now()}${extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ok = IMAGE_EXT.includes(extname(file.originalname).toLowerCase());
      cb(
        ok
          ? null
          : new BadRequestException('Use a PNG, JPG, SVG, WEBP, GIF or ICO image'),
        ok,
      );
    },
  });
}

class UpdateLayoutDto {
  @IsOptional()
  @IsString()
  headerHtml?: string;

  @IsOptional()
  @IsString()
  footerHtml?: string;
}

class BrandingDto {
  @IsString()
  @MinLength(1)
  siteName!: string;
}

class SocialLinkDto {
  @IsString()
  icon!: string;

  @IsString()
  @MinLength(1)
  label!: string;

  @IsString()
  @MinLength(1)
  url!: string;
}

class SocialLinksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  links!: SocialLinkDto[];
}

@Controller('layout')
export class LayoutController {
  constructor(private readonly layout: LayoutService) {}

  // ── Public: logo + favicon files referenced by the rendered site ──

  @Get('logo')
  async logo(@Res() res: Response) {
    const b = await this.layout.getBranding();
    const path = b.logoPath ? join(UPLOAD_DIR, b.logoPath) : '';
    if (!path || !existsSync(path)) throw new NotFoundException('No logo set');
    res.sendFile(path);
  }

  @Get('favicon')
  async favicon(@Res() res: Response) {
    const b = await this.layout.getBranding();
    const path = b.faviconPath ? join(UPLOAD_DIR, b.faviconPath) : '';
    if (!path || !existsSync(path)) throw new NotFoundException('No favicon set');
    res.sendFile(path);
  }

  // ── Admin: shared header/footer ──

  @Get()
  @UseGuards(AdminGuard)
  async get() {
    const [layout, branding, social] = await Promise.all([
      this.layout.getLayout(),
      this.layout.getBranding(),
      this.layout.getSocial(),
    ]);
    return {
      ...layout,
      social,
      // token-expanded versions for the admin preview
      expandedHeaderHtml: this.layout.expandTokens(layout.headerHtml, branding, social),
      expandedFooterHtml: this.layout.expandTokens(layout.footerHtml, branding, social),
    };
  }

  @Put()
  @UseGuards(AdminGuard)
  async save(@Body() dto: UpdateLayoutDto) {
    await this.layout.saveLayout(dto);
    return { ok: true };
  }

  @Put('social')
  @UseGuards(AdminGuard)
  async saveSocial(@Body() dto: SocialLinksDto) {
    await this.layout.saveSocial(dto.links);
    return { ok: true };
  }

  // ── Admin: branding ──

  @Get('branding')
  @UseGuards(AdminGuard)
  async branding() {
    const b = await this.layout.getBranding();
    return {
      siteName: b.siteName,
      logoUrl: this.layout.logoUrl(b),
      faviconUrl: this.layout.faviconUrl(b),
    };
  }

  @Put('branding')
  @UseGuards(AdminGuard)
  async saveBranding(@Body() dto: BrandingDto) {
    await this.layout.saveBranding({ siteName: dto.siteName.trim() });
    return { ok: true };
  }

  private async replaceFile(
    kind: 'logoPath' | 'faviconPath',
    filename: string | null,
  ) {
    const b = await this.layout.getBranding();
    const old = b[kind];
    if (old) {
      const oldPath = join(UPLOAD_DIR, old);
      if (existsSync(oldPath)) unlinkSync(oldPath);
    }
    await this.layout.saveBranding({ [kind]: filename ?? '' });
  }

  @Post('branding/logo')
  @UseGuards(AdminGuard)
  @UseInterceptors(imageUpload('branding-logo'))
  async uploadLogo(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    await this.replaceFile('logoPath', file.filename);
    return { ok: true };
  }

  @Delete('branding/logo')
  @UseGuards(AdminGuard)
  async removeLogo() {
    await this.replaceFile('logoPath', null);
    return { ok: true };
  }

  @Post('branding/favicon')
  @UseGuards(AdminGuard)
  @UseInterceptors(imageUpload('branding-favicon'))
  async uploadFavicon(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    await this.replaceFile('faviconPath', file.filename);
    return { ok: true };
  }

  @Delete('branding/favicon')
  @UseGuards(AdminGuard)
  async removeFavicon() {
    await this.replaceFile('faviconPath', null);
    return { ok: true };
  }
}
