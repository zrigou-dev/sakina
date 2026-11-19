import type { SqlDatabase } from '@/database/types';
import { normalizeArabic, normalizeLatin } from '@/services/search/normalize';

/**
 * SAKINA content package (books, courses, life guides, family lessons).
 * Packages are produced by trusted publishers and validated strictly before use.
 * Every item must declare whether it is source text, scholarly opinion or an
 * educational summary, so the UI can distinguish them.
 */
export const CONTENT_PACKAGE_FORMAT = 'sakina-content';
export const CONTENT_PACKAGE_VERSION = 1;

export type Section = 'library' | 'academy' | 'guides' | 'family';
export type ContentType = 'source_text' | 'scholarly_opinion' | 'educational_summary';

export interface ContentItem {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly contentType: ContentType;
  readonly source: string;
}

export interface ContentPackage {
  readonly format: typeof CONTENT_PACKAGE_FORMAT;
  readonly version: number;
  readonly id: string;
  readonly section: Section;
  readonly language: 'ar' | 'en' | 'fr';
  readonly title: string;
  readonly description: string;
  readonly source: { readonly name: string; readonly url: string };
  readonly license: string;
  readonly reviewed: { readonly by: string; readonly on: string } | null;
  readonly items: readonly ContentItem[];
}

export class ContentPackageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentPackageError';
  }
}

const str = (v: unknown, field: string, max = 200): string => {
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw new ContentPackageError(`invalid ${field}`);
  return v.trim();
};

export function parseContentPackage(raw: string): ContentPackage {
  if (raw.length > 20 * 1024 * 1024) throw new ContentPackageError('too large');
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new ContentPackageError('not JSON');
  }
  if (!j || j.format !== CONTENT_PACKAGE_FORMAT || j.version !== CONTENT_PACKAGE_VERSION) throw new ContentPackageError('wrong format');
  const id = str(j.id, 'id', 80);
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(id)) throw new ContentPackageError('invalid id');
  if (!['library', 'academy', 'guides', 'family'].includes(j.section as string)) throw new ContentPackageError('invalid section');
  if (!['ar', 'en', 'fr'].includes(j.language as string)) throw new ContentPackageError('invalid language');
  const source = j.source as Record<string, unknown> | undefined;
  const sourceUrl = str(source?.url, 'source.url', 500);
  if (!/^https:\/\//.test(sourceUrl)) throw new ContentPackageError('source.url must be https');
  const reviewed = j.reviewed as Record<string, unknown> | null | undefined;
  if (!Array.isArray(j.items) || j.items.length === 0 || j.items.length > 2000) throw new ContentPackageError('invalid items');
  const seen = new Set<string>();
  const items = (j.items as Record<string, unknown>[]).map((it, i) => {
    const itemId = str(it?.id, `items[${i}].id`, 80);
    if (seen.has(itemId)) throw new ContentPackageError(`duplicate item ${itemId}`);
    seen.add(itemId);
    const ct = it.contentType;
    if (ct !== 'source_text' && ct !== 'scholarly_opinion' && ct !== 'educational_summary') throw new ContentPackageError(`items[${i}].contentType`);
    return {
      id: itemId,
      title: str(it.title, `items[${i}].title`),
      body: str(it.body, `items[${i}].body`, 200_000),
      contentType: ct,
      source: str(it.source, `items[${i}].source`, 500),
    } as ContentItem;
  });
  return {
    format: CONTENT_PACKAGE_FORMAT,
    version: CONTENT_PACKAGE_VERSION,
    id,
    section: j.section as Section,
    language: j.language as ContentPackage['language'],
    title: str(j.title, 'title'),
    description: str(j.description, 'description', 2000),
    source: { name: str(source?.name, 'source.name'), url: sourceUrl },
    license: str(j.license, 'license', 1000),
    reviewed: reviewed ? { by: str(reviewed.by, 'reviewed.by'), on: str(reviewed.on, 'reviewed.on', 40) } : null,
    items,
  };
}

export interface InstalledPackage {
  readonly id: string;
  readonly section: Section;
  readonly language: string;
  readonly title: string;
  readonly description: string;
  readonly sourceName: string;
  readonly sourceUrl: string;
  readonly license: string;
  readonly reviewedBy: string | null;
  readonly itemCount: number;
}

export const contentPackagesRepo = {
  async install(db: SqlDatabase, p: ContentPackage): Promise<void> {
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM library_item WHERE package_id = ?', [p.id]);
      await db.runAsync('DELETE FROM content_package WHERE id = ?', [p.id]);
      await db.runAsync(
        `INSERT INTO content_package (id, section, language, title, description, source_name, source_url, license, reviewed_by, reviewed_on, installed_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          p.id,
          p.section,
          p.language,
          p.title,
          p.description,
          p.source.name,
          p.source.url,
          p.license,
          p.reviewed?.by ?? null,
          p.reviewed?.on ?? null,
          new Date().toISOString(),
        ],
      );
      let pos = 0;
      for (const it of p.items) {
        const search = p.language === 'ar' ? normalizeArabic(`${it.title} ${it.body}`) : normalizeLatin(`${it.title} ${it.body}`);
        await db.runAsync(
          `INSERT INTO library_item (id, package_id, kind, parent_id, position, language, title, body, body_search, source, content_type) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          [
            `${p.id}/${it.id}`,
            p.id,
            p.section === 'academy' ? 'lesson' : p.section === 'guides' ? 'guide' : 'article',
            null,
            pos++,
            p.language,
            it.title,
            it.body,
            search,
            it.source,
            it.contentType,
          ],
        );
      }
    });
  },
  async list(db: SqlDatabase, section: Section): Promise<InstalledPackage[]> {
    return db.getAllAsync(
      `SELECT p.id, p.section, p.language, p.title, p.description, p.source_name AS sourceName, p.source_url AS sourceUrl, p.license, p.reviewed_by AS reviewedBy,
              (SELECT COUNT(*) FROM library_item i WHERE i.package_id = p.id) AS itemCount
       FROM content_package p WHERE p.section = ? ORDER BY p.title`,
      [section],
    );
  },
  async items(db: SqlDatabase, packageId: string): Promise<{ id: string; title: string; contentType: ContentType }[]> {
    return db.getAllAsync('SELECT id, title, content_type AS contentType FROM library_item WHERE package_id = ? ORDER BY position', [packageId]);
  },
  async item(
    db: SqlDatabase,
    id: string,
  ): Promise<{ id: string; packageId: string; title: string; body: string; source: string; contentType: ContentType } | null> {
    return db.getFirstAsync('SELECT id, package_id AS packageId, title, body, source, content_type AS contentType FROM library_item WHERE id = ?', [id]);
  },
  async remove(db: SqlDatabase, packageId: string): Promise<void> {
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM library_item WHERE package_id = ?', [packageId]);
      await db.runAsync('DELETE FROM content_package WHERE id = ?', [packageId]);
    });
  },
};
