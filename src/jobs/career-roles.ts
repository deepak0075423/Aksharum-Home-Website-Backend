import type { PublicJob } from './jobs.service';

/*
 * Server-rendered "Open Roles" list for the career page.
 *
 * public/js/career.js builds this same list in the browser from /api/jobs,
 * but until it runs, the page shows whatever static rows were saved in the
 * CMS body — roles that may have closed long ago. Search engines index that
 * first HTML, so the API fills the list in before the page leaves the server.
 * The markup mirrors crRoleRow() in career.js: keep the two in step, or the
 * list will visibly change shape when the script re-renders it.
 */

const DEPT_ICONS: Record<string, string> = {
  engineering:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  design:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>',
  'customer success':
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
  default:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
};

const ARROW =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function openingsLabel(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '';
  return `${n} ${n === 1 ? 'opening' : 'openings'}`;
}

function roleRow(job: PublicJob, idx: number): string {
  const icon = DEPT_ICONS[(job.department || '').toLowerCase()] ?? DEPT_ICONS.default;
  const openings = openingsLabel(job.openings);
  const statusTag =
    job.status === 'FILLED'
      ? '<span class="cr-role-tag cr-tag-type">Positions Filled</span>'
      : openings
        ? `<span class="cr-role-tag cr-tag-open">${openings}</span>`
        : '';

  return (
    `<a class="cr-role-row" href="${esc(job.path)}" data-idx="${idx}">` +
    '<div class="cr-role-left">' +
    `<div class="cr-role-ico">${icon}</div>` +
    '<div>' +
    `<div class="cr-role-title">${esc(job.title)}</div>` +
    '<div class="cr-role-meta">' +
    `<span class="cr-role-tag cr-tag-type">${esc(job.type || 'Full-time')}</span>` +
    `<span class="cr-role-tag cr-tag-loc">${esc(job.location)}</span>` +
    `<span class="cr-role-tag cr-tag-dep">${esc(job.department)}</span>` +
    statusTag +
    '</div>' +
    '</div>' +
    '</div>' +
    `<div class="cr-role-arrow">${ARROW}</div>` +
    '</a>'
  );
}

const EMPTY_ROW =
  '<div class="cr-role-row" style="cursor:default"><div class="cr-role-left">' +
  `<div class="cr-role-ico">${DEPT_ICONS.default}</div>` +
  '<div><div class="cr-role-title">No open roles right now</div>' +
  '<div class="cr-role-meta"><span class="cr-role-tag cr-tag-loc">Check back soon — or send a general application below</span></div>' +
  '</div></div></div>';

export function roleRowsHtml(jobs: PublicJob[]): string {
  return jobs.length ? jobs.map(roleRow).join('') : EMPTY_ROW;
}

/**
 * Replaces the children of the first `.cr-roles-grid` element in `html`
 * with `inner`. Works on the raw string — matching <div>/</div> depth from
 * the opening tag — so the rest of the admin-authored page is passed through
 * byte for byte rather than being re-serialised by an HTML parser. Returns
 * the input unchanged if the grid isn't there (an admin may have removed it).
 */
export function replaceRolesGrid(html: string, inner: string): string {
  const open = /<div\b[^>]*\bclass\s*=\s*["'][^"']*\bcr-roles-grid\b[^"']*["'][^>]*>/i.exec(html);
  if (!open) return html;

  const start = open.index + open[0].length;
  const tag = /<div\b[^>]*>|<\/div\s*>/gi;
  tag.lastIndex = start;
  let depth = 1;
  for (let m = tag.exec(html); m; m = tag.exec(html)) {
    depth += m[0][1] === '/' ? -1 : 1;
    if (depth === 0) {
      return html.slice(0, start) + inner + html.slice(m.index);
    }
  }
  return html; // unbalanced markup — leave it alone rather than guess
}
