import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Fields the public site may see. Closed roles never leave the API; filled
// ones stay listed (marked as filled) so the career page doesn't jump around.
const PUBLIC_SELECT = {
  id: true,
  title: true,
  department: true,
  location: true,
  type: true,
  description: true,
  openings: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.JobSelect;

const PUBLIC_STATUSES = ['OPEN', 'FILLED'] as const;

type PublicJobRow = Prisma.JobGetPayload<{ select: typeof PUBLIC_SELECT }>;

export interface PublicJob extends PublicJobRow {
  /** Site path of the role's own page, e.g. /career/qa-intern-cmf3x… */
  path: string;
}

/** "QA Intern / Software Testing" -> "qa-intern-software-testing". */
export function jobSlug(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

/**
 * /career/<title-slug>-<id>. The id (a cuid, which never contains a dash)
 * is what identifies the role; the title part is for people and search
 * engines. The frontend reads the id from after the last dash and redirects
 * any outdated title slug to this canonical path, so renaming a role never
 * breaks a link that is already indexed or shared.
 */
export function jobPath(job: { id: string; title: string }): string {
  const slug = jobSlug(job.title);
  return `/career/${slug ? `${slug}-` : ''}${job.id}`;
}

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Open + filled roles for the career page, in admin-defined order. */
  async listPublic(): Promise<PublicJob[]> {
    const rows = await this.prisma.job.findMany({
      where: { status: { in: [...PUBLIC_STATUSES] } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: PUBLIC_SELECT,
    });
    return rows.map((row) => ({ ...row, path: jobPath(row) }));
  }

  /** One public role, or null when it doesn't exist or is closed. */
  async findPublic(id: string): Promise<PublicJob | null> {
    const row = await this.prisma.job.findFirst({
      where: { id, status: { in: [...PUBLIC_STATUSES] } },
      select: PUBLIC_SELECT,
    });
    return row ? { ...row, path: jobPath(row) } : null;
  }
}
