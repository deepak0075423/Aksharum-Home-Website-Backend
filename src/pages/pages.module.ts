import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { LayoutModule } from '../layout/layout.module';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';

@Module({
  imports: [LayoutModule, JobsModule],
  controllers: [PagesController],
  providers: [PagesService],
})
export class PagesModule {}
