ALTER TABLE public.artigos_vinted DROP CONSTRAINT IF EXISTS artigos_vinted_user_artigo_unique;
ALTER TABLE public.artigos_vinted ADD CONSTRAINT artigos_vinted_user_artigo_unique UNIQUE (user_id, id_artigo);
