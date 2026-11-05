import { useEffect, useState, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import PlayerLayout from '../../components/layout/PlayerLayout'
import MoneyDisplay from '../../components/ui/MoneyDisplay'
import StatusBadge from '../../components/ui/StatusBadge'

// ─── STEP INDICATOR ─────────────────────────────────────────
function Steps({ current }) {
  const steps = ['Select Method', 'Enter Amount', 'Upload Proof', 'Confirm']
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32, gap: 0 }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800,
              background: i < current ? '#10b981' : i === current ? 'linear-gradient(135deg,#fbbf24,#f59e0b)' : 'rgba(255,255,255,.08)',
              color: i <= current ? '#fff' : 'rgba(255,255,255,.3)',
              border: i === current ? '2px solid rgba(251,191,36,.5)' : '2px solid transparent',
              boxShadow: i === current ? '0 0 16px rgba(251,191,36,.4)' : 'none',
              flexShrink: 0,
            }}>{i < current ? '✓' : i + 1}</div>
            <span style={{ fontSize: 10, fontWeight: 700, color: i <= current ? '#fff' : 'rgba(255,255,255,.3)', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{s}</span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ flex: 1, height: 2, background: i < current ? '#10b981' : 'rgba(255,255,255,.08)', margin: '0 8px', marginBottom: 22, transition: 'background .3s' }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── PAYMENT METHOD CARD ─────────────────────────────────────
function MethodCard({ method, selected, onSelect }) {
  const icons = { cashapp: '💸', zelle: '⚡', venmo: '💜', crypto: '₿', bank_transfer: '🏦', money_order: '📮', other: '💳' }
  return (
    <div onClick={() => onSelect(method)} style={{
      padding: '18px 20px', borderRadius: 16, cursor: 'pointer',
      background: selected ? 'linear-gradient(135deg,rgba(251,191,36,.18),rgba(251,191,36,.06))' : 'rgba(255,255,255,.03)',
      border: `1.5px solid ${selected ? '#fbbf24' : 'rgba(255,255,255,.08)'}`,
      transition: 'all .2s',
      boxShadow: selected ? '0 0 24px rgba(251,191,36,.2)' : 'none',
    }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = 'rgba(251,191,36,.35)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = 'rgba(255,255,255,.08)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>{icons[method.type] || '💳'}</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{method.name}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>
              Min: <MoneyDisplay cents={method.min_deposit_cents} size="xs" color="rgba(255,255,255,.4)" /> ·
              Max: <MoneyDisplay cents={method.max_deposit_cents} size="xs" color="rgba(255,255,255,.4)" />
            </div>
          </div>
        </div>
        {method.default_bonus_pct > 0 && (
          <div style={{ background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontSize: 12, fontWeight: 800, padding: '4px 12px', borderRadius: 99 }}>
            +{method.default_bonus_pct}% BONUS
          </div>
        )}
      </div>
      {selected && method.account_details && (
        <div style={{ marginTop: 12, padding: '12px 14px', background: 'rgba(251,191,36,.1)', borderRadius: 10, border: '1px solid rgba(251,191,36,.2)' }}>
          {Object.entries(method.account_details).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', textTransform: 'capitalize', fontWeight: 600 }}>{k.replace(/_/g, ' ')}</span>
              <span style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── MAIN PAGE ───────────────────────────────────────────────
export default function DepositPage() {
  const router = useRouter()
  const fileRef = useRef()

  const [step, setStep] = useState(0)
  const [methods, setMethods] = useState([])
  const [selectedMethod, setSelectedMethod] = useState(null)
  const [amountInput, setAmountInput] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [screenshot, setScreenshot] = useState(null) // { base64, type, name, preview }
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [myDeposits, setMyDeposits] = useState([])

  useEffect(() => { loadData() }, [])

  function showToast(msg, type = 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 5000)
  }

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const [{ data: methodsData }, { data: depositsData }] = await Promise.all([
      supabase.from('payment_methods').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('deposits').select('*, payment_methods(name)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
    ])
    setMethods(methodsData || [])
    setMyDeposits(depositsData || [])
  }

  // Amount in cents (integer)
  const amountCents = Math.round(parseFloat(amountInput || 0) * 100)
  const bonusPct = selectedMethod?.default_bonus_pct || 0
  const bonusCents = Math.floor(amountCents * (bonusPct / 100))
  const totalCents = amountCents + bonusCents

  function validateStep() {
    if (step === 0 && !selectedMethod) { setError('Please select a payment method'); return false }
    if (step === 1) {
      if (!amountInput || amountCents <= 0) { setError('Please enter an amount'); return false }
      if (selectedMethod && amountCents < selectedMethod.min_deposit_cents) { setError(`Minimum deposit is $${(selectedMethod.min_deposit_cents / 100).toFixed(2)}`); return false }
      if (selectedMethod && amountCents > selectedMethod.max_deposit_cents) { setError(`Maximum deposit is $${(selectedMethod.max_deposit_cents / 100).toFixed(2)}`); return false }
    }
    if (step === 2 && !screenshot && !reference) { setError('Please upload a screenshot or enter transaction reference'); return false }
    setError('')
    return true
  }

  function handleNext() {
    if (validateStep()) setStep(s => s + 1)
  }

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { showToast('Only image files are allowed'); return }
    if (file.size > 5 * 1024 * 1024) { showToast('File too large. Max 5MB.'); return }

    const reader = new FileReader()
    reader.onload = (ev) => {
      const base64 = ev.target.result.split(',')[1]
      setScreenshot({ base64, type: file.type, name: file.name, preview: ev.target.result })
    }
    reader.readAsDataURL(file)
  }

  async function handleSubmit() {
    if (!validateStep()) return
    setSubmitting(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

      // Upload screenshot if provided
      let screenshot_url = null
      if (screenshot) {
        setUploading(true)
        const uploadRes = await fetch('/api/deposit/upload-screenshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ file_base64: screenshot.base64, file_type: screenshot.type, file_name: screenshot.name }),
        })
        const uploadData = await uploadRes.json()
        if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed')
        screenshot_url = uploadData.path
        setUploading(false)
      }

      // Generate idempotency key
      const idempotency_key = `dep_${Date.now()}_${Math.random().toString(36).slice(2)}`

      // Submit deposit
      const submitRes = await fetch('/api/deposit/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          payment_method_id: selectedMethod.id,
          amount_cents: amountCents,
          player_reference: reference || null,
          screenshot_url,
          player_notes: notes || null,
          idempotency_key,
        }),
      })
      const submitData = await submitRes.json()
      if (!submitRes.ok) throw new Error(submitData.error || 'Submission failed')

      setResult(submitData.deposit)
      showToast(`Deposit ${submitData.deposit.reference_id} submitted successfully!`, 'success')
      loadData()

    } catch (err) {
      showToast(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
      setUploading(false)
    }
  }

  // ── Success screen ───────────────────────────────────────
  if (result) return (
    <PlayerLayout>
      <Head><title>Deposit Submitted — Casinoze Room</title></Head>
      <div style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>✅</div>
        <h2 style={{ fontFamily: "'Cinzel', serif", fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 12 }}>Deposit Submitted!</h2>
        <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 15, marginBottom: 28, lineHeight: 1.7 }}>
          Your deposit request has been submitted and is pending review by our team. You will be notified once it's approved.
        </p>
        <div style={{ background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.25)', borderRadius: 16, padding: '24px', marginBottom: 28 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(120px,100%), 1fr))', gap: 16, textAlign: 'left' }}>
            {[
              ['Reference', result.reference_id],
              ['Status', 'Pending Review'],
              ['Amount', `$${(result.amount_cents / 100).toFixed(2)}`],
              ['Bonus', `+$${(result.bonus_cents / 100).toFixed(2)}`],
              ['Total Credit', `$${(result.total_credit_cents / 100).toFixed(2)}`],
              ['Method', selectedMethod?.name],
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={() => { setResult(null); setStep(0); setSelectedMethod(null); setAmountInput(''); setScreenshot(null); setReference(''); }}
            style={{ padding: '12px 28px', background: 'rgba(251,191,36,.15)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 12, color: '#fbbf24', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
            Make Another Deposit
          </button>
          <button onClick={() => router.push('/dashboard')}
            style={{ padding: '12px 28px', background: 'linear-gradient(135deg,#f59e0b,#fbbf24)', border: 'none', borderRadius: 12, color: '#050505', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
            Go to Dashboard
          </button>
        </div>
      </div>
    </PlayerLayout>
  )

  return (
    <PlayerLayout>
      <Head><title>Add Money — Casinoze Room</title></Head>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: toast.type === 'error' ? 'rgba(239,68,68,.95)' : 'rgba(16,185,129,.95)', border: `1px solid ${toast.type === 'error' ? '#ef4444' : '#10b981'}`, borderRadius: 12, padding: '12px 24px', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap', boxShadow: '0 8px 32px rgba(0,0,0,.4)' }}>
          {toast.type === 'error' ? '⚠ ' : '✓ '}{toast.msg}
        </div>
      )}

      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: "'Cinzel', serif", fontSize: 'clamp(20px,3vw,28px)', fontWeight: 700, color: '#fff', marginBottom: 4 }}>Add Money</h1>
          <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 14 }}>Deposit funds to your wallet. Credits appear after approval.</p>
        </div>

        <Steps current={step} />

        <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 20, padding: '28px' }}>

          {/* ── STEP 0: Select Method ── */}
          {step === 0 && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 20 }}>Choose Payment Method</h3>
              {methods.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,.3)' }}>No payment methods available. Please contact support.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {methods.map(m => <MethodCard key={m.id} method={m} selected={selectedMethod?.id === m.id} onSelect={setSelectedMethod} />)}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 1: Amount ── */}
          {step === 1 && selectedMethod && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Enter Amount</h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginBottom: 24 }}>
                Sending via <strong style={{ color: '#fff' }}>{selectedMethod.name}</strong>
              </p>

              {/* Amount input */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.5)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>Amount (USD)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,.4)' }}>$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={amountInput}
                    onChange={e => setAmountInput(e.target.value)}
                    style={{ width: '100%', padding: '16px 16px 16px 36px', background: 'rgba(255,255,255,.05)', border: '1.5px solid rgba(251,191,36,.3)', borderRadius: 12, color: '#fff', fontSize: 24, fontWeight: 700, fontFamily: "'Outfit',sans-serif", outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = '#fbbf24'}
                    onBlur={e => e.target.style.borderColor = 'rgba(251,191,36,.3)'}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>
                    Min: <MoneyDisplay cents={selectedMethod.min_deposit_cents} size="xs" color="rgba(255,255,255,.4)" />
                  </span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>
                    Max: <MoneyDisplay cents={selectedMethod.max_deposit_cents} size="xs" color="rgba(255,255,255,.4)" />
                  </span>
                </div>
              </div>

              {/* Quick amount buttons */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
                {[10, 25, 50, 100, 200, 500].map(amt => (
                  <button key={amt} onClick={() => setAmountInput(amt.toString())}
                    style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${amountInput === amt.toString() ? '#fbbf24' : 'rgba(255,255,255,.12)'}`, background: amountInput === amt.toString() ? 'rgba(251,191,36,.2)' : 'rgba(255,255,255,.04)', color: amountInput === amt.toString() ? '#fbbf24' : 'rgba(255,255,255,.6)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                    ${amt}
                  </button>
                ))}
              </div>

              {/* Bonus preview — calculated client-side for display only, re-calculated server-side */}
              {amountCents > 0 && (
                <div style={{ background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 14, padding: '18px 20px' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#10b981', marginBottom: 14 }}>💰 Deposit Summary</div>
                  {[
                    ['You Send',    amountCents,  '#fff'],
                    [`Bonus (+${bonusPct}%)`, bonusCents, '#10b981'],
                  ].map(([label, cents, color]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 14, color: 'rgba(255,255,255,.55)' }}>{label}</span>
                      <MoneyDisplay cents={cents} size="md" color={color} />
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Total Wallet Credit</span>
                    <MoneyDisplay cents={totalCents} size="lg" color="#f59e0b" />
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,.3)' }}>
                    * Final amounts are confirmed server-side upon approval
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Upload proof ── */}
          {step === 2 && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Upload Payment Proof</h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginBottom: 24 }}>
                Upload a screenshot of your payment or enter the transaction reference number.
              </p>

              {/* Screenshot upload */}
              <div style={{ marginBottom: 20 }}>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                <div onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${screenshot ? '#10b981' : 'rgba(251,191,36,.35)'}`, borderRadius: 16, padding: '32px 20px', textAlign: 'center', cursor: 'pointer', background: screenshot ? 'rgba(16,185,129,.06)' : 'rgba(255,255,255,.02)', transition: 'all .2s' }}
                  onMouseEnter={e => { if (!screenshot) e.currentTarget.style.borderColor = '#fbbf24' }}
                  onMouseLeave={e => { if (!screenshot) e.currentTarget.style.borderColor = 'rgba(251,191,36,.35)' }}
                >
                  {screenshot ? (
                    <div>
                      <img src={screenshot.preview} alt="Screenshot" style={{ maxHeight: 180, maxWidth: '100%', borderRadius: 10, marginBottom: 10, objectFit: 'contain' }} />
                      <div style={{ fontSize: 13, color: '#10b981', fontWeight: 700 }}>✓ {screenshot.name}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 4 }}>Click to change</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 40, marginBottom: 12 }}>📸</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Upload Screenshot</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>JPG, PNG, WebP · Max 5MB</div>
                    </div>
                  )}
                </div>
              </div>

              {/* OR divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.08)' }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', letterSpacing: '.06em' }}>OR</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.08)' }} />
              </div>

              {/* Reference field */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.5)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>Transaction Reference / Confirmation #</label>
                <input type="text" placeholder="e.g. CashApp: #ABC123" value={reference} onChange={e => setReference(e.target.value)}
                  style={{ width: '100%', padding: '13px 16px', background: 'rgba(255,255,255,.05)', border: '1.5px solid rgba(255,255,255,.1)', borderRadius: 12, color: '#fff', fontSize: 14, fontFamily: "'Outfit',sans-serif", outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = '#fbbf24'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.1)'}
                />
              </div>

              {/* Optional notes */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.5)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>Notes (Optional)</label>
                <textarea placeholder="Any additional information for our team…" value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  style={{ width: '100%', padding: '13px 16px', background: 'rgba(255,255,255,.05)', border: '1.5px solid rgba(255,255,255,.1)', borderRadius: 12, color: '#fff', fontSize: 14, fontFamily: "'Outfit',sans-serif", outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = '#fbbf24'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.1)'}
                />
              </div>
            </div>
          )}

          {/* ── STEP 3: Confirm ── */}
          {step === 3 && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 20 }}>Review & Confirm</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                {[
                  ['Payment Method', selectedMethod?.name],
                  ['Amount',         `$${(amountCents / 100).toFixed(2)}`],
                  [`Bonus (${bonusPct}%)`, `+$${(bonusCents / 100).toFixed(2)}`],
                  ['Total Credit',   `$${(totalCents / 100).toFixed(2)}`],
                  reference && ['Reference', reference],
                  screenshot && ['Screenshot', `${screenshot.name} (attached)`],
                ].filter(Boolean).map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,.03)', borderRadius: 10 }}>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>{value}</span>
                  </div>
                ))}
              </div>

              {screenshot?.preview && (
                <div style={{ marginBottom: 20, textAlign: 'center' }}>
                  <img src={screenshot.preview} alt="Payment proof" style={{ maxHeight: 160, maxWidth: '100%', borderRadius: 10, border: '1px solid rgba(255,255,255,.1)', objectFit: 'contain' }} />
                </div>
              )}

              <div style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 12, padding: '14px 16px', fontSize: 13, color: 'rgba(255,255,255,.55)', lineHeight: 1.6 }}>
                ⚠️ Please ensure your payment has been sent before submitting. False submissions may result in account suspension.
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, color: '#f87171', fontSize: 13, fontWeight: 600 }}>
              ⚠ {error}
            </div>
          )}

          {/* Navigation buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, gap: 12 }}>
            <button onClick={() => step > 0 ? setStep(s => s - 1) : router.push('/dashboard')}
              style={{ padding: '12px 24px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, color: 'rgba(255,255,255,.6)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
              ← {step === 0 ? 'Cancel' : 'Back'}
            </button>

            {step < 3 ? (
              <button onClick={handleNext}
                style={{ padding: '12px 32px', background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', border: 'none', borderRadius: 12, color: '#050505', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                Continue →
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting || uploading}
                style={{ padding: '12px 32px', background: submitting ? 'rgba(245,158,11,.4)' : 'linear-gradient(135deg,#f59e0b,#fbbf24)', border: 'none', borderRadius: 12, color: '#050505', fontSize: 14, fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: "'Outfit',sans-serif", display: 'flex', alignItems: 'center', gap: 8 }}>
                {uploading ? '⬆ Uploading…' : submitting ? '⏳ Submitting…' : '✓ Submit Deposit'}
              </button>
            )}
          </div>
        </div>

        {/* Recent deposits */}
        {myDeposits.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,.5)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>Recent Deposits</h3>
            <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, overflow: 'hidden' }}>
              {myDeposits.map((d, i) => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: i < myDeposits.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{d.reference_id}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>
                      {d.payment_methods?.name} · {new Date(d.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div>
                      <MoneyDisplay cents={d.amount_cents} size="sm" color="#fff" />
                      {d.bonus_cents > 0 && <div style={{ fontSize: 10, color: '#10b981', fontWeight: 700 }}>+<MoneyDisplay cents={d.bonus_cents} size="xs" color="#10b981" /> bonus</div>}
                    </div>
                    <StatusBadge status={d.status} size="xs" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PlayerLayout>
  )
}
