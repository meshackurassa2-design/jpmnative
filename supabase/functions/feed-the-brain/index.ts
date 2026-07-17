import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id, content, source } = await req.json()

    if (!user_id || !content) {
      return new Response(JSON.stringify({ error: 'user_id and content are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1. Check if user has unlocked the AI Brain
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('ai_subscription_ends_at')
      .eq('id', user_id)
      .single()

    const hasActiveSubscription = profileData?.ai_subscription_ends_at && new Date(profileData.ai_subscription_ends_at) > new Date()

    if (profileError || !hasActiveSubscription) {
      return new Response(JSON.stringify({ error: 'Payment Required: This user does not have an active Dapaz AI Pro subscription.' }), {
        status: 402, // Payment Required
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Get Embedding from Gemini API
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set in Edge Function secrets")
    }

    const embeddingResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text: content }] }
        })
      }
    )

    if (!embeddingResponse.ok) {
      const err = await embeddingResponse.text()
      throw new Error(`Gemini API Error: ${err}`)
    }

    const embeddingData = await embeddingResponse.json()
    const embedding = embeddingData.embedding?.values

    if (!embedding) {
      throw new Error("Failed to extract embedding values from Gemini response")
    }

    // 3. Save to Supabase ai_memory table

    const { error: dbError } = await supabaseClient
      .from('ai_memory')
      .insert({
        user_id,
        content,
        source: source || 'zapier',
        embedding,
      })

    if (dbError) throw dbError

    return new Response(
      JSON.stringify({ success: true, message: 'Memory successfully saved to AI Brain!' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error: any) {
    console.error('Webhook Error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
