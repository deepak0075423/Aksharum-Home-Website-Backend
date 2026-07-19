import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../common/admin.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('stats')
@UseGuards(AdminGuard)
export class StatsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async stats() {
    const [
      pages,
      jobsOpen,
      jobsTotal,
      applications,
      applicationsNew,
      contacts,
      contactsNew,
      demos,
      demosNew,
      recentContacts,
      recentDemos,
      recentApplications,
    ] = await Promise.all([
      this.prisma.page.count(),
      this.prisma.job.count({ where: { status: 'OPEN' } }),
      this.prisma.job.count(),
      this.prisma.jobApplication.count(),
      this.prisma.jobApplication.count({ where: { status: 'NEW' } }),
      this.prisma.contactSubmission.count(),
      this.prisma.contactSubmission.count({ where: { status: 'NEW' } }),
      this.prisma.demoRequest.count(),
      this.prisma.demoRequest.count({ where: { status: 'NEW' } }),
      this.prisma.contactSubmission.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, school: true, createdAt: true, status: true },
      }),
      this.prisma.demoRequest.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, school: true, preferredDate: true, preferredSlot: true, createdAt: true, status: true },
      }),
      this.prisma.jobApplication.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, fullName: true, role: true, createdAt: true, status: true },
      }),
    ]);

    return {
      counts: {
        pages,
        jobsOpen,
        jobsTotal,
        applications,
        applicationsNew,
        contacts,
        contactsNew,
        demos,
        demosNew,
      },
      recent: {
        contacts: recentContacts,
        demos: recentDemos,
        applications: recentApplications,
      },
    };
  }
}
