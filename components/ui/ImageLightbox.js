/**
 * components/ui/ImageLightbox.js
 *
 * In-page image viewer for admin document/proof images (KYC docs, deposit
 * proofs, …). Opens over the current page instead of a new browser tab.
 *
 *   const [img, setImg] = useState(null)
 *   <button onClick={() => setImg(url)}>View</button>
 *   <ImageLightbox src={img} onClose={() => setImg(null)} />
 *
 * Click anywhere on the backdrop (or press Esc) to close. "Copy image" puts
 * the picture on the clipboard; "Download" saves it. The image and buttons
 * don't close the viewer when clicked.
 */
import { useEffect, useState } from 'react'
import Icon from './Icon'

export default function ImageLightbox({ src, onClose }) {
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!src) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [src, onClose])

  if (!src) return null

  const isPdf = /\.pdf(\?|$)/i.test(src)

  async function copy(e) {
    e.stopPropagation()
    setNote('Copying…')
    try {
      const blob = await fetch(src).then(r => r.blob())
      // Clipboard image support is PNG-only in most browsers, so normalise
      // whatever we fetched (jpeg/webp) to PNG via a canvas.
      const bitmap = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width; canvas.height = bitmap.height
      canvas.getContext('2d').drawImage(bitmap, 0, 0)
      const png = await new Promise(r => canvas.toBlob(r, 'image/png'))
      await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': png })])
      setNote('Copied ✓'); setTimeout(() => setNote(''), 1800)
    } catch (err) {
      setNote('Copy not supported — use Download'); setTimeout(() => setNote(''), 2500)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 3000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 }}>
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, maxWidth: '92vw', maxHeight: '92vh' }}>
        {isPdf ? (
          <iframe src={src} title="Document" style={{ width: '82vw', height: '78vh', border: '1px solid rgba(255,255,255,.15)', borderRadius: 12, background: '#fff' }} />
        ) : (
          <img src={src} alt="Document" style={{ maxWidth: '92vw', maxHeight: '78vh', objectFit: 'contain', borderRadius: 12, border: '1px solid rgba(255,255,255,.15)', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }} />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!isPdf && (
            <button onClick={copy} style={btn('rgba(251,191,36,.15)', '#fbbf24', 'rgba(251,191,36,.35)')}>
              <Icon name="copy" size={14} /> Copy image
            </button>
          )}
          <a href={src} download target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ ...btn('rgba(255,255,255,.08)', '#fff', 'rgba(255,255,255,.18)'), textDecoration: 'none' }}>
            <Icon name="download" size={14} /> Download
          </a>
          <button onClick={onClose} style={btn('rgba(255,255,255,.05)', 'rgba(255,255,255,.6)', 'rgba(255,255,255,.14)')}>
            <Icon name="x" size={14} /> Close
          </button>
          {note && <span style={{ color: 'rgba(255,255,255,.7)', fontSize: 12, fontWeight: 700 }}>{note}</span>}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>Click anywhere outside to close</div>
      </div>
    </div>
  )
}

function btn(bg, color, border) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '9px 16px', borderRadius: 10, cursor: 'pointer',
    background: bg, color, border: `1px solid ${border}`,
    fontSize: 13, fontWeight: 800, fontFamily: "'Outfit',sans-serif",
  }
}
