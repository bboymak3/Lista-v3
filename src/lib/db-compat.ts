/**
 * Wrapper Prisma — en desarrollo usa Prisma real,
 * en producción (Cloudflare D1) usa SQL crudo.
 *
 * Mantiene la misma API que PrismaClient para no cambiar las rutas existentes.
 */

import { isD1, d1Query, d1First, d1Run } from './d1'

// Tabla mapping (model name Prisma → table name D1 con prefijo v3_)
const TABLES: Record<string, string> = {
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

// Convierte un valor de D1 (INTEGER 0/1) a Boolean para compatibilidad con Prisma
function normalize(value: any): any {
  if (value === null || value === undefined) return value
  if (typeof value === 'number' && (value === 0 || value === 1)) {
    // Heurística: si la columna es booleana (activo, activa, leida, esPrincipal), convertir
    return value === 1
  }
  return value
}

function normalizeRow(row: Record<string, any> | null): any {
  if (!row) return null
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(row)) {
    // Campos booleanos conocidos
    if (['activo', 'activa', 'leida', 'esPrincipal'].includes(k)) {
      out[k] = v === 1 || v === true
    } else {
      out[k] = v
    }
  }
  return out
}

// Construir WHERE SQL
function buildWhere(where: any): { sql: string; params: any[] } {
  if (!where || Object.keys(where).length === 0) return { sql: '', params: [] }
  const clauses: string[] = []
  const params: any[] = []
  for (const [k, v] of Object.entries(where)) {
    if (v === null || v === undefined) {
      clauses.push(`${k} IS NULL`)
    } else if (typeof v === 'boolean') {
      clauses.push(`${k} = ?`)
      params.push(v ? 1 : 0)
    } else if (typeof v === 'object') {
      // Ignorar objetos complejos (select, include, orderBy, etc.)
      continue
    } else {
      clauses.push(`${k} = ?`)
      params.push(v)
    }
  }
  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params }
}

// Construir SET clause
function buildSet(data: any): { sql: string; params: any[] } {
  const sets: string[] = []
  const params: any[] = []
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue
    if (typeof v === 'boolean') {
      sets.push(`${k} = ?`)
      params.push(v ? 1 : 0)
    } else {
      sets.push(`${k} = ?`)
      params.push(v)
    }
  }
  return { sql: sets.join(', '), params }
}

