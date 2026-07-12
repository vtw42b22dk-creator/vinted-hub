-- ============================================================
-- SCHEMA VINTED — Inbox + Inventário Auto-Sync
-- Executar no Supabase SQL Editor (depois do schema.sql base)
-- ============================================================

CREATE TYPE status_inbox AS ENUM (
  'por_responder',
  'proposta_recebida',
  'proposta_enviada',
  'em_negociacao',
  'arquivada'
);

CREATE TYPE status_negocio AS ENUM (
  'sem_proposta',
  'proposta_pendente',
  'aceite',
  'recusada',
  'expirada'
);

CREATE TYPE status_artigo_vinted AS ENUM (
  'ativo',
  'reservado',
  'vendido',
  'rascunho',
  'oculto'
);

CREATE TABLE public.artigos_vinted (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_artigo         TEXT NOT NULL UNIQUE,
  nome              TEXT NOT NULL,
  marca             TEXT,
  tamanho           TEXT,
  preco_venda       NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (preco_venda >= 0),
  preco_custo       NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (preco_custo >= 0),
  status_artigo     status_artigo_vinted NOT NULL DEFAULT 'ativo',
  foto_url          TEXT,
  url_vinted        TEXT,
  sincronizado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE VIEW public.artigos_vinted_com_lucro AS
SELECT
  *,
  (preco_venda - preco_custo) AS lucro_bruto,
  CASE
    WHEN preco_venda > 0 THEN ROUND(((preco_venda - preco_custo) / preco_venda) * 100, 1)
    ELSE 0
  END AS margem_percentual
FROM public.artigos_vinted;

CREATE INDEX idx_artigos_vinted_status ON public.artigos_vinted (status_artigo);
CREATE INDEX idx_artigos_vinted_sync ON public.artigos_vinted (sincronizado_em DESC);

CREATE TABLE public.conversas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_vinted           TEXT NOT NULL UNIQUE,
  user_comprador      TEXT NOT NULL,
  avatar_comprador    TEXT,
  ultimo_texto        TEXT,
  ultima_mensagem_de  TEXT NOT NULL DEFAULT 'comprador'
                        CHECK (ultima_mensagem_de IN ('comprador', 'vendedor')),
  status_inbox        status_inbox NOT NULL DEFAULT 'por_responder',
  status_negocio      status_negocio NOT NULL DEFAULT 'sem_proposta',
  valor_proposta      NUMERIC(10, 2) CHECK (valor_proposta IS NULL OR valor_proposta >= 0),
  id_artigo_vinted    TEXT REFERENCES public.artigos_vinted(id_artigo) ON DELETE SET NULL,
  url_conversa        TEXT,
  data_atualizacao    TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversas_inbox ON public.conversas (status_inbox, data_atualizacao DESC);
CREATE INDEX idx_conversas_comprador ON public.conversas (user_comprador);

CREATE OR REPLACE FUNCTION public.set_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_artigos_vinted_updated
  BEFORE UPDATE ON public.artigos_vinted
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

ALTER TABLE public.artigos_vinted ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dev: acesso total artigos_vinted"
  ON public.artigos_vinted FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Dev: acesso total conversas"
  ON public.conversas FOR ALL USING (true) WITH CHECK (true);
