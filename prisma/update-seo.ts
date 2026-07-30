/**
 * One-off migration: populates SEO copy (meta description + keywords) on
 * pages that were seeded before the curated SEO map existed, and clears the
 * broken "https://example.com" OG placeholder left on the career page.
 *
 * Idempotent and non-destructive: only fills a field when it is currently
 * empty, so any SEO text an admin has already customised is left untouched.
 *
 * Run with: npx ts-node prisma/update-seo.ts
 */
import { PrismaClient } from '@prisma/client';
import { PAGE_SEO } from './page-seo';

const prisma = new PrismaClient();

async function main() {
  let updated = 0;

  for (const [slug, seo] of Object.entries(PAGE_SEO)) {
    const page = await prisma.page.findUnique({ where: { slug } });
    if (!page) {
      console.log(`page "${slug}" not found — skipped`);
      continue;
    }

    const data: {
      metaDescription?: string;
      metaKeywords?: string;
      ogImage?: string;
    } = {};

    if (!page.metaDescription.trim()) data.metaDescription = seo.metaDescription;
    if (!page.metaKeywords.trim()) data.metaKeywords = seo.metaKeywords;
    // The site now serves a branded default OG image; drop stale placeholders
    // so pages fall back to it instead of pointing at example.com.
    if (page.ogImage.includes('example.com')) data.ogImage = '';

    if (Object.keys(data).length === 0) {
      console.log(`page "${slug}" already has SEO — skipped`);
      continue;
    }

    await prisma.page.update({ where: { slug }, data });
    console.log(`page "${slug}" SEO updated: ${Object.keys(data).join(', ')}`);
    updated++;
  }

  console.log(`\ndone — ${updated} page(s) updated`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
