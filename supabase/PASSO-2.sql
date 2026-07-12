-- PASSO 2 de 3 — Copia isto, cola no Supabase, clica RUN
-- Depois corre PASSO-3.sql

ALTER TABLE public.artigos_vinted DROP CONSTRAINT IF EXISTS artigos_vinted_user_artigo_unique;
ALTER TABLE public.artigos_vinted ADD CONSTRAINT artigos_vinted_user_artigo_unique UNIQUE (user_id, id_artigo);

ALTER TABLE public.conversas DROP CONSTRAINT IF EXISTS conversas_user_vinted_unique;
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

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, sync_secret) VALUES (NEW.id, encode(gen_random_bytes(24), 'hex'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (id, sync_secret)
SELECT id, encode(gen_random_bytes(24), 'hex') FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles) ON CONFLICT (id) DO NOTHING;
