-- ============================================================
-- SETUP COMPLETO — Executar UMA VEZ no Supabase SQL Editor
-- Cria tabelas Vinted + dados demo + desativa RLS para testes
-- ============================================================

-- Tipos (ignorar erro se já existirem)
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

-- Tabela artigos manual (se ainda não existir)
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

-- Tabela artigos Vinted
CREATE TABLE IF NOT EXISTS public.artigos_vinted (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_artigo         TEXT NOT NULL UNIQUE,
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

CREATE OR REPLACE VIEW public.artigos_vinted_com_lucro AS
SELECT *, (preco_venda - preco_custo) AS lucro_bruto,
  CASE WHEN preco_venda > 0 THEN ROUND(((preco_venda - preco_custo) / preco_venda) * 100, 1) ELSE 0 END AS margem_percentual
FROM public.artigos_vinted;

-- Tabela conversas
CREATE TABLE IF NOT EXISTS public.conversas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_vinted           TEXT NOT NULL UNIQUE,
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

-- Índices
CREATE INDEX IF NOT EXISTS idx_artigos_vinted_status ON public.artigos_vinted (status_artigo);
CREATE INDEX IF NOT EXISTS idx_conversas_inbox ON public.conversas (status_inbox, data_atualizacao DESC);

-- RLS desativado para arrancar já (reativar com auth depois)
ALTER TABLE public.artigos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.artigos_vinted DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversas DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- DADOS DEMO
-- ============================================================

INSERT INTO public.artigos_vinted (id_artigo, nome, marca, tamanho, preco_venda, preco_custo, status_artigo, url_vinted)
VALUES
  ('100001', 'Camisola Nike Dri-FIT', 'Nike', 'M', 22.00, 5.00, 'ativo', 'https://www.vinted.pt/items/100001'),
  ('100002', 'Casaco Zara Wool', 'Zara', 'L', 35.00, 8.00, 'ativo', 'https://www.vinted.pt/items/100002'),
  ('100003', 'Calças Levi''s 501', 'Levi''s', '32', 28.00, 7.00, 'reservado', 'https://www.vinted.pt/items/100003'),
  ('100004', 'Vestido Mango', 'Mango', 'S', 18.00, 4.00, 'vendido', 'https://www.vinted.pt/items/100004'),
  ('100005', 'Sweater H&M', 'H&M', 'M', 12.00, 3.00, 'ativo', 'https://www.vinted.pt/items/100005')
ON CONFLICT (id_artigo) DO NOTHING;

INSERT INTO public.conversas (id_vinted, user_comprador, ultimo_texto, ultima_mensagem_de, status_inbox, status_negocio, valor_proposta, id_artigo_vinted, url_conversa, data_atualizacao)
VALUES
  ('conv-001', 'maria_pt', 'Olá! Aceitas 18€ pela camisola Nike?', 'comprador', 'proposta_recebida', 'proposta_pendente', 18.00, '100001', 'https://www.vinted.pt/inbox/conv-001', now() - interval '5 minutes'),
  ('conv-002', 'joao_vintage', 'Ainda está disponível?', 'comprador', 'por_responder', 'sem_proposta', NULL, '100002', 'https://www.vinted.pt/inbox/conv-002', now() - interval '20 minutes'),
  ('conv-003', 'ana_style', 'Enviei proposta de 25€', 'vendedor', 'proposta_enviada', 'proposta_pendente', 25.00, '100003', 'https://www.vinted.pt/inbox/conv-003', now() - interval '1 hour'),
  ('conv-004', 'pedro_deals', 'Posso pagar 30€ se enviar hoje?', 'comprador', 'em_negociacao', 'proposta_pendente', 30.00, '100002', 'https://www.vinted.pt/inbox/conv-004', now() - interval '2 hours'),
  ('conv-005', 'sofia_shop', 'Obrigada! Quando envias?', 'comprador', 'por_responder', 'aceite', NULL, '100004', 'https://www.vinted.pt/inbox/conv-005', now() - interval '30 minutes')
ON CONFLICT (id_vinted) DO NOTHING;

INSERT INTO public.artigos (nome, marca, tamanho, estado_artigo, preco_custo, preco_venda_previsto, status)
SELECT 'Blusa vintage manual', 'Pull&Bear', 'S', 'Bom', 3.00, 15.00, 'Em Stock'
WHERE NOT EXISTS (SELECT 1 FROM public.artigos WHERE nome = 'Blusa vintage manual');
