-- ============================================================
-- VINTED HUB — COLA TUDO ISTO NO SUPABASE SQL EDITOR → RUN
-- https://supabase.com/dashboard/project/varmqpsxxmwtuxwltppn/sql/new
-- Se der erro de rede: Settings → Restart project → espera 2 min → tenta outra vez
-- ============================================================

-- Tipos
DO $$ BEGIN
  CREATE TYPE status_inbox AS ENUM (
    'por_responder', 'proposta_recebida', 'proposta_enviada', 'em_negociacao', 'arquivada'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE status_negocio AS ENUM (
    'sem_proposta', 'proposta_pendente', 'aceite', 'recusada', 'expirada'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE status_artigo_vinted AS ENUM (
    'ativo', 'reservado', 'vendido', 'rascunho', 'oculto'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tabelas base
CREATE TABLE IF NOT EXISTS public.artigos (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT now(),
  nome                 TEXT NOT NULL,
  marca                TEXT,
  tamanho              TEXT,
  estado_artigo        TEXT NOT NULL DEFAULT 'Bom',
  preco_custo          NUMERIC(10, 2) NOT NULL DEFAULT 0,
  preco_venda_previsto NUMERIC(10, 2) NOT NULL DEFAULT 0,
  preco_venda_real     NUMERIC(10, 2),
  foto_url             TEXT,
  status               TEXT NOT NULL DEFAULT 'Em Stock'
);

CREATE TABLE IF NOT EXISTS public.artigos_vinted (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_artigo         TEXT NOT NULL,
  nome              TEXT NOT NULL,
  marca             TEXT,
  tamanho           TEXT,
  preco_venda       NUMERIC(10, 2) NOT NULL DEFAULT 0,
  preco_custo       NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status_artigo     status_artigo_vinted NOT NULL DEFAULT 'ativo',
  foto_url          TEXT,
  url_vinted        TEXT,
  sincronizado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_vinted           TEXT NOT NULL,
  user_comprador      TEXT NOT NULL,
  avatar_comprador    TEXT,
  ultimo_texto        TEXT,
  ultima_mensagem_de  TEXT NOT NULL DEFAULT 'comprador',
  status_inbox        status_inbox NOT NULL DEFAULT 'por_responder',
  status_negocio      status_negocio NOT NULL DEFAULT 'sem_proposta',
  valor_proposta      NUMERIC(10, 2),
  id_artigo_vinted    TEXT,
  url_conversa        TEXT,
  data_atualizacao    TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Remover FK/constraints antigas (schema-vinted.sql)
ALTER TABLE public.conversas DROP CONSTRAINT IF EXISTS conversas_id_artigo_vinted_fkey;
ALTER TABLE public.artigos_vinted DROP CONSTRAINT IF EXISTS artigos_vinted_id_artigo_key;
ALTER TABLE public.conversas DROP CONSTRAINT IF EXISTS conversas_id_vinted_key;
ALTER TABLE public.artigos_vinted DROP CONSTRAINT IF EXISTS artigos_vinted_user_artigo_unique;
ALTER TABLE public.conversas DROP CONSTRAINT IF EXISTS conversas_user_vinted_unique;

-- Colunas novas
ALTER TABLE public.artigos ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.artigos_vinted ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS aberta_em TIMESTAMPTZ;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS item_fechado BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.artigos ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.artigos_vinted ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.conversas ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Unique por utilizador
ALTER TABLE public.artigos_vinted ADD CONSTRAINT artigos_vinted_user_artigo_unique UNIQUE (user_id, id_artigo);
ALTER TABLE public.conversas ADD CONSTRAINT conversas_user_vinted_unique UNIQUE (user_id, id_vinted);

-- View
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

-- Índices
CREATE INDEX IF NOT EXISTS idx_artigos_vinted_status ON public.artigos_vinted (status_artigo);
CREATE INDEX IF NOT EXISTS idx_conversas_inbox ON public.conversas (status_inbox, data_atualizacao DESC);
CREATE INDEX IF NOT EXISTS idx_conversas_aberta ON public.conversas (aberta_em);

-- Perfis + sync secret (extensão Chrome)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sync_secret TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

INSERT INTO public.profiles (id, sync_secret)
SELECT id, encode(gen_random_bytes(24), 'hex')
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- RLS (privado por utilizador)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artigos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artigos_vinted ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dev: acesso total artigos_vinted" ON public.artigos_vinted;
DROP POLICY IF EXISTS "Dev: acesso total conversas" ON public.conversas;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "artigos_own" ON public.artigos;
DROP POLICY IF EXISTS "artigos_vinted_own" ON public.artigos_vinted;
DROP POLICY IF EXISTS "conversas_own" ON public.conversas;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "artigos_own" ON public.artigos FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "artigos_vinted_own" ON public.artigos_vinted FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "conversas_own" ON public.conversas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- FIM — Success. No rows returned
