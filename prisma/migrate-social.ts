/**
 * One-off migration: turns the hardcoded social links inside the stored
 * shared footer into managed data — the links move into the "social"
 * setting and the footer keeps a {{SOCIAL_LINKS}} token where they were.
 * Rendered output stays identical.
 *
 * Idempotent: skips if the footer already carries the token.
 *
 * Run with: npx ts-node prisma/migrate-social.ts
 */
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import { tokenizeSocialColumn } from './layout-extract';

const prisma = new PrismaClient();

async function main() {
  const row = await prisma.setting.findUnique({ where: { key: 'layout' } });
  const layout = (row?.value as { headerHtml?: string; footerHtml?: string }) ?? {};
  const footerHtml = layout.footerHtml ?? '';

  if (!footerHtml) {
    console.log('no stored footer — run seed/migrate-layout first');
    return;
  }
  if (footerHtml.includes('{{SOCIAL_LINKS}}')) {
    console.log('footer already tokenized — nothing to do');
    return;
  }

  const $ = cheerio.load(footerHtml, null, false);
  const links = tokenizeSocialColumn($);
  if (!links.length) {
    console.log('no social column found in footer — nothing to do');
    return;
  }

  await prisma.setting.update({
    where: { key: 'layout' },
    data: { value: { ...layout, footerHtml: $.html() } },
  });
  console.log('footer social column tokenized');

  if (!(await prisma.setting.findUnique({ where: { key: 'social' } }))) {
    await prisma.setting.create({
      data: { key: 'social', value: JSON.parse(JSON.stringify({ links })) },
    });
    console.log(
      `${links.length} social links migrated: ${links.map((l) => l.label).join(', ')}`,
    );
  } else {
    console.log('social setting already exists — links left untouched');
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
