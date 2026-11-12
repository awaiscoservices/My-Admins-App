/**
 * POST /api/admin/payments/upload-qr
 * Uploads a payment-method QR image and returns its public URL, to store on
 * the payment method's account_details.qr_image_url (shown to players).
 */
import { guardAdmin, PERMS } from '../../../../lib/adminGuard'

export const config = { api: { bodyParser: { sizeLimit: '8mb' } } }

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.PAYMENTS_WRITE })
  if (!gate) return

  const { file_base64, file_type, file_name } = req.body
  if (!file_base64 || !file_type) return res.status(400).json({ error: 'File data required' })
  if (!ALLOWED.includes(file_type)) return res.status(400).json({ error: 'Only images are allowed (jpg, png, webp, gif)' })

  const buffer = Buffer.from(file_base64, 'base64')
  if (buffer.length > 5 * 1024 * 1024) return res.status(400).json({ error: 'File too large. Maximum 5MB.' })

  const ext = (file_type.split('/')[1]) || 'png'
  const path = `payment-qr/${gate.tenantId ?? 'shared'}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  // Reuse the public chat-attachments bucket so the player app can load the
  // image by its public URL without signing.
  const { data, error } = await gate.db.storage
    .from('chat-attachments')
    .upload(path, buffer, { contentType: file_type, upsert: false })

  if (error) {
    console.error('QR upload error:', error)
    return res.status(500).json({ error: 'Upload failed. Please try again.' })
  }

  const { data: { publicUrl } } = gate.db.storage.from('chat-attachments').getPublicUrl(data.path)
  return res.status(200).json({ url: publicUrl })
}
