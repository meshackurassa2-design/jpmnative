import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { GoogleAuth } from 'npm:google-auth-library'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Validate Admin Request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing Authorization header')
    }

    // 2. Setup Google Auth using Service Account JSON stored in secrets
    const googleCredentialsStr = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    if (!googleCredentialsStr) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON secret is missing')
    }
    
    const credentials = JSON.parse(googleCredentialsStr)
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/admob.report'],
    })
    
    const client = await auth.getClient()
    
    // 3. Get AdMob Publisher ID from Secrets
    const publisherId = Deno.env.get('ADMOB_PUBLISHER_ID')
    if (!publisherId) {
      throw new Error('ADMOB_PUBLISHER_ID secret is missing')
    }

    // 4. Calculate yesterday's date (AdMob operates on publisher timezone)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const year = yesterday.getFullYear()
    const month = yesterday.getMonth() + 1
    const day = yesterday.getDate()

    // 5. Query AdMob API for Network Report
    const res = await client.request({
      url: `https://admob.googleapis.com/v1/accounts/${publisherId}/networkReport:generate`,
      method: 'POST',
      data: {
        reportSpec: {
          dateRange: {
            startDate: { year, month, day },
            endDate: { year, month, day }
          },
          metrics: ['ESTIMATED_EARNINGS']
        }
      }
    })

    // 6. Parse AdMob Response
    let totalAdmobRevenue = 0
    const rows = (res.data as any) || []
    
    for (const line of rows) {
      if (line.row && line.row.metricValues && line.row.metricValues.ESTIMATED_EARNINGS) {
        totalAdmobRevenue = Number(line.row.metricValues.ESTIMATED_EARNINGS.microsValue) / 1000000
        break;
      }
    }

    // Return the revenue directly to the Admin UI
    return new Response(
      JSON.stringify({ 
        success: true,
        admob_revenue: totalAdmobRevenue
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error("AdMob Automation Error:", error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
