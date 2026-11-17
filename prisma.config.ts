import dotenv from 'dotenv'
import { defineConfig } from 'prisma/config'

dotenv.config({ path: '.env.local', quiet: true })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env['DIRECT_URL'],
  },
})
