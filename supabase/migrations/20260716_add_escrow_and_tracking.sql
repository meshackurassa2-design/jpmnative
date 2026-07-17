-- supabase/migrations/20260716_add_escrow_and_tracking.sql
-- Add shipping receipt URL for tracking, and escrow columns for holding seller funds

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS shipping_receipt_url TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS escrow_release_date TIMESTAMPTZ;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_escrow_released BOOLEAN DEFAULT false;

-- Make sure we have a shop_documents bucket for uploading these receipts if not already exist
-- It probably already exists since we used it in register-shop.tsx, but just in case:
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop_documents', 'shop_documents', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated users to upload to shop_documents
CREATE POLICY "Allow authenticated uploads to shop_documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'shop_documents');

-- Policy to allow everyone to view shop_documents
CREATE POLICY "Allow public read from shop_documents"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'shop_documents');

-- Policy to allow sellers to update their own order items
CREATE POLICY "Sellers can update their own order items"
ON order_items
FOR UPDATE
TO authenticated
USING (shop_id = auth.uid())
WITH CHECK (shop_id = auth.uid());
