/**
 * One-off migration for databases seeded before the shared-layout feature:
 * strips the duplicated header/footer out of every Page.bodyHtml (recording
 * each page's inline <nav> style and whether it had the chrome at all) and
 * creates the "layout" + "branding" settings.
 *
 * Idempotent — pages already stripped and existing settings are left alone.
 *
 * Run with: npx ts-node prisma/migrate-layout.ts
 */
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  DEFAULT_BRANDING,
  extractSharedLayout,
  stripLayoutFromBody,
} from './layout-extract';

const prisma = new PrismaClient();
const ASSETS = join(__dirname, '..', 'seed-assets');

async function main() {
  const pages = await prisma.page.findMany();
  for (const page of pages) {
    const $ = cheerio.load(page.bodyHtml, null, false);
    const hasChrome = $('#nav').length > 0 || $('footer').length > 0;
    if (!hasChrome) {
      // Already stripped, or a standalone page like /auth — record the flag
      // only if this page never had the chrome AND still claims showLayout
      // from the schema default.
      if (page.slug === 'auth' && page.showLayout) {
        await prisma.page.update({
          where: { id: page.id },
          data: { showLayout: false },
        });
        console.log(`page "${page.slug}": standalone (no header/footer)`);
      }
      continue;
    }
    const { navStyle } = stripLayoutFromBody($);
    await prisma.page.update({
      where: { id: page.id },
      data: { bodyHtml: $.html(), showLayout: true, navStyle },
    });
    console.log(
      `page "${page.slug}": header/footer stripped${navStyle ? ' (nav style kept)' : ''}`,
    );
  }

  if (!(await prisma.setting.findUnique({ where: { key: 'layout' } }))) {
    const { headerHtml, footerHtml } = extractSharedLayout(
      readFileSync(join(ASSETS, 'career.html'), 'utf8'),
      readFileSync(join(ASSETS, 'index.html'), 'utf8'),
    );
    await prisma.setting.create({
      data: { key: 'layout', value: { headerHtml, footerHtml } },
    });
    console.log('shared header/footer layout created');
  }
  if (!(await prisma.setting.findUnique({ where: { key: 'branding' } }))) {
    await prisma.setting.create({
      data: { key: 'branding', value: DEFAULT_BRANDING },
    });
    console.log('branding settings created');
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
