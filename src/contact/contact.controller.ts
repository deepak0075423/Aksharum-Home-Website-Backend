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
import { InboxStatus } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { AdminGuard } from '../common/admin.guard';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

class CreateContactDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  school!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  students?: string;

  @IsOptional()
  @IsString()
  moduleInterest?: string;

  @IsString()
  @MinLength(2)
  message!: string;
}

class UpdateContactDto {
  @IsEnum(InboxStatus)
  status!: InboxStatus;
}

@Controller('contact')
export class ContactController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  @Post()
  async create(@Body() dto: CreateContactDto) {
    const row = await this.prisma.contactSubmission.create({
      data: {
        name: dto.name,
        email: dto.email,
        school: dto.school,
        phone: dto.phone ?? '',
        role: dto.role ?? '',
        students: dto.students ?? '',
        moduleInterest: dto.moduleInterest ?? '',
        message: dto.message,
      },
    });

    void this.mail.notify(
      `New contact message from ${dto.name} (${dto.school})`,
      this.mail.table({
        Name: dto.name,
        Email: dto.email,
        School: dto.school,
        Phone: dto.phone ?? '',
        Role: dto.role ?? '',
        Students: dto.students ?? '',
        'Module interest': dto.moduleInterest ?? '',
        Message: dto.message,
      }),
    );

    return { ok: true, id: row.id };
  }

  @Get()
  @UseGuards(AdminGuard)
  list() {
    return this.prisma.contactSubmission.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  async update(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    const row = await this.prisma.contactSubmission.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Submission not found');
    return this.prisma.contactSubmission.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  async remove(@Param('id') id: string) {
    const row = await this.prisma.contactSubmission.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Submission not found');
    await this.prisma.contactSubmission.delete({ where: { id } });
    return { ok: true };
  }
}
