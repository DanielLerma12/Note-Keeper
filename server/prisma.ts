import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client'

dotenv.config({ path: fileURLToPath(new URL('../.env.local', import.meta.url)), quiet: true })

function createClient() {
  const adapter = new PrismaPg(
    {
      connectionString: process.env.DATABASE_URL!,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 20_000,
      keepAlive: true,
    },
    {
      onPoolError: (error) => console.warn('[prisma] pool error:', error.message),
      onConnectionError: (error) => console.warn('[prisma] connection error:', error.message),
    },
  )
  return new PrismaClient({ adapter, transactionOptions: { maxWait: 10_000, timeout: 30_000 } })
}

const globalForPrisma = globalThis as typeof globalThis & { notekeeperPrisma?: PrismaClient }

export const prisma = globalForPrisma.notekeeperPrisma ?? createClient()
globalForPrisma.notekeeperPrisma = prisma
