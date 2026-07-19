import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { AdminGuard } from '../common/admin.guard';
import { AuthService } from './auth.service';

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters' })
  newPassword!: string;
}

class CreateAdminDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string;
}

class SetActiveDto {
  @IsBoolean()
  active!: boolean;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('me')
  @UseGuards(AdminGuard)
  me(@Req() req: any) {
    return this.auth.me(req.admin.sub);
  }

  @Put('password')
  @UseGuards(AdminGuard)
  changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(
      req.admin.sub,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  // ── Admin management ──

  @Get('admins')
  @UseGuards(AdminGuard)
  listAdmins() {
    return this.auth.listAdmins();
  }

  @Post('admins')
  @UseGuards(AdminGuard)
  createAdmin(@Body() dto: CreateAdminDto) {
    return this.auth.createAdmin({
      name: dto.name ?? '',
      email: dto.email,
      password: dto.password,
    });
  }

  @Patch('admins/:id')
  @UseGuards(AdminGuard)
  setActive(@Req() req: any, @Param('id') id: string, @Body() dto: SetActiveDto) {
    return this.auth.setAdminActive(req.admin.sub, id, dto.active);
  }

  @Delete('admins/:id')
  @UseGuards(AdminGuard)
  deleteAdmin(@Req() req: any, @Param('id') id: string) {
    return this.auth.deleteAdmin(req.admin.sub, id);
  }
}
