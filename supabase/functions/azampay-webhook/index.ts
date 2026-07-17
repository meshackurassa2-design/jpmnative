import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Webhook doesn't need strict CORS since it's called server-to-server, 
// but we include it just in case AzamPay sends preflight.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    // AzamPay typical callback payload structure
    // {
    //    "msisdn": "0123456789",
    //    "amount": "1000",
    //    "message": "Transaction Successful",
    //    "utilityref": "...",
    //    "operator": "Tigo",
    //    "reference": "12345",
    //    "transactionstatus": "success",
    //    "submerchantAcc": "...",
    //    "externalId": "txn_xxx",
    //    "transactionid": "az_xxx"
    // }

    const { externalId, transactionstatus, transactionid, amount } = body

    if (!externalId) {
       return new Response('Missing externalId', { status: 400 })
    }

    const isSuccess = (transactionstatus || '').toLowerCase() === 'success' || (body.status || '').toLowerCase() === 'success' || body.success === true

    // Initialize Supabase Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Find the pending transaction
    const { data: txn, error: fetchErr } = await supabaseAdmin
      .from('azampay_transactions')
      .select('*')
      .eq('external_id', externalId)
      .single()

    if (fetchErr || !txn) {
      console.error(`Transaction not found for externalId: ${externalId}`)
      return new Response('Transaction not found', { status: 404 })
    }

    if (txn.status !== 'PENDING') {
      console.log(`Transaction ${externalId} is already processed with status ${txn.status}`)
      return new Response('Already processed', { status: 200 })
    }

    if (isSuccess) {
      // 1. Update status to APPROVED
      await supabaseAdmin
        .from('azampay_transactions')
        .update({ 
          status: 'APPROVED', 
          reference_id: transactionid || txn.reference_id 
        })
        .eq('id', txn.id)

      // 2. Smart Router: Handle action based on transaction_type
      if (txn.transaction_type === 'BUY_COINS') {
        const { error: rpcError } = await supabaseAdmin.rpc('receive_coins', {
          p_user_id: txn.user_id,
          p_amount: txn.amount // Use the exact amount we initiated with
        })
        if (rpcError) console.error(`Failed to credit coins for ${txn.user_id}:`, rpcError)
      } 
      else if (txn.transaction_type === 'SHOP_FEE') {
        const meta = txn.metadata || {}
        const { error: insertErr } = await supabaseAdmin.from('shops').insert({
          owner_id: txn.user_id,
          name: meta.shopName,
          description: meta.description,
          category: meta.category,
          location_city: meta.city,
          tra_tin: meta.traTin,
          status: 'pending',
          is_paid: true,
        })
        if (insertErr) console.error(`Failed to insert shop for ${txn.user_id}:`, insertErr)
      }
    } else {
      // Mark as FAILED
      await supabaseAdmin
        .from('azampay_transactions')
        .update({ 
          status: 'FAILED', 
          reference_id: transactionid || txn.reference_id 
        })
        .eq('id', txn.id)
    }

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    })

  } catch (error: any) {
    console.error('Webhook processing error:', error)
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500 
    })
  }
})
