import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { publicEncrypt, constants } from "node:crypto";
import { Buffer } from "node:buffer";

// M-Pesa OpenAPI - Tanzania (Vodacom)
// Auth: RSA PKCS1 v1.5 encrypt API key → base64 → Bearer token for getSession
// C2B: RSA PKCS1 v1.5 encrypt Session ID → base64 → Bearer token

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { amount, phone_number } = await req.json();
    if (!amount || !phone_number) throw new Error("Amount and phone_number are required");

    // 1. Verify user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("No Authorization header");

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !user) throw new Error(`Auth failed: ${userError?.message || 'No user'}`);

    // 2. Prepare keys
    let publicKeyPem = Deno.env.get('MPESA_PUBLIC_KEY') || '';
    const apiKey = Deno.env.get('MPESA_API_KEY') || '';
    if (!publicKeyPem || !apiKey) throw new Error("M-Pesa secrets not configured");

    // Ensure PEM headers
    if (!publicKeyPem.includes('-----BEGIN')) {
      const cleaned = publicKeyPem.replace(/\s/g, '');
      const chunked = cleaned.match(/.{1,64}/g)?.join('\n') ?? cleaned;
      publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${chunked}\n-----END PUBLIC KEY-----`;
    }

    // RSA PKCS1 v1.5 encrypt using Node.js crypto (OpenSSL)
    const rsaEncrypt = (data: string): string => {
      const encrypted = publicEncrypt(
        { key: publicKeyPem, padding: constants.RSA_PKCS1_PADDING },
        Buffer.from(data, 'utf8')
      );
      return encrypted.toString('base64');
    };

    // 3. Get Session from M-Pesa
    const encryptedApiKey = rsaEncrypt(apiKey);
    console.log("Calling M-Pesa getSession...");

    const sessionRes = await fetch(
      "https://openapi.m-pesa.com/sandbox/ipg/v2/vodacomTZN/getSession/",
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${encryptedApiKey}`,
          "Content-Type": "application/json",
          "Origin": "developer.mpesa.vm.co.tz",
        },
      }
    );

    const sessionText = await sessionRes.text();
    console.log("getSession response:", sessionText);
    
    const sessionData = JSON.parse(sessionText);
    if (!sessionData.output_SessionID) {
      throw new Error(`M-Pesa Session Error: ${JSON.stringify(sessionData)}`);
    }

    const sessionId = sessionData.output_SessionID;
    console.log("Got session ID, encrypting for C2B...");

    // 4. Encrypt session ID for C2B
    const encryptedSession = rsaEncrypt(sessionId);

    // 5. C2B Payment
    const transactionReference = `DPZ${Date.now()}`;
    
    const c2bRes = await fetch(
      "https://openapi.m-pesa.com/sandbox/ipg/v2/vodacomTZN/c2bPayment/singleStage/",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${encryptedSession}`,
          "Content-Type": "application/json",
          "Origin": "developer.mpesa.vm.co.tz",
        },
        body: JSON.stringify({
          input_Amount: String(amount),
          input_Country: "TZN",
          input_Currency: "TZS",
          input_CustomerMSISDN: phone_number,
          input_ServiceProviderCode: "000000",
          input_ThirdPartyConversationID: transactionReference,
          input_TransactionReference: transactionReference,
          input_PurchasedItemsDesc: "Dapaz Coins Topup",
        }),
      }
    );

    const c2bText = await c2bRes.text();
    console.log("C2B response:", c2bText);
    
    const c2bData = JSON.parse(c2bText);
    if (c2bData.output_ResponseCode !== "INS-0") {
      throw new Error(`M-Pesa Error: ${c2bData.output_ResponseDesc || JSON.stringify(c2bData)}`);
    }

    // 6. Log transaction
    await supabaseAdmin.from('mpesa_transactions').insert({
      user_id: user.id,
      amount,
      phone_number,
      transaction_reference: transactionReference,
      conversation_id: c2bData.output_ConversationID,
      status: 'PENDING',
    });

    return new Response(
      JSON.stringify({ success: true, message: "M-Pesa PIN prompt sent!", transactionId: transactionReference }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error("Error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});
