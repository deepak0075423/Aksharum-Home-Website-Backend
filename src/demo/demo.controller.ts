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
import { DemoStatus } from '@prisma/client';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { AdminGuard } from '../common/admin.guard';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

class CreateDemoDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(5)
  phone!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  school!: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  students?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modules?: string[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  preferredDate?: string;

  @IsOptional()
  @IsString()
  preferredSlot?: string;
}

class UpdateDemoDto {
  @IsEnum(DemoStatus)
  status!: DemoStatus;
}

@Controller('demo-requests')
export class DemoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  @Post()
  async create(@Body() dto: CreateDemoDto) {
    const row = await this.prisma.demoRequest.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        school: dto.school,
        role: dto.role ?? '',
        students: dto.students ?? '',
        modules: dto.modules ?? [],
        notes: dto.notes ?? '',
        preferredDate: dto.preferredDate ?? '',
        preferredSlot: dto.preferredSlot ?? '',
      },
    });

    void this.mail.notify(
      `New demo booking: ${dto.school} — ${dto.preferredDate || 'no date'} ${dto.preferredSlot || ''}`,
      this.mail.table({
        Name: dto.name,
        Phone: dto.phone,
        Email: dto.email,
        School: dto.school,
        Role: dto.role ?? '',
        Students: dto.students ?? '',
        Modules: dto.modules ?? [],
        Date: dto.preferredDate ?? '',
        Slot: dto.preferredSlot ?? '',
        Notes: dto.notes ?? '',
      }),
    );

    return { ok: true, id: row.id };
  }

  @Get()
  @UseGuards(AdminGuard)
  list() {
    return this.prisma.demoRequest.findMany({ orderBy: { createdAt: 'desc' } });
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  async update(@Param('id') id: string, @Body() dto: UpdateDemoDto) {
    const row = await this.prisma.demoRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Demo request not found');
    return this.prisma.demoRequest.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  async remove(@Param('id') id: string) {
    const row = await this.prisma.demoRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Demo request not found');
    await this.prisma.demoRequest.delete({ where: { id } });
    return { ok: true };
  }
}
