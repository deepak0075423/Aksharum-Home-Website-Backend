import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BlogStatus, Prisma } from '@prisma/client';
import { Response } from 'express';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { diskStorage } from 'multer';
import { basename, extname, join } from 'path';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AdminGuard } from '../common/admin.guard';
import { PrismaService } from '../prisma/prisma.service';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif'];
mkdirSync(UPLOAD_DIR, { recursive: true });

const coverUpload = () =>
  FileInterceptor('file', {
    storage: diskStorage({
      destination: UPLOAD_DIR,
      filename: (_req, file, cb) =>
        cb(
          null,
          `blog-cover-${Date.now()}${extname(file.originalname).toLowerCase()}`,
        ),
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ok = IMAGE_EXT.includes(extname(file.originalname).toLowerCase());
      cb(
        ok ? null : new BadRequestException('Use a PNG, JPG, SVG, WEBP or GIF image'),
        ok,
      );
    },
  });

// Fields the public site is allowed to see. Drafts never leave the admin API.
const PUBLIC_FIELDS = {
  slug: true,
  title: true,
  excerpt: true,
  coverPath: true,
  coverAlt: true,
  author: true,
  tags: true,
  publishedAt: true,
  updatedAt: true,
} satisfies Prisma.BlogSelect;

class CreateBlogDto {
  @Matches(/^[a-z0-9][a-z0-9-]*$/, {
    message: 'Slug must be lowercase letters, numbers and dashes',
  })
  slug!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  excerpt?: string;

  @IsOptional()
  @IsString()
  bodyHtml?: string;

  @IsOptional()
  @IsEnum(BlogStatus)
  status?: BlogStatus;

  @IsOptional()
  @IsString()
  coverPath?: string;

  @IsOptional()
  @IsString()
  coverAlt?: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(12)
  tags?: string[];

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

class UpdateBlogDto {
  @IsOptional()
  @Matches(/^[a-z0-9][a-z0-9-]*$/, {
    message: 'Slug must be lowercase letters, numbers and dashes',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  excerpt?: string;

  @IsOptional()
  @IsString()
  bodyHtml?: string;

  @IsOptional()
  @IsEnum(BlogStatus)
  status?: BlogStatus;

  @IsOptional()
  @IsString()
  coverPath?: string;

  @IsOptional()
  @IsString()
  coverAlt?: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(12)
  tags?: string[];

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

@Controller('blogs')
export class BlogsController {
  constructor(private readonly prisma: PrismaService) {}

  // ── Public ──

  // Published posts, newest first — powers the listing page and the sitemap.
  @Get('public')
  listPublic() {
    return this.prisma.blog.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      select: PUBLIC_FIELDS,
    });
  }

  // Every tag in use, so the listing page can render its filter row.
  @Get('public/tags')
  async publicTags() {
    const rows = await this.prisma.blog.findMany({
      where: { status: 'PUBLISHED' },
      select: { tags: true },
    });
    const counts = new Map<string, number>();
    for (const tag of rows.flatMap((r) => r.tags)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }

  @Get('public/:slug')
  async getPublic(@Param('slug') slug: string) {
    const blog = await this.prisma.blog.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: {
        ...PUBLIC_FIELDS,
        bodyHtml: true,
        metaDescription: true,
        metaKeywords: true,
        ogImage: true,
        createdAt: true,
      },
    });
    if (!blog) throw new NotFoundException('Post not found');

    // Up to three more posts sharing a tag, for the "read next" strip.
    const related = await this.prisma.blog.findMany({
      where: {
        status: 'PUBLISHED',
        slug: { not: slug },
        ...(blog.tags.length ? { tags: { hasSome: blog.tags } } : {}),
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 3,
      select: PUBLIC_FIELDS,
    });

    return { ...blog, related };
  }

  // Cover images. Filenames are generated by the upload handler, but this
  // route is public — basename() keeps a crafted slug from escaping uploads/.
  @Get('cover/:file')
  cover(@Param('file') file: string, @Res() res: Response) {
    const path = join(UPLOAD_DIR, basename(file));
    if (!existsSync(path)) throw new NotFoundException('Image not found');
    res.sendFile(path);
  }

  // ── Admin ──

  @Get('all')
  @UseGuards(AdminGuard)
  listAll() {
    return this.prisma.blog.findMany({
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  @Post('cover')
  @UseGuards(AdminGuard)
  @UseInterceptors(coverUpload())
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return { coverPath: file.filename, url: `/api/blogs/cover/${file.filename}` };
  }

  @Post()
  @UseGuards(AdminGuard)
  async create(@Body() dto: CreateBlogDto) {
    await this.assertSlugFree(dto.slug);
    return this.prisma.blog.create({
      data: {
        ...dto,
        // Publishing straight from the create form still needs a date.
        publishedAt: dto.status === 'PUBLISHED' ? new Date() : null,
      },
    });
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  async update(@Param('id') id: string, @Body() dto: UpdateBlogDto) {
    const blog = await this.prisma.blog.findUnique({ where: { id } });
    if (!blog) throw new NotFoundException('Post not found');
    if (dto.slug && dto.slug !== blog.slug) await this.assertSlugFree(dto.slug);

    // Stamp publishedAt on the first publish only — later edits keep the
    // original date so the public ordering stays stable.
    const firstPublish =
      dto.status === 'PUBLISHED' && !blog.publishedAt ? new Date() : undefined;

    // A replaced cover leaves the old file orphaned otherwise.
    if (dto.coverPath !== undefined && blog.coverPath && dto.coverPath !== blog.coverPath) {
      this.removeFile(blog.coverPath);
    }

    return this.prisma.blog.update({
      where: { id },
      data: { ...dto, ...(firstPublish ? { publishedAt: firstPublish } : {}) },
    });
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  async remove(@Param('id') id: string) {
    const blog = await this.prisma.blog.findUnique({ where: { id } });
    if (!blog) throw new NotFoundException('Post not found');
    if (blog.coverPath) this.removeFile(blog.coverPath);
    await this.prisma.blog.delete({ where: { id } });
    return { ok: true };
  }

  private async assertSlugFree(slug: string) {
    const clash = await this.prisma.blog.findUnique({ where: { slug } });
    if (clash) throw new BadRequestException(`Slug "${slug}" is already used`);
  }

  private removeFile(filename: string) {
    const path = join(UPLOAD_DIR, basename(filename));
    if (existsSync(path)) unlinkSync(path);
  }
}
