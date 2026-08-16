/**
 * D1 Database adapter — usa SQL crudo contra Cloudflare D1 en producción.
 * En desarrollo usa Prisma contra SQLite local.
 */

function getD1(): D1Database | null {
  try {
    const g = globalThis as Record<string, unknown>
    const d1 = g.DB as D1Database | undefined
    if (d1 && typeof d1.prepare === 'function') return d1
  } catch { /* ignore */ }
  try {
    const { getRequestContext } = require('@opennextjs/cloudflare/next')
    const env = getRequestContext().env
    const d1 = (env as Record<string, unknown>).DB as D1Database | undefined
    if (d1 && typeof d1.prepare === 'function') return d1
  } catch { /* ignore */ }
  return null
}

export const isD1 = () => getD1() !== null

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

export async function d1Insert(table: string, data: Record<string, unknown>): Promise<void> {
  const keys = Object.keys(data)
  const placeholders = keys.map(() => '?').join(', ')
  const values = keys.map(k => data[k])
  await d1Run(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`, values)
}

export async function d1Update(table: string, data: Record<string, unknown>, where: string, whereParams: unknown[] = []): Promise<void> {
  const sets = Object.keys(data).map(k => `${k} = ?`).join(', ')
  const values = Object.keys(data).map(k => data[k])
  await d1Run(`UPDATE ${table} SET ${sets} WHERE ${where}`, [...values, ...whereParams])
}
