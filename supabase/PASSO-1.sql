-- PASSO 1 de 3 — Copia isto, cola no Supabase, clica RUN
-- Depois corre PASSO-2.sql

ALTER TABLE public.conversas DROP CONSTRAINT IF EXISTS conversas_id_artigo_vinted_fkey;
ALTER TABLE public.artigos_vinted DROP CONSTRAINT IF EXISTS artigos_vinted_id_artigo_key;
ALTER TABLE public.conversas DROP CONSTRAINT IF EXISTS conversas_id_vinted_key;

ALTER TABLE public.artigos ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.artigos_vinted ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS aberta_em TIMESTAMPTZ;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS item_fechado BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.artigos ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.artigos_vinted ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.conversas ALTER COLUMN user_id SET DEFAULT auth.uid();
