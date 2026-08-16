// Cliente D1 directo (sin Prisma) para Cloudflare Workers free tier
// Usa SQL nativo - elimina la dependencia de Prisma WASM (~2.1 MiB)

import { getRequestContext } from '@cloudflare/next-on-pages'

export interface D1Result<T = any> {
  results?: T[]
  meta?: any
  success: boolean
}

function getBinding() {
  if (process.env.NODE_ENV !== 'production') {
    throw new Error('D1 binding solo disponible en producción (Cloudflare)')
  }
  const env = getRequestContext().env as { DB: any }
  return env.DB
}

// Cliente SQL directo
export const sql = {
  async query<T = any>(text: string, ...bindings: any[]): Promise<T[]> {
    const stmt = getBinding().prepare(text)
    if (bindings.length > 0) stmt.bind(...bindings)
    const result = await stmt.all()
    return (result.results || []) as T[]
  },

  async queryFirst<T = any>(text: string, ...bindings: any[]): Promise<T | null> {
    const stmt = getBinding().prepare(text)
    if (bindings.length > 0) stmt.bind(...bindings)
    const result = await stmt.first()
    return (result || null) as T | null
  },

  async execute(text: string, ...bindings: any[]): Promise<{ meta: any }> {
    const stmt = getBinding().prepare(text)
    if (bindings.length > 0) stmt.bind(...bindings)
    const result = await stmt.run()
    return { meta: result.meta }
  },

  async batch<T = any>(statements: Array<{ text: string; bindings?: any[] }>): Promise<D1Result<T>[]> {
    const stmts = statements.map(s => {
      const stmt = getBinding().prepare(s.text)
      if (s.bindings && s.bindings.length > 0) stmt.bind(...s.bindings)
      return stmt
    })
    const results = await getBinding().batch(stmts)
    return results as D1Result<T>[]
  },
}

// Helper para generar IDs tipo cuid
export function generateId(): string {
  return 'cl' + Date.now().toString(36) + Math.random().toString(36).substring(2, 14)
}
