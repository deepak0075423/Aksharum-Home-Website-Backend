import { Module } from '@nestjs/common';
import { LayoutModule } from '../layout/layout.module';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';

@Module({
  imports: [LayoutModule],
  controllers: [PagesController],
  providers: [PagesService],
})
export class PagesModule {}
