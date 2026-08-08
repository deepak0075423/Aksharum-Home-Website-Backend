import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PagesModule } from './pages/pages.module';
import { JobsModule } from './jobs/jobs.module';
import { BlogsModule } from './blogs/blogs.module';
import { ApplicationsModule } from './applications/applications.module';
import { ContactModule } from './contact/contact.module';
import { DemoModule } from './demo/demo.module';
import { LayoutModule } from './layout/layout.module';
import { SettingsModule } from './settings/settings.module';
import { MailModule } from './mail/mail.module';
import { StatsModule } from './stats/stats.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      signOptions: { expiresIn: '7d' },
    }),
    PrismaModule,
    MailModule,
    AuthModule,
    LayoutModule,
    PagesModule,
    JobsModule,
    BlogsModule,
    ApplicationsModule,
    ContactModule,
    DemoModule,
    SettingsModule,
    StatsModule,
  ],
})
export class AppModule {}
