/**
 * Prisma client — solo se carga en desarrollo (Node.js).
 * En producción (Cloudflare), este archivo NO debe incluirse en el bundle.
 *
 * Usamos eval('require') para evitar que el bundler resuelva @prisma/client.
 */

declare const require: ((m: string) => any) | undefined

let _db: any = null

export async function getDb(): Promise<any> {
  if (_db) return _db
  if (typeof require !== 'undefined') {
    try {
      const { PrismaClient } = require('@prisma/client')
      _db = new PrismaClient({ log: ['error', 'warn'] })
    } catch (e) {
      console.error('Prisma load error:', e)
    }
  }
  return _db
}

// Exportar db sync para compatibilidad con el wrapper
// (se inicializa lazy en la primera llamada)
export const db = new Proxy({} as any, {
  get(_target, prop) {
    if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined
    // Devolver un proxy que cuando se llama a cualquier método, espera a getDb()
    return new Proxy(function () {}, {
      get(_, method) {
        return async (...args: any[]) => {
          const client = await getDb()
          if (!client) throw new Error('Prisma not available in production')
          return client[prop][method](...args)
        }
      },
      apply(_, __, args) {
        return (async () => {
          const client = await getDb()
          if (!client) throw new Error('Prisma not available in production')
          return client[prop](...args)
        })()
      },
    })
  },
})
