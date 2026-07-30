import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PagesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.page.findMany({
      select: { id: true, slug: true, title: true, updatedAt: true },
      orderBy: { slug: 'asc' },
    });
  }

  // Public: indexable pages for the sitemap. Login and error pages are
  // excluded — they carry noindex and should never appear in search.
  listPublic() {
    return this.prisma.page.findMany({
      where: { slug: { notIn: ['auth', '404', '403'] } },
      select: { slug: true, updatedAt: true },
      orderBy: { slug: 'asc' },
    });
  }

  async getBySlug(slug: string) {
    const page = await this.prisma.page.findUnique({ where: { slug } });
    if (!page) throw new NotFoundException(`Page "${slug}" not found`);
    return page;
  }

  async create(data: {
    slug: string;
    title: string;
    bodyHtml: string;
    cssLinks?: string[];
    fontLinks?: string[];
    scripts?: string[];
    showLayout?: boolean;
    metaDescription?: string;
    metaKeywords?: string;
    ogImage?: string;
  }) {
    const existing = await this.prisma.page.findUnique({
      where: { slug: data.slug },
    });
    if (existing) throw new ConflictException(`Page "${data.slug}" already exists`);
    return this.prisma.page.create({
      data: {
        slug: data.slug,
        title: data.title,
        bodyHtml: data.bodyHtml,
        cssLinks: data.cssLinks ?? [],
        fontLinks: data.fontLinks ?? [],
        scripts: data.scripts ?? [],
        showLayout: data.showLayout ?? true,
        metaDescription: data.metaDescription ?? '',
        metaKeywords: data.metaKeywords ?? '',
        ogImage: data.ogImage ?? '',
      },
    });
  }

  async update(
    slug: string,
    data: Partial<{
      title: string;
      bodyHtml: string;
      cssLinks: string[];
      fontLinks: string[];
      scripts: string[];
      showLayout: boolean;
      navStyle: string;
      metaDescription: string;
      metaKeywords: string;
      ogImage: string;
    }>,
  ) {
    await this.getBySlug(slug);
    return this.prisma.page.update({ where: { slug }, data });
  }

  async remove(slug: string) {
    await this.getBySlug(slug);
    await this.prisma.page.delete({ where: { slug } });
    return { ok: true };
  }
}
