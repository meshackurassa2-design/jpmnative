import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
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
    const { amount, accountNumber, provider, transactionType = 'BUY_COINS', metadata = {} } = await req.json()

    // 1. Get the Auth User
    const authHeader = req.headers.get('Authorization')!
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    // Generate unique external ID for this transaction
    const externalId = `txn_${Date.now()}_${Math.floor(Math.random() * 1000)}`

    // 2. Insert PENDING transaction using Service Role to bypass RLS if needed, 
    // but here we can just use the user client since they have INSERT policy
    const { error: dbError } = await supabaseClient
      .from('azampay_transactions')
      .insert({
        user_id: user.id,
        amount: parseInt(amount, 10),
        currency: 'TZS',
        provider,
        account_number: accountNumber,
        external_id: externalId,
        status: 'PENDING',
        transaction_type: transactionType,
        metadata: metadata
      })

    if (dbError) throw dbError

    // 3. Get AzamPay Bearer Token
    const appName = Deno.env.get('AZAMPAY_APP_NAME')
    const clientId = Deno.env.get('AZAMPAY_CLIENT_ID')
    const clientSecret = Deno.env.get('AZAMPAY_CLIENT_SECRET')
    const environment = Deno.env.get('AZAMPAY_ENVIRONMENT') || 'sandbox'

    const authUrl = environment === 'sandbox' 
      ? 'https://authenticator-sandbox.azampay.co.tz/AppRegistration/GenerateToken'
      : 'https://authenticator.azampay.co.tz/AppRegistration/GenerateToken'

    const tokenRes = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appName,
        clientId,
        clientSecret
      })
    })

    if (!tokenRes.ok) {
      const errText = await tokenRes.text()
      throw new Error(`Failed to generate AzamPay token: ${errText}`)
    }

    const tokenData = await tokenRes.json()
    const bearerToken = tokenData.data?.bearerToken || tokenData.bearerToken || tokenData.data?.accessToken || tokenData.accessToken || tokenData.access_token

    if (!bearerToken) {
      throw new Error('No bearer token received from AzamPay')
    }

    // 4. Initiate MNO Checkout
    const checkoutUrl = environment === 'sandbox'
      ? 'https://sandbox.azampay.co.tz/azampay/mno/checkout'
      : 'https://checkout.azampay.co.tz/azampay/mno/checkout'

    const checkoutRes = await fetch(checkoutUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'X-Api-Key': Deno.env.get('AZAMPAY_API_KEY') || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accountNumber: accountNumber,
        amount: amount.toString(),
        currency: "TZS",
        externalId: externalId,
        provider: provider // e.g., "Mpesa", "Tigo", "Airtel", "Halopesa"
      })
    })

    const checkoutText = await checkoutRes.text()
    let checkoutData: any = {}
    try {
      if (checkoutText) {
        checkoutData = JSON.parse(checkoutText)
      }
    } catch (e) {
      throw new Error(`AzamPay checkout failed. Response: ${checkoutText}`)
    }

    if (!checkoutRes.ok || checkoutData?.success === false) {
      // Mark as failed in DB
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      await supabaseAdmin.from('azampay_transactions')
        .update({ status: 'FAILED' })
        .eq('external_id', externalId)

      return new Response(
        JSON.stringify({ error: 'AzamPay Checkout Failed', details: checkoutData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // 5. Update transaction with AzamPay reference ID if available
    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    if (checkoutData.transactionId) {
        await supabaseAdmin.from('azampay_transactions')
            .update({ reference_id: checkoutData.transactionId })
            .eq('external_id', externalId)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Push request sent to user phone',
        externalId,
        azampayResponse: checkoutData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
