/**
 * POST /api/internal/upload
 * Staff uploads a file attachment for an internal Support message.
 * Returns { url, name, type } to embed in the message.
 *
 * Mirrors /api/admin/chat/upload: service-role only, same bucket, but reachable
 * by every staff role (INTERNAL_CHAT) and pathed under internal/.
 */
import { guardAdmin, PERMS } from '../../../lib/adminGuard'
import formidable from 'formidable'
import fs from 'fs'

export const config = { api: { bodyParser: false } }

const ALLOWED_TYPES = ['image/jpeg','image/png','image/gif','image/webp','application/pdf','text/plain']
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const gate = await guardAdmin(req, res, { allow: PERMS.INTERNAL_CHAT })
  if (!gate) return

  const form = formidable({ maxFileSize: MAX_BYTES })
  let files
  try {
    ;[, files] = await form.parse(req)
  } catch {
    return res.status(400).json({ error: 'File too large or invalid' })
  }

  const file = Array.isArray(files.file) ? files.file[0] : files.file
  if (!file) return res.status(400).json({ error: 'No file provided' })
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    return res.status(400).json({ error: 'File type not allowed' })
  }

  const bytes = fs.readFileSync(file.filepath)
  const ext   = file.originalFilename?.split('.').pop() ?? 'bin'
  const path  = `internal/${gate.tenantId ?? 'platform'}/${gate.actor.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { data, error } = await gate.db.storage
    .from('chat-attachments')
    .upload(path, bytes, { contentType: file.mimetype, upsert: false })

  if (error) return res.status(500).json({ error: 'Upload failed' })

  const { data: { publicUrl } } = gate.db.storage
    .from('chat-attachments')
    .getPublicUrl(data.path)

  return res.status(200).json({ url: publicUrl, name: file.originalFilename, type: file.mimetype })
}
