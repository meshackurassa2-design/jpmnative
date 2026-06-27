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

    const { generation_id } = await req.json()
    if (!generation_id) throw new Error('Missing generation_id')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Get the Operation ID from the database
    const { data: row, error: rowError } = await supabaseAdmin
      .from('video_generations')
      .select('thumbnail_url, status')
      .eq('id', generation_id)
      .eq('user_id', user.id)
      .single()

    if (rowError || !row) throw new Error('Generation not found')
    
    if (row.status !== 'processing') {
       return new Response(JSON.stringify({ status: row.status }), { headers: corsHeaders })
    }

    const operationId = row.thumbnail_url
    if (!operationId) throw new Error('No operation ID found')

    // Always use the key the user provided
    const GEMINI_API_KEY = "YOUR_API_KEY_HERE"

    // MOCK MODE FOR TESTING WITHOUT COST
    if (operationId === 'mock_operation_123') {
        const mockVideoUrl = 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
        await supabaseAdmin.from('video_generations').update({
            status: 'completed',
            video_url: mockVideoUrl,
            thumbnail_url: null,
            completed_at: new Date().toISOString()
        }).eq('id', generation_id)
        return new Response(JSON.stringify({ status: 'completed' }), { headers: corsHeaders })
    }

    // 2. Poll the operation directly via Google REST API to avoid Deno npm import bugs
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${operationId}?key=${GEMINI_API_KEY}`)
    
    if (!res.ok) {
        const errorText = await res.text()
        console.error('Failed to poll operation:', errorText)
        
        // If it's a 404 or 403, fail the generation entirely so they aren't stuck forever and they get their refund
        if (res.status === 404 || res.status === 403) {
            await supabaseAdmin.from('video_generations').update({ status: 'failed', completed_at: new Date().toISOString() }).eq('id', generation_id)
            await supabaseAdmin.rpc('refund_studio_coins', { p_user_id: user.id })
            return new Response(JSON.stringify({ status: 'failed', error: `Google API rejected polling: ${errorText.substring(0, 200)}` }), { headers: corsHeaders })
        }

        // Otherwise keep processing
        return new Response(JSON.stringify({ status: 'processing' }), { headers: corsHeaders })
    }

    const operation = await res.json()

    if (operation.done) {
      if (operation.error) {
        await supabaseAdmin.from('video_generations').update({ status: 'failed', completed_at: new Date().toISOString() }).eq('id', generation_id)
        await supabaseAdmin.rpc('refund_studio_coins', { p_user_id: user.id })
        return new Response(JSON.stringify({ status: 'failed', error: operation.error.message }), { headers: corsHeaders })
      }

      // Extract the video URI from the completed Long Running Operation response
      let videoUri = operation.response?.generatedVideos?.[0]?.video?.uri
                    || operation.response?.predictions?.[0]?.videoUri
                    || operation.response?.videoUri
                    || ''

      // Google Video URIs require the API key to stream/download
      if (videoUri && !videoUri.includes('key=')) {
        videoUri = videoUri.includes('?') ? `${videoUri}&key=${GEMINI_API_KEY}` : `${videoUri}?key=${GEMINI_API_KEY}`
      }

      await supabaseAdmin.from('video_generations').update({
        status: 'completed',
        video_url: videoUri,
        thumbnail_url: null,
        completed_at: new Date().toISOString()
      }).eq('id', generation_id)

      return new Response(JSON.stringify({ status: 'completed', video_url: videoUri }), { headers: corsHeaders })
    }

    // Still rendering
    return new Response(JSON.stringify({ status: 'processing' }), { headers: corsHeaders })

  } catch (error: any) {
    console.error('Edge Function Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
