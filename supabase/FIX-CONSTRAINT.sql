-- FIX RÁPIDO — corre isto PRIMEIRO, depois volta a correr SETUP-TUDO.sql
-- (ou cola só isto se o resto já correu)

ALTER TABLE public.conversas DROP CONSTRAINT IF EXISTS conversas_id_artigo_vinted_fkey;

ALTER TABLE public.artigos_vinted DROP CONSTRAINT IF EXISTS artigos_vinted_id_artigo_key;
ALTER TABLE public.artigos_vinted DROP CONSTRAINT IF EXISTS artigos_vinted_user_artigo_unique;
ALTER TABLE public.artigos_vinted ADD CONSTRAINT artigos_vinted_user_artigo_unique UNIQUE (user_id, id_artigo);

ALTER TABLE public.conversas DROP CONSTRAINT IF EXISTS conversas_id_vinted_key;
ALTER TABLE public.conversas DROP CONSTRAINT IF EXISTS conversas_user_vinted_unique;
ALTER TABLE public.conversas ADD CONSTRAINT conversas_user_vinted_unique UNIQUE (user_id, id_vinted);
