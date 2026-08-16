/**
 * Database client — wrapper que funciona en dev (Prisma) y prod (D1 crudo).
 *
 * En desarrollo: usa Prisma contra SQLite local (lazy loaded via eval('require')).
 * En producción (Cloudflare D1): usa SQL crudo contra tablas v3_* de lista_db.
 *
 * Mantiene la misma API que PrismaClient (findUnique, findMany, create, update, etc.)
 * para que las rutas API existentes no necesiten cambios.
 */

export { db } from './db-compat'
