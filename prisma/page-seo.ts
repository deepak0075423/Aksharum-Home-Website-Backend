/**
 * Curated per-page SEO metadata (meta description + keywords), targeted at
 * "school ERP" / "school management software" search intent.
 *
 * Shared by the seed (fresh installs) and the update-seo migration
 * (populating pages that were seeded before SEO copy existed).
 *
 * Titles lead with the search phrase ("School ERP …") and keep the brand
 * last, staying near 60 chars so Google shows them whole; the part before
 * " — " doubles as the page's breadcrumb label. Descriptions are kept
 * ~150-160 chars — the range Google renders without truncation. Keywords
 * stay tightly on-topic; admins can override any of this later from the
 * panel (Admin -> Pages -> SEO).
 */
export interface PageSeo {
  title?: string;
  metaDescription: string;
  metaKeywords: string;
}

// Pages that should never be indexed (no useful SEO copy either).
export const NOINDEX_SLUGS = ['auth', '404', '403'] as const;

export const PAGE_SEO: Record<string, PageSeo> = {
  home: {
    title: 'School ERP Software & School Management System | Aksharum',
    metaDescription:
      'Aksharum is a cloud school ERP and school management system for Indian schools: admissions, attendance, fees, exams, report cards and parent communication.',
    metaKeywords:
      'school ERP, school ERP software, school management software, school management system, best school ERP in India, student information system, school administration software, education ERP',
  },
  about: {
    title: 'About Aksharum — Cloud School ERP Built in India',
    metaDescription:
      'Aksharum builds cloud school ERP software in India, helping schools of every size run admissions, academics, fees and communication on one platform.',
    metaKeywords:
      'about Aksharum, school ERP company, school management software company, education technology, edtech India, school software provider',
  },
  services: {
    title: 'School Management System — Dashboards for Every Role | Aksharum',
    metaDescription:
      'One school management system with a dashboard for every role — admins, principals, teachers, parents and students. Secure, modular and live in a day.',
    metaKeywords:
      'school management system, school ERP services, school admin dashboard, teacher dashboard, parent portal, student portal, school management services',
  },
  features: {
    title: 'School ERP Features — Attendance, Fees, Exams & More | Aksharum',
    metaDescription:
      "Explore Aksharum's school ERP modules: one-tap attendance, online fee collection, exams and report cards, timetables, bus tracking, library, HR and payroll.",
    metaKeywords:
      'school ERP features, school ERP modules, online fee collection, student attendance software, exam and report card software, timetable software, school bus tracking, school HR and payroll',
  },
  contact: {
    title: 'Contact Aksharum — School ERP Demo, Pricing & Support',
    metaDescription:
      'Talk to Aksharum about school ERP pricing, a live demo, onboarding or support. Our team replies within 24 hours, Monday to Saturday.',
    metaKeywords:
      'contact Aksharum, school ERP demo, school ERP pricing, school management software pricing, school software support',
  },
  career: {
    title: 'Careers at Aksharum — EdTech & School ERP Jobs in India',
    metaDescription:
      'Careers at Aksharum: remote-friendly edtech and school ERP jobs in India across engineering, design, QA, marketing and customer success. Apply today.',
    metaKeywords:
      'Aksharum careers, Aksharum jobs, edtech jobs India, school ERP jobs, remote edtech jobs, edtech internships, software jobs Kolkata, software jobs Mumbai',
  },
  demo: {
    title: 'Book a Free School ERP Demo | Aksharum',
    metaDescription:
      'Book a free 30-minute live demo of Aksharum school ERP on Google Meet and see admissions, attendance, fees, exams and parent communication for your school.',
    metaKeywords:
      'book school ERP demo, free school ERP demo, school management software demo, school ERP trial, request demo',
  },
  privacy: {
    metaDescription:
      'Read the Aksharum privacy policy to understand how we collect, use and protect data across our school ERP and school management platform.',
    metaKeywords:
      'Aksharum privacy policy, school ERP data privacy, student data protection, education software privacy',
  },
  terms: {
    metaDescription:
      'Review the Aksharum Terms of Use governing access to and use of our school ERP and school management software and services.',
    metaKeywords:
      'Aksharum terms of use, school ERP terms, school software terms, software terms and conditions',
  },
  'terms-conditions': {
    metaDescription:
      'Read the Aksharum Terms & Conditions covering use of our school management software, subscriptions and services.',
    metaKeywords:
      'Aksharum terms and conditions, school ERP agreement, school software subscription terms',
  },
};
