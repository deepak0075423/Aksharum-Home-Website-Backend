import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { AdminGuard } from '../common/admin.guard';
import { replaceRolesGrid, roleRowsHtml } from '../jobs/career-roles';
import { JobsService } from '../jobs/jobs.service';
import { LayoutService } from '../layout/layout.service';
import { PagesService } from './pages.service';

class CreatePageDto {
  @Matches(/^[a-z0-9][a-z0-9-]*$/, {
    message: 'Slug must be lowercase letters, numbers and dashes',
  })
  slug!: string;

  @IsString()
  title!: string;

  @IsString()
  bodyHtml!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cssLinks?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fontLinks?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scripts?: string[];

  @IsOptional()
  @IsBoolean()
  showLayout?: boolean;

  @IsOptional()
  @IsString()
  metaDescription?: string;

  @IsOptional()
  @IsString()
  metaKeywords?: string;

  @IsOptional()
  @IsString()
  ogImage?: string;
}

class UpdatePageDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  bodyHtml?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cssLinks?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fontLinks?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scripts?: string[];

  @IsOptional()
  @IsBoolean()
  showLayout?: boolean;

  @IsOptional()
  @IsString()
  navStyle?: string;

  @IsOptional()
  @IsString()
  metaDescription?: string;

  @IsOptional()
  @IsString()
  metaKeywords?: string;

  @IsOptional()
  @IsString()
  ogImage?: string;
}

@Controller('pages')
export class PagesController {
  constructor(
    private readonly pages: PagesService,
    private readonly layout: LayoutService,
    private readonly jobs: JobsService,
  ) {}

  // Public: indexable page slugs + last-modified, used to build the sitemap.
  // Declared before the ":slug" route so "public" isn't captured as a slug.
  @Get('public')
  listPublic() {
    return this.pages.listPublic();
  }

  // Public: used by the Next.js frontend to render the site —
  // page content plus the shared header/footer composed for this page
  @Get('public/:slug')
  async getPublic(@Param('slug') slug: string) {
    const page = await this.pages.getBySlug(slug);
    const composed = await this.layout.compose(page);
    // The career page's role list is live data: render the current roles
    // (each linking to its own job page) into the HTML crawlers receive,
    // instead of the static rows saved with the page. Public render only —
    // the admin editor reads the stored body through GET /pages/:slug.
    const bodyHtml =
      slug === 'career'
        ? replaceRolesGrid(page.bodyHtml, roleRowsHtml(await this.jobs.listPublic()))
        : page.bodyHtml;
    return { ...page, bodyHtml, ...composed };
  }

  @Get()
  @UseGuards(AdminGuard)
  list() {
    return this.pages.list();
  }

  @Get(':slug')
  @UseGuards(AdminGuard)
  get(@Param('slug') slug: string) {
    return this.pages.getBySlug(slug);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreatePageDto) {
    return this.pages.create(dto);
  }

  @Put(':slug')
  @UseGuards(AdminGuard)
  update(@Param('slug') slug: string, @Body() dto: UpdatePageDto) {
    return this.pages.update(slug, dto);
  }

  @Delete(':slug')
  @UseGuards(AdminGuard)
  remove(@Param('slug') slug: string) {
    return this.pages.remove(slug);
  }
}
