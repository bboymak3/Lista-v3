/**
 * D1 Database adapter — usa SQL crudo contra Cloudflare D1 en producción.
 * En desarrollo usa Prisma contra SQLite local.
 */

function getCloudflareContext(): any | null {
  try {
    // OpenNext expone el contexto vía globalThis con el símbolo __cloudflare-context__
    const sym = Symbol.for('__cloudflare-context__')
    const ctx = (globalThis as any)[sym]
    if (ctx?.env) return ctx
  } catch { /* ignore */ }
  return null
}

export function isD1(): boolean {
  const ctx = getCloudflareContext()
  return !!(ctx?.env?.DB)
}

function getD1(): D1Database | null {
  const ctx = getCloudflareContext()
  const d1 = ctx?.env?.DB as D1Database | undefined
  if (d1 && typeof d1.prepare === 'function') return d1
  return null
}

export async function d1Query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const d1 = getD1()
  if (!d1) throw new Error('D1 not available')
  const stmt = params.length > 0 ? d1.prepare(sql).bind(...params) : d1.prepare(sql)
  const result = await stmt.all()
  return (result.results || []) as T[]
}

export async function d1Run(sql: string, params: unknown[] = []): Promise<void> {
  const d1 = getD1()
  if (!d1) throw new Error('D1 not available')
  const stmt = params.length > 0 ? d1.prepare(sql).bind(...params) : d1.prepare(sql)
  await stmt.run()
}

export async function d1First<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await d1Query<T>(sql, params)
  return rows[0] || null
}
