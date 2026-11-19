// npm run session-limit -- <username> <minutes> [cooldownHours]
// npm run session-limit -- <username> off
//
// Caps how long a Notekeeper session lasts for one account and how long it waits
// before it can sign in again (24 h by default). Used for the public tester.
import { prisma } from '../prisma'

const USAGE = 'usage: npm run session-limit -- <username> <minutes> [cooldownHours] | <username> off'

async function main() {
  const [username, minutesArg, cooldownArg] = process.argv.slice(2)
  if (!username || !minutesArg) throw new Error(USAGE)

  const off = minutesArg === 'off'
  const minutes = Number(minutesArg)
  const cooldownHours = cooldownArg === undefined ? 24 : Number(cooldownArg)
  if (!off && (!Number.isInteger(minutes) || minutes <= 0 || !Number.isInteger(cooldownHours) || cooldownHours <= 0)) {
    throw new Error(USAGE)
  }

  const { count } = await prisma.users.updateMany({
    where: { username: username.toLowerCase() },
    data: off
      ? { session_limit_minutes: null, session_cooldown_hours: null }
      : { session_limit_minutes: minutes, session_cooldown_hours: cooldownHours },
  })
  if (!count) throw new Error(`no Notekeeper user named ${username}`)

  console.log(
    off
      ? `[session-limit] ${username}: limit removed`
      : `[session-limit] ${username}: ${minutes} min per session, ${cooldownHours} h between sign-ins`,
  )
}

main()
  .catch((error: unknown) => {
    console.error('[session-limit]', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
