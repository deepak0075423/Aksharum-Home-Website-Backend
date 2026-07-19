/**
 * Seeds the database from the original static site:
 *  - every HTML page (backend/seed-assets/*.html) becomes a Page row,
 *    with links/assets rewritten to the new routes — markup is otherwise untouched
 *  - the five job roles from career.html become Job rows
 *  - the initial admin user (ADMIN_EMAIL / ADMIN_PASSWORD env vars)
 *  - default site + SMTP settings
 *
 * Safe to re-run: existing rows are never overwritten.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as cheerio from 'cheerio';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ERROR_PAGE_CSS,
  ERROR_PAGE_FONTS,
  ERROR_PAGE_SCRIPTS,
  ERROR_PAGES,
} from './error-pages';
import {
  DEFAULT_BRANDING,
  extractSharedLayout,
  rewriteInternalLinks,
  stripLayoutFromBody,
} from './layout-extract';

const prisma = new PrismaClient();
const ASSETS = join(__dirname, '..', 'seed-assets');

const PAGE_FILES: Record<string, string> = {
  'index.html': 'home',
  'about.html': 'about',
  'services.html': 'services',
  'features.html': 'features',
  'contact.html': 'contact',
  'career.html': 'career',
  'demo.html': 'demo',
  'auth.html': 'auth',
  'privacy.html': 'privacy',
  'terms.html': 'terms',
  'terms&conditions.html': 'terms-conditions',
};

function parsePage(file: string) {
  const html = readFileSync(join(ASSETS, file), 'utf8');
  const $ = cheerio.load(html);

  const title = $('title').text().trim() || 'Aksharum';

  const cssLinks: string[] = [];
  const fontLinks: string[] = [];
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (!href) return;
    if (/^https?:\/\//.test(href)) fontLinks.push(href);
    else cssLinks.push('/' + href.replace(/^\.?\//, ''));
  });

  // All external scripts in document order (CDN libs, then page scripts)
  const scripts: string[] = [];
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src') ?? '';
    if (!src) return;
    scripts.push(/^https?:\/\//.test(src) ? src : '/' + src.replace(/^\.?\//, ''));
  });

  // Scripts are re-injected by the frontend loader; innerHTML'd tags never run
  $('body script').remove();

  rewriteInternalLinks($);

  // Header/footer live once in the shared layout — pages keep content only
  const { hadLayout, navStyle } = stripLayoutFromBody($);

  return {
    title,
    cssLinks,
    fontLinks,
    scripts,
    bodyHtml: $('body').html() ?? '',
    showLayout: hadLayout,
    navStyle,
  };
}

const SEED_JOBS = [
  { title: 'Full-Stack Engineer (Node.js / Express)', department: 'Engineering', location: 'Remote · India', type: 'Full-time', sortOrder: 1 },
  { title: 'Product Designer (UI/UX)', department: 'Design', location: 'Remote · India', type: 'Full-time', sortOrder: 2 },
  { title: 'Software Testing Engineer', department: 'QA', location: 'Remote · India', type: 'Full-time', sortOrder: 3 },
  { title: 'School Success Manager (Onboarding & Support)', department: 'Customer Success', location: 'Remote · India', type: 'Full-time', sortOrder: 4 },
  { title: 'Growth & Marketing Lead', department: 'Marketing', location: 'Remote · India', type: 'Full-time', sortOrder: 5 },
];

async function main() {
  // Pages
  for (const [file, slug] of Object.entries(PAGE_FILES)) {
    const existing = await prisma.page.findUnique({ where: { slug } });
    if (existing) {
      console.log(`page "${slug}" exists — skipped`);
      continue;
    }
    const data = parsePage(file);
    await prisma.page.create({ data: { slug, ...data } });
    console.log(`page "${slug}" seeded from ${file}`);
  }

  // Editable error pages (404, 403)
  for (const ep of ERROR_PAGES) {
    if (await prisma.page.findUnique({ where: { slug: ep.slug } })) {
      console.log(`page "${ep.slug}" exists — skipped`);
      continue;
    }
    await prisma.page.create({
      data: {
        slug: ep.slug,
        title: ep.title,
        bodyHtml: ep.bodyHtml,
        cssLinks: ERROR_PAGE_CSS,
        fontLinks: ERROR_PAGE_FONTS,
        scripts: ERROR_PAGE_SCRIPTS,
        showLayout: true,
        metaDescription: ep.metaDescription,
      },
    });
    console.log(`page "${ep.slug}" (error page) seeded`);
  }

  // Jobs
  if ((await prisma.job.count()) === 0) {
    await prisma.job.createMany({ data: SEED_JOBS });
    console.log(`${SEED_JOBS.length} jobs seeded`);
  } else {
    console.log('jobs exist — skipped');
  }

  // Admin user
  const email = (process.env.ADMIN_EMAIL ?? 'admin@aksharum.in').toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? 'Aksharum@2026';
  if (!(await prisma.adminUser.findUnique({ where: { email } }))) {
    await prisma.adminUser.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 10),
        name: 'Admin',
        isRoot: true,
      },
    });
    console.log(`primary admin created: ${email} (password from ADMIN_PASSWORD env)`);
  } else {
    console.log(`admin user ${email} exists — skipped`);
  }

  // Shared header/footer layout + branding + social links
  const extracted = extractSharedLayout(
    readFileSync(join(ASSETS, 'career.html'), 'utf8'),
    readFileSync(join(ASSETS, 'index.html'), 'utf8'),
  );
  if (!(await prisma.setting.findUnique({ where: { key: 'layout' } }))) {
    await prisma.setting.create({
      data: {
        key: 'layout',
        value: {
          headerHtml: extracted.headerHtml,
          footerHtml: extracted.footerHtml,
        },
      },
    });
    console.log('shared header/footer layout seeded');
  }
  if (!(await prisma.setting.findUnique({ where: { key: 'social' } }))) {
    await prisma.setting.create({
      data: {
        key: 'social',
        value: JSON.parse(JSON.stringify({ links: extracted.socialLinks })),
      },
    });
    console.log(`${extracted.socialLinks.length} social links seeded`);
  }
  if (!(await prisma.setting.findUnique({ where: { key: 'branding' } }))) {
    await prisma.setting.create({
      data: { key: 'branding', value: DEFAULT_BRANDING },
    });
    console.log('branding settings seeded');
  }

  // Settings
  if (!(await prisma.setting.findUnique({ where: { key: 'site' } }))) {
    await prisma.setting.create({
      data: {
        key: 'site',
        value: {
          careersOpen: true,
          careersClosedMessage:
            'We are not accepting applications right now. Please check back soon!',
        },
      },
    });
    console.log('site settings seeded');
  }
  if (!(await prisma.setting.findUnique({ where: { key: 'smtp' } }))) {
    await prisma.setting.create({
      data: {
        key: 'smtp',
        value: {
          enabled: false,
          host: '',
          port: 587,
          secure: false,
          user: '',
          pass: '',
          fromName: 'Aksharum',
          fromEmail: '',
          notifyTo: '',
        },
      },
    });
    console.log('smtp settings seeded (disabled until configured in admin)');
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
