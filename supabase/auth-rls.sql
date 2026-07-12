-- ============================================================
-- AUTH + RLS — Executar no Supabase SQL Editor (depois do setup)
-- Login privado + sync secret por utilizador
-- ============================================================

-- Perfil com sync secret (extensão Chrome)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sync_secret TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Trigger: criar perfil ao registar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, sync_secret)
  VALUES (NEW.id, encode(gen_random_bytes(24), 'hex'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Colunas user_id
ALTER TABLE public.artigos ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.artigos_vinted ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Defaults para inserts autenticados
ALTER TABLE public.artigos ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.artigos_vinted ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.conversas ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Unique por utilizador (não global)
-- Remover FK antiga que dependia do unique em id_artigo
ALTER TABLE public.conversas DROP CONSTRAINT IF EXISTS conversas_id_artigo_vinted_fkey;

ALTER TABLE public.artigos_vinted DROP CONSTRAINT IF EXISTS artigos_vinted_id_artigo_key;
ALTER TABLE public.artigos_vinted DROP CONSTRAINT IF EXISTS artigos_vinted_user_artigo_unique;
ALTER TABLE public.artigos_vinted ADD CONSTRAINT artigos_vinted_user_artigo_unique UNIQUE (user_id, id_artigo);

ALTER TABLE public.conversas DROP CONSTRAINT IF EXISTS conversas_id_vinted_key;
ALTER TABLE public.conversas DROP CONSTRAINT IF EXISTS conversas_user_vinted_unique;
ALTER TABLE public.conversas ADD CONSTRAINT conversas_user_vinted_unique UNIQUE (user_id, id_vinted);

-- Colunas de estado (se ainda não existirem)
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS aberta_em TIMESTAMPTZ;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS item_fechado BOOLEAN NOT NULL DEFAULT false;

-- Recriar view com user_id
DROP VIEW IF EXISTS public.artigos_vinted_com_lucro;
CREATE VIEW public.artigos_vinted_com_lucro AS
SELECT
  *,
  (preco_venda - preco_custo) AS lucro_bruto,
  CASE
    WHEN preco_venda > 0 THEN ROUND(((preco_venda - preco_custo) / preco_venda) * 100, 1)
    ELSE 0
  END AS margem_percentual
FROM public.artigos_vinted;

-- RLS
ALTER TABLE public.artigos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artigos_vinted ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "artigos_own" ON public.artigos;
CREATE POLICY "artigos_own" ON public.artigos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "artigos_vinted_own" ON public.artigos_vinted;
CREATE POLICY "artigos_vinted_own" ON public.artigos_vinted
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "conversas_own" ON public.conversas;
CREATE POLICY "conversas_own" ON public.conversas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Perfis para utilizadores já existentes (antes do trigger)
INSERT INTO public.profiles (id, sync_secret)
SELECT id, encode(gen_random_bytes(24), 'hex')
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;
