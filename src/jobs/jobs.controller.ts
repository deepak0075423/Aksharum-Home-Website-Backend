import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JobStatus } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { AdminGuard } from '../common/admin.guard';
import { PrismaService } from '../prisma/prisma.service';
import { JobsService } from './jobs.service';

class CreateJobDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsString()
  @MinLength(1)
  department!: string;

  @IsString()
  @MinLength(1)
  location!: string;

  @IsString()
  @MinLength(1)
  type!: string;

  // Required: a role must ship with a description (rich-text HTML).
  @IsString()
  @MinLength(1)
  description!: string;

  @IsInt()
  @Min(1)
  openings!: number;

  @IsEnum(JobStatus)
  status!: JobStatus;

  @IsInt()
  @Min(0)
  sortOrder!: number;
}

class UpdateJobDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  type?: string;

  // Optional for partial updates (e.g. status-only), but never blank when sent.
  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  openings?: number;

  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
  ) {}

  // Public: open + filled roles shown on the career page (closed are hidden).
  // Each carries `path`, the URL of its own job page.
  @Get()
  listPublic() {
    return this.jobs.listPublic();
  }

  @Get('all')
  @UseGuards(AdminGuard)
  listAll() {
    return this.prisma.job.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { applications: true } } },
    });
  }

  // Public: one role for its /career/<slug> page (and its JobPosting data).
  // Declared after 'all' so that path is never captured as an id.
  @Get(':id')
  async getPublic(@Param('id') id: string) {
    const job = await this.jobs.findPublic(id);
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateJobDto) {
    return this.prisma.job.create({ data: dto });
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  async update(@Param('id') id: string, @Body() dto: UpdateJobDto) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Job not found');
    return this.prisma.job.update({ where: { id }, data: dto });
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  async remove(@Param('id') id: string) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Job not found');
    await this.prisma.job.delete({ where: { id } });
    return { ok: true };
  }
}
