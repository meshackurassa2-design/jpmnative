-- Analytics Migration
-- Adds a view counter to the shops table for the Store Analytics Dashboard

ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;
