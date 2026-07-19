import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

const ADMIN_SELECT = {
  id: true,
  email: true,
  name: true,
  isRoot: true,
  active: true,
  createdAt: true,
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!admin.active) {
      throw new UnauthorizedException(
        'This account has been deactivated. Contact the primary admin.',
      );
    }
    const token = await this.jwt.signAsync({
      sub: admin.id,
      email: admin.email,
      name: admin.name,
    });
    return {
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        isRoot: admin.isRoot,
      },
    };
  }

  async me(adminId: string) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
      select: ADMIN_SELECT,
    });
    if (!admin) throw new UnauthorizedException();
    return admin;
  }

  async changePassword(
    adminId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
    });
    if (!admin || !(await bcrypt.compare(currentPassword, admin.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }
    await this.prisma.adminUser.update({
      where: { id: adminId },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
    return { ok: true };
  }

  // ── Admin management ──
  // Any admin can list and create; only the primary (root) admin can
  // deactivate or delete, and the primary account itself is untouchable.

  listAdmins() {
    return this.prisma.adminUser.findMany({
      select: ADMIN_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async createAdmin(data: { name: string; email: string; password: string }) {
    const email = data.email.toLowerCase().trim();
    if (await this.prisma.adminUser.findUnique({ where: { email } })) {
      throw new ConflictException('An admin with this email already exists');
    }
    return this.prisma.adminUser.create({
      data: {
        email,
        name: data.name.trim() || 'Admin',
        passwordHash: await bcrypt.hash(data.password, 10),
      },
      select: ADMIN_SELECT,
    });
  }

  private async requireRoot(callerId: string) {
    const caller = await this.prisma.adminUser.findUnique({
      where: { id: callerId },
    });
    if (!caller?.isRoot) {
      throw new ForbiddenException(
        'Only the primary admin can deactivate or delete admin accounts',
      );
    }
  }

  private async getTarget(id: string) {
    const target = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('Admin not found');
    if (target.isRoot) {
      throw new BadRequestException(
        'The primary admin account cannot be deactivated or deleted',
      );
    }
    return target;
  }

  async setAdminActive(callerId: string, id: string, active: boolean) {
    await this.requireRoot(callerId);
    await this.getTarget(id);
    return this.prisma.adminUser.update({
      where: { id },
      data: { active },
      select: ADMIN_SELECT,
    });
  }

  async deleteAdmin(callerId: string, id: string) {
    await this.requireRoot(callerId);
    await this.getTarget(id);
    await this.prisma.adminUser.delete({ where: { id } });
    return { ok: true };
  }
}