// Crear un modelo proxy que usa D1 o Prisma según el entorno
function createModelProxy(modelName: string) {
  return {
    async findUnique({ where, select }: { where: any; select?: any }) {
      if (isD1()) {
        const table = TABLES[modelName]
        const { sql, params } = buildWhere(where)
        const row = await d1First(`SELECT * FROM ${table} ${sql} LIMIT 1`, params)
        return normalizeRow(row)
      }
      const { db } = await import('./db-dev')
      return db[modelName].findUnique({ where, select })
    },

    async findFirst({ where, select, orderBy }: { where?: any; select?: any; orderBy?: any }) {
      if (isD1()) {
        const table = TABLES[modelName]
        const { sql, params } = buildWhere(where)
        const orderClause = orderBy ? ` ORDER BY ${Object.keys(orderBy)[0]} ${Object.values(orderBy)[0]}` : ''
        const row = await d1First(`SELECT * FROM ${table} ${sql}${orderClause} LIMIT 1`, params)
        return normalizeRow(row)
      }
      const { db } = await import('./db-dev')
      return db[modelName].findFirst({ where, select, orderBy })
    },

    async findMany({ where, select, orderBy, take, skip, include }: { where?: any; select?: any; orderBy?: any; take?: number; skip?: number; include?: any }) {
      if (isD1()) {
        const table = TABLES[modelName]
        const { sql, params } = buildWhere(where)
        let q = `SELECT * FROM ${table} ${sql}`
        if (orderBy) {
          const k = Object.keys(orderBy)[0]
          q += ` ORDER BY ${k} ${orderBy[k]}`
        }
        if (take) q += ` LIMIT ${take}`
        if (skip) q += ` OFFSET ${skip}`
        const rows = await d1Query(q, params)
        return rows.map(normalizeRow)
      }
      const { db } = await import('./db-dev')
      return db[modelName].findMany({ where, select, orderBy, take, skip, include })
    },

    async create({ data, select }: { data: any; select?: any }) {
      if (isD1()) {
        const table = TABLES[modelName]
        const keys = Object.keys(data).filter(k => data[k] !== undefined)
        const placeholders = keys.map(() => '?').join(', ')
        const values = keys.map((k: string) => typeof data[k] === 'boolean' ? (data[k] ? 1 : 0) : data[k])
        await d1Run(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`, values)
        if (data.id) {
          const row = await d1First(`SELECT * FROM ${table} WHERE id = ?`, [data.id])
          return normalizeRow(row)
        }
        const row = await d1First(`SELECT * FROM ${table} ORDER BY rowid DESC LIMIT 1`)
        return normalizeRow(row)
      }
      const { db } = await import('./db-dev')
      return db[modelName].create({ data, select })
    },

    async update({ where, data, select }: { where: any; data: any; select?: any }) {
      if (isD1()) {
        const table = TABLES[modelName]
        const { sql: setSql, params: setParams } = buildSet(data)
        const { sql: whereSql, params: whereParams } = buildWhere(where)
        await d1Run(`UPDATE ${table} SET ${setSql} ${whereSql}`, [...setParams, ...whereParams])
        const row = await d1First(`SELECT * FROM ${table} ${whereSql} LIMIT 1`, whereParams)
        return normalizeRow(row)
      }
      const { db } = await import('./db-dev')
      return db[modelName].update({ where, data, select })
    },

    async updateMany({ where, data }: { where: any; data: any }) {
      if (isD1()) {
        const table = TABLES[modelName]
        const { sql: setSql, params: setParams } = buildSet(data)
        const { sql: whereSql, params: whereParams } = buildWhere(where)
        await d1Run(`UPDATE ${table} SET ${setSql} ${whereSql}`, [...setParams, ...whereParams])
        return { count: 0 }
      }
      const { db } = await import('./db-dev')
      return db[modelName].updateMany({ where, data })
    },

    async delete({ where }: { where: any }) {
      if (isD1()) {
        const table = TABLES[modelName]
        const { sql, params } = buildWhere(where)
        await d1Run(`DELETE FROM ${table} ${sql}`, params)
        return {}
      }
      const { db } = await import('./db-dev')
      return db[modelName].delete({ where })
    },

    async deleteMany({ where }: { where: any }) {
      if (isD1()) {
        const table = TABLES[modelName]
        const { sql, params } = buildWhere(where)
        await d1Run(`DELETE FROM ${table} ${sql}`, params)
        return { count: 0 }
      }
      const { db } = await import('./db-dev')
      return db[modelName].deleteMany({ where })
    },

    async count({ where }: { where?: any }) {
      if (isD1()) {
        const table = TABLES[modelName]
        const { sql, params } = buildWhere(where)
        const r = await d1First<{ count: number }>(`SELECT COUNT(*) as count FROM ${table} ${sql}`, params)
        return r?.count || 0
      }
      const { db } = await import('./db-dev')
      return db[modelName].count({ where })
    },

    async upsert({ where, create, update }: { where: any; create: any; update: any }) {
      if (isD1()) {
        const table = TABLES[modelName]
        const { sql, params } = buildWhere(where)
        const existing = await d1First(`SELECT * FROM ${table} ${sql} LIMIT 1`, params)
        if (existing) {
          const { sql: setSql, params: setParams } = buildSet(update)
          await d1Run(`UPDATE ${table} SET ${setSql} ${sql}`, [...setParams, ...params])
          const row = await d1First(`SELECT * FROM ${table} ${sql} LIMIT 1`, params)
          return normalizeRow(row)
        } else {
          const keys = Object.keys(create).filter(k => create[k] !== undefined)
          const placeholders = keys.map(() => '?').join(', ')
          const values = keys.map((k: string) => typeof create[k] === 'boolean' ? (create[k] ? 1 : 0) : create[k])
          await d1Run(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`, values)
          const row = await d1First(`SELECT * FROM ${table} ${sql} LIMIT 1`, params)
          return normalizeRow(row)
        }
      }
      const { db } = await import('./db-dev')
      return db[modelName].upsert({ where, create, update })
    },
  }
}

// Proxy que devuelve el modelo correcto
export const db = new Proxy({} as any, {
  get(_target, prop) {
    return createModelProxy(prop as string)
  },
})
