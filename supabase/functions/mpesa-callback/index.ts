import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

serve(async (req) => {
  // M-Pesa sends server-to-server callbacks here after a transaction succeeds or fails.
  try {
    const data = await req.json();
    console.log("M-Pesa Webhook Received: ", JSON.stringify(data));

    // For C2B, M-Pesa usually sends output_ResponseCode, output_ResponseDesc, output_ConversationID etc.
    // Or sometimes a nested body. We will look for ConversationID or TransactionID
    const conversationId = data?.output_ConversationID || data?.ConversationID || data?.input_ThirdPartyConversationID;
    const responseCode = data?.output_ResponseCode || data?.ResponseCode;
    const responseDesc = data?.output_ResponseDesc || data?.ResponseDesc;

    if (!conversationId) {
      return new Response("Invalid Payload", { status: 400 });
    }

    // Initialize Supabase Admin client to update the ledger securely
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find the pending transaction
    const { data: transaction, error: txError } = await supabaseAdmin
      .from('mpesa_transactions')
      .select('*')
      .eq('conversation_id', conversationId)
      .single();

    if (txError || !transaction) {
      console.error("Transaction not found for ConversationID: ", conversationId);
      return new Response("Transaction not found", { status: 404 });
    }

    if (transaction.status !== 'PENDING') {
      return new Response("Transaction already processed", { status: 200 });
    }

    if (responseCode === "INS-0" || responseCode === "0" || responseDesc?.toLowerCase().includes("success")) {
      // Payment Successful!
      
      // 1. Update Transaction Status
      await supabaseAdmin
        .from('mpesa_transactions')
        .update({ status: 'COMPLETED' })
        .eq('id', transaction.id);

      // 2. Add Coins to User's Wallet (using an RPC or a read-then-update)
      // Read current balance
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('wallet_balance')
        .eq('id', transaction.user_id)
        .single();
        
      const currentBalance = profile?.wallet_balance || 0;
      
      // Update balance
      await supabaseAdmin
        .from('profiles')
        .update({ wallet_balance: currentBalance + Number(transaction.amount) })
        .eq('id', transaction.user_id);

      console.log(`Successfully added ${transaction.amount} coins to user ${transaction.user_id}`);

    } else {
      // Payment Failed
      await supabaseAdmin
        .from('mpesa_transactions')
        .update({ status: 'FAILED' })
        .eq('id', transaction.id);
        
      console.log(`Payment failed for ConversationID: ${conversationId}`);
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Success" }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error("Webhook Error:", error.message);
    return new Response("Internal Server Error", { status: 500 });
  }
});
