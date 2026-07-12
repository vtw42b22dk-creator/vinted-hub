ALTER TABLE public.conversas DROP CONSTRAINT IF EXISTS conversas_id_artigo_vinted_fkey;
ALTER TABLE public.artigos_vinted DROP CONSTRAINT IF EXISTS artigos_vinted_id_artigo_key;
ALTER TABLE public.conversas DROP CONSTRAINT IF EXISTS conversas_id_vinted_key;
ALTER TABLE public.artigos_vinted DROP CONSTRAINT IF EXISTS artigos_vinted_user_artigo_unique;
ALTER TABLE public.conversas DROP CONSTRAINT IF EXISTS conversas_user_vinted_unique;

ALTER TABLE public.artigos ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.artigos_vinted ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS aberta_em TIMESTAMPTZ;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS item_fechado BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.artigos ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.artigos_vinted ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.conversas ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.artigos_vinted ADD CONSTRAINT artigos_vinted_user_artigo_unique UNIQUE (user_id, id_artigo);
ALTER TABLE public.conversas ADD CONSTRAINT conversas_user_vinted_unique UNIQUE (user_id, id_vinted);

DROP VIEW IF EXISTS public.artigos_vinted_com_lucro;
CREATE VIEW public.artigos_vinted_com_lucro AS
SELECT *, (preco_venda - preco_custo) AS lucro_bruto,
CASE WHEN preco_venda > 0 THEN ROUND(((preco_venda - preco_custo) / preco_venda) * 100, 1) ELSE 0 END AS margem_percentual
FROM public.artigos_vinted;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sync_secret TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
