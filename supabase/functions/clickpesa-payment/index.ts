import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── ClickPesa Credentials (set via: supabase secrets set) ──────────────────
const CLICKPESA_CLIENT_ID = Deno.env.get('CLICKPESA_CLIENT_ID')!
const CLICKPESA_API_KEY   = Deno.env.get('CLICKPESA_API_KEY')!
const CLICKPESA_BASE_URL  = 'https://api.clickpesa.com/third-parties'

// ── CORS ────────────────────────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Token cache (lives as long as the function instance is warm) ─────────────
let cachedToken: string | null = null
let tokenExpiresAt = 0

async function getClickPesaToken(): Promise<string> {
  // Re-use token if it's still valid (with 2-minute safety buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 120_000) {
    return cachedToken
  }

  const res = await fetch(`${CLICKPESA_BASE_URL}/generate-token`, {
    method: 'POST',
    headers: {
      'client-id': CLICKPESA_CLIENT_ID,
      'api-key':   CLICKPESA_API_KEY,
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`ClickPesa auth failed (${res.status}): ${body}`)
  }

  const data = await res.json()
  if (!data.token) throw new Error('ClickPesa: no token in response')

  // Token is valid for 1 hour
  cachedToken    = data.token  // already includes "Bearer "
  tokenExpiresAt = Date.now() + 60 * 60 * 1000
  return cachedToken
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function normalizePhone(raw: string): string {
  // Accept: 0712345678 | +255712345678 | 255712345678 → 255712345678
  return raw.replace(/\D/g, '').replace(/^0/, '255')
}

function makeOrderRef(prefix = 'JPM'): string {
  // Alphanumeric only, unique, must be <= 20 chars
  return `${prefix}${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`
}

// ── Main handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const { action } = body

    // ── 1. PREVIEW ────────────────────────────────────────────────────────────
    if (action === 'preview') {
      const { amount, phoneNumber, orderReference } = body

      if (!amount || !orderReference) {
        return json({ error: 'amount and orderReference are required' }, 400)
      }

      const token = await getClickPesaToken()
      const payload: Record<string, any> = {
        amount:         String(amount),
        currency:       'TZS',
        orderReference: orderReference,
      }
      if (phoneNumber) {
        payload.phoneNumber      = normalizePhone(phoneNumber)
        payload.fetchSenderDetails = true
      }

      const res = await fetch(`${CLICKPESA_BASE_URL}/payments/preview-ussd-push-request`, {
        method:  'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) return json({ error: data.message || 'Preview failed' }, res.status)
      return json(data)
    }

    // ── 2. INITIATE ───────────────────────────────────────────────────────────
    if (action === 'initiate') {
      const { amount, phoneNumber, userId, description } = body

      if (!amount || !phoneNumber || !userId) {
        return json({ error: 'amount, phoneNumber, and userId are required' }, 400)
      }

      const normalizedPhone = normalizePhone(phoneNumber)
      const orderReference  = makeOrderRef()

      // Store a pending payment record in Supabase first
      const { error: dbErr } = await supabase.from('clickpesa_payments').insert({
        order_reference: orderReference,
        user_id:         userId,
        amount:          Number(amount),
        currency:        'TZS',
        phone_number:    normalizedPhone,
        description:     description || null,
        status:          'PROCESSING',
      })

      if (dbErr) {
        console.error('DB insert error:', dbErr)
        // Don't block — just log, payment can still proceed
      }

      const token = await getClickPesaToken()
      const res   = await fetch(`${CLICKPESA_BASE_URL}/payments/initiate-ussd-push-request`, {
        method:  'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          amount:         String(amount),
          currency:       'TZS',
          orderReference: orderReference,
          phoneNumber:    normalizedPhone,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        // Clean up the pending record on failure
        await supabase.from('clickpesa_payments').delete().eq('order_reference', orderReference)
        return json({ error: data.message || 'Initiate failed' }, res.status)
      }

      return json({ ...data, orderReference })
    }

    // ── 3. CHECK STATUS ───────────────────────────────────────────────────────
    if (action === 'status') {
      const { orderReference } = body
      if (!orderReference) return json({ error: 'orderReference is required' }, 400)

      const token = await getClickPesaToken()
      const res   = await fetch(
        `${CLICKPESA_BASE_URL}/payments/${encodeURIComponent(orderReference)}`,
        { headers: { Authorization: token } }
      )

      const data = await res.json()
      if (!res.ok) return json({ error: data.message || 'Status check failed' }, res.status)

      // The API returns an array — take the first result
      const payment = Array.isArray(data) ? data[0] : data
      if (!payment) return json({ error: 'Payment not found' }, 404)

      // Update our local DB record
      if (payment.status) {
        await supabase
          .from('clickpesa_payments')
          .update({
            status:           payment.status,
            payment_reference: payment.paymentReference || null,
            updated_at:       new Date().toISOString(),
          })
          .eq('order_reference', orderReference)
      }

      return json(payment)
    }

    // ── 4. WEBHOOK (ClickPesa → Supabase) ─────────────────────────────────────
    if (action === 'webhook') {
      // ClickPesa POSTs directly to this endpoint
      // event: "PAYMENT RECEIVED" | "PAYMENT FAILED"
      const { event, data: eventData } = body

      console.log(`[clickpesa-webhook] event=${event}`, JSON.stringify(eventData))

      if (!eventData?.orderReference) return json({ received: true })

      const newStatus = event === 'PAYMENT RECEIVED' ? 'SUCCESS' : 'FAILED'

      const { error: updateErr } = await supabase
        .from('clickpesa_payments')
        .update({
          status:            newStatus,
          payment_reference: eventData.paymentReference || null,
          collected_amount:  eventData.collectedAmount  ? Number(eventData.collectedAmount) : null,
          channel:           eventData.channel          || null,
          updated_at:        new Date().toISOString(),
        })
        .eq('order_reference', eventData.orderReference)

      if (updateErr) console.error('[clickpesa-webhook] DB update error:', updateErr)

      // If success, you could trigger wallet top-up or order fulfilment here
      if (newStatus === 'SUCCESS') {
        // Example: update wallet balance
        const { data: paymentRow } = await supabase
          .from('clickpesa_payments')
          .select('user_id, amount')
          .eq('order_reference', eventData.orderReference)
          .single()

        if (paymentRow?.user_id) {
          // Credit the user's wallet — adjust table/column names to match your schema
          await supabase.rpc('credit_wallet', {
            p_user_id: paymentRow.user_id,
            p_amount:  paymentRow.amount,
          }).catch((e: any) => console.error('credit_wallet rpc error:', e))
        }
      }

      return json({ received: true })
    }

    return json({ error: `Unknown action: ${action}` }, 400)

  } catch (err: any) {
    console.error('[clickpesa-payment] Error:', err)
    return json({ error: err.message || 'Internal server error' }, 500)
  }
})

// ── Tiny helper ──────────────────────────────────────────────────────────────
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
