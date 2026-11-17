import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const PREFIX = 'enc:v1:'

function key() {
  const raw = process.env.NOTEKEEPER_SECRET_KEY
  const buf = raw ? Buffer.from(raw, 'base64') : Buffer.alloc(0)
  if (buf.length !== 32) throw new Error('NOTEKEEPER_SECRET_KEY must be 32 bytes in base64')
  return buf
}

export function encrypt(plain: string) {
  if (!plain || plain.startsWith(PREFIX)) return plain
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + [iv, tag, data].map((b) => b.toString('base64')).join(':')
}

export function decrypt(value: string) {
  if (!value.startsWith(PREFIX)) return value
  const [iv, tag, data] = value.slice(PREFIX.length).split(':').map((p) => Buffer.from(p, 'base64'))
  const decipher = createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
