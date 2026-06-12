import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const AZAMPAY_CLIENT_ID = Deno.env.get('AZAMPAY_CLIENT_ID')!
const AZAMPAY_CLIENT_SECRET = Deno.env.get('AZAMPAY_CLIENT_SECRET')!
const AZAMPAY_API_KEY = Deno.env.get('AZAMPAY_API_KEY')!
const AZAMPAY_APP_NAME = Deno.env.get('AZAMPAY_APP_NAME') || 'jpm'
const AZAMPAY_SANDBOX = Deno.env.get('AZAMPAY_SANDBOX') === 'true'

const AZAMPAY_AUTH_URL = AZAMPAY_SANDBOX
  ? 'https://authenticator-sandbox.azampay.co.tz/AppRegistration/GenerateToken'
  : 'https://authenticator.azampay.co.tz/AppRegistration/GenerateToken'

const AZAMPAY_CHECKOUT_URL = AZAMPAY_SANDBOX
  ? 'https://sandbox.azampay.co.tz/azampay/mno/checkout'
  : 'https://checkout.azampay.co.tz/azampay/mno/checkout'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getAzamPayToken(): Promise<string> {
  const res = await fetch(AZAMPAY_AUTH_URL, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-API-KEY': AZAMPAY_API_KEY,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    body: JSON.stringify({
      appName: AZAMPAY_APP_NAME,
      clientId: AZAMPAY_CLIENT_ID,
      clientSecret: AZAMPAY_CLIENT_SECRET,
    }),
  })
  
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`AzamPay auth failed: ${err}`)
  }
  
  const data = await res.json()
  return data.data?.accessToken
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { email, name, phone, address, city, amount, items, provider, buyerId, deliveryFee } = await req.json()

    // Validate inputs
    if (!phone || !amount || !provider || !buyerId) {
      return new Response(JSON.stringify({ error: 'Missing required fields.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Normalize phone: strip leading 0 or +255, keep 9 digits
    const normalizedPhone = phone.replace(/^\+?255/, '').replace(/^0/, '').replace(/\D/g, '')

    // Create pending order in DB first
    const orderId = crypto.randomUUID()
    const { error: orderError } = await supabase.from('orders').insert({
      id: orderId,
      buyer_id: buyerId,
      buyer_email: email,
      buyer_name: name,
      buyer_phone: normalizedPhone,
      buyer_address: address,
      buyer_city: city,
      total_amount: amount,
      status: 'pending',
    })

    if (orderError) throw new Error(`Order creation failed: ${orderError.message}`)

    // Get AzamPay token
    const token = await getAzamPayToken()

    // Return token to the client so the client app can bypass the WAF
    return new Response(JSON.stringify({
      orderId,
      accessToken: token,
      apiKey: AZAMPAY_API_KEY
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error('Checkout error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
