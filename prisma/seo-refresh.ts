/**
 * One-off migration: moves the core pages onto the current SEO copy in
 * page-seo.ts — search-led titles, refreshed meta descriptions and keywords —
 * puts "School ERP" in the home page's <h1>, and replaces the placeholder
 * phone number that shipped on the demo page.
 *
 * Idempotent and non-destructive. A field is only rewritten while it still
 * holds a known earlier default (or is empty), so anything an admin has
 * customised in the panel is left untouched; the HTML edits only apply when
 * the exact original markup is still there. Safe to run more than once.
 *
 * Run with: npm run seo:refresh   (or: npx ts-node prisma/seo-refresh.ts)
 */
import { PrismaClient } from '@prisma/client';
import { PAGE_SEO } from './page-seo';

const prisma = new PrismaClient();

// Titles the pages have carried before — from the original HTML <title>
// tags and from early admin edits. Only these are replaced.
const LEGACY_TITLES: Record<string, string[]> = {
  home: ['Aksharum — The Modern School ERP', 'Aksharum'],
  features: ['Features — School 2.0', 'Features', 'Features — Aksharum'],
  services: ['Services — Aksharum', 'Services'],
  about: ['About — Aksharum', 'About', 'About Us — Aksharum'],
  career: ['Careers - Aksharum', 'Careers — Aksharum', 'Careers'],
  contact: ['Contact Us — Aksharum', 'Contact', 'Contact — Aksharum'],
  demo: ['Book Demo — Aksharum', 'Book Demo', 'Book a Demo — Aksharum'],
};

// The previous curated copy (page-seo.ts before this migration). A page still
// carrying it gets the new version; a page with custom copy keeps its own.
const PREVIOUS_DESCRIPTIONS: Record<string, string> = {
  home: 'Aksharum is a modern school ERP that unifies admissions, attendance, fees, exams, timetables and parent communication in one secure platform. Book a free demo.',
  about:
    'Meet Aksharum — the team building modern school ERP software that helps institutions digitise admissions, academics, fees and communication. Discover our mission.',
  services:
    'Explore Aksharum school ERP services: student information systems, fee management, attendance, exams and report cards, timetables and parent-teacher communication.',
  features:
    'Discover Aksharum school ERP features: admissions, attendance, online fee collection, exams and grading, timetables, transport, library, HR and parent communication.',
  contact:
    'Contact Aksharum to see how our school ERP software streamlines your institution. Reach our team for demos, pricing, onboarding and support.',
  career:
    'Join Aksharum and help build the school ERP shaping the future of education. Explore open roles in engineering, design, QA, customer success and marketing.',
  demo: 'Book a free, personalised demo of Aksharum school ERP. See how our school management software simplifies admissions, fees, attendance, exams and communication.',
};

const PREVIOUS_KEYWORDS: Record<string, string> = {
  home: 'school ERP, school management software, school management system, student information system, school administration software, education ERP, online school software',
  about:
    'about Aksharum, school ERP company, school management software company, education technology, edtech India, school software provider',
  services:
    'school ERP services, school management services, student information system, fee management software, attendance management, exam management software',
  features:
    'school ERP features, school management system features, online fee collection, student attendance software, exam and grading system, timetable software, school transport management',
  contact:
    'contact Aksharum, school ERP demo, school management software pricing, school software support, school ERP contact',
  career:
    'Aksharum careers, edtech jobs, school ERP jobs, software jobs India, remote edtech careers, school software company jobs',
  demo: 'book school ERP demo, free school management software demo, school ERP trial, request demo, school software demo',
};

// Exact-markup body edits: [slug, description, original, replacement].
const BODY_EDITS: [string, string, RegExp, string][] = [
  [
    'home',
    'hero <h1> now names the product category ("School ERP")',
    /(<h1 id="h-title">\s*)The Operating<br>System for <br>Modern <em>Schools\.<\/em>/,
    '$1The School ERP<br>Built for <br>Modern <em>Schools.</em>',
  ],
  [
    'demo',
    'placeholder phone "+91 98765 43210" replaced with the contact-page number',
    /<span>\+91 98765 43210<\/span>/g,
    '<span>+91 7595963707</span>',
  ],
];

async function main() {
  let updated = 0;

  for (const [slug, seo] of Object.entries(PAGE_SEO)) {
    const page = await prisma.page.findUnique({ where: { slug } });
    if (!page) {
      console.log(`page "${slug}" not found — skipped`);
      continue;
    }

    const data: { title?: string; metaDescription?: string; metaKeywords?: string; bodyHtml?: string } = {};
    const notes: string[] = [];

    if (seo.title && page.title !== seo.title && (LEGACY_TITLES[slug] ?? []).includes(page.title.trim())) {
      data.title = seo.title;
      notes.push(`title "${page.title}" -> "${seo.title}"`);
    }

    const desc = page.metaDescription.trim();
    if (desc !== seo.metaDescription && (!desc || desc === PREVIOUS_DESCRIPTIONS[slug])) {
      data.metaDescription = seo.metaDescription;
      notes.push('meta description');
    }

    const keys = page.metaKeywords.trim();
    if (keys !== seo.metaKeywords && (!keys || keys === PREVIOUS_KEYWORDS[slug])) {
      data.metaKeywords = seo.metaKeywords;
      notes.push('meta keywords');
    }

    let body = page.bodyHtml;
    for (const [editSlug, label, pattern, replacement] of BODY_EDITS) {
      if (editSlug !== slug) continue;
      const next = body.replace(pattern, replacement);
      if (next !== body) {
        body = next;
        notes.push(label);
      }
    }
    if (body !== page.bodyHtml) data.bodyHtml = body;

    if (notes.length === 0) {
      console.log(`page "${slug}" — nothing to change (already current or customised)`);
      continue;
    }

    await prisma.page.update({ where: { slug }, data });
    console.log(`page "${slug}" updated:\n  - ${notes.join('\n  - ')}`);
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
