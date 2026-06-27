@echo off
set SUPABASE_ACCESS_TOKEN=sbp_YOUR_SUPABASE_TOKEN_HERE
npx supabase db execute --file scratch\setup_refund.sql --project-ref tgfuufsgkelgjjktbugg
npx supabase functions deploy generate-video-ad --no-verify-jwt --project-ref tgfuufsgkelgjjktbugg

