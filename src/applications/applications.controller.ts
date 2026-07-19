import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApplicationStatus } from '@prisma/client';
import { Response } from 'express';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { AdminGuard } from '../common/admin.guard';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const ALLOWED_EXT = ['.pdf', '.doc', '.docx'];
mkdirSync(UPLOAD_DIR, { recursive: true });

class CreateApplicationDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  role!: string;

  @IsString()
  @MinLength(1)
  experience!: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  portfolio?: string;

  // JSON-encoded array (multipart forms send strings)
  @IsOptional()
  @IsString()
  locations?: string;

  @IsString()
  @MinLength(2)
  message!: string;

  @IsOptional()
  @IsString()
  jobId?: string;
}

class UpdateApplicationDto {
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus;
}

@Controller('applications')
export class ApplicationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('resume', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const safe = file.originalname
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .slice(-80);
          cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}-${safe}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok = ALLOWED_EXT.includes(extname(file.originalname).toLowerCase());
        cb(ok ? null : new BadRequestException('Resume must be PDF, DOC or DOCX'), ok);
      },
    }),
  )
  async create(
    @Body() dto: CreateApplicationDto,
    @UploadedFile() resume?: Express.Multer.File,
  ) {
    const site = await this.prisma.setting.findUnique({ where: { key: 'site' } });
    const siteCfg = (site?.value as { careersOpen?: boolean }) ?? {};
    if (siteCfg.careersOpen === false) {
      throw new ForbiddenException('Applications are currently closed');
    }

    let locations: string[] = [];
    try {
      const parsed = JSON.parse(dto.locations ?? '[]');
      if (Array.isArray(parsed)) locations = parsed.map(String);
    } catch {
      locations = dto.locations ? [dto.locations] : [];
    }

    let jobId: string | null = null;
    if (dto.jobId) {
      const job = await this.prisma.job.findUnique({ where: { id: dto.jobId } });
      jobId = job?.id ?? null;
    }

    const app = await this.prisma.jobApplication.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        role: dto.role,
        experience: dto.experience,
        company: dto.company ?? '',
        portfolio: dto.portfolio ?? '',
        locations,
        message: dto.message,
        resumePath: resume?.filename ?? null,
        resumeName: resume?.originalname ?? null,
        jobId,
      },
    });

    void this.mail.notify(
      `New job application: ${dto.role} — ${dto.fullName}`,
      this.mail.table({
        Name: dto.fullName,
        Email: dto.email,
        Role: dto.role,
        Experience: dto.experience,
        'Company / College': dto.company ?? '',
        Portfolio: dto.portfolio ?? '',
        Locations: locations,
        Message: dto.message,
        Resume: resume?.originalname ?? 'not attached',
      }),
    );

    return { ok: true, id: app.id };
  }

  @Get()
  @UseGuards(AdminGuard)
  list() {
    return this.prisma.jobApplication.findMany({
      orderBy: { createdAt: 'desc' },
      include: { job: { select: { id: true, title: true } } },
    });
  }

  @Get(':id/resume')
  @UseGuards(AdminGuard)
  async resume(@Param('id') id: string, @Res() res: Response) {
    const app = await this.prisma.jobApplication.findUnique({ where: { id } });
    if (!app?.resumePath) throw new NotFoundException('No resume on file');
    const path = join(UPLOAD_DIR, app.resumePath);
    if (!existsSync(path)) throw new NotFoundException('Resume file missing');
    res.download(path, app.resumeName ?? 'resume');
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  async update(@Param('id') id: string, @Body() dto: UpdateApplicationDto) {
    const app = await this.prisma.jobApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    return this.prisma.jobApplication.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  async remove(@Param('id') id: string) {
    const app = await this.prisma.jobApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    await this.prisma.jobApplication.delete({ where: { id } });
    return { ok: true };
  }
}
