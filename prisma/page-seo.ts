/**
 * Curated per-page SEO metadata (meta description + keywords), targeted at
 * "school ERP" / "school management software" search intent.
 *
 * Shared by the seed (fresh installs) and the update-seo migration
 * (populating pages that were seeded before SEO copy existed).
 *
 * Descriptions are kept ~150-160 chars — the range Google renders without
 * truncation. Keywords stay tightly on-topic; admins can override any of
 * this later from the panel (Admin -> Pages -> SEO).
 */
export interface PageSeo {
  metaDescription: string;
  metaKeywords: string;
}

// Pages that should never be indexed (no useful SEO copy either).
export const NOINDEX_SLUGS = ['auth', '404', '403'] as const;

export const PAGE_SEO: Record<string, PageSeo> = {
  home: {
    metaDescription:
      'Aksharum is a modern school ERP that unifies admissions, attendance, fees, exams, timetables and parent communication in one secure platform. Book a free demo.',
    metaKeywords:
      'school ERP, school management software, school management system, student information system, school administration software, education ERP, online school software',
  },
  about: {
    metaDescription:
      'Meet Aksharum — the team building modern school ERP software that helps institutions digitise admissions, academics, fees and communication. Discover our mission.',
    metaKeywords:
      'about Aksharum, school ERP company, school management software company, education technology, edtech India, school software provider',
  },
  services: {
    metaDescription:
      'Explore Aksharum school ERP services: student information systems, fee management, attendance, exams and report cards, timetables and parent-teacher communication.',
    metaKeywords:
      'school ERP services, school management services, student information system, fee management software, attendance management, exam management software',
  },
  features: {
    metaDescription:
      'Discover Aksharum school ERP features: admissions, attendance, online fee collection, exams and grading, timetables, transport, library, HR and parent communication.',
    metaKeywords:
      'school ERP features, school management system features, online fee collection, student attendance software, exam and grading system, timetable software, school transport management',
  },
  contact: {
    metaDescription:
      'Contact Aksharum to see how our school ERP software streamlines your institution. Reach our team for demos, pricing, onboarding and support.',
    metaKeywords:
      'contact Aksharum, school ERP demo, school management software pricing, school software support, school ERP contact',
  },
  career: {
    metaDescription:
      'Join Aksharum and help build the school ERP shaping the future of education. Explore open roles in engineering, design, QA, customer success and marketing.',
    metaKeywords:
      'Aksharum careers, edtech jobs, school ERP jobs, software jobs India, remote edtech careers, school software company jobs',
  },
  demo: {
    metaDescription:
      'Book a free, personalised demo of Aksharum school ERP. See how our school management software simplifies admissions, fees, attendance, exams and communication.',
    metaKeywords:
      'book school ERP demo, free school management software demo, school ERP trial, request demo, school software demo',
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
