/**
 * Default content for the editable error pages (404, 403). They are normal
 * CMS pages — admins edit them under Pages like everything else. The Next.js
 * not-found boundary renders the "404" page for any unknown URL; "403" is
 * available at /403 for access-denied situations.
 */

export const ERROR_PAGE_CSS = ['/css/career.css', '/css/liquid-glass.css'];

export const ERROR_PAGE_FONTS = [
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400;1,600;1,700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap',
];

export const ERROR_PAGE_SCRIPTS = ['/js/site-common.js', '/js/page-transitions.js'];

function errorBody(code: string, heading: string, headingEm: string, message: string): string {
  return `<section style="min-height:78vh;display:flex;align-items:center;justify-content:center;padding:150px 24px 90px">
  <div style="text-align:center;max-width:600px">
    <div style="font-family:'Playfair Display',serif;font-size:clamp(96px,18vw,180px);font-weight:800;line-height:1;color:var(--p600);letter-spacing:-4px">${code}</div>
    <h1 style="font-family:'Playfair Display',serif;font-size:clamp(26px,4.5vw,38px);font-weight:800;color:var(--ink);margin:10px 0 14px">${heading} <em style="color:var(--p600)">${headingEm}</em></h1>
    <p style="font-family:'DM Sans',sans-serif;font-size:16px;color:var(--ink3);line-height:1.75;margin-bottom:30px">${message}</p>
    <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap">
      <a href="/" class="cr-btn-pri">Back to Home</a>
      <a href="/contact" class="cr-btn-sec">Contact Us</a>
    </div>
  </div>
</section>`;
}

export const ERROR_PAGES = [
  {
    slug: '404',
    title: 'Page Not Found - Aksharum',
    bodyHtml: errorBody(
      '404',
      'This page has',
      'wandered off.',
      "The page you're looking for doesn't exist or may have been moved. Let's get you back to class.",
    ),
    metaDescription: '',
  },
  {
    slug: '403',
    title: 'Access Denied - Aksharum',
    bodyHtml: errorBody(
      '403',
      'This area is',
      'off limits.',
      "You don't have permission to view this page. If you believe this is a mistake, please get in touch with us.",
    ),
    metaDescription: '',
  },
];
