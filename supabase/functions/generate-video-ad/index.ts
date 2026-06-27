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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    const { prompt, language, image_url } = await req.json()
    if (!prompt) throw new Error('Missing prompt')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Securely deduct 5,000 Coins
    const { error: chargeError } = await supabaseAdmin.rpc('spend_studio_coins', { p_user_id: user.id })
    if (chargeError) {
      return new Response(JSON.stringify({ error: chargeError.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Always use the key the user provided
    const GEMINI_API_KEY = "YOUR_API_KEY_HERE"

    // 2. Track the generation
    const { data: genRow, error: genError } = await supabaseAdmin
      .from('video_generations')
      .insert({ user_id: user.id, prompt, language, status: 'processing' })
      .select()
      .single()

    if (genError) throw genError

    let veoData;
    let rawText = "";
    
    // 3. Call Veo 3 directly via predictLongRunning
    try {
      // MOCK MODE FOR TESTING WITHOUT COST
      if (prompt.toLowerCase().trim() === 'mock') {
        await supabaseAdmin
          .from('video_generations')
          .update({ thumbnail_url: 'mock_operation_123' })
          .eq('id', genRow.id)

        return new Response(
          JSON.stringify({ success: true, generation_id: genRow.id, message: 'Mock video generation started!' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const veoPrompt = `Create a 10-second cinematic product ad. Prompt: ${prompt}. Language style context: ${language}.`
      
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: veoPrompt }],
          parameters: { aspectRatio: "16:9" }
        })
      })

      rawText = await res.text()
      if (!res.ok) {
         await supabaseAdmin.from('video_generations').update({ status: 'failed' }).eq('id', genRow.id)
         await supabaseAdmin.rpc('refund_studio_coins', { p_user_id: user.id })
         throw new Error(`Google API Rejected Request (Code ${res.status}): ${rawText.substring(0, 500)}`)
      }
      
      veoData = JSON.parse(rawText)
    } catch (error: any) {
      // Don't refund again if we already refunded inside the block
      if (!error.message.includes('Google API Rejected Request')) {
         await supabaseAdmin.from('video_generations').update({ status: 'failed' }).eq('id', genRow.id)
         await supabaseAdmin.rpc('refund_studio_coins', { p_user_id: user.id })
      }
      throw new Error(`Gemini API Error: ${error.message}`)
    }

    const operationId = veoData?.name
    if (!operationId) {
      await supabaseAdmin.from('video_generations').update({ status: 'failed' }).eq('id', genRow.id)
      await supabaseAdmin.rpc('refund_studio_coins', { p_user_id: user.id })
      throw new Error(`Google API succeeded but returned no operation name! Response: ${rawText}`)
    }

    // 4. Store the operation ID in the thumbnail_url column temporarily
    await supabaseAdmin
      .from('video_generations')
      .update({ thumbnail_url: operationId })
      .eq('id', genRow.id)

    return new Response(
      JSON.stringify({ success: true, generation_id: genRow.id, message: 'Video generation started!' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Edge Function Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
