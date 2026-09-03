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
  Query,
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

// Admin table columns. bodyHtml is deliberately absent — a page of posts
// would otherwise ship every rich-text body; the editor fetches the one
// post it opens from GET /blogs/:id instead.
const LIST_FIELDS = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  status: true,
  coverPath: true,
  coverAlt: true,
  author: true,
  tags: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BlogSelect;

const MAX_PAGE_SIZE = 60;

/** Page and limit are both 1-based, so junk and non-positive input alike
    fall back to the default rather than clamping to a nonsense 1. */
function toInt(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

/** "Fees, Admissions" -> ['Fees', 'Admissions'] */
function splitTags(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 12);
}

/**
 * Commas separate tags, so "Fees, Admissions" is two tags and never one.
 * The editor's picker already splits them; doing it here as well means no
 * client can write a comma into a stored tag. Also trims, drops blanks and
 * de-duplicates case-insensitively.
 */
function normaliseTags(tags: string[] | undefined): string[] | undefined {
  if (!tags) return undefined;
  const out: string[] = [];
  for (const part of tags.flatMap((t) => t.split(','))) {
    const tag = part.trim();
    if (tag && !out.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      out.push(tag);
    }
  }
  return out.slice(0, 12);
}

/** Tag usage counts, most-used first, ties broken alphabetically. */
function countTags(rows: { tags: string[] }[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const tag of rows.flatMap((r) => r.tags)) {
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

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
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      select: PUBLIC_FIELDS,
    });
  }

  // One page of published posts, filtered by tag and free text. The listing
  // page reads this instead of `public` so the payload stays flat as the
  // archive grows; `public` still returns everything for the sitemap.
  @Get('public/list')
  async listPublicPage(
    @Query('page') pageParam?: string,
    @Query('limit') limitParam?: string,
    @Query('tags') tagsParam?: string,
    @Query('q') q?: string,
  ) {
    const limit = clamp(toInt(limitParam, 12), 1, MAX_PAGE_SIZE);
    const tags = splitTags(tagsParam);
    const search = (q ?? '').trim();

    const where: Prisma.BlogWhereInput = {
      status: 'PUBLISHED',
      // Any of the picked tags — narrowing to posts carrying all of them
      // empties the grid as soon as a second tag is ticked.
      ...(tags.length ? { tags: { hasSome: tags } } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { excerpt: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const total = await this.prisma.blog.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / limit));
    // Clamped, so ?page=99 lands on the last page rather than an empty grid.
    const page = clamp(toInt(pageParam, 1), 1, totalPages);

    const items = await this.prisma.blog.findMany({
      where,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      select: PUBLIC_FIELDS,
    });

    return { items, total, page, limit, totalPages };
  }

  // Every tag in use, so the listing page can render its filter row.
  @Get('public/tags')
  async publicTags() {
    const rows = await this.prisma.blog.findMany({
      where: { status: 'PUBLISHED' },
      select: { tags: true },
    });
    return countTags(rows);
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
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
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

  // One page of the admin table. Drafts included, bodyHtml excluded.
  @Get('all')
  @UseGuards(AdminGuard)
  async listAll(
    @Query('page') pageParam?: string,
    @Query('limit') limitParam?: string,
    @Query('q') q?: string,
    @Query('status') statusParam?: string,
  ) {
    const limit = clamp(toInt(limitParam, 10), 1, MAX_PAGE_SIZE);
    const search = (q ?? '').trim();
    const status =
      statusParam === 'DRAFT' || statusParam === 'PUBLISHED'
        ? (statusParam as BlogStatus)
        : undefined;

    const where: Prisma.BlogWhereInput = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
              { author: { contains: search, mode: 'insensitive' } },
              { tags: { has: search } },
            ],
          }
        : {}),
    };

    const total = await this.prisma.blog.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const page = clamp(toInt(pageParam, 1), 1, totalPages);

    const items = await this.prisma.blog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      select: LIST_FIELDS,
    });

    return { items, total, page, limit, totalPages };
  }

  // Tag catalogue for the editor's tag picker — drafts included, so a tag
  // coined on an unpublished post is still suggested on the next one.
  @Get('tags')
  @UseGuards(AdminGuard)
  async allTags() {
    const rows = await this.prisma.blog.findMany({ select: { tags: true } });
    return countTags(rows);
  }

  // The editor loads the post it is about to open — this is the only place
  // bodyHtml crosses the wire, keeping the table's payload small.
  @Get(':id')
  @UseGuards(AdminGuard)
  async getOne(@Param('id') id: string) {
    const blog = await this.prisma.blog.findUnique({ where: { id } });
    if (!blog) throw new NotFoundException('Post not found');
    return blog;
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
    const tags = normaliseTags(dto.tags);
    return this.prisma.blog.create({
      data: {
        ...dto,
        ...(tags ? { tags } : {}),
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

    const tags = normaliseTags(dto.tags);

    return this.prisma.blog.update({
      where: { id },
      data: {
        ...dto,
        ...(tags ? { tags } : {}),
        ...(firstPublish ? { publishedAt: firstPublish } : {}),
      },
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
