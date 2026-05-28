import { PrismaClient } from '@prisma/client';

const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const MIN_LENGTH = 2;
const MAX_LENGTH = 5;
const MAX_RETRIES_PER_LENGTH = 20;

export const RESERVED_SLUGS = new Set([
  'api',
  'admin',
  'auth',
  'dashboard',
  'health',
  'login',
  'register',
  'r',
  'settings',
  'team',
]);

function generateRandomString(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return result;
}

/**
 * Checks if a slug is reserved (used by application routes).
 */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

/**
 * Generates a unique short code with progressive length (2 to 5 characters).
 * @param db - The Prisma client instance to use for database queries.
 */
export async function generateShortCode(db: PrismaClient): Promise<string> {
  let config = await db.systemConfig.findUnique({ where: { id: 1 } });
  if (!config) {
    config = await db.systemConfig.create({ data: { id: 1, slug_generation_length: MIN_LENGTH } });
  }
  let currentLength = config.slug_generation_length;

  for (let length = currentLength; length <= MAX_LENGTH; length++) {
    if (length > currentLength) {
      await db.systemConfig.update({
        where: { id: 1 },
        data: { slug_generation_length: length },
      });
      currentLength = length;
    }

    for (let i = 0; i < MAX_RETRIES_PER_LENGTH; i++) {
      const slug = generateRandomString(length);
      if (isReservedSlug(slug)) {
        continue;
      }
      const existingLink = await db.link.findUnique({ where: { short_code: slug } });
      if (!existingLink) {
        return slug;
      }
    }
    console.warn(`[SlugGenerator] High collision density for length ${length}. Moving to length ${length + 1}.`);
  }

  throw new Error('Unable to generate a unique short code. Namespace may be exhausted.');
}
