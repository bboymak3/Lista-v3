/**
 * Database client — supports both local SQLite (dev, via Prisma) and Cloudflare D1 (prod, raw SQL).
 * Prisma is loaded via eval-require to prevent bundlers from including it
 * in the Cloudflare Workers bundle (which would cause fs.readdir errors).
 */

import { isD1 } from './d1'

let _db: unknown = null

// Load Prisma only in local dev (not in Cloudflare D1)
if (!isD1()) {
  try {
    const req = eval('require')
    const { PrismaClient } = req('@prisma/client')
    _db = new PrismaClient({ log: ['error', 'warn'] })
  } catch {
    /* Prisma not available */
  }
}

// In production (D1), db is a proxy that throws helpful errors
const _proxy = new Proxy({}, {
  get() {
    throw new Error('Prisma not available in production — use d1Query/d1Run from @/lib/d1')
  }
})

export const db = (_db || _proxy) as import('@prisma/client').PrismaClient
