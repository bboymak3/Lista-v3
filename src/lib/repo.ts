/**
 * Database access layer — usa Prisma en dev, D1 crudo en producción.
 */

import { isD1, d1Query, d1First, d1Run } from './d1'

// En desarrollo, cargar Prisma. En producción (D1), no.
// El bundler NO debe incluir @prisma/client en el build de Cloudflare.
declare const require: ((m: string) => any) | undefined

let _prismaDb: any = null

async function getDb(): Promise<any> {
  if (isD1()) return null
  if (_prismaDb) return _prismaDb
  try {
    // require solo existe en Node.js, no en edge/Workers
    if (typeof require !== 'undefined') {
      const { PrismaClient } = require('@prisma/client')
      _prismaDb = new PrismaClient({ log: ['error', 'warn'] })
    }
    return _prismaDb
  } catch (e) {
    console.error('Error loading Prisma:', e)
    return null
  }
}

export interface WhereClause {
  [key: string]: unknown
}

// Mapeo modelo → tabla D1 (todas con prefijo v3_)
const TABLE_MAP: Record<string, string> = {
  user: 'v3_users',
  plantel: 'v3_plantels',
  section: 'v3_sections',
  sectionAssignment: 'v3_section_assignments',
  student: 'v3_students',
  parentStudent: 'v3_parent_student',
  attendanceSession: 'v3_attendance_sessions',
  attendance: 'v3_attendance',
  professorCheckin: 'v3_professor_checkin',
  feedPost: 'v3_feed_posts',
  notification: 'v3_notifications',
  pushSubscription: 'v3_push_subscriptions',
  locationPing: 'v3_location_pings',
}

function buildWhere(where: WhereClause): { sql: string; params: unknown[] } {
  const keys = Object.keys(where)
  if (keys.length === 0) return { sql: '', params: [] }
  const clauses: string[] = []
  const params: unknown[] = []
  for (const k of keys) {
    const v = where[k]
    if (v === null || v === undefined) {
      clauses.push(`${k} IS NULL`)
    } else if (typeof v === 'object' && v !== null) {
      continue
    } else {
      clauses.push(`${k} = ?`)
      params.push(v)
    }
  }
  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params }
}

export const repo = {
  async findFirst<T = any>(model: string, where: WhereClause, orderBy?: string): Promise<T | null> {
    if (!isD1()) {
      const db = await getDb()
      if (!db) throw new Error('Prisma not available')
      return db[model].findFirst({ where, orderBy })
    }
    const table = TABLE_MAP[model]
    if (!table) throw new Error(`Unknown model: ${model}`)
    const { sql, params } = buildWhere(where)
    const orderClause = orderBy ? ` ORDER BY ${orderBy}` : ''
    return d1First<T>(`SELECT * FROM ${table} ${sql}${orderClause} LIMIT 1`, params)
  },

  async findMany<T = any>(
    model: string,
    where: WhereClause = {},
    opts: { orderBy?: string; limit?: number; offset?: number } = {}
  ): Promise<T[]> {
    if (!isD1()) {
      const db = await getDb()
      if (!db) throw new Error('Prisma not available')
      return db[model].findMany({ where, orderBy: opts.orderBy as any, take: opts.limit, skip: opts.offset })
    }
    const table = TABLE_MAP[model]
    const { sql, params } = buildWhere(where)
    let q = `SELECT * FROM ${table} ${sql}`
    if (opts.orderBy) q += ` ORDER BY ${opts.orderBy}`
    if (opts.limit) q += ` LIMIT ${opts.limit}`
    if (opts.offset) q += ` OFFSET ${opts.offset}`
    return d1Query<T>(q, params)
  },

  async create<T = any>(model: string, data: Record<string, unknown>): Promise<T> {
    if (!isD1()) {
      const db = await getDb()
      if (!db) throw new Error('Prisma not available')
      return db[model].create({ data })
    }
    const table = TABLE_MAP[model]
    const keys = Object.keys(data).filter(k => data[k] !== undefined)
    const placeholders = keys.map(() => '?').join(', ')
    const values = keys.map(k => data[k])
    await d1Run(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`, values)
    const id = data.id as string
    if (id) return d1First<T>(`SELECT * FROM ${table} WHERE id = ?`, [id]) as Promise<T>
    return d1First<T>(`SELECT * FROM ${table} ORDER BY rowid DESC LIMIT 1`) as Promise<T>
  },

  async update<T = any>(
    model: string,
    where: WhereClause,
    data: Record<string, unknown>
  ): Promise<T | null> {
    if (!isD1()) {
      const db = await getDb()
      if (!db) throw new Error('Prisma not available')
      return db[model].update({ where, data })
    }
    const table = TABLE_MAP[model]
    const setKeys = Object.keys(data).filter(k => data[k] !== undefined)
    const setClause = setKeys.map(k => `${k} = ?`).join(', ')
    const setValues = setKeys.map(k => data[k])
    const { sql, params } = buildWhere(where)
    await d1Run(`UPDATE ${table} SET ${setClause} ${sql}`, [...setValues, ...params])
    return d1First<T>(`SELECT * FROM ${table} ${sql} LIMIT 1`, params)
  },

  async count(model: string, where: WhereClause = {}): Promise<number> {
    if (!isD1()) {
      const db = await getDb()
      if (!db) throw new Error('Prisma not available')
      return db[model].count({ where })
    }
    const table = TABLE_MAP[model]
    const { sql, params } = buildWhere(where)
    const r = await d1First<{ count: number }>(`SELECT COUNT(*) as count FROM ${table} ${sql}`, params)
    return r?.count || 0
  },

  async query<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (!isD1()) {
      const db = await getDb()
      if (!db) throw new Error('Prisma not available')
      return db.$queryRawUnsafe(sql, ...params)
    }
    return d1Query<T>(sql, params)
  },

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    if (!isD1()) {
      const db = await getDb()
      if (!db) throw new Error('Prisma not available')
      await db.$executeRawUnsafe(sql, ...params)
      return
    }
    await d1Run(sql, params)
  },
}
