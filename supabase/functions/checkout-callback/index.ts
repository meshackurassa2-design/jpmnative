// supabase/functions/checkout-callback/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const body = await req.json()
    console.log('AzamPay callback received:', JSON.stringify(body))

    // AzamPay sends: { transactionStatus, message, externalId (= our orderId), ... }
    const { externalId, transactionStatus } = body

    if (!externalId) {
      return new Response(JSON.stringify({ error: 'Missing externalId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Map AzamPay statuses to our status
    // AzamPay success statuses: 'success', 'COMPLETED'
    let status = 'failed'
    if (
      transactionStatus?.toLowerCase() === 'success' ||
      transactionStatus?.toLowerCase() === 'completed'
    ) {
      status = 'paid'
    }

    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', externalId)

    if (error) throw new Error(error.message)

    console.log(`Order ${externalId} updated to status: ${status}`)

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error('Callback error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
