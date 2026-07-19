/**
 * Shared helpers for turning the legacy static pages into CMS data:
 * link/image rewriting, splitting the shared header/footer out of page
 * bodies, and building the tokenized layout fragments.
 *
 * Used by both prisma/seed.ts (fresh installs) and
 * prisma/migrate-layout.ts (upgrading an existing database).
 */
import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';

export const HREF_MAP: Record<string, string> = {
  'index.html': '/',
  'about.html': '/about',
  'services.html': '/services',
  'features.html': '/features',
  'contact.html': '/contact',
  'career.html': '/career',
  'demo.html': '/demo',
  'auth.html': '/auth',
  'privacy.html': '/privacy',
  'terms.html': '/terms',
  'terms&conditions.html': '/terms-conditions',
};

// The original inline-SVG logo box, used when no custom logo is uploaded.
export const DEFAULT_LOGO_BOX =
  '<div class="lbox"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg></div>';

export const DEFAULT_BRANDING = {
  siteName: 'Aksharum',
  logoPath: '',
  faviconPath: '',
};

export interface SocialLink {
  icon: string; // key into the icon set (email, instagram, linkedin, x, ...)
  label: string;
  url: string;
}

export function detectSocialIcon(label: string, url: string): string {
  const l = label.toLowerCase();
  const u = url.toLowerCase();
  if (u.startsWith('mailto:')) return 'email';
  if (l.includes('instagram') || u.includes('instagram.')) return 'instagram';
  if (l.includes('linkedin') || u.includes('linkedin.')) return 'linkedin';
  if (l.includes('twitter') || l === 'x' || l.startsWith('x ') || u.includes('twitter.') || u.includes('x.com')) return 'x';
  if (l.includes('facebook') || u.includes('facebook.')) return 'facebook';
  if (l.includes('youtube') || u.includes('youtube.')) return 'youtube';
  if (l.includes('whatsapp') || u.includes('wa.me')) return 'whatsapp';
  if (l.includes('telegram') || u.includes('t.me')) return 'telegram';
  if (l.includes('github') || u.includes('github.')) return 'github';
  return 'link';
}

/**
 * Replaces the links inside the footer's "Social Media" column with the
 * {{SOCIAL_LINKS}} token and returns the links that were there, so they can
 * be managed as data from the admin panel.
 */
export function tokenizeSocialColumn($: CheerioAPI): SocialLink[] {
  const links: SocialLink[] = [];
  const col = $('footer .fcol')
    .filter((_, el) => $(el).find('h4').first().text().trim().toLowerCase() === 'social media')
    .first();
  if (!col.length) return links;
  col.find('ul li a').each((_, el) => {
    const url = $(el).attr('href') ?? '#';
    const label = $(el).text().trim();
    links.push({ icon: detectSocialIcon(label, url), label, url });
  });
  col.find('ul').first().html('{{SOCIAL_LINKS}}');
  return links;
}

export function rewriteInternalLinks($: CheerioAPI): void {
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const clean = href.replace(/^\.?\//, '');
    if (HREF_MAP[clean]) $(el).attr('href', HREF_MAP[clean]);
  });
  $('img[src]').each((_, el) => {
    const src = $(el).attr('src') ?? '';
    if (src && !/^(https?:\/\/|data:|\/)/.test(src)) {
      $(el).attr('src', '/' + src.replace(/^\.?\//, ''));
    }
  });
}

/**
 * Removes the shared chrome (nav, overlay, mobile drawer, footer) from a
 * page document/fragment. Returns whether the page had it (auth.html does
 * not) and the page's original inline style on <nav>, which is re-applied
 * when the shared header is composed back in.
 */
export function stripLayoutFromBody($: CheerioAPI): {
  hadLayout: boolean;
  navStyle: string;
} {
  const nav = $('#nav');
  const hadLayout = nav.length > 0 || $('footer').length > 0;
  const navStyle = nav.attr('style') ?? '';
  nav.remove();
  $('#navOverlay').remove();
  $('#mobileDrawer').remove();
  $('footer').remove();
  return { hadLayout, navStyle };
}

/**
 * Builds the shared, tokenized header/footer from the legacy pages:
 * header (nav + overlay + drawer) from career.html (the variant without
 * page-specific inline styles), footer from index.html. The logo box and
 * site name become {{LOGO_BOX}} / {{SITE_NAME}} tokens so branding can be
 * changed without editing HTML.
 */
export function extractSharedLayout(
  careerHtml: string,
  indexHtml: string,
): { headerHtml: string; footerHtml: string; socialLinks: SocialLink[] } {
  const $c = cheerio.load(careerHtml);
  rewriteInternalLinks($c);
  $c('#nav a.active, #mobileDrawer a.active').removeClass('active');
  $c('#nav .logo .lbox').replaceWith('{{LOGO_BOX}}');
  $c('#mobileDrawer .drawer-logo .lbox').replaceWith('{{LOGO_BOX}}');
  $c('#nav .logo-accent').text('{{SITE_NAME}}');
  $c('#mobileDrawer .drawer-logo > span').text('{{SITE_NAME}}');
  const headerHtml = [
    $c.html($c('#nav')),
    $c.html($c('#navOverlay')),
    $c.html($c('#mobileDrawer')),
  ].join('\n\n');

  const $i = cheerio.load(indexHtml);
  rewriteInternalLinks($i);
  $i('footer .f-brand-name span').text('{{SITE_NAME}}');
  const socialLinks = tokenizeSocialColumn($i);
  const footerHtml = $i.html($i('footer'));

  return { headerHtml, footerHtml, socialLinks };
}
