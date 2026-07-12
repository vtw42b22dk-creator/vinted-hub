-- Migração: campos para gestão de estado das conversas
-- Executar no Supabase SQL Editor

ALTER TABLE public.conversas
  ADD COLUMN IF NOT EXISTS aberta_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS item_fechado BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_conversas_aberta ON public.conversas (aberta_em);
