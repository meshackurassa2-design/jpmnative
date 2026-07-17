// lib/clickpesa.ts
// ── ClickPesa Payment Service ─────────────────────────────────────────────
// All calls go through the Supabase Edge Function so API keys never leave the server.

import { createClient } from './supabase'

const supabase = createClient()

// The project URL is already in your .env
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://aarqgytazwnlwveeqwdd.supabase.co'

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/clickpesa-payment`

// ── Types ────────────────────────────────────────────────────────────────────

export type PaymentStatus =
  | 'PROCESSING'
  | 'SUCCESS'
  | 'SETTLED'
  | 'FAILED'
  | 'PENDING'

export interface PaymentMethod {
  name:    string   // e.g. "TIGO-PESA"
  status:  'AVAILABLE' | 'UNAVAILABLE'
  fee?:    number
  message?: string
}

export interface PreviewResult {
  activeMethods: PaymentMethod[]
  sender?: {
    accountName:     string
    accountNumber:   string
    accountProvider: string
  }
}

export interface InitiateResult {
  id:               string
  status:           PaymentStatus
  channel:          string
  orderReference:   string
  collectedAmount:  string
  collectedCurrency:string
  createdAt:        string
  clientId:         string
}

export interface PaymentStatusResult {
  id:                string
  status:            PaymentStatus
  paymentReference?: string
  paymentPhoneNumber?:string
  orderReference:    string
  collectedAmount?:  number
  collectedCurrency?:string
  message?:          string
  updatedAt:         string
  createdAt:         string
  customer?: {
    customerName?:        string
    customerPhoneNumber?: string
    customerEmail?:       string
  }
}

// ── Private helper ────────────────────────────────────────────────────────────
async function callFunction(payload: Record<string, any>) {
  const { data: session } = await supabase.auth.getSession()
  const accessToken = session?.session?.access_token

  const res = await fetch(FUNCTION_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(payload),
  })

  const json = await res.json()
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`)
  return json
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Step 1 — Validate amount, phone, and check available payment methods.
 * Call this before showing the "Pay" button to the user.
 */
export async function previewPayment(
  amount: number,
  orderReference: string,
  phoneNumber?: string,
): Promise<PreviewResult> {
  return callFunction({ action: 'preview', amount, orderReference, phoneNumber })
}

/**
 * Step 2 — Send the USSD push to the customer's phone.
 * The customer will get a prompt to enter their mobile money PIN.
 * Returns an orderReference you must use for polling in step 3.
 */
export async function initiatePayment(
  amount:      number,
  phoneNumber: string,
  userId:      string,
  description?: string,
): Promise<InitiateResult & { orderReference: string }> {
  return callFunction({ action: 'initiate', amount, phoneNumber, userId, description })
}

/**
 * Step 3 — Poll until status is SUCCESS / FAILED / SETTLED.
 * Recommended: call every 3 seconds, max 60 seconds.
 */
export async function checkPaymentStatus(
  orderReference: string,
): Promise<PaymentStatusResult> {
  return callFunction({ action: 'status', orderReference })
}

/**
 * Convenience: initiate + poll until done. Calls onStatus after each poll.
 * Resolves with the final payment status.
 * Rejects if payment fails or times out.
 */
export async function initiateAndWait(
  amount:      number,
  phoneNumber: string,
  userId:      string,
  description?: string,
  options?: {
    intervalMs?: number   // default 3000
    timeoutMs?:  number   // default 60000
    onStatus?:   (status: PaymentStatus) => void
  },
): Promise<PaymentStatusResult> {
  const { intervalMs = 3000, timeoutMs = 60_000, onStatus } = options ?? {}

  const result = await initiatePayment(amount, phoneNumber, userId, description)
  const { orderReference } = result

  return new Promise((resolve, reject) => {
    const start = Date.now()

    const poll = async () => {
      try {
        const payment = await checkPaymentStatus(orderReference)
        onStatus?.(payment.status)

        if (payment.status === 'SUCCESS' || payment.status === 'SETTLED') {
          return resolve(payment)
        }
        if (payment.status === 'FAILED') {
          return reject(new Error(payment.message || 'Payment failed'))
        }

        // Still PROCESSING or PENDING
        if (Date.now() - start > timeoutMs) {
          return reject(new Error('Payment timed out — please check your phone'))
        }

        setTimeout(poll, intervalMs)
      } catch (err) {
        reject(err)
      }
    }

    // First poll after a short delay (give ClickPesa time to process)
    setTimeout(poll, intervalMs)
  })
}
