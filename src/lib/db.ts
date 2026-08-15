import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import { getRequestContext } from '@cloudflare/next-on-pages'

const globalForPrisma = globalThis as unknown as {
  __prismaDev: PrismaClient | undefined
}

function getDevClient(): PrismaClient {
  if (!globalForPrisma.__prismaDev) {
    globalForPrisma.__prismaDev = new PrismaClient({ log: ['error', 'warn'] })
  }
  return globalForPrisma.__prismaDev
}

function getProdClient(): PrismaClient {
  const env = getRequestContext().env as { DB: any }
  const adapter = new PrismaD1(env.DB)
  return new PrismaClient({ adapter } as any)
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = process.env.NODE_ENV === 'production' ? getProdClient() : getDevClient()
    const value = (client as any)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  },
})
