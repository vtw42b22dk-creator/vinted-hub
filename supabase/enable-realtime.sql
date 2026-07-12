-- Ativar tempo real (Supabase Realtime) — corre uma vez no SQL Editor

ALTER TABLE public.conversas REPLICA IDENTITY FULL;
ALTER TABLE public.artigos_vinted REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversas;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.artigos_vinted;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
